import { collectionTaskScope, trendTopicEventReadRelation } from "@scoutops/database";
import { automaticIntakeBacklogLimit } from "./automatic-intake-capacity-policy.js";
import { collectedProductProjectionSql, nativeCollectedProductProjectionSql } from "./collected-product-projection-policy.js";
import { nativeCollectionBacklogCountSql } from "./collection-account-backlog.js";
import { enqueueNativeTrendProjection, nativeTrendProjectionScopeSql } from "./trend-projection-account-queue.js";
import {
  activeCollectionScopeSql,
  automaticCollectionBacklogCountSql,
} from "./collection-source-scheduling-policy.js";
import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  buildSupplierSearchQuery,
  projectedTrendProviderContext,
  readRuleProductDiscoveryProvenance,
  TrendProjectionError,
  type TrendProjectionJob,
} from "./trend-projection-calculation.js";
import { TrendProjectionPersistence } from "./trend-projection-persistence.js";
import { resolveTrendProjectionOwnership, verifyTrendModelInputs } from "./trend-projection-ownership.js";
import { IntelligenceSourceRecovery } from "./intelligence-source-recovery.js";
import { amazonAsin } from "./competitor-discovery-policy.js";
import {
  intelligenceInput,
  type IntelligenceProductClassifier,
} from "./intelligence-product-association.js";

export { buildSupplierSearchQuery, projectedTrendProviderContext, TrendProjectionError };
export {
  isAutomaticProductDiscoveryProvider,
  isConcreteProductEvidence,
  normalizeProjectedTrendTitle,
} from "./trend-projection-calculation.js";
export type { ProjectedTrendProviderContext } from "./trend-projection-calculation.js";

export type TrendProjectionResult =
  | { status: "idle" }
  | {
      status: "succeeded" | "succeeded_empty" | "failed_terminal" | "scheduled" | "dead_letter";
      job_id: string;
      topic_id?: string;
      error_code?: string;
      diagnostic?: string;
    };

const activeTrendProjectionScopeSql =
  "EXISTS (SELECT 1 FROM normalized_records projection_scope_record " +
  "JOIN raw_evidence projection_scope_evidence ON projection_scope_evidence.id=projection_scope_record.raw_evidence_id " +
  "AND projection_scope_evidence.provider_id=projection_scope_record.provider_id " +
  "JOIN collection_tasks projection_scope_task ON projection_scope_task.id=projection_scope_evidence.collection_task_id " +
  "WHERE projection_scope_record.id=trend_projection_jobs.normalized_record_id " +
  `AND ${activeCollectionScopeSql("projection_scope_task")})`;

export const intelligenceFirstOrderSql =
  " ORDER BY COALESCE((SELECT CASE WHEN p_intelligence.code='amazon_product' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(q_intelligence.target_json,'$.projection_type'))='intelligence_product_discovery' " +
  "THEN 0 WHEN p_intelligence.access_mode='public_rss' THEN 1 ELSE 2 END " +
  "FROM normalized_records n_intelligence " +
  "JOIN providers p_intelligence ON p_intelligence.id=n_intelligence.provider_id " +
  "JOIN raw_evidence e_intelligence ON e_intelligence.id=n_intelligence.raw_evidence_id " +
  "AND e_intelligence.provider_id=n_intelligence.provider_id " +
  "LEFT JOIN collection_subqueries q_intelligence ON q_intelligence.id=e_intelligence.collection_subquery_id " +
  "AND q_intelligence.task_id=e_intelligence.collection_task_id AND q_intelligence.provider_id=n_intelligence.provider_id " +
  "WHERE n_intelligence.id=trend_projection_jobs.normalized_record_id),2),available_at,id LIMIT 1";

export const intelligenceProvenanceSql =
  "SELECT n.id,n.payload_json FROM normalized_records n JOIN " + trendTopicEventReadRelation + " e ON e.organization_id=n.organization_id " +
  "AND e.workspace_id=n.workspace_id AND e.event_type='trend.intelligence.associated' " +
  "WHERE n.id=? AND n.organization_id=? AND n.workspace_id=? AND n.status IN ('active','superseded') " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,'$.normalized_record_id'))=BINARY n.id " +
  "AND JSON_CONTAINS(JSON_EXTRACT(e.payload_json,'$.association.queries'),JSON_QUOTE(?)) LIMIT 1";

