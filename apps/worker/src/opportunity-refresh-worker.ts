import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export type OpportunityRefreshResult =
  | { status: "idle" }
  | {
      status: "succeeded" | "succeeded_empty" | "failed_terminal" | "scheduled" | "dead_letter";
      job_id: string;
      opportunity_id?: string;
      error_code?: string;
      diagnostic?: string;
    };
interface Job {
  id: string;
  organizationId: string;
  workspaceId: string;
  opportunityId: string;
  sourceType: "manual" | "trend_topic";
  sourceRefId: string | null;
  requestId: string;
  traceId: string;
  attemptCount: number;
}
export class OpportunityRefreshError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "OpportunityRefreshError";
  }
}
export class MySqlOpportunityRefreshWorker {
  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly leaseSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async processOnce(): Promise<OpportunityRefreshResult> {
    const job = await this.claim();
    if (!job) return { status: "idle" };
    if (job.sourceType === "manual" || !job.sourceRefId) {
      await this.finish(job, "succeeded_empty", null);
      return { status: "succeeded_empty", job_id: job.id, opportunity_id: job.opportunityId };
    }
    try {
      const count = await this.refresh(job);
      return {
        status: count ? "succeeded" : "succeeded_empty",
        job_id: job.id,
        opportunity_id: job.opportunityId,
      };
    } catch (error) {
      const wrapped =
          error instanceof OpportunityRefreshError
            ? error
            : new OpportunityRefreshError(
                `opportunity_refresh_${String((error as { code?: string }).code ?? "dependency_failed").toLocaleLowerCase("en-US")}`,
                true,
              ),
        status = !wrapped.retryable
          ? "failed_terminal"
          : job.attemptCount >= 4
            ? "dead_letter"
            : "scheduled";
      await this.finish(job, status, wrapped.code);
      return {
        status,
        job_id: job.id,
        error_code: wrapped.code,
        ...(process.env.NODE_ENV === "production"
          ? {}
          : { diagnostic: error instanceof Error ? error.message.slice(0, 300) : "unknown" }),
      };
    }
  }
  private async claim(): Promise<Job | null> {
    const connection = await this.pool.getConnection(),
      now = this.now(),
      expires = new Date(now.getTime() + this.leaseSeconds * 1000);
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT j.*,o.source_type,o.source_ref_id FROM opportunity_refresh_jobs j JOIN opportunities o ON o.id=j.opportunity_id AND o.organization_id=j.organization_id AND o.workspace_id=j.workspace_id WHERE (j.status IN ('queued','retry_scheduled') AND j.available_at<=?) OR (j.status='leased' AND j.lease_expires_at<=?) ORDER BY j.available_at,j.id LIMIT 1 FOR UPDATE",
        [now, now],
      );
      const row = rows[0];
      if (!row) {
        await connection.commit();
        return null;
      }
      await connection.query(
        "UPDATE opportunity_refresh_jobs SET status='leased',attempt_count=attempt_count+1,lease_owner=?,lease_expires_at=?,updated_at=? WHERE id=?",
        [this.workerId, expires, now, row.id],
      );
      await connection.commit();
      return {
        id: String(row.id),
        organizationId: String(row.organization_id),
        workspaceId: String(row.workspace_id),
        opportunityId: String(row.opportunity_id),
        sourceType: row.source_type,
        sourceRefId: row.source_ref_id == null ? null : String(row.source_ref_id),
        requestId: String(row.request_id),
        traceId: String(row.trace_id),
        attemptCount: Number(row.attempt_count) + 1,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  private async refresh(job: Job) {
    const connection = await this.pool.getConnection(),
      now = this.now();
    try {
      await connection.beginTransaction();
      const [topics] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM trend_topics WHERE id=? AND organization_id=? AND workspace_id=? LIMIT 1 FOR UPDATE",
        [job.sourceRefId, job.organizationId, job.workspaceId],
      );
      if (!topics[0]) throw new OpportunityRefreshError("opportunity_source_missing", false);
      await connection.query(
        "INSERT IGNORE INTO opportunity_evidence_links (id,organization_id,workspace_id,opportunity_id,evidence_type,evidence_id,provider_id,raw_evidence_id,observed_at,created_at) SELECT UUID(),s.organization_id,s.workspace_id,?,'trend_signal',s.id,s.provider_id,s.raw_evidence_id,s.observed_at,? FROM trend_signals s WHERE s.topic_id=? AND s.organization_id=? AND s.workspace_id=?",
        [job.opportunityId, now, job.sourceRefId, job.organizationId, job.workspaceId],
      );
      const [counts] = await connection.query<RowDataPacket[]>(
        "SELECT COUNT(*) evidence_count,COUNT(DISTINCT provider_id) source_count FROM opportunity_evidence_links WHERE opportunity_id=? AND organization_id=? AND workspace_id=?",
        [job.opportunityId, job.organizationId, job.workspaceId],
      );
      const evidenceCount = Number(counts[0]?.evidence_count ?? 0),
        sourceCount = Number(counts[0]?.source_count ?? 0);
      await connection.query(
        "UPDATE opportunities SET evidence_count=?,source_count=?,coverage_status=?,lifecycle_status=?,updated_at=? WHERE id=? AND organization_id=? AND workspace_id=?",
        [
          evidenceCount,
          sourceCount,
          evidenceCount ? "partial" : "insufficient",
          evidenceCount ? "ready" : "candidate",
          now,
          job.opportunityId,
          job.organizationId,
          job.workspaceId,
        ],
      );
      const status = evidenceCount ? "succeeded" : "succeeded_empty";
      await connection.query(
        "UPDATE opportunity_refresh_jobs SET status=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=NULL,updated_at=? WHERE id=? AND lease_owner=?",
        [status, now, job.id, this.workerId],
      );
      await this.event(
        connection,
        job,
        "opportunity.evidence.refreshed",
        {
          evidence_count: evidenceCount,
          source_count: sourceCount,
          coverage_status: evidenceCount ? "partial" : "insufficient",
        },
        now,
      );
      await connection.commit();
      return evidenceCount;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  private async finish(
    job: Job,
    status: "succeeded_empty" | "failed_terminal" | "scheduled" | "dead_letter",
    errorCode: string | null,
  ) {
    const now = this.now(),
      delays = [60_000, 300_000, 900_000],
      available =
        status === "scheduled"
          ? new Date(now.getTime() + delays[Math.min(job.attemptCount - 1, 2)]!)
          : now,
      stored = status === "scheduled" ? "retry_scheduled" : status;
    await this.pool.query(
      "UPDATE opportunity_refresh_jobs SET status=?,available_at=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=?,updated_at=? WHERE id=? AND lease_owner=?",
      [stored, available, errorCode, now, job.id, this.workerId],
    );
  }
  private async event(
    connection: PoolConnection,
    job: Job,
    eventType: string,
    payload: unknown,
    now: Date,
  ) {
    const eventId = randomUUID();
    await connection.query(
      "INSERT INTO opportunity_events (id,organization_id,workspace_id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) VALUES (?,?,?,?,?,?,'worker',?,?,?,?,?)",
      [
        eventId,
        job.organizationId,
        job.workspaceId,
        eventType,
        "opportunity",
        job.opportunityId,
        this.workerId,
        job.requestId,
        job.traceId,
        JSON.stringify(payload),
        now,
      ],
    );
    await connection.query(
      "INSERT INTO opportunity_outbox (id,organization_id,workspace_id,event_type,resource_type,resource_id,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'queued',0,?,?,?,?,?)",
      [
        eventId,
        job.organizationId,
        job.workspaceId,
        eventType,
        "opportunity",
        job.opportunityId,
        JSON.stringify(payload),
        now,
        job.requestId,
        job.traceId,
        now,
        now,
      ],
    );
  }
}
