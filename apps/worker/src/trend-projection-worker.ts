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

export const intelligenceFirstOrderSql =
  " ORDER BY COALESCE((SELECT CASE WHEN p_intelligence.code='amazon_product' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(q_intelligence.target_json,'$.projection_type'))='intelligence_product_discovery' " +
  "THEN 0 WHEN p_intelligence.access_mode='public_rss' THEN 1 ELSE 2 END " +
  "FROM normalized_records n_intelligence " +
  "JOIN providers p_intelligence ON p_intelligence.id=n_intelligence.provider_id " +
  "JOIN raw_evidence e_intelligence ON e_intelligence.id=n_intelligence.raw_evidence_id " +
  "AND e_intelligence.organization_id=n_intelligence.organization_id AND e_intelligence.workspace_id=n_intelligence.workspace_id " +
  "LEFT JOIN collection_subqueries q_intelligence ON q_intelligence.id=e_intelligence.collection_subquery_id " +
  "AND q_intelligence.organization_id=n_intelligence.organization_id AND q_intelligence.workspace_id=n_intelligence.workspace_id " +
  "WHERE n_intelligence.id=trend_projection_jobs.normalized_record_id " +
  "AND n_intelligence.organization_id=trend_projection_jobs.organization_id " +
  "AND n_intelligence.workspace_id=trend_projection_jobs.workspace_id),2),available_at,id LIMIT 1";

export const intelligenceProvenanceSql =
  "SELECT n.id FROM normalized_records n JOIN trend_events e ON e.organization_id=n.organization_id " +
  "AND e.workspace_id=n.workspace_id AND e.event_type='trend.intelligence.associated' " +
  "WHERE n.id=? AND n.organization_id=? AND n.workspace_id=? AND n.status IN ('active','superseded') " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,'$.normalized_record_id'))=BINARY n.id " +
  "AND JSON_CONTAINS(JSON_EXTRACT(e.payload_json,'$.association.queries'),JSON_QUOTE(?)) LIMIT 1";

