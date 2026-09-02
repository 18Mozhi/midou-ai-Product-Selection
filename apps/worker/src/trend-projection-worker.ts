import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  buildSupplierSearchQuery,
  projectedTrendProviderContext,
  TrendProjectionError,
  type TrendProjectionJob,
} from "./trend-projection-calculation.js";
import { TrendProjectionPersistence } from "./trend-projection-persistence.js";

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

  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly leaseSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.persistence = new TrendProjectionPersistence(pool, workerId, now);
  }

  async processOnce(): Promise<TrendProjectionResult> {
    await this.persistence.enqueueMissingAutomaticDownstream();
    await this.enqueueMissing();
    const job = await this.claim();
    if (!job) return { status: "idle" };
    if (!projectedTrendProviderContext(job.providerCode).accepted) {
      await this.finish(job, "succeeded_empty", null);
      return { status: "succeeded_empty", job_id: job.id };
    }
    try {
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
        "SELECT n.organization_id,n.workspace_id,n.provider_id,n.raw_evidence_id,n.payload_json,n.created_by,n.request_id,n.trace_id,p.code provider_code,e.collection_task_id FROM normalized_records n JOIN providers p ON p.id=n.provider_id JOIN raw_evidence e ON e.id=n.raw_evidence_id WHERE n.id=? AND n.organization_id=? AND n.workspace_id=? LIMIT 1",
        [row.normalized_record_id, row.organization_id, row.workspace_id],
      );
      if (!records[0]) throw new TrendProjectionError("trend_projection_record_missing", false);
      const record = records[0];
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
        payload:
          typeof record.payload_json === "string"
            ? JSON.parse(record.payload_json)
            : record.payload_json,
        actorId: String(record.created_by),
        requestId: String(record.request_id),
        traceId: String(record.trace_id),
        attemptCount: Number(row.attempt_count) + 1,
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
