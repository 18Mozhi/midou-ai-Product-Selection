import { approvalTemplateScopeRelation } from "@scoutops/database";
import { appendBusinessAudit, appendPlatformAudit } from "@scoutops/database";
import { randomUUID } from "node:crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { calculationOwnersMatch, registerCalculationOwners, resolveCalculationOwnership } from "./opportunity-calculation-ownership.js";
import { readApprovalResourceOwners } from "./approval-resource-lineage.js";

const refusalCodes = new Set([
  "approval_escalation_owner_mismatch",
  "opportunity_calculation_parent_owner_mismatch",
  "approval_account_schema_not_ready",
  "approval_template_scope_schema_invalid",
  "approval_escalation_scope_missing",
  "approval_escalation_lease_lost",
  "approval_escalation_node_changed",
]);

export class ApprovalEscalationWorker {
  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly leaseSeconds: number,
    private readonly now = () => new Date(),
  ) {}
  async processOnce() {
    const c = await this.pool.getConnection(),
      now = this.now();
    let job: any;
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM approval_escalation_jobs WHERE (status='queued' AND available_at<=?) OR (status='leased' AND lease_expires_at<=?) ORDER BY available_at,id LIMIT 1 FOR UPDATE",
        [now, now],
      );
      job = rows[0];
      if (!job) {
        await c.commit();
        return { status: "idle" as const };
      }
      await c.query(
        "UPDATE approval_escalation_jobs SET status='leased',lease_owner=?,lease_expires_at=DATE_ADD(?,INTERVAL ? SECOND),attempt_count=attempt_count+1,updated_at=? WHERE id=?",
        [this.workerId, now, this.leaseSeconds, now, job.id],
      );
      await c.commit();
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
    const x = await this.pool.getConnection();
    const attempt = Number(job.attempt_count) + 1;
    const finishSql = "UPDATE approval_escalation_jobs SET status='succeeded',lease_owner=NULL,lease_expires_at=NULL,updated_at=? WHERE id=? AND status='leased' AND lease_owner=? AND attempt_count=?";
    try {
      await x.beginTransaction();
      const [runs] = await x.query<RowDataPacket[]>(
        "SELECT r.id,r.status,r.escalated_at,r.escalation_assignee_id,q.status request_status,t.id template_id,v.id template_version_id,q.resource_type,q.resource_id " +
          "FROM approval_node_runs r JOIN approval_requests q ON q.id=r.approval_request_id " +
          "JOIN approval_templates t ON t.id=q.template_id AND t.resource_type=q.resource_type " +
          "JOIN approval_template_versions v ON v.id=q.template_version_id AND v.template_id=t.id " +
          "JOIN approval_escalation_jobs j ON j.node_run_id=r.id AND j.approval_request_id=q.id " +
          "WHERE r.id=? AND q.id=? AND r.ordinal=q.current_node_ordinal AND j.id=? AND j.status='leased' AND j.lease_owner=? " +
          "AND j.attempt_count=? AND j.lease_expires_at>? FOR UPDATE",
        [job.node_run_id, job.approval_request_id, job.id, this.workerId, attempt, this.now()],
      );
      const run = runs[0];
      if (
        !run ||
        run.status !== "pending" ||
        run.request_status !== "pending" ||
        run.escalated_at
      ) {
        const checkedAt = this.now();
        const [finished] = await x.query<ResultSetHeader>(finishSql + " AND lease_expires_at>?",
          [checkedAt, job.id, this.workerId, attempt, checkedAt]);
        if (finished.affectedRows !== 1) throw new Error("approval_escalation_lease_lost");
        await x.commit();
        return {
          status: "succeeded" as const,
          job_id: String(job.id),
          escalated: false,
        };
      }
      const ownership = await resolveCalculationOwnership(x, String(job.approval_request_id), "approval_requests");
      const lineage = ownership?.owner ? await readApprovalResourceOwners(x, run, ownership.owner.account_id) : null;
      if (ownership && (!ownership.owner || !lineage || !(await calculationOwnersMatch(x, ownership, [
        ["approval_escalation_jobs", String(job.id)], ["approval_node_runs", String(run.id)],
        ["approval_templates", String(run.template_id)], ["approval_template_versions", String(run.template_version_id)],
        ...lineage,
      ])))) throw new Error("approval_escalation_owner_mismatch");
      const account = Boolean(ownership?.owner);
      let organizationId: string | undefined;
      let workspaceId: string | undefined;
      if (account) {
        const [columns] = await x.query<RowDataPacket[]>(
          "SHOW COLUMNS FROM outbox_events WHERE Field IN ('organization_id','workspace_id')",
        );
        const legacyNullable = columns.length === 2 && ["organization_id", "workspace_id"].every(field =>
          columns.some(column => column.Field === field && column.Null === "YES"));
        if (columns.length !== 0 && !legacyNullable)
          throw new Error("approval_account_schema_not_ready");
      } else {
        const templateSource = await approvalTemplateScopeRelation(x);
        if (templateSource !== "approval_templates") throw new Error("approval_escalation_owner_mismatch");
        const [[scope]] = await x.query<RowDataPacket[]>(
          "SELECT t.organization_id,t.workspace_id FROM approval_requests q JOIN approval_templates t ON t.id=q.template_id WHERE q.id=? FOR UPDATE",
          [job.approval_request_id],
        );
        organizationId = scope?.organization_id;
        workspaceId = scope?.workspace_id;
        if (!organizationId || !workspaceId) throw new Error("approval_escalation_scope_missing");
      }
      const actionId = randomUUID(), outboxId = randomUUID();
      const [assigned] = await x.query<ResultSetHeader>(
        "UPDATE approval_node_runs SET active_approver_id=escalation_assignee_id,escalated_at=?,version=version+1,updated_at=? " +
          "WHERE id=? AND approval_request_id=? AND status='pending' AND escalated_at IS NULL AND escalation_assignee_id=?",
        [now, now, run.id, job.approval_request_id, run.escalation_assignee_id],
      );
      if (assigned.affectedRows !== 1) throw new Error("approval_escalation_node_changed");
      await x.query(
        "INSERT INTO approval_actions (id,approval_request_id,node_run_id,action,reason,actor_id,request_id,trace_id,created_at) VALUES (?,?,?,'escalated','node_sla_overdue',?,?,?,?)",
        [
          actionId,
          job.approval_request_id,
          run.id,
          run.escalation_assignee_id,
          job.request_id,
          job.trace_id,
          now,
        ],
      );
      const payload = {
        approval_request_id: String(job.approval_request_id),
        node_run_id: String(run.id),
        active_approver_id: String(run.escalation_assignee_id),
        reason: "node_sla_overdue",
        ...(ownership?.owner ? { account_projection_contract: 25, approval_action_id: actionId } : {}),
      };
      if (account) await appendPlatformAudit(x,
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) VALUES(?,NULL,NULL,?,'approval.node.escalated','approval_request',?,'succeeded',?,?,?,?,1)",
        [randomUUID(), run.escalation_assignee_id, job.approval_request_id, job.request_id, job.trace_id, JSON.stringify(payload), now],
      );
      else await appendBusinessAudit(x,
        "INSERT INTO audit_logs (id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,request_id,trace_id,metadata_json,occurred_at,schema_version) VALUES (?,?,?,?,'approval.node.escalated','approval_request',?,?,?,?,?,1)",
        [
          randomUUID(),
          organizationId,
          workspaceId,
          run.escalation_assignee_id,
          job.approval_request_id,
          job.request_id,
          job.trace_id,
          JSON.stringify(payload),
          now,
        ],
      );
      await x.query(
        `INSERT INTO outbox_events (id,${account ? "" : "organization_id,workspace_id,"}event_type,schema_version,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at,version) VALUES (?,${account ? "" : "?,?,"}'approval.overdue',1,?,'pending',0,?,?,?,?,?,1)`,
        [
          outboxId,
          ...(account ? [] : [organizationId, workspaceId]),
          JSON.stringify(payload),
          now,
          job.request_id,
          job.trace_id,
          now,
          now,
        ],
      );
      await registerCalculationOwners(x, ownership, [["approval_actions", actionId], ["outbox_events", outboxId]]);
      const finishedAt = this.now();
      const [finished] = await x.query<ResultSetHeader>(finishSql + " AND lease_expires_at>?",
        [finishedAt, job.id, this.workerId, attempt, finishedAt]);
      if (finished.affectedRows !== 1) throw new Error("approval_escalation_lease_lost");
      await x.commit();
      return {
        status: "succeeded" as const,
        job_id: String(job.id),
        escalated: true,
      };
    } catch (error) {
      await x.rollback();
      const message = error instanceof Error ? error.message : "";
      const code = refusalCodes.has(message) ? message : "approval_escalation_dependency_failed";
      const failedAt = this.now();
      await this.pool.query(
        "UPDATE approval_escalation_jobs SET status=IF(attempt_count>=3,'dead_letter','queued'),available_at=DATE_ADD(?,INTERVAL 60 SECOND),lease_owner=NULL,lease_expires_at=NULL,last_error_code=?,updated_at=? WHERE id=? AND status='leased' AND lease_owner=? AND attempt_count=? AND lease_expires_at>?",
        [now, code, failedAt, job.id, this.workerId, attempt, failedAt],
      );
      return { status: "failed" as const, job_id: String(job.id) };
    } finally {
      x.release();
    }
  }
}