export class MySqlTrendProjectionWorker {
  private readonly persistence: TrendProjectionPersistence;
  private readonly sourceRecovery: IntelligenceSourceRecovery;
  private claimedSinceRepair = 0;

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
    // A permanently busy projection queue must not starve historical sourcing.
    // Match the recovery batch bound, while still serving fresh work first.
    let repaired = false;
    if (this.claimedSinceRepair >= 20) {
      // An exception still yields the next turn to fresh work. An ordinary
      // capacity/no-work result retains the owed repair turn across idle polls.
      this.claimedSinceRepair = 0;
      if (!(await this.persistence.enqueueMissingAutomaticDownstream()))
        this.claimedSinceRepair = 20;
      repaired = true;
    }
    let job = await this.claim();
    let skipped = 0;
    // Retire old non-intelligence work through the normal lease/finish contract.
    // A supply batch must not cost one complete scheduler turn per offer.
    while (job && !projectedTrendProviderContext(job.providerCode).accepted) {
      this.claimedSinceRepair += 1;
      await this.finish(job, "succeeded_empty", null);
      if (++skipped === 20) return { status: "succeeded_empty", job_id: job.id };
      job = await this.claim();
    }
    if (!job) {
      if (!repaired && (await this.persistence.enqueueMissingAutomaticDownstream()))
        this.claimedSinceRepair = 0;
      return { status: "idle" };
    }
    this.claimedSinceRepair += 1;
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
      "SELECT n.id,n.organization_id,n.workspace_id " + source + suffix,
    );
    for (const row of candidates) {
      await this.pool.query(
        sql.slice(0, start) +
          source +
          " AND n.id=? AND n.organization_id=? AND n.workspace_id=? ORDER BY n.created_at LIMIT 1",
        [now, now, now, row.id, row.organization_id, row.workspace_id],
      );
    }
  }

  private async enqueueMissing() {
    const now = this.now();
    await this.enqueueMissingBatch(
      [
        "INSERT IGNORE INTO trend_projection_jobs (id,organization_id,workspace_id,normalized_record_id,status,",
        "attempt_count,available_at,lease_owner,lease_expires_at,last_error_code,request_id,trace_id,created_at,",
        "updated_at) SELECT UUID(),n.organization_id,n.workspace_id,n.id,'scheduled',0,?,NULL,NULL,NULL,n.request_id,",
        "n.trace_id,?,? FROM normalized_records n JOIN providers p ON p.id=n.provider_id JOIN raw_evidence e ON e.id=n.raw_evidence_id LEFT JOIN ",
        "trend_projection_jobs j ON j.normalized_record_id=n.id WHERE n.status='active' AND j.id IS NULL AND ",
        "(p.code NOT IN ('1688_search','amazon_product','dhgate_supplier_search','made_in_china_search','ec21_supplier_search') ",
        "OR (p.code='amazon_product' AND EXISTS (SELECT 1 FROM collection_subqueries cs ",
        "WHERE cs.id=e.collection_subquery_id AND JSON_UNQUOTE(JSON_EXTRACT(cs.target_json,'$.projection_type'))='rule_product_discovery'))) ",
        `AND ${activeCollectionScopeSql("n")} ORDER BY n.created_at LIMIT 100`,
      ].join(""),
      now,
    );
    await this.enqueueMissingBatch(
      "INSERT IGNORE INTO trend_projection_jobs (id,organization_id,workspace_id,normalized_record_id,status," +
        "attempt_count,available_at,request_id,trace_id,created_at,updated_at) " +
        "SELECT UUID(),n.organization_id,n.workspace_id,n.id,'scheduled',0,?,n.request_id,n.trace_id,?,? " +
        "FROM normalized_records n JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' " +
        "JOIN raw_evidence e ON e.id=n.raw_evidence_id JOIN collection_subqueries cs ON cs.id=e.collection_subquery_id " +
        "AND cs.organization_id=n.organization_id AND cs.workspace_id=n.workspace_id " +
        "JOIN collection_tasks t ON t.id=cs.task_id AND t.organization_id=n.organization_id AND t.workspace_id=n.workspace_id " +
        "LEFT JOIN trend_projection_jobs j ON j.normalized_record_id=n.id " +
        "WHERE n.status='active' AND j.id IS NULL AND t.status IN ('succeeded','completed_with_warnings') AND " +
        "JSON_UNQUOTE(JSON_EXTRACT(cs.target_json,'$.projection_type'))='intelligence_product_discovery' " +
        "AND n.id=(SELECT MIN(n_first.id) FROM collection_task_evidence_links l_first JOIN normalized_records n_first " +
        "ON n_first.id=l_first.normalized_record_id AND n_first.organization_id=l_first.organization_id " +
        "AND n_first.workspace_id=l_first.workspace_id AND n_first.status='active' " +
        "WHERE l_first.collection_task_id=cs.task_id AND l_first.organization_id=n.organization_id " +
        "AND l_first.workspace_id=n.workspace_id) " +
        `AND ${activeCollectionScopeSql("n")} ORDER BY n.created_at LIMIT 100`,
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
    if (job.intelligenceSourceRecordId) {
      const [sources] = await this.pool.query<RowDataPacket[]>(intelligenceProvenanceSql, [
        job.intelligenceSourceRecordId,
        job.organizationId,
        job.workspaceId,
        job.intelligenceQuery,
      ]);
      if (!sources[0]) throw new TrendProjectionError("intelligence_provenance_invalid", false);
      const [rows] = await this.pool.query<RowDataPacket[]>(
        "SELECT n.id,n.provider_id,n.raw_evidence_id,n.payload_json FROM collection_task_evidence_links l " +
          "JOIN normalized_records n ON n.id=l.normalized_record_id AND n.organization_id=l.organization_id " +
          "AND n.workspace_id=l.workspace_id AND n.status IN ('active','superseded') JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' " +
          "WHERE l.collection_task_id=? AND l.organization_id=? AND l.workspace_id=? ORDER BY l.created_at,n.id LIMIT 30",
        [job.collectionTaskId, job.organizationId, job.workspaceId],
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
      const selected = await this.intelligence.selectPrimary(job.intelligenceQuery!, candidates);
      if (!selected.source_ref) return false;
      const record = rows.find((row) => String(row.id) === selected.source_ref);
      if (!record) throw new TrendProjectionError("intelligence_primary_invalid", false);
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

  private async claim(): Promise<TrendProjectionJob | null> {
    const c = await this.pool.getConnection(),
      now = this.now(),
      expires = new Date(now.getTime() + this.leaseSeconds * 1000);
    try {
      await c.beginTransaction();
      const [candidates] = await c.query<RowDataPacket[]>(
        `SELECT id,organization_id,workspace_id FROM trend_projection_jobs WHERE ${activeCollectionScopeSql("trend_projection_jobs")} AND ((status='scheduled' AND available_at<=?) OR (status='leased' AND lease_expires_at<=?)) AND ${automaticCollectionBacklogCountSql}<?` +
          intelligenceFirstOrderSql,
        [now, now, this.queueBacklogLimit],
      );
      const candidate = candidates[0];
      if (!candidate) {
        await c.commit();
        return null;
      }
      // Range scans with FOR UPDATE lock competing inserts across the backlog.
      // Recheck under a single-row current read if another owner won the race.
      const [jobs] = await c.query<RowDataPacket[]>(
        "SELECT * FROM trend_projection_jobs WHERE id=? AND organization_id=? AND workspace_id=? " +
          `AND ${activeCollectionScopeSql("trend_projection_jobs")} AND ((status='scheduled' AND available_at<=?) OR (status='leased' AND lease_expires_at<=?)) FOR UPDATE`,
        [candidate.id, candidate.organization_id, candidate.workspace_id, now, now],
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
        "SELECT n.organization_id,n.workspace_id,n.provider_id,n.raw_evidence_id,n.payload_json,n.created_by,n.request_id,n.trace_id,p.code provider_code,e.collection_task_id,cs.target_json FROM normalized_records n JOIN providers p ON p.id=n.provider_id JOIN raw_evidence e ON e.id=n.raw_evidence_id LEFT JOIN collection_subqueries cs ON cs.id=e.collection_subquery_id WHERE n.id=? AND n.organization_id=? AND n.workspace_id=? LIMIT 1",
        [row.normalized_record_id, row.organization_id, row.workspace_id],
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
        organizationId: String(row.organization_id),
        workspaceId: String(row.workspace_id),
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
      "UPDATE trend_projection_jobs SET status=?,available_at=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=?,updated_at=? WHERE id=? AND lease_owner=?",
      [status, available, errorCode, now, job.id, this.workerId],
    );
  }
}
