import {
  appendCollectionSubquery,
  collectionTaskScope,
  insertScheduledHighCollectionTask,
} from "@scoutops/database";
import { nativeCompetitorStorage } from "./competitor-storage.js";
import { nativeOpportunityStorage } from "./opportunity-storage.js";
import {
  competitorRefreshNoActiveDetailSql,
  competitorRefreshObservedAtSql,
  competitorRefreshOrderSql,
} from "./competitor-refresh-policy.js";
import {
  activeCollectionScopeSql,
  automaticCollectionBacklogCountSql,
} from "./collection-source-scheduling-policy.js";
import { recoverCircuitHeldSourcing } from "./automatic-sourcing-retry-policy.js";
import { refreshStaleAutomaticSourcing } from "./automatic-sourcing-refresh.js";
import { repairMissingPrimaryProduct } from "./automatic-primary-product-repair.js";
import {
  appendSourcingEvent,
  hasLegacySourcingEventScope,
  sourcingSearchHasLegacyScope,
} from "@scoutops/database";
import {
  findSealedDetailRefresh,
  findWaitingPrimaryDetailRefresh,
} from "./automatic-primary-detail-refresh.js";
import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { queueAutomaticSelectionEvaluation } from "./automatic-selection-evaluation-worker.js";
import { queueOwnedSelectionEvaluation } from "./account-evaluation-enqueue.js";
import { refreshRuleRecommendation } from "./rule-recommendation.js";
import { TrendProjectionAlerts } from "./trend-projection-alerts.js";
import { amazonAsin } from "./competitor-discovery-policy.js";
import {
  automaticPrimaryImageSql,
  hasNativeNormalizedAccountScope,
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
import {
  registerTrendProjectionOwners,
  resolveTrendProjectionOwnership,
  verifyTrendProjectionOwner,
  type TrendProjectionOwnership,
} from "./trend-projection-ownership.js";
import {
  calculationOwnersMatch,
  hasCalculationAccountCutover,
  resolveCalculationOwnership,
} from "./opportunity-calculation-ownership.js";
import { hasLegacyScoreRuleScope } from "./score-rule-scope.js";

export const ownedTrendTopicLookupSql = `SELECT t.id FROM trend_topics t
  JOIN account_owned_records o ON o.source_table='trend_topics' AND o.source_id=t.id AND o.account_id=?
  LEFT JOIN trend_signals existing ON existing.normalized_record_id=? AND existing.topic_id=t.id
  WHERE t.topic_key=? OR existing.id IS NOT NULL
  ORDER BY (existing.id IS NOT NULL) DESC,t.created_at,t.id
  LIMIT 1 FOR UPDATE`;
const nativeTrendTopicLookupSql = ownedTrendTopicLookupSql.replace(
  "WHERE t.topic_key=? OR existing.id IS NOT NULL",
  "WHERE t.account_id=o.account_id AND (t.topic_key=? OR existing.id IS NOT NULL)",
);

export class TrendProjectionPersistence {
  private primaryRepairAfterId = "";
  private preferCompetitorDiscovery = false;
  private preferSourcingRefresh = false;
  private nextCompetitorDiscoveryScanAt = 0;
  private competitorDiscoveryAfterId = "";
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
        "SELECT id FROM trend_projection_jobs WHERE id=? AND normalized_record_id=? AND status='leased' AND lease_owner=? " +
          "AND attempt_count=? AND lease_expires_at>? FOR UPDATE",
        [job.id, job.leasedNormalizedRecordId ?? job.normalizedRecordId, this.workerId, job.attemptCount, now],
      );
      if (!lease[0]) throw new TrendProjectionError("trend_projection_lease_lost", true);
      stage = "evidence_ownership";
      const ownership = await resolveTrendProjectionOwnership(c, job);
      if (ownership?.nativeEvidence)
        await verifyTrendProjectionOwner(c, ownership, ["trend_projection_jobs", job.id]);
      if (job.leasedNormalizedRecordId && job.leasedNormalizedRecordId !== job.normalizedRecordId)
        await verifyTrendProjectionOwner(c, ownership, [
          "normalized_records",
          job.leasedNormalizedRecordId,
        ]);
      if (job.intelligenceSourceRecordId)
        await verifyTrendProjectionOwner(c, ownership, [
          "normalized_records",
          job.intelligenceSourceRecordId,
        ]);
      stage = "topic_lookup";
      const topicOwner = ownership?.nativeEvidence ? ownership.owner?.account_id : undefined;
      let nativeTopic = false;
      if (topicOwner) {
        const [columns] = await c.query<RowDataPacket[]>(
          "SHOW COLUMNS FROM trend_topics WHERE Field IN ('account_id','organization_id','workspace_id')",
        );
        const shape = columns
          .map((row) => row.Field)
          .sort()
          .join(",");
        nativeTopic = shape === "account_id";
        if (!nativeTopic && shape !== "organization_id,workspace_id")
          throw new TrendProjectionError("trend_topic_scope_schema_invalid", false);
        if (nativeTopic) {
          // Historical duplicates are retained; serialize new topic creation without a unique account/topic key.
          const [owner] = await c.query<RowDataPacket[]>(
            "SELECT id FROM users WHERE id=? FOR UPDATE",
            [topicOwner],
          );
          if (!owner[0])
            throw new TrendProjectionError("trend_projection_destination_owner_mismatch", false);
        }
      }
      const [topics] = await c.query<RowDataPacket[]>(
        topicOwner
          ? nativeTopic
            ? nativeTrendTopicLookupSql
            : ownedTrendTopicLookupSql
          : "SELECT id FROM trend_topics WHERE organization_id=? AND workspace_id=? AND topic_key=? FOR UPDATE",
        topicOwner
          ? [topicOwner, job.normalizedRecordId, topicKey]
          : [job.organizationId, job.workspaceId, topicKey],
      );
      const topicId = topics[0] ? String(topics[0].id) : randomUUID();
      if (topics[0]) await verifyTrendProjectionOwner(c, ownership, ["trend_topics", topicId]);
      if (!topics[0]) {
        stage = "topic_insert";
        await c.query(
          `INSERT INTO trend_topics (id,${nativeTopic ? "account_id" : "organization_id,workspace_id"},topic_key,title,category,market,language,status,signal_count,source_count,heat_value,heat_unit,momentum_percent,confidence_score,confidence_status,first_seen_at,last_seen_at,source_fresh_at,version,created_by,created_at,updated_at) VALUES (?,?,${nativeTopic ? "" : "?,"}?,?,?,?,?,'active',0,0,0,'signals',NULL,NULL,'insufficient_data',?,?,?,1,?,?,?)`,
          [
            topicId,
            ...(nativeTopic ? [topicOwner] : [job.organizationId, job.workspaceId]),
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
        await registerTrendProjectionOwners(c, ownership, [["trend_topics", topicId]]);
      }
      if (topics[0] && providerContext.category)
        await c.query("UPDATE trend_topics SET category=COALESCE(category,?) WHERE id=?", [
          providerContext.category,
          topicId,
        ]);
      stage = "signal_insert";
      const signalId = randomUUID();
      const [insert] = await c.query<ResultSetHeader>(
        "INSERT IGNORE INTO trend_signals (id,topic_id,normalized_record_id,raw_evidence_id,provider_id,title,publisher,canonical_url,published_at,observed_at,request_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          signalId,
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
      if (!insert.affectedRows && ownership) {
        const [existing] = await c.query<RowDataPacket[]>(
          "SELECT id FROM trend_signals WHERE normalized_record_id=? AND topic_id=? AND raw_evidence_id=? AND provider_id=? FOR UPDATE",
          [job.normalizedRecordId, topicId, job.rawEvidenceId, job.providerId],
        );
        if (!existing[0])
          throw new TrendProjectionError("trend_projection_signal_not_persisted", false);
        await verifyTrendProjectionOwner(c, ownership, ["trend_signals", String(existing[0].id)]);
      }
      if (insert.affectedRows) {
        await registerTrendProjectionOwners(c, ownership, [["trend_signals", signalId]]);
        stage = "topic_aggregate";
        await c.query(
          "UPDATE trend_topics t SET signal_count=(SELECT COUNT(*) FROM trend_signals s WHERE s.topic_id=t.id),source_count=(SELECT COUNT(DISTINCT provider_id) FROM trend_signals s WHERE s.topic_id=t.id),heat_value=(SELECT COUNT(*) FROM trend_signals s WHERE s.topic_id=t.id),first_seen_at=(SELECT MIN(published_at) FROM trend_signals s WHERE s.topic_id=t.id),last_seen_at=(SELECT MAX(published_at) FROM trend_signals s WHERE s.topic_id=t.id),source_fresh_at=GREATEST(source_fresh_at,?),version=version+1,updated_at=? WHERE t.id=?",
          [observedAt, now, topicId],
        );
        stage = "keyword_insert";
        const keyword = normalizedTitle.slice(0, 300),
          keywordId = randomUUID();
        const [keywordInsert] = await c.query<ResultSetHeader>(
          "INSERT IGNORE INTO trend_topic_keywords (id,topic_id,keyword,keyword_type,language,market,created_at) VALUES (?,?,?,'primary',?,?,?)",
          [keywordId, topicId, keyword, providerContext.language, providerContext.market, now],
        );
        if (keywordInsert.affectedRows)
          await registerTrendProjectionOwners(c, ownership, [["trend_topic_keywords", keywordId]]);
        else if (ownership) {
          const [existing] = await c.query<RowDataPacket[]>(
            "SELECT id FROM trend_topic_keywords WHERE topic_id=? AND keyword=? AND keyword_type='primary' FOR UPDATE",
            [topicId, keyword],
          );
          if (!existing[0])
            throw new TrendProjectionError("trend_projection_keyword_not_persisted", false);
          await verifyTrendProjectionOwner(c, ownership, [
            "trend_topic_keywords",
            String(existing[0].id),
          ]);
        }
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
          ownership,
        );
        stage = "event_insert";
        await this.alerts.writeTrendEvent(
          c,
          job,
          "trend.topic.projected",
          "trend_topic",
          topicId,
          {
            normalized_record_id: job.normalizedRecordId,
            provider_code: job.providerCode,
            market: providerContext.market,
            language: providerContext.language,
            heat_unit: "signals",
          },
          ownership,
        );
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
            ownership,
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
                ownership,
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
            ownership,
          );
        }
      }
      stage = "job_complete";
      const finishedAt = this.now();
      const [finished] = await c.query<ResultSetHeader>(
        "UPDATE trend_projection_jobs SET status='succeeded',lease_owner=NULL,lease_expires_at=NULL,last_error_code=NULL,updated_at=? " +
          "WHERE id=? AND status='leased' AND lease_owner=? AND attempt_count=? AND lease_expires_at>?",
        [finishedAt, job.id, this.workerId, job.attemptCount, finishedAt],
      );
      if (finished.affectedRows !== 1) throw new TrendProjectionError("trend_projection_lease_lost", true);
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
  async enqueueMissingAutomaticDownstream(): Promise<boolean> {
    if (this.preferSourcingRefresh && (await this.enqueueSourcingRefresh())) {
      this.preferSourcingRefresh = false;
      return true;
    }
    if (await this.enqueueExistingAutomaticDownstream()) {
      this.preferSourcingRefresh = true;
      return true;
    }
    if (await this.enqueueSourcingRefresh()) {
      this.preferSourcingRefresh = false;
      return true;
    }
    return false;
  }
  private async enqueueSourcingRefresh(): Promise<boolean> {
    return refreshStaleAutomaticSourcing(
      this.pool,
      async (connection, row, taskId, target, requestId, traceId, ownership) => {
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
          ownership,
        );
      },
      this.now(),
      this.queueBacklogLimit,
    );
  }
  private async enqueueExistingAutomaticDownstream(): Promise<boolean> {
    if (
      await recoverCircuitHeldSourcing(
        this.pool,
        async (connection, row, taskId, target, requestId, traceId, ownership) => {
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
            ownership,
          );
        },
        this.now(),
      )
    )
      return true;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const providers = await this.downstreamProviders(c);
      if (!providers.amazon && !providers.alibaba1688) {
        await c.commit();
        return false;
      }
      const primaryRepair = providers.amazon
        ? await repairMissingPrimaryProduct(c, providers.amazon, now, this.primaryRepairAfterId)
        : null;
      // Materialize actionable identities before resolving their primary/image.
      // Outer real competitor/search rows retain the existing locking boundary.
      const accountMode = await hasCalculationAccountCutover(c);
      const legacySourcingScope = !accountMode && (await hasLegacySourcingEventScope(c));
      const [rows] = await c.query<RowDataPacket[]>(
        `SELECT o.id opportunity_id,o.organization_id,o.workspace_id,o.name,o.market,o.created_by,
                  c.id competitor_id,c.external_id,c.product_url,c.latest_snapshot_id,
                  ss.id search_id,ss.collection_task_id previous_task_id,
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
             SELECT ${accountMode ? "so.account_id" : "src.organization_id,src.workspace_id"},evt.resource_id,
                    JSON_UNQUOTE(JSON_EXTRACT(evt.payload_json,'$.opportunity_id')) opportunity_id
             FROM sourcing_events evt JOIN sourcing_searches src ON src.id=evt.resource_id
               ${legacySourcingScope ? "AND src.organization_id=evt.organization_id AND src.workspace_id=evt.workspace_id" : ""}
               ${
                 accountMode
                   ? `JOIN account_owned_records so ON so.source_table='sourcing_searches' AND so.source_id=src.id
                 JOIN account_owned_records eo ON eo.source_table='sourcing_events' AND eo.source_id=evt.id AND eo.account_id=so.account_id
                 JOIN account_owned_records co ON co.source_table='collection_tasks' AND co.source_id=src.collection_task_id AND co.account_id=so.account_id`
                   : ""
               }
             WHERE evt.event_type='sourcing.search.seeded_from_opportunity'
             GROUP BY ${accountMode ? "so.account_id" : "src.organization_id,src.workspace_id"},evt.resource_id,opportunity_id
           ) se
             ON se.opportunity_id=CONVERT(o.id USING utf8mb4) COLLATE utf8mb4_bin
             AND ${
               accountMode
                 ? `EXISTS (SELECT 1 FROM account_owned_records oo
               WHERE oo.source_table='opportunities' AND oo.source_id=o.id AND oo.account_id=se.account_id)`
                 : "se.organization_id=o.organization_id AND se.workspace_id=o.workspace_id"
             }
           LEFT JOIN sourcing_searches ss
             ON ss.id=se.resource_id
            ${accountMode ? "" : "AND ss.organization_id=o.organization_id AND ss.workspace_id=o.workspace_id"}
            AND ss.input_type='opportunity'
            AND ss.input_ref=o.id AND ss.deleted_at IS NULL
            ${accountMode ? "AND ss.candidate_count=0 AND NOT EXISTS (SELECT 1 FROM sourcing_candidates prior_offer WHERE prior_offer.search_id=ss.id)" : ""}
           LEFT JOIN (
             SELECT query_task.organization_id,query_task.workspace_id,
                    JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.competitor_id')) competitor_id
             FROM collection_subqueries q JOIN collection_tasks query_task ON query_task.id=q.task_id
             WHERE JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='competitor_snapshot'
               AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.page_url')) IS NOT NULL
             GROUP BY query_task.organization_id,query_task.workspace_id,competitor_id
           ) cq
             ON cq.organization_id=o.organization_id
            AND cq.workspace_id=o.workspace_id
            AND cq.competitor_id=CONVERT(c.id USING utf8mb4) COLLATE utf8mb4_bin
           LEFT JOIN (
             SELECT ${accountMode ? "task_owner.account_id" : "query_task.organization_id,query_task.workspace_id"},
                    JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.search_id')) search_id
             FROM collection_subqueries q JOIN collection_tasks query_task ON query_task.id=q.task_id
             JOIN providers p_supply ON p_supply.id=q.provider_id AND p_supply.code='1688_search'
             ${
               accountMode
                 ? `JOIN account_owned_records task_owner ON task_owner.source_table='collection_tasks' AND task_owner.source_id=query_task.id
               JOIN account_owned_records query_owner ON query_owner.source_table='collection_subqueries' AND query_owner.source_id=q.id
                 AND query_owner.account_id=task_owner.account_id`
                 : ""
             }
             WHERE JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='sourcing_search'
               AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.image_url')) IS NOT NULL
               AND CHAR_LENGTH(JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.query'))) BETWEEN 1 AND 300
               AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.query_contract'))='supplier-keywords-v2'
             GROUP BY ${accountMode ? "task_owner.account_id" : "query_task.organization_id,query_task.workspace_id"},search_id
           ) sq
             ON sq.search_id=CONVERT(ss.id USING utf8mb4) COLLATE utf8mb4_bin
            AND ${accountMode ? "sq.account_id=se.account_id" : "sq.organization_id=o.organization_id AND sq.workspace_id=o.workspace_id"}
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
             ${accountMode ? "" : "AND ss.organization_id=o.organization_id AND ss.workspace_id=o.workspace_id"}
             AND ss.input_ref=o.id AND ss.deleted_at IS NULL
           WHERE (ss.id IS NULL OR ss.collection_task_id<=>o.previous_collection_task_id)
           HAVING (competitor_task_missing=1 AND ? IS NOT NULL)
               OR (sourcing_task_missing=1 AND ? IS NOT NULL AND primary_image_url IS NOT NULL)
           ORDER BY o.created_at,o.id
           LIMIT 20 FOR UPDATE`,
        [providers.amazon, providers.alibaba1688, providers.amazon, providers.alibaba1688],
      );
      const scheduledSearches = new Set<string>();
      let scheduledWork = false;
      for (const row of rows) {
        const ownership = await resolveCalculationOwnership(c, String(row.opportunity_id));
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
          (await calculationOwnersMatch(c, ownership, [
            ["competitors", String(row.competitor_id)],
          ])) &&
          !(await this.existingAutomaticCompetitorTask(c, row, providers.amazon, ownership))
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
            ownership,
          );
          scheduledWork = true;
        }
        const searchId = row.search_id == null ? null : String(row.search_id),
          imageUrl = row.primary_image_url ? String(row.primary_image_url) : null,
          supplierProviderIds = providers.alibaba1688 && imageUrl ? [providers.alibaba1688] : [];
        const searchKey = accountMode
          ? String(searchId)
          : `${context.organizationId}:${context.workspaceId}:${searchId}`;
        if (
          searchId &&
          Boolean(row.sourcing_task_missing) &&
          supplierProviderIds.length &&
          (accountMode ? Boolean(ownership?.owner) : ownership === null) &&
          (await calculationOwnersMatch(c, ownership, [
            ["sourcing_searches", searchId],
            ["collection_tasks", String(row.previous_task_id)],
          ])) &&
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
            ownership,
          );
          const [updated] = await c.query<ResultSetHeader>(
            accountMode
              ? "UPDATE sourcing_searches SET collection_task_id=?,status='queued',candidate_count=0,missing_fields_json='[]',updated_at=? WHERE id=? AND collection_task_id=? AND deleted_at IS NULL AND candidate_count=0"
              : "UPDATE sourcing_searches SET collection_task_id=?,input_ref=?,status='queued',candidate_count=0,missing_fields_json='[]',updated_at=? WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL",
            accountMode
              ? [taskId, now, searchId, row.previous_task_id]
              : [
                  taskId,
                  row.opportunity_id,
                  now,
                  searchId,
                  context.organizationId,
                  context.workspaceId,
                ],
          );
          if (accountMode && updated.affectedRows !== 1)
            throw new Error("sourcing_repair_link_changed");
          scheduledSearches.add(searchKey);
          scheduledWork = true;
        }
      }
      let periodic: "discovery" | "detail" | null = null;
      let discoveryScanned = false;
      const discoveryCursor = { afterId: this.competitorDiscoveryAfterId };
      if (!rows.length && providers.amazon) {
        const order: Array<"discovery" | "detail"> = this.preferCompetitorDiscovery
          ? ["discovery", "detail"]
          : ["detail", "discovery"];
        for (const kind of order) {
          // Missing-work repair keeps its original cadence; only the broader
          // discovery page is bounded to one scan per minute in this Worker.
          if (kind === "discovery" && now.getTime() < this.nextCompetitorDiscoveryScanAt) continue;
          const scheduled =
            kind === "discovery"
              ? await this.enqueueDueCompetitorDiscovery(c, providers.amazon, now, discoveryCursor)
              : await this.enqueueDueCompetitorRefresh(c, providers.amazon, now, accountMode);
          if (kind === "discovery") discoveryScanned = true;
          if (scheduled) {
            periodic = kind;
            break;
          }
        }
      }
      await c.commit();
      if (primaryRepair) this.primaryRepairAfterId = primaryRepair.afterId;
      if (periodic) this.preferCompetitorDiscovery = periodic === "detail";
      if (discoveryScanned) {
        this.nextCompetitorDiscoveryScanAt = now.getTime() + 60_000;
        this.competitorDiscoveryAfterId = discoveryCursor.afterId;
      }
      return Boolean(primaryRepair?.repaired || scheduledWork || periodic);
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }

  private async enqueueDueCompetitorRefresh(
    c: PoolConnection,
    providerId: string,
    now: Date,
    accountMode: boolean,
  ) {
    const before = new Date(now.getTime() - this.refreshIntervalSeconds * 1000);
    const native = accountMode && (await hasNativeNormalizedAccountScope(c));
    const nativeCompetitor = native && (await nativeCompetitorStorage(c));
    if (nativeCompetitor && (await collectionTaskScope(c)) !== "account")
      throw new Error("competitor_refresh_task_scope_schema_invalid");
    const preferred = native
      ? await findSealedDetailRefresh(c, before, this.queueBacklogLimit, nativeCompetitor)
      : await findWaitingPrimaryDetailRefresh(c, before, this.queueBacklogLimit);
    if (native && !preferred) return false;
    const [rows] = preferred
      ? [[preferred]]
      : await c.query<RowDataPacket[]>(
          `SELECT c.id,c.organization_id,c.workspace_id,c.external_id,c.product_url,o.created_by,o.id opportunity_id
       FROM competitors c JOIN opportunities o ON o.id=c.opportunity_id
         AND o.organization_id=c.organization_id AND o.workspace_id=c.workspace_id
       LEFT JOIN competitor_snapshots s ON s.id=c.latest_snapshot_id AND s.competitor_id=c.id
       LEFT JOIN (SELECT query_task.organization_id,query_task.workspace_id,
         JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.competitor_id')) competitor_id
         FROM collection_subqueries q JOIN collection_tasks query_task ON query_task.id=q.task_id WHERE q.created_at>?
         AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='competitor_snapshot'
         GROUP BY query_task.organization_id,query_task.workspace_id,competitor_id) recent
         ON recent.organization_id=c.organization_id AND recent.workspace_id=c.workspace_id
         AND recent.competitor_id=CONVERT(c.id USING utf8mb4) COLLATE utf8mb4_bin
       WHERE ${activeCollectionScopeSql("c")} AND c.status='active' AND c.deleted_at IS NULL AND c.source_site='Amazon'
         AND c.external_id REGEXP '^[A-Z0-9]{10}$'
         AND c.product_url REGEXP CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',c.external_id,'([/?#]|$)')
         AND o.source_type='trend_topic' AND o.lifecycle_status NOT IN ('archived','deleted')
         AND ${competitorRefreshObservedAtSql}<=?
         AND (SELECT COUNT(*) FROM collection_tasks backlog
           WHERE ${activeCollectionScopeSql("backlog")} AND backlog.status IN ('scheduled','queued','leased','running','parsing','validating','retry_scheduled','rate_limited'))<?
         AND ${competitorRefreshNoActiveDetailSql} AND recent.competitor_id IS NULL
       ${competitorRefreshOrderSql}`,
          [before, before, this.queueBacklogLimit],
        );
    const row = rows[0];
    if (!row || !amazonAsin({ asin: row.external_id }, String(row.product_url))) return false;
    const ownership = await resolveCalculationOwnership(c, String(row.opportunity_id));
    if (native && ownership?.owner?.account_id !== row.account_id) return false;
    if (!(await calculationOwnersMatch(c, ownership, [["competitors", String(row.id)]])))
      return false;
    if (
      ownership?.owner &&
      (await this.hasOwnedCompetitorWork(
        c,
        ownership.owner.account_id,
        "competitor_snapshot",
        String(row.id),
        before,
      ))
    )
      return false;
    await this.scheduleCoreCollection(
      c,
      {
        ...(nativeCompetitor
          ? {}
          : {
              organizationId: String(row.organization_id),
              workspaceId: String(row.workspace_id),
            }),
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
      ownership,
    );
    return true;
  }

  private async enqueueDueCompetitorDiscovery(
    c: PoolConnection,
    providerId: string,
    now: Date,
    cursor = { afterId: this.competitorDiscoveryAfterId },
  ) {
    // Resolve expensive identity/title/relevance facts only for a bounded page.
    // Cursor is committed by the caller, including pages without an eligible item.
    const [identities] = await c.query<RowDataPacket[]>(
      `SELECT o.id,${automaticCollectionBacklogCountSql} backlog_count FROM opportunities o
       WHERE ${activeCollectionScopeSql("o")} AND o.source_type='trend_topic'
         AND o.lifecycle_status NOT IN ('archived','deleted') AND o.id>?
       ORDER BY o.id LIMIT 20`,
      [cursor.afterId],
    );
    if (!identities.length) {
      cursor.afterId = "";
      return false;
    }
    const backlog = Number(identities[0]!.backlog_count);
    if (!Number.isSafeInteger(backlog) || backlog < 0 || backlog >= this.queueBacklogLimit)
      return false;
    const opportunityIds = identities.map((row) => String(row.id));
    cursor.afterId = opportunityIds.at(-1)!;
    const before = new Date(now.getTime() - this.refreshIntervalSeconds * 1000);
    const [rows] = await c.query<RowDataPacket[]>(
      `SELECT o.id discovery_opportunity_id,o.organization_id,o.workspace_id,o.created_by,o.primary_asin,
         ${automaticPrimaryTitleSql} discovery_query
       FROM (SELECT o.*,${selectionPrimaryAsinSql} primary_asin FROM opportunities o
         JOIN (SELECT DISTINCT l_identified.opportunity_id,n_identified.organization_id,n_identified.workspace_id
           FROM normalized_records n_identified
           JOIN providers p_identified ON p_identified.id=n_identified.provider_id AND p_identified.code='amazon_product'
           JOIN opportunity_evidence_links l_identified ON l_identified.raw_evidence_id=n_identified.raw_evidence_id
           WHERE n_identified.status='active'
             AND JSON_UNQUOTE(JSON_EXTRACT(n_identified.payload_json,'$.asin')) REGEXP '^[A-Za-z0-9]{10}$') identified
           ON identified.opportunity_id=o.id AND identified.organization_id=o.organization_id AND identified.workspace_id=o.workspace_id
         WHERE o.source_type='trend_topic' AND o.lifecycle_status NOT IN ('archived','deleted')
           AND o.id IN (?)
         HAVING primary_asin REGEXP '^[A-Z0-9]{10}$'
         LIMIT 18446744073709551615) o
       JOIN opportunities locked_opportunity ON locked_opportunity.id=o.id
         AND locked_opportunity.organization_id=o.organization_id AND locked_opportunity.workspace_id=o.workspace_id
       JOIN organizations active_org ON active_org.id=o.organization_id AND active_org.status='active'
       JOIN workspaces active_workspace ON active_workspace.id=o.workspace_id
         AND active_workspace.organization_id=o.organization_id AND active_workspace.status='active'
       LEFT JOIN (SELECT active_task.organization_id,active_task.workspace_id,
         JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.opportunity_id')) opportunity_id,COUNT(*) active_count
         FROM collection_subqueries q JOIN collection_tasks active_task ON active_task.id=q.task_id
         WHERE JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='opportunity_competitors'
           AND active_task.status IN ('scheduled','queued','leased','running','parsing','validating','retry_scheduled','rate_limited')
         GROUP BY active_task.organization_id,active_task.workspace_id,opportunity_id) busy
         ON busy.organization_id=o.organization_id AND busy.workspace_id=o.workspace_id
         AND busy.opportunity_id=CONVERT(o.id USING utf8mb4) COLLATE utf8mb4_bin
       LEFT JOIN (SELECT query_task.organization_id,query_task.workspace_id,
         JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.opportunity_id')) opportunity_id,MAX(q.created_at) last_discovery_at
         FROM collection_subqueries q JOIN collection_tasks query_task ON query_task.id=q.task_id
         WHERE JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='opportunity_competitors'
         GROUP BY query_task.organization_id,query_task.workspace_id,opportunity_id) recent
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
      [opportunityIds, before, this.queueBacklogLimit],
    );
    const row = rows[0],
      title = typeof row?.discovery_query === "string" ? row.discovery_query.trim() : "";
    if (!row || !/^[A-Z0-9]{10}$/.test(String(row.primary_asin)) || !title) return false;
    const [existing] = await c.query<RowDataPacket[]>(
      "SELECT q.id FROM collection_subqueries q JOIN collection_tasks active_task ON active_task.id=q.task_id " +
        "WHERE q.provider_id=? AND active_task.organization_id=? AND active_task.workspace_id=? " +
        "AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='opportunity_competitors' " +
        "AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.opportunity_id'))=? " +
        "AND (q.created_at>? OR active_task.status IN ('scheduled','queued','leased','running','parsing','validating','retry_scheduled','rate_limited')) LIMIT 1 FOR UPDATE",
      [providerId, row.organization_id, row.workspace_id, row.discovery_opportunity_id, before],
    );
    if (existing[0]) return false;
    const ownership = await resolveCalculationOwnership(c, String(row.discovery_opportunity_id));
    if (
      ownership?.owner &&
      (await this.hasOwnedCompetitorWork(
        c,
        ownership.owner.account_id,
        "opportunity_competitors",
        String(row.discovery_opportunity_id),
        before,
        providerId,
      ))
    )
      return false;
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
      ownership,
    );
    return true;
  }

  private async existingAutomaticCompetitorTask(
    c: PoolConnection,
    row: RowDataPacket,
    providerId: string,
    ownership: TrendProjectionOwnership,
  ) {
    // Current locking read after the real competitor row is locked: a stale
    // materialized candidate must not create a duplicate after another writer.
    const [existing] = await c.query<RowDataPacket[]>(
      "SELECT q.id FROM collection_subqueries q JOIN collection_tasks query_task ON query_task.id=q.task_id WHERE q.provider_id=? AND query_task.organization_id=? AND query_task.workspace_id=? AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.competitor_id'))=? AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='competitor_snapshot' AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.page_url')) IS NOT NULL LIMIT 1 FOR UPDATE",
      [providerId, row.organization_id, row.workspace_id, row.competitor_id],
    );
    return (
      Boolean(existing[0]) ||
      Boolean(
        ownership?.owner &&
        (await this.hasOwnedCompetitorWork(
          c,
          ownership.owner.account_id,
          "competitor_snapshot",
          String(row.competitor_id),
          null,
          providerId,
        )),
      )
    );
  }

  // The parent candidate is already locked. A task moved to the same account
  // still counts, but a foreign task or a foreign subquery cannot suppress it.
  private async hasOwnedCompetitorWork(
    c: PoolConnection,
    accountId: string,
    type: "competitor_snapshot" | "opportunity_competitors",
    parentId: string,
    before: Date | null,
    providerId?: string,
  ) {
    const parent = type === "competitor_snapshot" ? "competitor_id" : "opportunity_id";
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT q.id FROM collection_subqueries q JOIN collection_tasks t ON t.id=q.task_id " +
        "JOIN account_owned_records ot ON ot.source_table='collection_tasks' AND ot.source_id=t.id " +
        "JOIN account_owned_records oq ON oq.source_table='collection_subqueries' AND oq.source_id=q.id AND oq.account_id=ot.account_id " +
        "WHERE ot.account_id=? AND BINARY JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))=BINARY ? " +
        `AND BINARY JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.${parent}'))=BINARY ? ` +
        (providerId ? "AND q.provider_id=? " : "") +
        (before
          ? "AND (q.created_at>? OR t.status IN ('scheduled','queued','leased','running','parsing','validating','retry_scheduled','rate_limited')) "
          : "AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.page_url')) IS NOT NULL ") +
        "LIMIT 1 FOR UPDATE",
      [accountId, type, parentId, ...(providerId ? [providerId] : []), ...(before ? [before] : [])],
    );
    return Boolean(rows[0]);
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
      organizationId?: string;
      workspaceId?: string;
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
    ownership: TrendProjectionOwnership = null,
  ) {
    if (!subqueries.length) return;
    const owned: [string, string][] = [["collection_tasks", taskId]];
    const storageScope = ownership?.owner ? await collectionTaskScope(c) : "legacy";
    const scope =
      storageScope === "account" && ownership?.owner
        ? { kind: "account" as const, accountId: ownership.owner.account_id }
        : context.organizationId && context.workspaceId
          ? {
              kind: "legacy" as const,
              organizationId: context.organizationId,
              workspaceId: context.workspaceId,
            }
          : null;
    if (!scope) throw new Error("legacy_collection_task_coordinates_required");
    await insertScheduledHighCollectionTask(c, {
      id: taskId,
      now,
      actorId: context.actorId,
      requestId: context.requestId,
      traceId: context.traceId,
      scope,
    });
    for (let index = 0; index < subqueries.length; index += 1) {
      const subquery = subqueries[index]!;
      const id = randomUUID();
      await appendCollectionSubquery(
        c,
        {
          id,
          taskId,
          providerId: subquery.providerId,
          ordinal: index + 1,
          targetJson: JSON.stringify(subquery.target),
          required: subquery.required,
          status: "pending",
          now,
        },
        storageScope === "account",
      );
      owned.push(["collection_subqueries", id]);
    }
    const eventId = randomUUID();
    await c.query(
      "INSERT INTO collection_task_events(id,task_id,event_type,from_status,to_status,actor_type,actor_id,request_id,trace_id,metadata_json,occurred_at) VALUES(?,?,?,NULL,'scheduled','worker',?,?,?,?,?)",
      [
        eventId,
        taskId,
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
    owned.push(["collection_task_events", eventId]);
    await registerTrendProjectionOwners(c, ownership, owned);
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
    ownership: TrendProjectionOwnership,
  ) {
    const owner = ownership?.owner;
    const native = Boolean(owner) && (await nativeOpportunityStorage(c));
    const scope = native ? [owner!.account_id] : [job.organizationId, job.workspaceId];
    if (native) {
      const [[topic]] = await c.query<RowDataPacket[]>(
        "SELECT id FROM trend_topics WHERE id=? AND account_id=? FOR UPDATE",
        [topicId, owner!.account_id],
      );
      if (!topic)
        throw new TrendProjectionError("trend_projection_destination_owner_mismatch", false);
      await verifyTrendProjectionOwner(c, ownership, ["trend_topics", topicId]);
    }
    const opportunityId = randomUUID();
    const [insert] = await c.query<ResultSetHeader>(
      `INSERT ${native ? "" : "IGNORE "}INTO opportunities (id,${native ? "account_id" : "organization_id,workspace_id"},` +
        "name,market,category,source_type,source_ref_id,owner_id,lifecycle_status,recommendation_status,overall_score," +
        "trend_score,competition_score,profit_status,risk_level,confidence_status,confidence_score,evidence_count," +
        "source_count,coverage_status,score_rule_version,scored_at,decision_status,version,created_by,created_at,updated_at) " +
        `VALUES (${native ? "?,?,?,?,?" : "?,?,?,?,?,?"},'trend_topic',?,NULL,'ready','insufficient_data',NULL,NULL,NULL,` +
        "'insufficient_data','unknown','insufficient_data',NULL,0,0,'partial',NULL,NULL,'pending',1,?,?,?)" +
        (native ? " ON DUPLICATE KEY UPDATE id=id" : ""),
      [
        opportunityId,
        ...scope,
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
      `SELECT id FROM opportunities WHERE ${native ? "account_id=?" : "organization_id=? AND workspace_id=?"} AND source_type='trend_topic' AND source_ref_id=? LIMIT 1 FOR UPDATE`,
      [...scope, topicId],
    );
    const persistedOpportunityId = String(rows[0]?.id ?? opportunityId);
    if (native && !rows[0])
      throw new TrendProjectionError("trend_projection_opportunity_not_persisted", false);
    const created =
      Boolean(insert.affectedRows) && (!native || persistedOpportunityId === opportunityId);
    if (created) {
      if (ownership && persistedOpportunityId !== opportunityId)
        throw new TrendProjectionError("trend_projection_opportunity_identity_mismatch", false);
      await registerTrendProjectionOwners(c, ownership, [
        ["opportunities", persistedOpportunityId],
      ]);
    } else if (ownership) {
      if (!rows[0])
        throw new TrendProjectionError("trend_projection_opportunity_not_persisted", false);
      await verifyTrendProjectionOwner(c, ownership, ["opportunities", persistedOpportunityId]);
    }
    for (const ruleId of matchedRuleIds) {
      const matchId = randomUUID();
      const [match] = await c.query<ResultSetHeader>(
        "INSERT IGNORE INTO opportunity_rule_matches (id,opportunity_id,monitoring_rule_id,topic_id,matched_at) VALUES (?,?,?,?,?)",
        [matchId, persistedOpportunityId, ruleId, topicId, now],
      );
      if (match.affectedRows)
        await registerTrendProjectionOwners(c, ownership, [["opportunity_rule_matches", matchId]]);
      else if (ownership) {
        const [matches] = await c.query<RowDataPacket[]>(
          "SELECT id FROM opportunity_rule_matches WHERE opportunity_id=? AND monitoring_rule_id=? AND topic_id=? FOR UPDATE",
          [persistedOpportunityId, ruleId, topicId],
        );
        if (!matches[0])
          throw new TrendProjectionError("trend_projection_rule_match_not_persisted", false);
        await verifyTrendProjectionOwner(c, ownership, [
          "opportunity_rule_matches",
          String(matches[0].id),
        ]);
      }
    }
    await this.attachProjectedSignal(
      c,
      persistedOpportunityId,
      {
        id: signalId,
        provider_id: job.providerId,
        raw_evidence_id: job.rawEvidenceId,
        observed_at: observedAt,
      },
      now,
      ownership,
    );
    if (job.intelligenceSourceRecordId && job.primarySelectionRationale) {
      if (ownership) {
        const owner = ownership.owner;
        const [source] = await c.query<RowDataPacket[]>(
          owner
            ? "SELECT s.id,s.topic_id,s.provider_id,s.raw_evidence_id,s.observed_at FROM trend_signals s " +
                "JOIN normalized_records n ON n.id=s.normalized_record_id AND n.raw_evidence_id=s.raw_evidence_id AND n.provider_id=s.provider_id " +
                "JOIN account_owned_records a ON a.source_table='normalized_records' AND a.source_id=n.id AND a.account_id=? " +
                "WHERE s.normalized_record_id=? FOR UPDATE"
            : "SELECT s.id,s.topic_id,s.provider_id,s.raw_evidence_id,s.observed_at FROM trend_signals s " +
                "JOIN trend_topics t ON t.id=s.topic_id WHERE s.normalized_record_id=? AND t.organization_id=? AND t.workspace_id=? FOR UPDATE",
          owner
            ? [owner.account_id, job.intelligenceSourceRecordId]
            : [job.intelligenceSourceRecordId, job.organizationId, job.workspaceId],
        );
        if (!source[0])
          throw new TrendProjectionError("trend_projection_source_signal_missing", false);
        for (const [table, id] of [
          ["trend_topics", source[0].topic_id],
          ["trend_signals", source[0].id],
          ["raw_evidence", source[0].raw_evidence_id],
        ])
          await verifyTrendProjectionOwner(c, ownership, [String(table), String(id)]);
        const original = source[0];
        await this.attachProjectedSignal(
          c,
          persistedOpportunityId,
          {
            id: String(original.id),
            provider_id: String(original.provider_id),
            raw_evidence_id: String(original.raw_evidence_id),
            observed_at: original.observed_at,
          },
          now,
          ownership,
        );
      } else
        await c.query(
          "INSERT IGNORE INTO opportunity_evidence_links (id,opportunity_id,evidence_type,evidence_id,provider_id,raw_evidence_id,observed_at,created_at) " +
            "SELECT UUID(),?,'trend_signal',s.id,s.provider_id,s.raw_evidence_id,s.observed_at,? " +
            "FROM trend_signals s JOIN trend_topics st ON st.id=s.topic_id WHERE s.normalized_record_id=? AND st.organization_id=? AND st.workspace_id=?",
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
        ownership,
      );
    }
    await c.query(
      "UPDATE opportunities o SET evidence_count=(SELECT COUNT(*) FROM opportunity_evidence_links l WHERE l.opportunity_id=o.id),source_count=(SELECT COUNT(DISTINCT provider_id) FROM opportunity_evidence_links l WHERE l.opportunity_id=o.id),coverage_status='partial',lifecycle_status=IF(lifecycle_status='candidate','ready',lifecycle_status),version=IF(?,version,version+1),updated_at=? WHERE o.id=?",
      [created ? 1 : 0, now, persistedOpportunityId],
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
      ownership,
    });
    if (owner)
      await queueOwnedSelectionEvaluation(c, persistedOpportunityId, owner.account_id, native, now);
    else
      await queueAutomaticSelectionEvaluation(c, {
        organizationId: job.organizationId, workspaceId: job.workspaceId,
        opportunityId: persistedOpportunityId, now,
      });
    if (created) {
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
        ownership,
        native,
      );
      await this.createDownstreamDiscovery(
        c,
        job,
        persistedOpportunityId,
        title,
        canonicalUrl,
        market,
        now,
        ownership,
      );
      const owner = ownership?.owner;
      const [activeScoreRules] =
        owner || (await hasLegacyScoreRuleScope(c))
          ? await c.query<RowDataPacket[]>(
              "SELECT id FROM score_rules WHERE " +
                (owner ? "" : "organization_id=? AND workspace_id=? AND ") +
                "status='active'" +
                (ownership
                  ? " AND " +
                    (owner ? "" : "NOT ") +
                    "EXISTS (SELECT 1 FROM account_owned_records o WHERE o.source_table='score_rules' AND o.source_id=score_rules.id" +
                    (owner ? " AND o.account_id=?" : "") +
                    ")"
                  : "") +
                " ORDER BY activated_at DESC,id DESC LIMIT 1",
              owner ? [owner.account_id] : [job.organizationId, job.workspaceId],
            )
          : [[]];
      if (activeScoreRules[0]) {
        const scoreJobId = randomUUID();
        await c.query(
          "INSERT INTO opportunity_score_jobs (id,opportunity_id,score_rule_id,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES (?,?,?,'queued',0,?,?,?,?,?)",
          [
            scoreJobId,
            persistedOpportunityId,
            activeScoreRules[0].id,
            now,
            job.requestId,
            job.traceId,
            now,
            now,
          ],
        );
        await registerTrendProjectionOwners(c, ownership, [["opportunity_score_jobs", scoreJobId]]);
      }
    }
  }

  private async attachProjectedSignal(
    c: PoolConnection,
    opportunityId: string,
    signal: { id: string; provider_id: string; raw_evidence_id: string; observed_at: Date },
    now: Date,
    ownership: TrendProjectionOwnership,
  ) {
    const id = randomUUID();
    const [insert] = await c.query<ResultSetHeader>(
      "INSERT IGNORE INTO opportunity_evidence_links (id,opportunity_id,evidence_type,evidence_id,provider_id,raw_evidence_id,observed_at,created_at) VALUES (?,?,'trend_signal',?,?,?,?,?)",
      [
        id,
        opportunityId,
        signal.id,
        signal.provider_id,
        signal.raw_evidence_id,
        signal.observed_at,
        now,
      ],
    );
    if (insert.affectedRows)
      await registerTrendProjectionOwners(c, ownership, [["opportunity_evidence_links", id]]);
    else if (ownership) {
      const [existing] = await c.query<RowDataPacket[]>(
        "SELECT id FROM opportunity_evidence_links WHERE opportunity_id=? AND evidence_type='trend_signal' AND evidence_id=? AND raw_evidence_id=? AND provider_id=? FOR UPDATE",
        [opportunityId, signal.id, signal.raw_evidence_id, signal.provider_id],
      );
      if (!existing[0])
        throw new TrendProjectionError("trend_projection_evidence_link_not_persisted", false);
      await verifyTrendProjectionOwner(c, ownership, [
        "opportunity_evidence_links",
        String(existing[0].id),
      ]);
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
    ownership: TrendProjectionOwnership,
  ) {
    const asin = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i
      .exec(canonicalUrl)?.[1]
      ?.toUpperCase();
    let competitorId: string | null = null;
    if (asin) {
      const native = Boolean(ownership?.owner) && (await nativeCompetitorStorage(c));
      const scope = native ? [ownership!.owner!.account_id] : [job.organizationId, job.workspaceId];
      const proposedCompetitorId = randomUUID();
      const [insert] = await c.query<ResultSetHeader>(
        `INSERT ${native ? "" : "IGNORE "}INTO competitors (id,${native ? "account_id" : "organization_id,workspace_id"},opportunity_id,provider_id,market,source_site,external_id,product_url,title,status,latest_snapshot_id,revision,created_by,created_at,updated_at) VALUES (${native ? "?,?,?,?,?" : "?,?,?,?,?,?"},'Amazon',?,?,?,'active',NULL,1,?,?,?)` +
          (native ? " ON DUPLICATE KEY UPDATE id=id" : ""),
        [
          proposedCompetitorId,
          ...scope,
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
        `SELECT id FROM competitors WHERE ${native ? "account_id=?" : "organization_id=? AND workspace_id=?"} AND market=? AND source_site='Amazon' AND external_id=? AND opportunity_id=? AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
        [...scope, market, asin, opportunityId],
      );
      competitorId = competitors[0] ? String(competitors[0].id) : null;
      if (insert.affectedRows && competitorId === proposedCompetitorId)
        await registerTrendProjectionOwners(c, ownership, [["competitors", competitorId]]);
      else if (ownership) {
        if (!competitorId || (!native && insert.affectedRows))
          throw new TrendProjectionError("trend_projection_competitor_not_persisted", false);
        await verifyTrendProjectionOwner(c, ownership, ["competitors", competitorId]);
      }
    }
    const legacySearchScope = !ownership || (await sourcingSearchHasLegacyScope(c));
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
        ownership,
      );
    else if (ownership)
      await verifyTrendProjectionOwner(c, ownership, ["collection_tasks", supplierTaskId]);
    await c.query(
      `INSERT INTO sourcing_searches (id,${legacySearchScope ? "organization_id,workspace_id," : ""}collection_task_id,input_type,input_ref,status,candidate_count,missing_fields_json,request_id,trace_id,created_by,created_at,updated_at) VALUES (?,${legacySearchScope ? "?,?," : ""}?,'opportunity',?,'queued',0,'[]',?,?,?,?,?)`,
      [
        searchId,
        ...(legacySearchScope ? [job.organizationId, job.workspaceId] : []),
        supplierTaskId,
        opportunityId,
        job.requestId,
        job.traceId,
        job.actorId,
        now,
        now,
      ],
    );
    await registerTrendProjectionOwners(c, ownership, [["sourcing_searches", searchId]]);
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
        ownership,
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
        ownership,
      );
    }
    if (!supplierProviderIds.length) {
      await c.query(
        "UPDATE sourcing_searches SET status='succeeded_empty',missing_fields_json=?,updated_at=? WHERE id=?",
        [JSON.stringify(["supplier_crawler", ...(!imageUrl ? ["image_url"] : [])]), now, searchId],
      );
    }
    const sourcingEventId = randomUUID();
    await appendSourcingEvent(c, {
      id: sourcingEventId,
      organizationId: job.organizationId,
      workspaceId: job.workspaceId,
      eventType: "sourcing.search.seeded_from_opportunity",
      resourceId: searchId,
      actorId: "ai-selection-worker",
      payloadJson: JSON.stringify({ opportunity_id: opportunityId, candidate_count: 0 }),
      requestId: job.requestId,
      traceId: job.traceId,
      createdAt: now,
    });
    await registerTrendProjectionOwners(c, ownership, [["sourcing_events", sourcingEventId]]);
  }
}
