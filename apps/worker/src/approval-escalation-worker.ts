import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
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
    try {
      await x.beginTransaction();
      const [runs] = await x.query<RowDataPacket[]>(
        "SELECT r.*,q.status request_status FROM approval_node_runs r JOIN approval_requests q ON q.id=r.approval_request_id WHERE r.id=? AND r.organization_id=? AND r.workspace_id=? FOR UPDATE",
        [job.node_run_id, job.organization_id, job.workspace_id],
      );
      const run = runs[0];
      if (
        !run ||
        run.status !== "pending" ||
        run.request_status !== "pending" ||
        run.escalated_at
      ) {
        await x.query(
          "UPDATE approval_escalation_jobs SET status='succeeded',lease_owner=NULL,lease_expires_at=NULL,updated_at=? WHERE id=?",
          [now, job.id],
        );
        await x.commit();
        return {
          status: "succeeded" as const,
          job_id: String(job.id),
          escalated: false,
        };
      }
      await x.query(
        "UPDATE approval_node_runs SET active_approver_id=escalation_assignee_id,escalated_at=?,version=version+1,updated_at=? WHERE id=?",
        [now, now, run.id],
      );
      await x.query(
        "INSERT INTO approval_actions (id,organization_id,workspace_id,approval_request_id,node_run_id,action,reason,actor_id,request_id,trace_id,created_at) VALUES (?,?,?,?,?,'escalated','node_sla_overdue',?,?,?,?)",
        [
          randomUUID(),
          job.organization_id,
          job.workspace_id,
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
      };
      await x.query(
        "INSERT INTO audit_logs (id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,request_id,trace_id,metadata_json,occurred_at,schema_version) VALUES (?,?,?,?,'approval.node.escalated','approval_request',?,?,?,?,?,1)",
        [
          randomUUID(),
          job.organization_id,
          job.workspace_id,
          run.escalation_assignee_id,
          job.approval_request_id,
          job.request_id,
          job.trace_id,
          JSON.stringify(payload),
          now,
        ],
      );
      await x.query(
        "INSERT INTO outbox_events (id,organization_id,workspace_id,event_type,schema_version,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at,version) VALUES (?,?,?,'approval.overdue',1,?,'pending',0,?,?,?,?,?,1)",
        [
          randomUUID(),
          job.organization_id,
          job.workspace_id,
          JSON.stringify(payload),
          now,
          job.request_id,
          job.trace_id,
          now,
          now,
        ],
      );
      await x.query(
        "UPDATE approval_escalation_jobs SET status='succeeded',lease_owner=NULL,lease_expires_at=NULL,updated_at=? WHERE id=?",
        [now, job.id],
      );
      await x.commit();
      return {
        status: "succeeded" as const,
        job_id: String(job.id),
        escalated: true,
      };
    } catch (error) {
      await x.rollback();
      const message = error instanceof Error ? error.message : "unknown";
      await this.pool.query(
        "UPDATE approval_escalation_jobs SET status=IF(attempt_count>=3,'dead_letter','queued'),available_at=DATE_ADD(?,INTERVAL 60 SECOND),lease_owner=NULL,lease_expires_at=NULL,last_error_code=?,updated_at=? WHERE id=?",
        [now, message.slice(0, 120), now, job.id],
      );
      return { status: "failed" as const, job_id: String(job.id) };
    } finally {
      x.release();
    }
  }
}
