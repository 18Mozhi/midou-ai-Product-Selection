import { activeCollectionScopeSql } from "./collection-source-scheduling-policy.js";
import { recoverCircuitHeldSourcing } from "./automatic-sourcing-retry-policy.js";
import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { queueAutomaticSelectionEvaluation } from "./automatic-selection-evaluation-worker.js";
import { refreshRuleRecommendation } from "./rule-recommendation.js";
import { TrendProjectionAlerts } from "./trend-projection-alerts.js";
import { amazonAsin } from "./competitor-discovery-policy.js";
import {
  automaticPrimaryImageSql,
  automaticPrimaryTitleSql,
} from "./automatic-selection-evidence.js";
import { selectionPrimaryAsinSql, selectionCompetitionGateSql } from "@scoutops/database";
import {
  buildSupplierSearchQuery,
  calculateTrendProjection,
  isAutomaticProductDiscoveryProvider,
  TrendProjectionError,
  type TrendProjectionJob,
} from "./trend-projection-calculation.js";

export class TrendProjectionPersistence {
  private preferCompetitorDiscovery = false;
  private nextCompetitorDiscoveryScanAt = 0;
  private readonly alerts: TrendProjectionAlerts;

  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly now: () => Date,
    private readonly refreshIntervalSeconds = 3600,
    private readonly queueBacklogLimit = 1000,
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
      const [lease] = await c.query<RowDataPacket[]>(
        "SELECT id FROM trend_projection_jobs WHERE id=? AND status='leased' AND lease_owner=? AND lease_expires_at>? FOR UPDATE",
        [job.id, this.workerId, now],
      );
      if (!lease[0]) throw new TrendProjectionError("trend_projection_lease_lost", true);
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
        if (job.intelligenceAssociation) {
          await this.alerts.writeTrendEvent(
            c,
            job,
            "trend.intelligence.associated",
            "trend_topic",
            topicId,
            {
              normalized_record_id: job.normalizedRecordId,
              association: job.intelligenceAssociation,
              model: job.intelligenceModel,
              contract: "intelligence-product-v1",
              evidence_status: "hypothesis",
            },
          );
          if (job.intelligenceAssociation.queries.length) {
            const [providers] = await c.query<RowDataPacket[]>(
              "SELECT id FROM providers WHERE code='amazon_product' LIMIT 1",
            );
            if (!providers[0])
              throw new TrendProjectionError("intelligence_amazon_provider_missing", true);
            for (const query of job.intelligenceAssociation.queries)
              await this.scheduleCoreCollection(
                c,
                job,
                randomUUID(),
                [
                  {
                    providerId: String(providers[0].id),
                    required: true,
                    target: {
                      query,
                      projection_type: "intelligence_product_discovery",
                      intelligence_source_record_id: job.normalizedRecordId,
                    },
                  },
                ],
                "intelligence.product_search.auto_scheduled",
                now,
              );
          }
        }
        if (
          (matchedRuleIds.length ||
            job.primarySelectionRationale ||
            isAutomaticProductDiscoveryProvider(job.providerCode)) &&
          amazonAsin(job.payload, canonicalUrl)
        ) {
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
    if (
      await recoverCircuitHeldSourcing(
        this.pool,
        async (connection, row, taskId, target, requestId, traceId) => {
          await this.scheduleCoreCollection(
            connection,
            {
              organizationId: String(row.organization_id),
              workspaceId: String(row.workspace_id),
              actorId: String(row.created_by),
              requestId,
              traceId,
            },
            taskId,
            [{ providerId: String(row.provider_id), required: true, target }],
            "sourcing.collection.auto_scheduled",
            this.now(),
          );
        },
        this.now(),
      )
    )
      return;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const providers = await this.downstreamProviders(c);
      if (!providers.amazon && !providers.alibaba1688) {
        await c.commit();
        return;
      }
      // Materialize actionable identities before resolving their primary/image.
      // Outer real competitor/search rows retain the existing locking boundary.
      const [rows] = await c.query<RowDataPacket[]>(
        `SELECT o.id opportunity_id,o.organization_id,o.workspace_id,o.name,o.market,o.created_by,
                  c.id competitor_id,c.external_id,c.product_url,c.latest_snapshot_id,
                  ss.id search_id,
                  ${automaticPrimaryImageSql} primary_image_url,
                  (c.latest_snapshot_id IS NULL AND o.prior_competitor_task IS NULL) competitor_task_missing,
                  (ss.id IS NOT NULL AND o.prior_sourcing_task IS NULL) sourcing_task_missing
           FROM (
             SELECT o.*,${selectionPrimaryAsinSql} primary_asin FROM (
               SELECT o.*,c.id repair_competitor_id,ss.id repair_search_id,
                      ss.collection_task_id previous_collection_task_id,
                      cq.competitor_id prior_competitor_task,sq.search_id prior_sourcing_task
               FROM opportunities o JOIN competitors c
             ON c.opportunity_id=o.id
            AND c.organization_id=o.organization_id
            AND c.workspace_id=o.workspace_id
            AND c.deleted_at IS NULL
           LEFT JOIN (
             SELECT organization_id,workspace_id,resource_id,
                    JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.opportunity_id')) opportunity_id
             FROM sourcing_events
             WHERE event_type='sourcing.search.seeded_from_opportunity'
             GROUP BY organization_id,workspace_id,resource_id,opportunity_id
           ) se
             ON se.organization_id=o.organization_id
            AND se.workspace_id=o.workspace_id
            AND se.opportunity_id=CONVERT(o.id USING utf8mb4) COLLATE utf8mb4_bin
           LEFT JOIN sourcing_searches ss
             ON ss.id=se.resource_id AND ss.organization_id=o.organization_id
            AND ss.workspace_id=o.workspace_id AND ss.input_type='opportunity'
            AND ss.input_ref=o.id AND ss.deleted_at IS NULL
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
             JOIN providers p_supply ON p_supply.id=q.provider_id AND p_supply.code='1688_search'
             WHERE JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='sourcing_search'
               AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.image_url')) IS NOT NULL
               AND CHAR_LENGTH(JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.query'))) BETWEEN 1 AND 300
               AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.query_contract'))='supplier-keywords-v2'
             GROUP BY q.organization_id,q.workspace_id,search_id
           ) sq
             ON sq.organization_id=o.organization_id
            AND sq.workspace_id=o.workspace_id
            AND sq.search_id=CONVERT(ss.id USING utf8mb4) COLLATE utf8mb4_bin
               WHERE o.source_type='trend_topic' AND o.lifecycle_status<>'deleted'
                 AND EXISTS (SELECT 1 FROM organizations scope_org
                   JOIN workspaces scope_ws ON scope_ws.organization_id=scope_org.id
                   WHERE scope_org.id=o.organization_id AND scope_org.status='active'
                     AND scope_ws.id=o.workspace_id AND scope_ws.status='active')
                 AND ((? IS NOT NULL AND c.latest_snapshot_id IS NULL AND cq.competitor_id IS NULL)
                   OR (? IS NOT NULL AND ss.id IS NOT NULL AND sq.search_id IS NULL))
               LIMIT 18446744073709551615
             ) o LIMIT 18446744073709551615
           ) o
           STRAIGHT_JOIN competitors c FORCE INDEX (PRIMARY) ON c.id=o.repair_competitor_id
             AND c.organization_id=o.organization_id AND c.workspace_id=o.workspace_id AND c.deleted_at IS NULL
           LEFT JOIN sourcing_searches ss ON ss.id=o.repair_search_id
             AND ss.organization_id=o.organization_id AND ss.workspace_id=o.workspace_id
             AND ss.input_ref=o.id AND ss.deleted_at IS NULL
           WHERE (ss.id IS NULL OR ss.collection_task_id<=>o.previous_collection_task_id)
           HAVING (competitor_task_missing=1 AND ? IS NOT NULL)
               OR (sourcing_task_missing=1 AND ? IS NOT NULL AND primary_image_url IS NOT NULL)
           ORDER BY o.created_at,o.id
           LIMIT 20 FOR UPDATE`,
        [providers.amazon, providers.alibaba1688, providers.amazon, providers.alibaba1688],
      );
      const scheduledSearches = new Set<string>();
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
          row.external_id &&
          !(await this.existingAutomaticCompetitorTask(c, row, providers.amazon))
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
          imageUrl = row.primary_image_url ? String(row.primary_image_url) : null,
          supplierProviderIds = providers.alibaba1688 && imageUrl ? [providers.alibaba1688] : [];
        const searchKey = `${context.organizationId}:${context.workspaceId}:${searchId}`;
        if (
          searchId &&
          Boolean(row.sourcing_task_missing) &&
          supplierProviderIds.length &&
          !scheduledSearches.has(searchKey)
        ) {
          const taskId = randomUUID();
          await this.scheduleCoreCollection(
            c,
            context,
            taskId,
            supplierProviderIds.map((providerId) => ({
              providerId,
              required: true,
              target: {
                query: buildSupplierSearchQuery(String(row.name)),
                image_url: imageUrl,
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
          scheduledSearches.add(searchKey);
        }
      }
      let periodic: "discovery" | "detail" | null = null;
      let discoveryScanned = false;
      if (!rows.length && providers.amazon) {
        const order: Array<"discovery" | "detail"> = this.preferCompetitorDiscovery
          ? ["discovery", "detail"]
          : ["detail", "discovery"];
        for (const kind of order) {
          // Missing-work repair keeps its original cadence; only the broader
          // discovery scan is bounded to one read per minute in this Worker.
          if (kind === "discovery" && now.getTime() < this.nextCompetitorDiscoveryScanAt) continue;
          const scheduled =
            kind === "discovery"
              ? await this.enqueueDueCompetitorDiscovery(c, providers.amazon, now)
              : await this.enqueueDueCompetitorRefresh(c, providers.amazon, now);
          if (kind === "discovery") discoveryScanned = true;
          if (scheduled) {
            periodic = kind;
            break;
          }
        }
      }
      await c.commit();
      if (periodic) this.preferCompetitorDiscovery = periodic === "detail";
      if (discoveryScanned) this.nextCompetitorDiscoveryScanAt = now.getTime() + 60_000;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }

  private async enqueueDueCompetitorRefresh(c: PoolConnection, providerId: string, now: Date) {
    const before = new Date(now.getTime() - this.refreshIntervalSeconds * 1000);
    const [rows] = await c.query<RowDataPacket[]>(
      `SELECT c.id,c.organization_id,c.workspace_id,c.external_id,c.product_url,o.created_by
       FROM competitors c JOIN opportunities o ON o.id=c.opportunity_id
         AND o.organization_id=c.organization_id AND o.workspace_id=c.workspace_id
       JOIN competitor_snapshots s ON s.id=c.latest_snapshot_id AND s.competitor_id=c.id
         AND s.organization_id=c.organization_id AND s.workspace_id=c.workspace_id
       LEFT JOIN (SELECT organization_id,COUNT(*) active_count FROM collection_tasks
         WHERE ${activeCollectionScopeSql("collection_tasks")} AND status IN ('scheduled','queued','leased','running','parsing','validating','retry_scheduled','rate_limited')
         GROUP BY organization_id) busy ON busy.organization_id=c.organization_id
       LEFT JOIN (SELECT q.organization_id,q.workspace_id,
         JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.competitor_id')) competitor_id
         FROM collection_subqueries q WHERE q.created_at>?
         AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='competitor_snapshot'
         GROUP BY q.organization_id,q.workspace_id,competitor_id) recent
         ON recent.organization_id=c.organization_id AND recent.workspace_id=c.workspace_id
         AND recent.competitor_id=CONVERT(c.id USING utf8mb4) COLLATE utf8mb4_bin
       WHERE ${activeCollectionScopeSql("c")} AND c.status='active' AND c.deleted_at IS NULL AND c.source_site='Amazon'
         AND c.external_id REGEXP '^[A-Z0-9]{10}$'
         AND c.product_url REGEXP CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',c.external_id,'([/?#]|$)')
         AND o.source_type='trend_topic' AND o.lifecycle_status NOT IN ('archived','deleted')
         AND s.captured_at<=?
         AND (SELECT COUNT(*) FROM collection_tasks backlog
           WHERE ${activeCollectionScopeSql("backlog")} AND backlog.status IN ('scheduled','queued','leased','running','parsing','validating','retry_scheduled','rate_limited'))<?
         AND busy.active_count IS NULL AND recent.competitor_id IS NULL
       ORDER BY s.captured_at,c.id LIMIT 1 FOR UPDATE`,
      [before, before, this.queueBacklogLimit],
    );
    const row = rows[0];
    if (!row || !amazonAsin({ asin: row.external_id }, String(row.product_url))) return false;
    await this.scheduleCoreCollection(
      c,
      {
        organizationId: String(row.organization_id),
        workspaceId: String(row.workspace_id),
        actorId: String(row.created_by),
        requestId: `auto-refresh-${randomUUID()}`,
        traceId: `auto-refresh-${String(row.id)}`,
      },
      randomUUID(),
      [
        {
          providerId,
          required: true,
          target: {
            page_url: String(row.product_url),
            asin: String(row.external_id),
            projection_type: "competitor_snapshot",
            competitor_id: String(row.id),
          },
        },
      ],
      "competitor.collection.auto_scheduled",
      now,
    );
    return true;
  }

  private async enqueueDueCompetitorDiscovery(c: PoolConnection, providerId: string, now: Date) {
    const before = new Date(now.getTime() - this.refreshIntervalSeconds * 1000);
    const [rows] = await c.query<RowDataPacket[]>(
      `SELECT o.id discovery_opportunity_id,o.organization_id,o.workspace_id,o.created_by,o.primary_asin,
         ${automaticPrimaryTitleSql} discovery_query
       FROM (SELECT o.*,${selectionPrimaryAsinSql} primary_asin FROM opportunities o
         JOIN (SELECT DISTINCT l_identified.opportunity_id,l_identified.organization_id,l_identified.workspace_id
           FROM normalized_records n_identified
           JOIN providers p_identified ON p_identified.id=n_identified.provider_id AND p_identified.code='amazon_product'
           JOIN opportunity_evidence_links l_identified ON l_identified.raw_evidence_id=n_identified.raw_evidence_id
             AND l_identified.organization_id=n_identified.organization_id AND l_identified.workspace_id=n_identified.workspace_id
           WHERE n_identified.status='active'
             AND JSON_UNQUOTE(JSON_EXTRACT(n_identified.payload_json,'$.asin')) REGEXP '^[A-Za-z0-9]{10}$') identified
           ON identified.opportunity_id=o.id AND identified.organization_id=o.organization_id AND identified.workspace_id=o.workspace_id
         WHERE o.source_type='trend_topic' AND o.lifecycle_status NOT IN ('archived','deleted')
         HAVING primary_asin REGEXP '^[A-Z0-9]{10}$'
         LIMIT 18446744073709551615) o
       JOIN opportunities locked_opportunity ON locked_opportunity.id=o.id
         AND locked_opportunity.organization_id=o.organization_id AND locked_opportunity.workspace_id=o.workspace_id
       JOIN organizations active_org ON active_org.id=o.organization_id AND active_org.status='active'
       JOIN workspaces active_workspace ON active_workspace.id=o.workspace_id
         AND active_workspace.organization_id=o.organization_id AND active_workspace.status='active'
       LEFT JOIN (SELECT organization_id,COUNT(*) active_count FROM collection_tasks
         WHERE ${activeCollectionScopeSql("collection_tasks")} AND status IN ('scheduled','queued','leased','running','parsing','validating','retry_scheduled','rate_limited')
         GROUP BY organization_id) busy ON busy.organization_id=o.organization_id
       LEFT JOIN (SELECT q.organization_id,q.workspace_id,
         JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.opportunity_id')) opportunity_id,MAX(q.created_at) last_discovery_at
         FROM collection_subqueries q
         WHERE JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='opportunity_competitors'
         GROUP BY q.organization_id,q.workspace_id,opportunity_id) recent
         ON recent.organization_id=o.organization_id AND recent.workspace_id=o.workspace_id
         AND recent.opportunity_id=CONVERT(o.id USING utf8mb4) COLLATE utf8mb4_bin
       WHERE o.primary_asin REGEXP '^[A-Z0-9]{10}$'
         AND locked_opportunity.lifecycle_status NOT IN ('archived','deleted')
         AND (recent.last_discovery_at IS NULL OR recent.last_discovery_at<=?)
         AND busy.active_count IS NULL
         AND (SELECT COUNT(*) FROM collection_tasks backlog WHERE ${activeCollectionScopeSql("backlog")} AND backlog.status IN
           ('scheduled','queued','leased','running','parsing','validating','retry_scheduled','rate_limited'))<?
         AND NOT ${selectionCompetitionGateSql(5, "materialized")}
       HAVING LENGTH(TRIM(discovery_query))>0
       ORDER BY COALESCE(recent.last_discovery_at,o.created_at),o.id LIMIT 1 FOR UPDATE`,
      [before, this.queueBacklogLimit],
    );
    const row = rows[0],
      title = typeof row?.discovery_query === "string" ? row.discovery_query.trim() : "";
    if (!row || !/^[A-Z0-9]{10}$/.test(String(row.primary_asin)) || !title) return false;
    await this.scheduleCoreCollection(
      c,
      {
        organizationId: String(row.organization_id),
        workspaceId: String(row.workspace_id),
        actorId: String(row.created_by),
        requestId: `auto-competitors-${randomUUID()}`,
        traceId: `auto-competitors-${String(row.discovery_opportunity_id)}`,
      },
      randomUUID(),
      [
        {
          providerId,
          required: true,
          target: {
            query: title.slice(0, 300),
            projection_type: "opportunity_competitors",
            opportunity_id: String(row.discovery_opportunity_id),
            main_asin: String(row.primary_asin),
          },
        },
      ],
      "competitor.discovery.auto_scheduled",
      now,
    );
    return true;
  }

  private async existingAutomaticCompetitorTask(
    c: PoolConnection,
    row: RowDataPacket,
    providerId: string,
  ) {
    // Current locking read after the real competitor row is locked: a stale
    // materialized candidate must not create a duplicate after another writer.
    const [existing] = await c.query<RowDataPacket[]>(
      "SELECT q.id FROM collection_subqueries q WHERE q.provider_id=? AND q.organization_id=? AND q.workspace_id=? AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.competitor_id'))=? AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='competitor_snapshot' AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.page_url')) IS NOT NULL LIMIT 1 FOR UPDATE",
      [providerId, row.organization_id, row.workspace_id, row.competitor_id],
    );
    return Boolean(existing[0]);
  }

  private async downstreamProviders(c: PoolConnection) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT id,code FROM providers WHERE code IN ('amazon_product','1688_search') AND status='enabled' AND (code='1688_search' OR access_mode='public_page')",
    );
    const values = new Map(rows.map((row) => [String(row.code), String(row.id)]));
    return {
      amazon: values.get("amazon_product") ?? null,
      alibaba1688: values.get("1688_search") ?? null,
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
    if (job.intelligenceSourceRecordId && job.primarySelectionRationale) {
      await c.query(
        "INSERT IGNORE INTO opportunity_evidence_links (id,organization_id,workspace_id,opportunity_id,evidence_type,evidence_id,provider_id,raw_evidence_id,observed_at,created_at) " +
          "SELECT UUID(),s.organization_id,s.workspace_id,?,'trend_signal',s.id,s.provider_id,s.raw_evidence_id,s.observed_at,? " +
          "FROM trend_signals s WHERE s.normalized_record_id=? AND s.organization_id=? AND s.workspace_id=?",
        [
          persistedOpportunityId,
          now,
          job.intelligenceSourceRecordId,
          job.organizationId,
          job.workspaceId,
        ],
      );
      await this.alerts.writeTrendEvent(
        c,
        job,
        "trend.intelligence.primary_selected",
        "trend_topic",
        topicId,
        {
          normalized_record_id: job.normalizedRecordId,
          intelligence_source_record_id: job.intelligenceSourceRecordId,
          query: job.intelligenceQuery,
          rationale: job.primarySelectionRationale,
          opportunity_id: persistedOpportunityId,
          evidence_status: "hypothesis",
          model: job.intelligenceModel,
          contract: "intelligence-product-v1",
        },
      );
    }
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
      imageUrl = typeof job.payload.image_url === "string" ? job.payload.image_url : null,
      supplierProviderIds = providers.alibaba1688 && imageUrl ? [providers.alibaba1688] : [],
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
          required: true,
          target: {
            query: buildSupplierSearchQuery(title),
            ...(providerId === providers.alibaba1688 ? { image_url: imageUrl } : {}),
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
              query: title.slice(0, 300),
              projection_type: "opportunity_competitors",
              opportunity_id: opportunityId,
              main_asin: asin,
            },
          },
        ],
        "competitor.discovery.auto_scheduled",
        now,
      );
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
        [JSON.stringify(["supplier_crawler", ...(!imageUrl ? ["image_url"] : [])]), now, searchId],
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