const intelligenceAccountProvenanceSql =
  "SELECT n.id,n.payload_json FROM normalized_records n " +
  "JOIN trend_signals s ON s.normalized_record_id=n.id AND s.raw_evidence_id=n.raw_evidence_id AND s.provider_id=n.provider_id " +
  "JOIN trend_events e ON e.resource_type='trend_topic' AND e.resource_id=s.topic_id AND e.event_type='trend.intelligence.associated' " +
  "JOIN account_owned_records o ON o.source_table='normalized_records' AND o.source_id=n.id AND o.account_id=? " +
  "JOIN account_owned_records so ON so.source_table='trend_signals' AND so.source_id=s.id AND so.account_id=o.account_id " +
  "JOIN account_owned_records ro ON ro.source_table='raw_evidence' AND ro.source_id=s.raw_evidence_id AND ro.account_id=o.account_id " +
  "JOIN account_owned_records eo ON eo.source_table='trend_events' AND eo.source_id=e.id AND eo.account_id=o.account_id " +
  "JOIN account_owned_records t ON t.source_table='trend_topics' AND t.source_id=s.topic_id AND t.account_id=o.account_id " +
  "WHERE n.id=? AND n.status IN ('active','superseded') " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,'$.normalized_record_id'))=BINARY n.id " +
  "AND JSON_CONTAINS(JSON_EXTRACT(e.payload_json,'$.association.queries'),JSON_QUOTE(?)) LIMIT 1";

const intelligenceAccountCandidateSql =
  "SELECT n.id,n.provider_id,n.raw_evidence_id,n.payload_json FROM collection_task_evidence_links l " +
  "JOIN normalized_records n ON n.id=l.normalized_record_id AND n.raw_evidence_id=l.raw_evidence_id AND n.provider_id=l.provider_id " +
  "AND n.status IN ('active','superseded') JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' " +
  "JOIN account_owned_records o ON o.source_table='collection_tasks' AND o.source_id=l.collection_task_id AND o.account_id=? " +
  "JOIN account_owned_records lo ON lo.source_table='collection_task_evidence_links' AND lo.source_id=l.id AND lo.account_id=o.account_id " +
  "JOIN account_owned_records no ON no.source_table='normalized_records' AND no.source_id=n.id AND no.account_id=o.account_id " +
  "JOIN account_owned_records ro ON ro.source_table='raw_evidence' AND ro.source_id=n.raw_evidence_id AND ro.account_id=o.account_id " +
  "WHERE l.collection_task_id=? ORDER BY l.created_at,n.id LIMIT 30";

