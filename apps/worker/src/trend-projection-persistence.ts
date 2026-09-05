import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { queueAutomaticSelectionEvaluation } from "./automatic-selection-evaluation-worker.js";
import { refreshRuleRecommendation } from "./rule-recommendation.js";
import { TrendProjectionAlerts } from "./trend-projection-alerts.js";
import {
  buildSupplierSearchQuery,
  calculateTrendProjection,
  isConcreteProductEvidence,
  TrendProjectionError,
  type TrendProjectionJob,
} from "./trend-projection-calculation.js";

export class TrendProjectionPersistence {
  private readonly alerts: TrendProjectionAlerts;

  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly now: () => Date,
  ) {
    this.alerts = new TrendProjectionAlerts(workerId, now);
  }

  async project(job: TrendProjectionJob) {
    const {
        title,
        normalizedTitle,
        publisher,
        canonicalUrl,
        publishedAt,
        observedAt,
        providerContext,
        topicKey,
      } = calculateTrendProjection(job),
      now = this.now(),
      c = await this.pool.getConnection();
    let stage = "begin";
    try {
      await c.beginTransaction();
      stage = "topic_lookup";
      const [topics] = await c.query<RowDataPacket[]>(
        "SELECT id FROM trend_topics WHERE organization_id=? AND workspace_id=? AND topic_key=? FOR UPDATE",
        [job.organizationId, job.workspaceId, topicKey],
      );
      const topicId = topics[0] ? String(topics[0].id) : randomUUID();
      if (!topics[0]) {
        stage = "topic_insert";
        await c.query(
          "INSERT INTO trend_topics (id,organization_id,workspace_id,topic_key,title,category,market,language,status,signal_count,source_count,heat_value,heat_unit,momentum_percent,confidence_score,confidence_status,first_seen_at,last_seen_at,source_fresh_at,version,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'active',0,0,0,'signals',NULL,NULL,'insufficient_data',?,?,?,1,?,?,?)",
          [
            topicId,
            job.organizationId,
            job.workspaceId,
            topicKey,
            title,
            providerContext.category,
            providerContext.market,
            providerContext.language,
            publishedAt,
            publishedAt,
            observedAt,
            job.actorId,
            now,
            now,
          ],
        );
      }
      if (topics[0] && providerContext.category)
        await c.query("UPDATE trend_topics SET category=COALESCE(category,?) WHERE id=?", [
          providerContext.category,
          topicId,
        ]);
      stage = "signal_insert";
      const signalId = randomUUID();
      const [insert] = await c.query<ResultSetHeader>(
        "INSERT IGNORE INTO trend_signals (id,organization_id,workspace_id,topic_id,normalized_record_id,raw_evidence_id,provider_id,title,publisher,canonical_url,published_at,observed_at,request_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          signalId,
          job.organizationId,
          job.workspaceId,
          topicId,
          job.normalizedRecordId,
          job.rawEvidenceId,
          job.providerId,
          title,
          publisher,
          canonicalUrl,
          publishedAt,
          observedAt,
          job.requestId,
          job.traceId,
          now,
        ],
      );
      if (insert.affectedRows) {
        stage = "topic_aggregate";
        await c.query(
          "UPDATE trend_topics t SET signal_count=(SELECT COUNT(*) FROM trend_signals s WHERE s.topic_id=t.id),source_count=(SELECT COUNT(DISTINCT provider_id) FROM trend_signals s WHERE s.topic_id=t.id),heat_value=(SELECT COUNT(*) FROM trend_signals s WHERE s.topic_id=t.id),first_seen_at=(SELECT MIN(published_at) FROM trend_signals s WHERE s.topic_id=t.id),last_seen_at=(SELECT MAX(published_at) FROM trend_signals s WHERE s.topic_id=t.id),source_fresh_at=GREATEST(source_fresh_at,?),version=version+1,updated_at=? WHERE t.id=?",
          [observedAt, now, topicId],
        );
        stage = "keyword_insert";
        await c.query(
          "INSERT IGNORE INTO trend_topic_keywords (id,organization_id,workspace_id,topic_id,keyword,keyword_type,language,market,created_at) VALUES (?,?,?,?,?,'primary',?,?,?)",
          [
            randomUUID(),
            job.organizationId,
            job.workspaceId,
            topicId,
            normalizedTitle.slice(0, 300),
            providerContext.language,
            providerContext.market,
            now,
          ],
        );
        stage = "monitoring_rules";
        const matchedRuleIds = await this.alerts.evaluateMonitoringRules(
          c,
          job,
          topicId,
          normalizedTitle,
          providerContext.market,
          providerContext.language,
          providerContext.category,
          now,
        );
        stage = "event_insert";
        await this.alerts.writeTrendEvent(c, job, "trend.topic.projected", "trend_topic", topicId, {
          normalized_record_id: job.normalizedRecordId,
          provider_code: job.providerCode,
          market: providerContext.market,
          language: providerContext.language,
          heat_unit: "signals",
        });
        if (matchedRuleIds.length && isConcreteProductEvidence(job.payload, canonicalUrl)) {
          stage = "automatic_product_discovery";
          await this.discoverOpportunity(
            c,
            job,
            topicId,
            signalId,
            title,
            canonicalUrl,
            providerContext.market,
            providerContext.category,
            matchedRuleIds,
            observedAt,
            now,
          );
        }
      }
      stage = "job_complete";
      await c.query(
        "UPDATE trend_projection_jobs SET status='succeeded',lease_owner=NULL,lease_expires_at=NULL,last_error_code=NULL,updated_at=? WHERE id=? AND status='leased' AND lease_owner=?",
        [now, job.id, this.workerId],
      );
      await c.commit();
      return topicId;
    } catch (error) {
      await c.rollback();
      if (error instanceof TrendProjectionError) throw error;
      const wrapped = new Error(
        `${stage}: ${error instanceof Error ? error.message : "unknown"}`,
      ) as Error & { code?: string };
      const code = (error as { code?: string })?.code;
      if (code) wrapped.code = code;
      throw wrapped;
    } finally {
      c.release();
    }
  }
  async enqueueMissingAutomaticDownstream() {
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const providers = await this.downstreamProviders(c),
        [rows] = await c.query<RowDataPacket[]>(
          `SELECT o.id opportunity_id,o.organization_id,o.workspace_id,o.name,o.market,o.created_by,
                  c.id competitor_id,c.external_id,c.product_url,c.latest_snapshot_id,
                  se.resource_id search_id,
                  (c.latest_snapshot_id IS NULL AND cq.competitor_id IS NULL) competitor_task_missing,
                  (se.resource_id IS NOT NULL AND sq.search_id IS NULL) sourcing_task_missing
           FROM opportunities o
           JOIN competitors c
             ON c.opportunity_id=o.id
            AND c.organization_id=o.organization_id
            AND c.workspace_id=o.workspace_id
            AND c.deleted_at IS NULL
           LEFT JOIN sourcing_events se
             ON se.organization_id=o.organization_id
            AND se.workspace_id=o.workspace_id
            AND se.event_type='sourcing.search.seeded_from_opportunity'
            AND JSON_UNQUOTE(JSON_EXTRACT(se.payload_json,'$.opportunity_id'))=CONVERT(o.id USING utf8mb4) COLLATE utf8mb4_bin
           LEFT JOIN (
             SELECT q.organization_id,q.workspace_id,
                    JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.competitor_id')) competitor_id
             FROM collection_subqueries q
             WHERE JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='competitor_snapshot'
               AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.page_url')) IS NOT NULL
             GROUP BY q.organization_id,q.workspace_id,competitor_id
           ) cq
             ON cq.organization_id=o.organization_id
            AND cq.workspace_id=o.workspace_id
            AND cq.competitor_id=CONVERT(c.id USING utf8mb4) COLLATE utf8mb4_bin
           LEFT JOIN (
             SELECT q.organization_id,q.workspace_id,
                    JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.search_id')) search_id
             FROM collection_subqueries q
             WHERE JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='sourcing_search'
               AND CHAR_LENGTH(JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.query'))) BETWEEN 1 AND 300
               AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.query_contract'))='supplier-keywords-v2'
             GROUP BY q.organization_id,q.workspace_id,search_id
           ) sq
             ON sq.organization_id=o.organization_id
            AND sq.workspace_id=o.workspace_id
            AND sq.search_id=CONVERT(se.resource_id USING utf8mb4) COLLATE utf8mb4_bin
           WHERE o.source_type='trend_topic'
             AND o.lifecycle_status<>'deleted'
             AND (
               (c.latest_snapshot_id IS NULL AND cq.competitor_id IS NULL)
               OR
               (se.resource_id IS NOT NULL AND sq.search_id IS NULL)
             )
           ORDER BY o.created_at,o.id
           LIMIT 20 FOR UPDATE`,
        );
      for (const row of rows) {
        const context = {
          organizationId: String(row.organization_id),
          workspaceId: String(row.workspace_id),
          actorId: String(row.created_by),
          requestId: `auto-downstream-${randomUUID()}`,
          traceId: `auto-downstream-${String(row.opportunity_id)}`,
        };
        if (
          providers.amazon &&
          Boolean(row.competitor_task_missing) &&
          !row.latest_snapshot_id &&
          row.product_url &&
          row.external_id
        ) {
          await this.scheduleCoreCollection(
            c,
            context,
            randomUUID(),
            [
              {
                providerId: providers.amazon,
                required: true,
                target: {
                  page_url: String(row.product_url),
                  asin: String(row.external_id),
                  projection_type: "competitor_snapshot",
                  competitor_id: String(row.competitor_id),
                },
              },
            ],
            "competitor.collection.auto_scheduled",
            now,
          );
        }
        const searchId = row.search_id == null ? null : String(row.search_id),
          supplierProviderIds = [providers.dhgate, providers.madeInChina, providers.ec21].filter(
            (value): value is string => Boolean(value),
          );
        if (searchId && Boolean(row.sourcing_task_missing) && supplierProviderIds.length) {
          const taskId = randomUUID();
          await this.scheduleCoreCollection(
            c,
            context,
            taskId,
            supplierProviderIds.map((providerId) => ({
              providerId,
              required: false,
              target: {
                query: buildSupplierSearchQuery(String(row.name)),
                query_contract: "supplier-keywords-v2",
                projection_type: "sourcing_search",
                search_id: searchId,
              },
            })),
            "sourcing.collection.auto_scheduled",
            now,
          );
          await c.query(
            "UPDATE sourcing_searches SET collection_task_id=?,input_ref=?,status='queued',candidate_count=0,missing_fields_json='[]',updated_at=? WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL",
            [
              taskId,
              row.opportunity_id,
              now,
              searchId,
              context.organizationId,
              context.workspaceId,
            ],
          );
        }
      }
      await c.commit();
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }

  private async downstreamProviders(c: PoolConnection) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT id,code FROM providers WHERE code IN ('amazon_product','dhgate_supplier_search','made_in_china_search','ec21_supplier_search') AND status='enabled' AND access_mode='public_page'",
    );
    const values = new Map(rows.map((row) => [String(row.code), String(row.id)]));
    return {
      amazon: values.get("amazon_product") ?? null,
      dhgate: values.get("dhgate_supplier_search") ?? null,
      madeInChina: values.get("made_in_china_search") ?? null,
      ec21: values.get("ec21_supplier_search") ?? null,
    };
  }

  private async scheduleCoreCollection(
    c: PoolConnection,
    context: {
      organizationId: string;
      workspaceId: string;
      actorId: string;
      requestId: string;
      traceId: string;
    },
    taskId: string,
    subqueries: Array<{
      providerId: string;
      required: boolean;
      target: Record<string, unknown>;
    }>,
    eventType: string,
    now: Date,
  ) {
    if (!subqueries.length) return;
    await c.query(
      "INSERT INTO collection_tasks(id,organization_id,workspace_id,status,coverage_status,priority,scheduled_at,available_at,attempt_count,successful_subquery_count,failed_subquery_count,blocked_subquery_count,available_result_count,missing_fields_json,request_id,trace_id,version,created_by,created_at,updated_at) VALUES(?,?,?,'scheduled',NULL,'high',?,?,0,0,0,0,0,'[]',?,?,1,?,?,?)",
      [
        taskId,
        context.organizationId,
        context.workspaceId,
        now,
        now,
        context.requestId,
        context.traceId,
        context.actorId,
        now,
        now,
      ],
    );
    for (let index = 0; index < subqueries.length; index += 1) {
      const subquery = subqueries[index]!;
      await c.query(
        "INSERT INTO collection_subqueries(id,task_id,organization_id,workspace_id,provider_id,ordinal,target_json,is_required,status,available_result_count,missing_fields_json,error_code,retryable,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'pending',0,'[]',NULL,0,1,?,?)",
        [
          randomUUID(),
          taskId,
          context.organizationId,
          context.workspaceId,
          subquery.providerId,
          index + 1,
          JSON.stringify(subquery.target),
          subquery.required ? 1 : 0,
          now,
          now,
        ],
      );
    }
    await c.query(
      "INSERT INTO collection_task_events(id,task_id,organization_id,workspace_id,event_type,from_status,to_status,actor_type,actor_id,request_id,trace_id,metadata_json,occurred_at) VALUES(?,?,?,?,?,NULL,'scheduled','worker',?,?,?,?,?)",
      [
        randomUUID(),
        taskId,
        context.organizationId,
        context.workspaceId,
        eventType,
        this.workerId,
        context.requestId,
        context.traceId,
        JSON.stringify({
          automatic: true,
          source: "automatic_product_discovery",
          subquery_count: subqueries.length,
        }),
        now,
      ],
    );
  }

  private async discoverOpportunity(
    c: PoolConnection,
    job: TrendProjectionJob,
    topicId: string,
    signalId: string,
    title: string,
    canonicalUrl: string,
    market: string,
    category: string | null,
    matchedRuleIds: string[],
    observedAt: Date,
    now: Date,
  ) {
    const opportunityId = randomUUID();
    const [insert] = await c.query<ResultSetHeader>(
      "INSERT IGNORE INTO opportunities (id,organization_id,workspace_id,name,market,category,source_type,source_ref_id,owner_id,lifecycle_status,recommendation_status,overall_score,trend_score,competition_score,profit_status,risk_level,confidence_status,confidence_score,evidence_count,source_count,coverage_status,score_rule_version,scored_at,decision_status,version,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,'trend_topic',?,NULL,'ready','insufficient_data',NULL,NULL,NULL,'insufficient_data','unknown','insufficient_data',NULL,0,0,'partial',NULL,NULL,'pending',1,?,?,?)",
      [
        opportunityId,
        job.organizationId,
        job.workspaceId,
        title.slice(0, 200),
        market,
        category,
        topicId,
        job.actorId,
        now,
        now,
      ],
    );
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT id FROM opportunities WHERE organization_id=? AND workspace_id=? AND source_type='trend_topic' AND source_ref_id=? LIMIT 1 FOR UPDATE",
      [job.organizationId, job.workspaceId, topicId],
    );
    const persistedOpportunityId = String(rows[0]?.id ?? opportunityId);
    for (const ruleId of matchedRuleIds)
      await c.query(
        "INSERT IGNORE INTO opportunity_rule_matches (id,organization_id,workspace_id,opportunity_id,monitoring_rule_id,topic_id,matched_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomUUID(),
          job.organizationId,
          job.workspaceId,
          persistedOpportunityId,
          ruleId,
          topicId,
          now,
        ],
      );
    await c.query(
      "INSERT IGNORE INTO opportunity_evidence_links (id,organization_id,workspace_id,opportunity_id,evidence_type,evidence_id,provider_id,raw_evidence_id,observed_at,created_at) VALUES (?,?,?,?,'trend_signal',?,?,?,?,?)",
      [
        randomUUID(),
        job.organizationId,
        job.workspaceId,
        persistedOpportunityId,
        signalId,
        job.providerId,
        job.rawEvidenceId,
        observedAt,
        now,
      ],
    );
    await c.query(
      "UPDATE opportunities o SET evidence_count=(SELECT COUNT(*) FROM opportunity_evidence_links l WHERE l.opportunity_id=o.id),source_count=(SELECT COUNT(DISTINCT provider_id) FROM opportunity_evidence_links l WHERE l.opportunity_id=o.id),coverage_status='partial',lifecycle_status=IF(lifecycle_status='candidate','ready',lifecycle_status),version=IF(?,version,version+1),updated_at=? WHERE o.id=?",
      [insert.affectedRows, now, persistedOpportunityId],
    );
    const ruleRecommendation = await refreshRuleRecommendation(c, {
      organizationId: job.organizationId,
      workspaceId: job.workspaceId,
      opportunityId: persistedOpportunityId,
      actorType: "worker",
      actorId: this.workerId,
      requestId: job.requestId,
      traceId: job.traceId,
      now,
    });
    await queueAutomaticSelectionEvaluation(c, {
      organizationId: job.organizationId,
      workspaceId: job.workspaceId,
      opportunityId: persistedOpportunityId,
      now,
    });
    if (job.providerCode === "1688_search")
      await c.query(
        "UPDATE automatic_selection_evaluations SET status=IF(status='leased',status,'queued')," +
          "available_at=IF(status='leased',available_at,?),last_error_code=IF(status='leased',last_error_code,NULL)," +
          "updated_at=? WHERE organization_id=? AND workspace_id=? AND status IN " +
          "('waiting_evidence','waiting_profit','succeeded','failed_terminal','dead_letter') AND EXISTS " +
          "(SELECT 1 FROM opportunities o JOIN opportunity_rule_matches m ON m.opportunity_id=o.id " +
          "AND m.organization_id=o.organization_id AND m.workspace_id=o.workspace_id JOIN " +
          "trend_monitoring_rules r ON r.id=m.monitoring_rule_id AND r.organization_id=m.organization_id " +
          "AND r.workspace_id=m.workspace_id WHERE o.id=automatic_selection_evaluations.opportunity_id " +
          "AND o.organization_id=automatic_selection_evaluations.organization_id AND " +
          "o.workspace_id=automatic_selection_evaluations.workspace_id AND o.decision_status='pending' " +
          "AND r.status='enabled' AND o.source_count>=r.recommendation_min_source_count)",
        [now, now, job.organizationId, job.workspaceId],
      );
    if (insert.affectedRows) {
      await this.alerts.writeOpportunityDiscovery(
        c,
        job,
        persistedOpportunityId,
        {
          source_type: "trend_topic",
          source_ref_id: topicId,
          provider_code: job.providerCode,
          recommendation_status: ruleRecommendation.changed
            ? ruleRecommendation.recommendationStatus
            : "insufficient_data",
          discovery_mode: "automatic",
          matched_rule_ids: matchedRuleIds,
        },
        now,
      );
      await this.createDownstreamDiscovery(
        c,
        job,
        persistedOpportunityId,
        title,
        canonicalUrl,
        market,
        now,
      );
      const [activeScoreRules] = await c.query<RowDataPacket[]>(
        "SELECT id FROM score_rules WHERE organization_id=? AND workspace_id=? AND status='active' ORDER BY activated_at DESC,id DESC LIMIT 1",
        [job.organizationId, job.workspaceId],
      );
      if (activeScoreRules[0]) {
        await c.query(
          "INSERT INTO opportunity_score_jobs (id,organization_id,workspace_id,opportunity_id,score_rule_id,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES (?,?,?,?,?,'queued',0,?,?,?,?,?)",
          [
            randomUUID(),
            job.organizationId,
            job.workspaceId,
            persistedOpportunityId,
            activeScoreRules[0].id,
            now,
            job.requestId,
            job.traceId,
            now,
            now,
          ],
        );
      }
    }
  }

  private async createDownstreamDiscovery(
    c: PoolConnection,
    job: TrendProjectionJob,
    opportunityId: string,
    title: string,
    canonicalUrl: string,
    market: string,
    now: Date,
  ) {
    const asin = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i
      .exec(canonicalUrl)?.[1]
      ?.toUpperCase();
    let competitorId: string | null = null;
    if (asin) {
      const proposedCompetitorId = randomUUID();
      await c.query(
        "INSERT IGNORE INTO competitors (id,organization_id,workspace_id,opportunity_id,provider_id,market,source_site,external_id,product_url,title,status,latest_snapshot_id,revision,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,'Amazon',?,?,?,'active',NULL,1,?,?,?)",
        [
          proposedCompetitorId,
          job.organizationId,
          job.workspaceId,
          opportunityId,
          job.providerId,
          market,
          asin,
          canonicalUrl,
          title.slice(0, 500),
          job.actorId,
          now,
          now,
        ],
      );
      const [competitors] = await c.query<RowDataPacket[]>(
        "SELECT id FROM competitors WHERE organization_id=? AND workspace_id=? AND market=? AND source_site='Amazon' AND external_id=? AND deleted_at IS NULL LIMIT 1 FOR UPDATE",
        [job.organizationId, job.workspaceId, market, asin],
      );
      competitorId = String(competitors[0]?.id ?? proposedCompetitorId);
    }
    const searchId = randomUUID(),
      providers = await this.downstreamProviders(c),
      supplierProviderIds = [providers.madeInChina, providers.ec21].filter(
        (value): value is string => Boolean(value),
      ),
      supplierTaskId = supplierProviderIds.length ? randomUUID() : job.collectionTaskId;
    if (supplierProviderIds.length)
      await this.scheduleCoreCollection(
        c,
        {
          organizationId: job.organizationId,
          workspaceId: job.workspaceId,
          actorId: job.actorId,
          requestId: job.requestId,
          traceId: job.traceId,
        },
        supplierTaskId,
        supplierProviderIds.map((providerId) => ({
          providerId,
          required: false,
          target: {
            query: buildSupplierSearchQuery(title),
            query_contract: "supplier-keywords-v2",
            projection_type: "sourcing_search",
            search_id: searchId,
          },
        })),
        "sourcing.collection.auto_scheduled",
        now,
      );
    await c.query(
      "INSERT INTO sourcing_searches (id,organization_id,workspace_id,collection_task_id,input_type,input_ref,status,candidate_count,missing_fields_json,request_id,trace_id,created_by,created_at,updated_at) VALUES (?,?,?,?,'opportunity',?,'queued',0,'[]',?,?,?,?,?)",
      [
        searchId,
        job.organizationId,
        job.workspaceId,
        supplierTaskId,
        opportunityId,
        job.requestId,
        job.traceId,
        job.actorId,
        now,
        now,
      ],
    );
    if (competitorId && asin && providers.amazon) {
      await this.scheduleCoreCollection(
        c,
        {
          organizationId: job.organizationId,
          workspaceId: job.workspaceId,
          actorId: job.actorId,
          requestId: job.requestId,
          traceId: job.traceId,
        },
        randomUUID(),
        [
          {
            providerId: providers.amazon,
            required: true,
            target: {
              page_url: canonicalUrl,
              asin,
              projection_type: "competitor_snapshot",
              competitor_id: competitorId,
            },
          },
        ],
        "competitor.collection.auto_scheduled",
        now,
      );
    }
    if (!supplierProviderIds.length) {
      await c.query(
        "UPDATE sourcing_searches SET status='succeeded_empty',missing_fields_json=?,updated_at=? WHERE id=?",
        [JSON.stringify(["supplier_crawler"]), now, searchId],
      );
    }
    await c.query(
      "INSERT INTO sourcing_events (id,organization_id,workspace_id,event_type,resource_id,actor_id,payload_json,request_id,trace_id,created_at) VALUES (?,?,?,'sourcing.search.seeded_from_opportunity',?,'ai-selection-worker',?,?,?,?)",
      [
        randomUUID(),
        job.organizationId,
        job.workspaceId,
        searchId,
        JSON.stringify({ opportunity_id: opportunityId, candidate_count: 0 }),
        job.requestId,
        job.traceId,
        now,
      ],
    );
  }
}
