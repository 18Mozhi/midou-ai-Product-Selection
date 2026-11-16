import { appendAccountOpportunityEvent, appendOpportunityEvent } from "@scoutops/database";
import { appendOpportunityOutbox } from "@scoutops/database";
import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { queueAutomaticSelectionEvaluation } from "./automatic-selection-evaluation-worker.js";
import { queueOwnedSelectionEvaluation } from "./account-evaluation-enqueue.js";
import { refreshRuleRecommendation } from "./rule-recommendation.js";
import { nativeOpportunityStorage } from "./opportunity-storage.js";
import { calculationOwnersMatch, registerCalculationOwners, resolveCalculationOwnership, type CalculationOwnership } from "./opportunity-calculation-ownership.js";

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
        opportunity_id: job.opportunityId,
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
        "SELECT j.*,o.source_type,o.source_ref_id FROM opportunity_refresh_jobs j JOIN opportunities o ON o.id=j.opportunity_id WHERE (j.status IN ('queued','retry_scheduled') AND j.available_at<=?) OR (j.status='leased' AND j.lease_expires_at<=?) ORDER BY j.available_at,j.id LIMIT 1 FOR UPDATE",
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
        organizationId: "",
        workspaceId: "",
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
      const [parents] = await connection.query<RowDataPacket[]>(
        "SELECT o.source_type,o.source_ref_id FROM opportunity_refresh_jobs j " +
          "JOIN opportunities o ON o.id=j.opportunity_id WHERE j.id=? AND o.id=? AND j.status='leased' " +
          "AND j.lease_owner=? AND j.attempt_count=? AND j.lease_expires_at>? FOR UPDATE",
        [job.id, job.opportunityId, this.workerId, job.attemptCount, now],
      );
      const parent = parents[0];
      if (!parent || parent.source_type !== job.sourceType || parent.source_ref_id !== job.sourceRefId)
        throw new OpportunityRefreshError("opportunity_refresh_parent_or_lease_changed", false);
      const ownership = await resolveCalculationOwnership(connection, job.opportunityId);
      const hasTopic = job.sourceType === "trend_topic" && !!job.sourceRefId;
      if (ownership && (!ownership.owner || !(await calculationOwnersMatch(connection, ownership, [
        ["opportunity_refresh_jobs", job.id], ...(hasTopic ? [["trend_topics", job.sourceRefId!] as const] : []),
      ])))) throw new OpportunityRefreshError("opportunity_refresh_owner_mismatch", false);
      const native = await nativeOpportunityStorage(connection);
      if (native) {
        if (!ownership?.owner) throw new OpportunityRefreshError("opportunity_refresh_owner_mismatch", false);
        const account = ownership.owner.account_id;
        const [[row]] = await connection.query<RowDataPacket[]>(
          "SELECT account_id FROM opportunities WHERE id=? FOR UPDATE", [job.opportunityId],
        );
        if (row?.account_id !== account)
          throw new OpportunityRefreshError("opportunity_refresh_owner_mismatch", false);
        if (hasTopic) {
          const [[topic]] = await connection.query<RowDataPacket[]>(
            "SELECT id FROM trend_topics WHERE id=? AND account_id=? LOCK IN SHARE MODE", [job.sourceRefId, account],
          );
          if (!topic) throw new OpportunityRefreshError("opportunity_refresh_owner_mismatch", false);
        }
      }
      if (!hasTopic) {
        await this.completeLeasedJob(connection, job, "succeeded_empty", now);
        await connection.commit();
        return 0;
      }
      if (ownership?.owner) {
        await this.refreshOwnedEvidence(connection, job, ownership, now, native);
      } else {
        const [[scope]] = await connection.query<RowDataPacket[]>(
          "SELECT organization_id,workspace_id FROM opportunities WHERE id=?",
          [job.opportunityId],
        );
        if (!scope) throw new OpportunityRefreshError("opportunity_refresh_parent_or_lease_changed", false);
        job = { ...job, organizationId: String(scope.organization_id), workspaceId: String(scope.workspace_id) };
        const [topics] = await connection.query<RowDataPacket[]>(
          "SELECT id FROM trend_topics WHERE id=? AND organization_id=? AND workspace_id=? LIMIT 1 FOR UPDATE",
          [job.sourceRefId, job.organizationId, job.workspaceId],
        );
        if (!topics[0]) throw new OpportunityRefreshError("opportunity_source_missing", false);
        await connection.query(
          "INSERT IGNORE INTO opportunity_evidence_links (id,opportunity_id,evidence_type,evidence_id,provider_id,raw_evidence_id,observed_at,created_at) SELECT UUID(),?,'trend_signal',s.id,s.provider_id,s.raw_evidence_id,s.observed_at,? FROM trend_signals s JOIN trend_topics st ON st.id=s.topic_id WHERE s.topic_id=? AND st.organization_id=? AND st.workspace_id=?",
          [job.opportunityId, now, job.sourceRefId, job.organizationId, job.workspaceId],
        );
      }
      const [counts] = await connection.query<RowDataPacket[]>(
        "SELECT COUNT(*) evidence_count,COUNT(DISTINCT provider_id) source_count FROM opportunity_evidence_links WHERE opportunity_id=?",
        [job.opportunityId],
      );
      const evidenceCount = Number(counts[0]?.evidence_count ?? 0),
        sourceCount = Number(counts[0]?.source_count ?? 0);
      await connection.query(
        "UPDATE opportunities SET evidence_count=?,source_count=?,coverage_status=?," +
          "lifecycle_entered_at=IF(lifecycle_status<>?,?,lifecycle_entered_at)," +
          "lifecycle_status=?,updated_at=? WHERE id=? AND " +
          (ownership?.owner
            ? (native ? "opportunities.account_id=? AND " : "") +
              "EXISTS (SELECT 1 FROM account_owned_records a WHERE a.source_table='opportunities' AND a.source_id=opportunities.id AND a.account_id=?)"
            : "organization_id=? AND workspace_id=?"),
        [
          evidenceCount,
          sourceCount,
          evidenceCount ? "partial" : "insufficient",
          evidenceCount ? "ready" : "candidate",
          now,
          evidenceCount ? "ready" : "candidate",
          now,
          job.opportunityId,
          ...(ownership?.owner ? (native ? [ownership.owner.account_id, ownership.owner.account_id] : [ownership.owner.account_id]) :
            [job.organizationId, job.workspaceId]),
        ],
      );
      await refreshRuleRecommendation(connection, {
        organizationId: job.organizationId,
        workspaceId: job.workspaceId,
        opportunityId: job.opportunityId,
        actorType: "worker",
        actorId: this.workerId,
        requestId: job.requestId,
        traceId: job.traceId,
        now,
        ownership,
      });
      if (ownership?.owner)
        await queueOwnedSelectionEvaluation(connection, job.opportunityId, ownership.owner.account_id, native, now);
      else
        await queueAutomaticSelectionEvaluation(connection, { ...job, now });
      const status = evidenceCount ? "succeeded" : "succeeded_empty";
      await this.completeLeasedJob(connection, job, status, now);
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
        ownership,
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
  private async refreshOwnedEvidence(connection: PoolConnection, job: Job, ownership: NonNullable<CalculationOwnership>, now: Date, native: boolean) {
    const account = ownership.owner!.account_id;
    const ownerJoin = (alias: string, table: string, id: string) =>
      `JOIN account_owned_records ${alias} ON ${alias}.source_table='${table}' AND ${alias}.source_id=${id} AND ${alias}.account_id=? `;
    const [signals] = await connection.query<RowDataPacket[]>(
      "SELECT s.id,s.provider_id,s.raw_evidence_id,s.observed_at,l.id link_id " +
        "FROM trend_topics t JOIN trend_signals s ON s.topic_id=t.id " +
        "JOIN raw_evidence r ON r.id=s.raw_evidence_id AND r.provider_id=s.provider_id " +
        ownerJoin("so", "trend_signals", "s.id") + ownerJoin("ro", "raw_evidence", "r.id") +
        "LEFT JOIN opportunity_evidence_links l ON l.opportunity_id=? AND l.evidence_type='trend_signal' AND l.evidence_id=s.id " +
        "WHERE t.id=?" + (native ? " AND r.account_id=ro.account_id" : "") + " LOCK IN SHARE MODE",
      [account, account, job.opportunityId, job.sourceRefId],
    );
    // A prior projection may legitimately have linked other topics. Preserve those
    // links, but never count a link with missing or mismatched original evidence.
    const [invalid] = await connection.query<RowDataPacket[]>(
      "SELECT l.id FROM opportunity_evidence_links l " +
        "LEFT JOIN trend_signals s ON l.evidence_type='trend_signal' AND s.id=l.evidence_id " +
        "AND s.provider_id=l.provider_id AND s.raw_evidence_id=l.raw_evidence_id " +
        "LEFT JOIN trend_topics t ON t.id=s.topic_id " +
        "LEFT JOIN raw_evidence r ON r.id=l.raw_evidence_id AND r.provider_id=l.provider_id " +
        "LEFT JOIN account_owned_records lo ON lo.source_table='opportunity_evidence_links' AND lo.source_id=l.id AND lo.account_id=? " +
        "LEFT JOIN account_owned_records so ON so.source_table='trend_signals' AND so.source_id=s.id AND so.account_id=? " +
        "LEFT JOIN account_owned_records ro ON ro.source_table='raw_evidence' AND ro.source_id=r.id AND ro.account_id=? " +
        "LEFT JOIN account_owned_records ot ON ot.source_table='trend_topics' AND ot.source_id=t.id AND ot.account_id=? " +
        "WHERE l.opportunity_id=? AND (lo.source_id IS NULL OR so.source_id IS NULL OR ro.source_id IS NULL OR ot.source_id IS NULL" +
        (native ? " OR NOT(r.account_id<=>ro.account_id) OR NOT(t.account_id<=>ot.account_id)" : "") + ") LIMIT 1 LOCK IN SHARE MODE",
      [account, account, account, account, job.opportunityId],
    );
    if (invalid.length)
      throw new OpportunityRefreshError("opportunity_refresh_evidence_owner_mismatch", false);
    const inserted: Array<readonly [string, string]> = [];
    for (const signal of signals) {
      if (signal.link_id) continue;
      const id = randomUUID();
      await connection.query(
        "INSERT INTO opportunity_evidence_links (id,opportunity_id,evidence_type,evidence_id,provider_id,raw_evidence_id,observed_at,created_at) " +
          "VALUES (?,?,'trend_signal',?,?,?,?,?)",
        [id, job.opportunityId, signal.id, signal.provider_id, signal.raw_evidence_id, signal.observed_at, now],
      );
      inserted.push(["opportunity_evidence_links", id]);
    }
    await registerCalculationOwners(connection, ownership, inserted);
  }
  private async completeLeasedJob(
    connection: PoolConnection, job: Job, status: "succeeded" | "succeeded_empty", now: Date,
  ) {
    const [result] = await connection.query<import("mysql2/promise").ResultSetHeader>(
      "UPDATE opportunity_refresh_jobs SET status=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=NULL,updated_at=? " +
        "WHERE id=? AND status='leased' AND lease_expires_at>UTC_TIMESTAMP(3) AND lease_owner=? AND attempt_count=?",
      [status, now, job.id, this.workerId, job.attemptCount],
    );
    if (result.affectedRows !== 1)
      throw new OpportunityRefreshError("opportunity_refresh_parent_or_lease_changed", false);
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
      "UPDATE opportunity_refresh_jobs SET status=?,available_at=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=?,updated_at=? " +
        "WHERE id=? AND status='leased' AND lease_expires_at>UTC_TIMESTAMP(3) AND lease_owner=? AND attempt_count=?",
      [stored, available, errorCode, now, job.id, this.workerId, job.attemptCount],
    );
  }
  private async event(
    connection: PoolConnection,
    job: Job,
    eventType: string,
    payload: unknown,
    now: Date,
    ownership: CalculationOwnership,
  ) {
    const eventId = randomUUID();
    if (ownership?.owner) {
      await appendAccountOpportunityEvent(connection, {
        id: eventId, opportunityId: job.opportunityId, eventType, actorType: "worker",
        actorId: this.workerId, requestId: job.requestId, traceId: job.traceId,
        payloadJson: JSON.stringify(payload), now,
      });
      await registerCalculationOwners(connection, ownership, [["opportunity_events", eventId], ["opportunity_outbox", eventId]]);
      return;
    }
    await appendOpportunityEvent(connection, {
      id: eventId,
      organizationId: job.organizationId,
      workspaceId: job.workspaceId,
      eventType,
      resourceType: "opportunity",
      resourceId: job.opportunityId,
      actorType: "worker",
      actorId: this.workerId,
      requestId: job.requestId,
      traceId: job.traceId,
      payloadJson: JSON.stringify(payload),
      occurredAt: now,
    });
    await appendOpportunityOutbox(connection, {
      id: eventId,
      eventId,
      organizationId: job.organizationId,
      workspaceId: job.workspaceId,
      eventType,
      resourceType: "opportunity",
      resourceId: job.opportunityId,
      payloadJson: JSON.stringify(payload),
      createdAt: now,
      requestId: job.requestId,
      traceId: job.traceId,
    });
    await registerCalculationOwners(connection, ownership, [["opportunity_events", eventId], ["opportunity_outbox", eventId]]);
  }
}
