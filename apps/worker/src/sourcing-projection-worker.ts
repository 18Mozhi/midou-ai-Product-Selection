import { randomUUID } from "node:crypto";
import { appendSourcingEvent, appendSourcingOutbox } from "@scoutops/database";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  registerCalculationOwners,
  resolveCalculationOwnership,
} from "./opportunity-calculation-ownership.js";
import {
  registerSourcingCandidate,
  requireSourcingOwners,
  requireSourcingRecordsOwner,
} from "./sourcing-projection-ownership.js";
type Job = {
  id: string;
  scope: { organizationId: string; workspaceId: string } | null;
  accountId: string | null;
  search: string;
  request: string;
  trace: string;
  attempt: number;
};
export class SourcingProjectionError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
  }
}
export class MySqlSourcingProjectionWorker {
  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly leaseSeconds: number,
    private readonly now = () => new Date(),
  ) {}
  async processOnce() {
    const job = await this.claim();
    if (!job) return { status: "idle" as const };
    try {
      return { status: "succeeded" as const, job_id: job.id, ...(await this.project(job)) };
    } catch (e) {
      const code = (e as { code?: string })?.code;
      const x =
          e instanceof SourcingProjectionError
            ? e
            : code === "sourcing_projection_owner_mismatch" ||
                code === "sourcing_candidate_source_mismatch"
              ? new SourcingProjectionError(code, false)
              : new SourcingProjectionError("sourcing_projection_internal_error", true),
        status = !x.retryable ? "failed_terminal" : job.attempt >= 4 ? "dead_letter" : "scheduled";
      await this.finish(job, status, x.code);
      return { status, job_id: job.id, error_code: x.code };
    }
  }
  private async claim(): Promise<Job | null> {
    const c = await this.pool.getConnection(),
      now = this.now(),
      expires = new Date(now.getTime() + this.leaseSeconds * 1000);
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM sourcing_projection_jobs WHERE status IN ('queued','retry_scheduled','leased') AND available_at<=? AND (lease_expires_at IS NULL OR lease_expires_at<=?) ORDER BY created_at,id LIMIT 1 FOR UPDATE",
        [now, now],
      );
      const r = rows[0];
      if (!r) {
        await c.commit();
        return null;
      }
      const ownership = await resolveCalculationOwnership(
        c,
        String(r.search_id),
        "sourcing_searches",
      );
      let scope: Job["scope"] = null;
      if (!ownership) {
        const [[parent]] = await c.query<RowDataPacket[]>(
          "SELECT organization_id,workspace_id FROM sourcing_searches WHERE id=?",
          [r.search_id],
        );
        if (!parent) throw new Error("sourcing_projection_jobs_parent_missing");
        scope = {
          organizationId: String(parent.organization_id),
          workspaceId: String(parent.workspace_id),
        };
      }
      await c.query(
        "UPDATE sourcing_projection_jobs SET status='leased',attempt_count=attempt_count+1,lease_owner=?,lease_expires_at=?,updated_at=? WHERE id=?",
        [this.workerId, expires, now, r.id],
      );
      await c.commit();
      return {
        id: String(r.id),
        scope,
        accountId: ownership?.owner?.account_id ?? null,
        search: String(r.search_id),
        request: String(r.request_id),
        trace: String(r.trace_id),
        attempt: Number(r.attempt_count) + 1,
      };
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  private async project(j: Job) {
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const ownership = await resolveCalculationOwnership(c, j.search, "sourcing_searches");
      if (
        (!ownership && !j.scope) ||
        (ownership && (!ownership.owner || j.scope || ownership.owner.account_id !== j.accountId))
      )
        throw new SourcingProjectionError("sourcing_projection_owner_mismatch", false);
      const scopeParams = j.scope ? [j.scope.organizationId, j.scope.workspaceId] : [];
      if (ownership) {
        const [lease] = await c.query<RowDataPacket[]>(
          "SELECT id FROM sourcing_projection_jobs WHERE id=? AND search_id=? AND status='leased' AND lease_owner=? AND lease_expires_at>? AND attempt_count=? FOR UPDATE",
          [j.id, j.search, this.workerId, now, j.attempt],
        );
        if (!lease[0]) throw new SourcingProjectionError("sourcing_projection_lease_lost", true);
        await requireSourcingOwners(c, ownership, [["sourcing_projection_jobs", j.id]], true);
      }
      const [s] = await c.query<RowDataPacket[]>(
        "SELECT collection_task_id,input_type,input_ref FROM sourcing_searches WHERE id=? " +
          (j.scope ? "AND organization_id=? AND workspace_id=? " : "") +
          "AND deleted_at IS NULL FOR UPDATE",
        [j.search, ...scopeParams],
      );
      if (!s[0]) throw new SourcingProjectionError("sourcing_search_missing", false);
      if (ownership) {
        await requireSourcingOwners(c, ownership, [
          ["collection_tasks", String(s[0].collection_task_id)],
          ...(s[0].input_type === "opportunity"
            ? [["opportunities", String(s[0].input_ref)] as const]
            : []),
        ]);
      }
      const [records] = await c.query<RowDataPacket[]>(
        "SELECT n.*,e.canonical_url,e.captured_at,l.id evidence_link_id,l.collection_subquery_id " +
          "FROM collection_task_evidence_links l JOIN collection_tasks link_task ON link_task.id=l.collection_task_id " +
          "JOIN collection_subqueries sq ON sq.id=l.collection_subquery_id AND sq.task_id=link_task.id AND sq.provider_id=l.provider_id " +
          "JOIN normalized_records n ON n.id=l.normalized_record_id AND n.raw_evidence_id=l.raw_evidence_id AND n.provider_id=l.provider_id " +
          (ownership?.owner
            ? ""
            : "AND n.organization_id=link_task.organization_id AND n.workspace_id=link_task.workspace_id ") +
          "JOIN raw_evidence e ON e.id=l.raw_evidence_id AND e.provider_id=l.provider_id " +
          "WHERE l.collection_task_id=? " +
          (ownership?.owner
            ? ""
            : "AND link_task.organization_id=? AND link_task.workspace_id=? ") +
          "AND n.status='active' AND (n.schema_version='product-supply-csv-v1' OR " +
          "(n.schema_version='provider-source-v1' AND EXISTS (SELECT 1 FROM providers p WHERE p.id=n.provider_id AND p.code='1688_search')))",
        [s[0].collection_task_id, ...scopeParams],
      );
      if (ownership) await requireSourcingRecordsOwner(c, ownership, records);
      const fieldsOf = (r: RowDataPacket) => {
        const payload =
          typeof r.payload_json === "string" ? JSON.parse(r.payload_json) : r.payload_json;
        return payload.fields ?? payload;
      };
      const detailedOffers = new Set(
        records
          .filter((r) => fieldsOf(r).record_type === "offer_sku_detail")
          .map((r) => String(fieldsOf(r).external_id)),
      );
      const allMissing = new Set<string>();
      let count = 0;
      for (const r of records) {
        const payload =
            typeof r.payload_json === "string" ? JSON.parse(r.payload_json) : r.payload_json,
          fields = payload.fields ?? payload;
        if (fields.record_type === "search_offer" && detailedOffers.has(String(fields.external_id)))
          continue;
        const detail = fields.record_type === "offer_sku_detail";
        const specification =
          detail && typeof fields.specification === "string" && fields.specification.length <= 1000
            ? fields.specification
            : null;
        const location =
          detail && typeof fields.location === "string" && fields.location.length <= 255
            ? fields.location
            : null;
        const missing = [
          ...(!specification ? ["specification"] : []),
          "lead_time_days",
          ...(!location ? ["location"] : []),
          "confidence_value",
          "stability_status",
          "risk_level",
        ];
        if (
          !fields.external_id ||
          !fields.title ||
          !fields.supplier_name ||
          fields.price == null ||
          !fields.currency ||
          !fields.moq ||
          !fields.canonical_url ||
          !fields.observed_at
        )
          continue;
        const candidateId = randomUUID();
        const [insert] = await c.query<ResultSetHeader>(
          "INSERT IGNORE INTO sourcing_candidates (id,search_id,provider_id,normalized_record_id,raw_evidence_id,external_id,supplier_name,product_title,specification,moq,quoted_price,currency,lead_time_days,location,original_url,observed_at,confidence_value,status,missing_fields_json,created_at) VALUES (?,?,?,?,?,?,?,?," +
            (detail ? "?" : "NULL") +
            ",?,?,?,NULL," +
            (detail ? "?" : "NULL") +
            ",?,?,NULL,'incomplete',?,?)",
          [
            candidateId,
            j.search,
            r.provider_id,
            r.id,
            r.raw_evidence_id,
            fields.external_id,
            fields.supplier_name,
            fields.title,
            ...(detail ? [specification] : []),
            fields.moq,
            fields.price,
            fields.currency,
            ...(detail ? [location] : []),
            fields.canonical_url,
            fields.observed_at,
            JSON.stringify(missing),
            now,
          ],
        );
        await registerSourcingCandidate(
          c,
          ownership,
          j.search,
          r,
          candidateId,
          Boolean(insert.affectedRows),
        );
        for (const field of missing) allMissing.add(field);
        count++;
      }
      const state = count ? "completed_with_warnings" : "succeeded_empty",
        missing = [...allMissing];
      await c.query(
        "UPDATE sourcing_searches SET status=?,candidate_count=?,missing_fields_json=?,updated_at=? WHERE id=?",
        [state, count, JSON.stringify(missing), now, j.search],
      );
      await c.query(
        "UPDATE sourcing_projection_jobs SET status=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=NULL,updated_at=? WHERE id=? AND lease_owner=?",
        [state, now, j.id, this.workerId],
      );
      const payload = {
          search_id: j.search,
          candidate_count: count,
          status: state,
          missing_fields: missing,
        },
        event = randomUUID();
      await appendSourcingEvent(c, {
        id: event,
        ...j.scope,
        eventType: "sourcing.search.projected",
        resourceId: j.search,
        actorId: this.workerId,
        payloadJson: JSON.stringify(payload),
        requestId: j.request,
        traceId: j.trace,
        createdAt: now,
      });
      await appendSourcingOutbox(c, {
        id: event,
        ...j.scope,
        eventType: "sourcing.search.projected",
        resourceId: j.search,
        payloadJson: JSON.stringify(payload),
        createdAt: now,
      });
      await registerCalculationOwners(c, ownership, [
        ["sourcing_events", event],
        ["sourcing_outbox", event],
      ]);
      await c.commit();
      return { candidate_count: count, projection_status: state };
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  private async finish(
    j: Job,
    status: "failed_terminal" | "dead_letter" | "scheduled",
    code: string,
  ) {
    const now = this.now(),
      stored = status === "scheduled" ? "retry_scheduled" : status,
      available =
        status === "scheduled"
          ? new Date(now.getTime() + [60000, 300000, 900000][Math.min(j.attempt - 1, 2)]!)
          : now;
    await this.pool.query(
      "UPDATE sourcing_projection_jobs SET status=?,available_at=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=?,updated_at=? WHERE id=? AND lease_owner=? AND attempt_count=?",
      [stored, available, code, now, j.id, this.workerId, j.attempt],
    );
  }
}
