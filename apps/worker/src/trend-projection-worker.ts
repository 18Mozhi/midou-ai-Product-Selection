import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  buildSupplierSearchQuery,
  projectedTrendProviderContext,
  readRuleProductDiscoveryProvenance,
  TrendProjectionError,
  type TrendProjectionJob,
} from "./trend-projection-calculation.js";
import { TrendProjectionPersistence } from "./trend-projection-persistence.js";
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

export class MySqlTrendProjectionWorker {
  private readonly persistence: TrendProjectionPersistence;
  private claimedSinceRepair = 0;

  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly leaseSeconds: number,
    private readonly now: () => Date = () => new Date(),
    private readonly intelligence?: IntelligenceProductClassifier,
  ) {
    this.persistence = new TrendProjectionPersistence(pool, workerId, now);
  }

  async processOnce(): Promise<TrendProjectionResult> {
    await this.enqueueMissing();
    // A permanently busy projection queue must not starve historical sourcing.
    // Match the recovery batch bound, while still serving fresh work first.
    let repaired = false;
    if (this.claimedSinceRepair >= 20) {
      this.claimedSinceRepair = 0;
      await this.persistence.enqueueMissingAutomaticDownstream();
      repaired = true;
    }
    const job = await this.claim();
    if (!job) {
      this.claimedSinceRepair = 0;
      if (!repaired) await this.persistence.enqueueMissingAutomaticDownstream();
      return { status: "idle" };
    }
    this.claimedSinceRepair += 1;
    if (!projectedTrendProviderContext(job.providerCode).accepted) {
      await this.finish(job, "succeeded_empty", null);
      return { status: "succeeded_empty", job_id: job.id };
    }
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

  private async enqueueMissing() {
    const now = this.now();
    await this.pool.query(
      [
        "INSERT IGNORE INTO trend_projection_jobs (id,organization_id,workspace_id,normalized_record_id,status,",
        "attempt_count,available_at,lease_owner,lease_expires_at,last_error_code,request_id,trace_id,created_at,",
        "updated_at) SELECT UUID(),n.organization_id,n.workspace_id,n.id,'scheduled',0,?,NULL,NULL,NULL,n.request_id,",
        "n.trace_id,?,? FROM normalized_records n JOIN providers p ON p.id=n.provider_id JOIN raw_evidence e ON e.id=n.raw_evidence_id LEFT JOIN ",
        "trend_projection_jobs j ON j.normalized_record_id=n.id WHERE n.status='active' AND j.id IS NULL AND ",
        "(p.code NOT IN ('amazon_product','dhgate_supplier_search','made_in_china_search','ec21_supplier_search') ",
        "OR (p.code='amazon_product' AND EXISTS (SELECT 1 FROM collection_subqueries cs ",
        "WHERE cs.id=e.collection_subquery_id AND JSON_UNQUOTE(JSON_EXTRACT(cs.target_json,'$.projection_type'))='rule_product_discovery'))) ",
        "ORDER BY n.created_at LIMIT 100",
      ].join(""),
      [now, now, now],
    );
    await this.pool.query(
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
        "AND l_first.workspace_id=n.workspace_id) ORDER BY n.created_at LIMIT 100",
      [now, now, now],
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
      const [sources] = await this.pool.query<RowDataPacket[]>(
        "SELECT n.id FROM normalized_records n JOIN trend_events e ON e.organization_id=n.organization_id " +
          "AND e.workspace_id=n.workspace_id AND e.event_type='trend.intelligence.associated' " +
          "WHERE n.id=? AND n.organization_id=? AND n.workspace_id=? AND n.status='active' " +
          "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,'$.normalized_record_id'))=BINARY n.id " +
          "AND JSON_CONTAINS(JSON_EXTRACT(e.payload_json,'$.association.queries'),JSON_QUOTE(?)) LIMIT 1",
        [
          job.intelligenceSourceRecordId,
          job.organizationId,
          job.workspaceId,
          job.intelligenceQuery,
        ],
      );
      if (!sources[0]) throw new TrendProjectionError("intelligence_provenance_invalid", false);
      const [rows] = await this.pool.query<RowDataPacket[]>(
        "SELECT n.id,n.provider_id,n.raw_evidence_id,n.payload_json FROM collection_task_evidence_links l " +
          "JOIN normalized_records n ON n.id=l.normalized_record_id AND n.organization_id=l.organization_id " +
          "AND n.workspace_id=l.workspace_id AND n.status='active' JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' " +
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
      job.providerCode !== "1688_search" &&
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
      const [jobs] = await c.query<RowDataPacket[]>(
        "SELECT * FROM trend_projection_jobs WHERE (status='scheduled' AND available_at<=?) OR (status='leased' AND lease_expires_at<=?) ORDER BY available_at,id LIMIT 1 FOR UPDATE",
        [now, now],
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