export class MySqlTrendProjectionWorker {
  private readonly persistence: TrendProjectionPersistence;
  private readonly sourceRecovery: IntelligenceSourceRecovery;
  private repairDue = false;
  private preferCollectedResult = true;

  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly leaseSeconds: number,
    private readonly now: () => Date = () => new Date(),
    private readonly intelligence?: IntelligenceProductClassifier,
    refreshIntervalSeconds = 3600,
    private readonly queueBacklogLimit = 1000,
  ) {
    this.sourceRecovery = new IntelligenceSourceRecovery(pool, workerId, now, queueBacklogLimit);
    this.persistence = new TrendProjectionPersistence(
      pool,
      workerId,
      now,
      refreshIntervalSeconds,
      queueBacklogLimit,
    );
  }

  async processOnce(): Promise<TrendProjectionResult> {
    try {
      await this.sourceRecovery.processOnce();
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      console.warn(
        "intelligence_source_recovery_failed",
        typeof code === "string" && /^[A-Z0-9_]{1,80}$/.test(code) ? code : "unknown",
      );
    }
    await this.enqueueMissing();
    // Already-collected products use completion admission, before a producer can
    // consume the released slot. Alternate with the entire original repair/fresh turn.
    const collectedTurn = this.preferCollectedResult;
    let job = collectedTurn ? await this.claim(true) : null;
    // A released slot can appear after the admission read. Retain the owed
    // collected turn rather than letting this same loop's producer take it.
    if (collectedTurn && !job && (await this.hasReadyCollectedResult())) return { status: "idle" };
    const collected = Boolean(job);
    this.preferCollectedResult = !collected;
    // Keep fresh intelligence moving, then give existing product completion the next turn.
    // A capacity/no-work result retains the owed turn; it must not restart a fresh batch.
    let repaired = false;
    if (!job && this.repairDue) {
      // An exception still yields the next turn to fresh work. An ordinary
      // capacity/no-work result retains the owed repair turn across idle polls.
      this.repairDue = false;
      if (!(await this.persistence.enqueueMissingAutomaticDownstream())) this.repairDue = true;
      repaired = true;
    }
    job ??= await this.claim();
    let skipped = 0;
    // Retire old non-intelligence work through the normal lease/finish contract.
    // A supply batch must not cost one complete scheduler turn per offer.
    while (job && !projectedTrendProviderContext(job.providerCode).accepted) {
      this.repairDue = true;
      await this.finish(job, "succeeded_empty", null);
      if (++skipped === 20) return { status: "succeeded_empty", job_id: job.id };
      job = await this.claim();
    }
    if (!job) {
      if (!repaired && (await this.persistence.enqueueMissingAutomaticDownstream()))
        this.repairDue = false;
      return { status: "idle" };
    }
    this.repairDue = true;
    try {
      if (!(await this.prepareIntelligence(job))) {
        await this.finish(job, "succeeded_empty", "intelligence_no_relevant_product");
        return {
          status: "succeeded_empty",
          job_id: job.id,
          error_code: "intelligence_no_relevant_product",
        };
      }
      const topicId = await this.persistence.project(job);
      return { status: "succeeded", job_id: job.id, topic_id: topicId };
    } catch (error) {
      const dependencyCode =
        typeof (error as { code?: unknown })?.code === "string"
          ? `trend_projection_${(error as { code: string }).code.toLocaleLowerCase("en-US")}`
          : "trend_projection_dependency_failed";
      const failure =
        error instanceof TrendProjectionError
          ? error
          : new TrendProjectionError(dependencyCode, true);
      const status = !failure.retryable
        ? "failed_terminal"
        : job.attemptCount >= 4
          ? "dead_letter"
          : "scheduled";
      await this.finish(job, status, failure.code);
      return {
        status,
        job_id: job.id,
        error_code: failure.code,
        ...(process.env.NODE_ENV === "production"
          ? {}
          : {
              diagnostic: error instanceof Error ? error.message.slice(0, 300) : "unknown",
            }),
      };
    }
  }

  /** Candidate scans are consistent reads; INSERT SELECT only reads a scoped primary key. */
  private async enqueueMissingBatch(sql: string, now: Date) {
    const start = sql.indexOf("FROM normalized_records n ");
    const suffix = " ORDER BY n.created_at LIMIT 100";
    if (start < 0 || !sql.endsWith(suffix)) throw new Error("projection_enqueue_sql_invalid");
    const source = sql.slice(start, -suffix.length);
    const [candidates] = await this.pool.query<RowDataPacket[]>(
      "SELECT n.id,t.organization_id,t.workspace_id " + source + suffix,
    );
    for (const row of candidates) {
      await this.pool.query(
        sql.slice(0, start) +
          source +
          " AND n.id=? AND t.organization_id=? AND t.workspace_id=? ORDER BY n.created_at LIMIT 1",
        [now, now, now, row.id, row.organization_id, row.workspace_id],
      );
    }
  }

  private async enqueueMissing() {
    const now = this.now();
    if (await collectionTaskScope(this.pool) === "account") {
      await enqueueNativeTrendProjection(this.pool, now);
      return;
    }
    await this.enqueueMissingBatch(
      [
        "INSERT IGNORE INTO trend_projection_jobs (id,normalized_record_id,status,",
        "attempt_count,available_at,lease_owner,lease_expires_at,last_error_code,request_id,trace_id,created_at,",
        "updated_at) SELECT UUID(),n.id,'scheduled',0,?,NULL,NULL,NULL,n.request_id,",
        "n.trace_id,?,? FROM normalized_records n JOIN providers p ON p.id=n.provider_id JOIN raw_evidence e ON e.id=n.raw_evidence_id AND e.provider_id=n.provider_id ",
        "JOIN collection_tasks t ON t.id=e.collection_task_id LEFT JOIN ",
        "trend_projection_jobs j ON j.normalized_record_id=n.id WHERE n.status='active' AND j.id IS NULL AND ",
        "(p.code NOT IN ('1688_search','amazon_product','dhgate_supplier_search','made_in_china_search','ec21_supplier_search') ",
        "OR (p.code='amazon_product' AND EXISTS (SELECT 1 FROM collection_subqueries cs ",
        "WHERE cs.id=e.collection_subquery_id AND JSON_UNQUOTE(JSON_EXTRACT(cs.target_json,'$.projection_type'))='rule_product_discovery'))) ",
        `AND ${activeCollectionScopeSql("t")} ORDER BY n.created_at LIMIT 100`,
      ].join(""),
      now,
    );
    await this.enqueueMissingBatch(
      "INSERT IGNORE INTO trend_projection_jobs (id,normalized_record_id,status," +
        "attempt_count,available_at,request_id,trace_id,created_at,updated_at) " +
        "SELECT UUID(),n.id,'scheduled',0,?,n.request_id,n.trace_id,?,? " +
        "FROM normalized_records n JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' " +
        "JOIN raw_evidence e ON e.id=n.raw_evidence_id AND e.provider_id=n.provider_id JOIN collection_subqueries cs ON cs.id=e.collection_subquery_id " +
        "AND cs.task_id=e.collection_task_id AND cs.provider_id=n.provider_id " +
        "JOIN collection_tasks t ON t.id=cs.task_id " +
        "LEFT JOIN trend_projection_jobs j ON j.normalized_record_id=n.id " +
        "WHERE n.status='active' AND j.id IS NULL AND t.status IN ('succeeded','completed_with_warnings') AND " +
        "JSON_UNQUOTE(JSON_EXTRACT(cs.target_json,'$.projection_type'))='intelligence_product_discovery' " +
        "AND n.id=(SELECT MIN(n_first.id) FROM collection_task_evidence_links l_first JOIN normalized_records n_first " +
        "ON n_first.id=l_first.normalized_record_id AND n_first.raw_evidence_id=l_first.raw_evidence_id " +
        "AND n_first.provider_id=l_first.provider_id AND n_first.status='active' " +
        "JOIN raw_evidence e_first ON e_first.id=n_first.raw_evidence_id AND e_first.provider_id=n_first.provider_id " +
        "JOIN collection_tasks t_first ON t_first.id=e_first.collection_task_id " +
        "WHERE l_first.collection_task_id=cs.task_id AND n_first.provider_id=n.provider_id AND t_first.organization_id=t.organization_id " +
        "AND t_first.workspace_id=t.workspace_id) " +
        `AND ${activeCollectionScopeSql("t")} ORDER BY n.created_at LIMIT 100`,
      now,
    );
  }

  private async prepareIntelligence(job: TrendProjectionJob) {
    if (!this.intelligence) {
      if (job.intelligenceSourceRecordId)
        throw new TrendProjectionError("intelligence_model_not_configured", false);
      return true;
    }
    job.intelligenceModel = this.intelligence.model;
    const ownership = await resolveTrendProjectionOwnership(this.pool, job, false);
    if (job.intelligenceSourceRecordId) {
      const accountId = ownership?.owner?.account_id;
      const [sources] = await this.pool.query<RowDataPacket[]>(
        accountId ? intelligenceAccountProvenanceSql : intelligenceProvenanceSql,
        accountId ? [accountId, job.intelligenceSourceRecordId, job.intelligenceQuery] : [
        job.intelligenceSourceRecordId,
        job.organizationId,
        job.workspaceId,
        job.intelligenceQuery,
      ]);
      if (!sources[0]) throw new TrendProjectionError("intelligence_provenance_invalid", false);
      const sourcePayload = sources[0].payload_json;
      const originatingIntelligence = intelligenceInput(
        job.intelligenceSourceRecordId,
        typeof sourcePayload === "string" ? JSON.parse(sourcePayload) : (sourcePayload ?? {}),
      );
      if (!originatingIntelligence.title.trim() && !originatingIntelligence.summary.trim())
        return false;
      const [rows] = await this.pool.query<RowDataPacket[]>(
        accountId ? intelligenceAccountCandidateSql : "SELECT n.id,n.provider_id,n.raw_evidence_id,n.payload_json FROM collection_task_evidence_links l " +
          "JOIN collection_tasks link_task ON link_task.id=l.collection_task_id " +
          "JOIN normalized_records n ON n.id=l.normalized_record_id AND n.raw_evidence_id=l.raw_evidence_id " +
          "AND n.organization_id=link_task.organization_id AND n.workspace_id=link_task.workspace_id " +
          "AND n.status IN ('active','superseded') JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' " +
          "WHERE l.collection_task_id=? AND link_task.organization_id=? AND link_task.workspace_id=? ORDER BY l.created_at,n.id LIMIT 30",
        accountId ? [accountId, job.collectionTaskId] : [job.collectionTaskId, job.organizationId, job.workspaceId],
      );
      const candidates = rows.flatMap((row) => {
        const payload =
          typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : row.payload_json;
        const asin = amazonAsin(payload, String(payload.canonical_url ?? ""));
        return asin &&
          typeof payload.title === "string" &&
          payload.title.trim() &&
          payload.sponsored !== true &&
          payload.sponsored !== 1
          ? [{ source_ref: String(row.id), asin, title: payload.title.slice(0, 500) }]
          : [];
      });
      if (!candidates.length) return false;
      const candidateIds = new Set(candidates.map(item => item.source_ref));
      await verifyTrendModelInputs(this.pool, ownership, [
        ["normalized_records", job.intelligenceSourceRecordId],
        ...rows.filter(row => candidateIds.has(String(row.id))).flatMap((row): [string, string][] => [
          ["normalized_records", String(row.id)], ["raw_evidence", String(row.raw_evidence_id)],
        ]),
      ]);
      const selected = await this.intelligence.selectPrimary(
        job.intelligenceQuery!,
        candidates,
        originatingIntelligence,
      );
      if (!selected.source_ref) return false;
      const record = rows.find((row) => String(row.id) === selected.source_ref);
      if (!record) throw new TrendProjectionError("intelligence_primary_invalid", false);
      job.leasedNormalizedRecordId ??= job.normalizedRecordId;
      job.normalizedRecordId = String(record.id);
      job.providerId = String(record.provider_id);
      job.rawEvidenceId = String(record.raw_evidence_id);
      job.payload =
        typeof record.payload_json === "string"
          ? JSON.parse(record.payload_json)
          : record.payload_json;
      job.primarySelectionRationale = selected.rationale;
    } else if (
      job.providerCode !== "amazon_product" &&
      !amazonAsin(job.payload, String(job.payload.canonical_url ?? ""))
    ) {
      job.intelligenceAssociation = await this.intelligence.associate(
        intelligenceInput(job.normalizedRecordId, job.payload),
      );
    }
    return true;
  }

  private async hasReadyCollectedResult(): Promise<boolean> {
    const now = this.now();
    const native = await collectionTaskScope(this.pool) === "account";
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id FROM trend_projection_jobs WHERE ${native ? nativeTrendProjectionScopeSql : activeTrendProjectionScopeSql} AND ((status='scheduled' AND available_at<=?) OR (status='leased' AND lease_expires_at<=?)) AND ${native ? nativeCollectedProductProjectionSql : collectedProductProjectionSql} LIMIT 1`,
      [now, now],
    );
    return Boolean(rows[0]);
  }

  private async claim(collectedProductsOnly = false): Promise<TrendProjectionJob | null> {
    const c = await this.pool.getConnection(),
      now = this.now(),
      expires = new Date(now.getTime() + this.leaseSeconds * 1000),
      admissionLimit = collectedProductsOnly
        ? this.queueBacklogLimit
        : automaticIntakeBacklogLimit(this.queueBacklogLimit);
    try {
      await c.beginTransaction();
      const native = await collectionTaskScope(c) === "account";
      const scope = native ? nativeTrendProjectionScopeSql : activeTrendProjectionScopeSql;
      const backlog = native ? nativeCollectionBacklogCountSql : automaticCollectionBacklogCountSql;
      const collectedGuard = collectedProductsOnly ? ` AND ${native ? nativeCollectedProductProjectionSql : collectedProductProjectionSql}` : "";
      const [candidates] = await c.query<RowDataPacket[]>(
        `SELECT id,normalized_record_id FROM trend_projection_jobs WHERE ${scope} AND ((status='scheduled' AND available_at<=?) OR (status='leased' AND lease_expires_at<=?))${collectedGuard} AND ${backlog}<?` +
          intelligenceFirstOrderSql,
        [now, now, admissionLimit],
      );
      const candidate = candidates[0];
      if (!candidate) {
        await c.commit();
        return null;
      }
      // Range scans with FOR UPDATE lock competing inserts across the backlog.
      // Recheck under a single-row current read if another owner won the race.
      const [jobs] = await c.query<RowDataPacket[]>(
        "SELECT * FROM trend_projection_jobs WHERE id=? AND normalized_record_id=? " +
          `AND ${scope} AND ((status='scheduled' AND available_at<=?) OR (status='leased' AND lease_expires_at<=?))${collectedGuard}` +
          (collectedProductsOnly ? ` AND ${backlog}<?` : "") +
          " FOR UPDATE",
        [
          candidate.id,
          candidate.normalized_record_id,
          now,
          now,
          ...(collectedProductsOnly ? [admissionLimit] : []),
        ],
      );
      if (!jobs[0]) {
        await c.commit();
        return null;
      }
      const row = jobs[0];
      await c.query(
        "UPDATE trend_projection_jobs SET status='leased',attempt_count=attempt_count+1,lease_owner=?,lease_expires_at=?,updated_at=? WHERE id=?",
        [this.workerId, expires, now, row.id],
      );
      const [records] = await c.query<RowDataPacket[]>(
        "SELECT " + (native ? "t.account_id" : "t.organization_id,t.workspace_id") + ",n.provider_id,n.raw_evidence_id,n.payload_json,n.created_by,n.request_id,n.trace_id,p.code provider_code,e.collection_task_id,cs.target_json " +
        "FROM normalized_records n JOIN providers p ON p.id=n.provider_id " +
        "JOIN raw_evidence e ON e.id=n.raw_evidence_id AND e.provider_id=n.provider_id " +
        "JOIN collection_tasks t ON t.id=e.collection_task_id " +
        "LEFT JOIN collection_subqueries cs ON cs.id=e.collection_subquery_id AND cs.task_id=t.id AND cs.provider_id=n.provider_id " +
        "WHERE n.id=? " + (native ? "AND n.account_id=e.account_id AND t.account_id=e.account_id " : "") + "LIMIT 1",
        [row.normalized_record_id],
      );
      if (!records[0]) throw new TrendProjectionError("trend_projection_record_missing", false);
      const record = records[0],
        provenance = readRuleProductDiscoveryProvenance(record.target_json),
        target =
          typeof record.target_json === "string"
            ? JSON.parse(record.target_json)
            : record.target_json;
      const intelligenceTarget =
        target?.projection_type === "intelligence_product_discovery" &&
        typeof target.intelligence_source_record_id === "string" &&
        /^[0-9a-f-]{36}$/i.test(target.intelligence_source_record_id) &&
        typeof target.query === "string";
      await c.commit();
      return {
        id: String(row.id),
        organizationId: native ? "" : String(record.organization_id),
        workspaceId: native ? "" : String(record.workspace_id),
        normalizedRecordId: String(row.normalized_record_id),
        providerId: String(record.provider_id),
        providerCode: String(record.provider_code),
        rawEvidenceId: String(record.raw_evidence_id),
        collectionTaskId: String(record.collection_task_id),
        monitoringRuleId: provenance.monitoringRuleId,
        monitoringRuleQuery: provenance.monitoringRuleQuery,
        payload:
          typeof record.payload_json === "string"
            ? JSON.parse(record.payload_json)
            : record.payload_json,
        actorId: String(record.created_by),
        requestId: String(record.request_id),
        traceId: String(record.trace_id),
        attemptCount: Number(row.attempt_count) + 1,
        ...(intelligenceTarget
          ? {
              intelligenceSourceRecordId: target.intelligence_source_record_id,
              intelligenceQuery: target.query,
            }
          : {}),
      };
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }

  private async finish(
    job: TrendProjectionJob,
    status: "succeeded_empty" | "failed_terminal" | "scheduled" | "dead_letter",
    errorCode: string | null,
  ) {
    const now = this.now(),
      retryDelays = [60_000, 300_000, 900_000] as const,
      available =
        status === "scheduled"
          ? new Date(now.getTime() + retryDelays[Math.min(job.attemptCount - 1, 2)]!)
          : now;
    await this.pool.query(
      "UPDATE trend_projection_jobs SET status=?,available_at=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=?,updated_at=? " +
        "WHERE id=? AND status='leased' AND lease_owner=? AND attempt_count=? AND lease_expires_at>?",
      [status, available, errorCode, now, job.id, this.workerId, job.attemptCount, now],
    );
  }
}
