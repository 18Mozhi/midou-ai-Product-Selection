import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
export class AutomationWorker {
  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly leaseSeconds: number,
    private readonly retryLimit: number,
    private readonly now = () => new Date(),
  ) {}
  async processOnce() {
    await this.discover();
    const job: any = await this.claim();
    if (!job) return { status: "idle" as const };
    const now = this.now();
    try {
      const [rows] = await this.pool.query<RowDataPacket[]>(
          "SELECT * FROM automation_rules WHERE id=? AND organization_id=? AND workspace_id=?",
          [job.rule_id, job.organization_id, job.workspace_id],
        ),
        rule = rows[0];
      if (!rule || rule.status !== "active") {
        await this.finish(
          job,
          "succeeded",
          null,
          null,
          "rule_paused_before_execution",
        );
        return { status: "suppressed" as const, execution_id: String(job.id) };
      }
      const since = new Date(
          now.valueOf() - Number(rule.rate_limit_window_minutes) * 60000,
        ),
        [counts] = await this.pool.query<RowDataPacket[]>(
          "SELECT COUNT(*) total FROM automation_executions WHERE rule_id=? AND status='succeeded' AND updated_at>=?",
          [rule.id, since],
        );
      if (Number(counts[0]?.total) >= Number(rule.rate_limit_count)) {
        await this.finish(
          job,
          "rate_limited",
          null,
          null,
          "rate_limit_exceeded",
        );
        await this.event(job, rule, "automation.rate_limited", {
          execution_id: String(job.id),
          rule_version: Number(job.rule_version),
        });
        return {
          status: "rate_limited" as const,
          execution_id: String(job.id),
        };
      }
      let type: string, id: string;
      const actionConnection = await this.pool.getConnection();
      try {
        await actionConnection.beginTransaction();
        if (rule.action_type === "notify_owner") {
          type = "notification";
          id = randomUUID();
          await actionConnection.query(
            "INSERT INTO outbox_events (id,organization_id,workspace_id,event_type,schema_version,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at,version) VALUES (?,?,?,'automation.notification.queued',1,?,'pending',0,?,?,?,?,?,1)",
            [
              id,
              job.organization_id,
              job.workspace_id,
              JSON.stringify({
                resource_type: "automation_rule",
                resource_id: String(rule.id),
                recipient_id: String(rule.owner_id),
                title: String(rule.action_title),
                automation_execution_id: String(job.id),
              }),
              now,
              job.request_id,
              job.trace_id,
              now,
              now,
            ],
          );
        } else {
          type = "task";
          id = randomUUID();
          const assignee = String(rule.action_assignee_id);
          await actionConnection.query(
            "INSERT INTO tasks (id,organization_id,workspace_id,title,description,status,priority,assignee_id,source_type,source_ref_id,due_at,created_by,version,created_at,updated_at) VALUES (?,?,?,?,?,'todo','normal',?,'automation',?,NULL,?,1,?,?)",
            [
              id,
              job.organization_id,
              job.workspace_id,
              String(rule.action_title),
              `由自动化规则 ${rule.name}（版本 ${job.rule_version}）创建；请人工判断与处理。`,
              assignee,
              job.id,
              rule.owner_id,
              now,
              now,
            ],
          );
          await actionConnection.query(
            "INSERT INTO task_events (id,organization_id,workspace_id,task_id,event_type,actor_id,payload_json,request_id,trace_id,created_at) VALUES (?,?,?,?, 'task.created',?,?,?,?,?)",
            [
              randomUUID(),
              job.organization_id,
              job.workspace_id,
              id,
              rule.owner_id,
              JSON.stringify({
                source_type: "automation",
                automation_rule_id: String(rule.id),
                automation_execution_id: String(job.id),
              }),
              job.request_id,
              job.trace_id,
              now,
            ],
          );
          await actionConnection.query(
            "INSERT INTO outbox_events (id,organization_id,workspace_id,event_type,schema_version,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at,version) VALUES (?,?,?,'task.created',1,?,'pending',0,?,?,?,?,?,1)",
            [
              randomUUID(),
              job.organization_id,
              job.workspace_id,
              JSON.stringify({
                resource_type: "task",
                resource_id: id,
                task_id: id,
                assignee_id: assignee,
                source_type: "automation",
              }),
              now,
              job.request_id,
              job.trace_id,
              now,
              now,
            ],
          );
        }
        await this.finish(job, "succeeded", type, id, null, actionConnection);
        await this.event(
          job,
          rule,
          "automation.execution.succeeded",
          {
            execution_id: String(job.id),
            action_resource_type: type,
            action_resource_id: id,
          },
          actionConnection,
        );
        await actionConnection.commit();
      } catch (error) {
        await actionConnection.rollback();
        throw error;
      } finally {
        actionConnection.release();
      }
      return {
        status: "succeeded" as const,
        execution_id: String(job.id),
        action_resource_type: type,
        action_resource_id: id,
      };
    } catch (error) {
      const dead = Number(job.attempt_count) >= this.retryLimit;
      await this.pool.query(
        "UPDATE automation_executions SET status=?,available_at=DATE_ADD(?,INTERVAL 60 SECOND),lease_expires_at=NULL,last_error_code='action_failed',updated_at=? WHERE id=?",
        [dead ? "dead_letter" : "retry_scheduled", now, now, job.id],
      );
      return {
        status: dead ? ("dead_letter" as const) : ("retry_scheduled" as const),
        execution_id: String(job.id),
        error: error instanceof Error ? error.message : "unknown",
      };
    }
  }
  private async discover() {
    const now = this.now();
    await this.pool.query(
      "INSERT IGNORE INTO automation_executions (id,organization_id,workspace_id,rule_id,rule_version,notification_id,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) SELECT UUID(),r.organization_id,r.workspace_id,r.id,r.version,n.id,'queued',0,?,e.request_id,e.trace_id,?,? FROM automation_rules r JOIN notifications n ON n.organization_id=r.organization_id AND n.workspace_id=r.workspace_id JOIN outbox_events e ON e.id=n.source_event_id AND e.event_type=r.trigger_event_type WHERE r.status='active' AND (r.condition_severity='any' OR r.condition_severity=n.severity) ORDER BY n.created_at LIMIT 100",
      [now, now, now],
    );
  }
  private async claim() {
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
          "SELECT * FROM automation_executions WHERE ((status IN ('queued','retry_scheduled') AND available_at<=?) OR (status='leased' AND lease_expires_at<=?)) ORDER BY available_at,id LIMIT 1 FOR UPDATE",
          [now, now],
        ),
        row = rows[0];
      if (!row) {
        await c.commit();
        return null;
      }
      await c.query(
        "UPDATE automation_executions SET status='leased',attempt_count=attempt_count+1,leased_by=?,lease_expires_at=DATE_ADD(?,INTERVAL ? SECOND),updated_at=? WHERE id=?",
        [this.workerId, now, this.leaseSeconds, now, row.id],
      );
      await c.commit();
      return { ...row, attempt_count: Number(row.attempt_count) + 1 };
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  private finish(
    job: any,
    status: string,
    type: string | null,
    id: string | null,
    error: string | null,
    queryable: any = this.pool,
  ) {
    const now = this.now();
    return queryable.query(
      "UPDATE automation_executions SET status=?,action_resource_type=?,action_resource_id=?,last_error_code=?,lease_expires_at=NULL,updated_at=? WHERE id=?",
      [status, type, id, error, now, job.id],
    );
  }
  private async event(
    job: any,
    rule: any,
    event: string,
    payload: any,
    queryable: any = this.pool,
  ) {
    const now = this.now();
    await queryable.query(
      "INSERT INTO audit_logs (id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,request_id,trace_id,metadata_json,occurred_at,schema_version) VALUES (?,?,?,?,?,'automation_rule',?,?,?,?,?,1)",
      [
        randomUUID(),
        job.organization_id,
        job.workspace_id,
        rule.owner_id,
        event,
        rule.id,
        job.request_id,
        job.trace_id,
        JSON.stringify(payload),
        now,
      ],
    );
    await queryable.query(
      "INSERT INTO outbox_events (id,organization_id,workspace_id,event_type,schema_version,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at,version) VALUES (?,?,?,?,1,?,'pending',0,?,?,?,?,?,1)",
      [
        randomUUID(),
        job.organization_id,
        job.workspace_id,
        event,
        JSON.stringify({
          resource_type: "automation_rule",
          resource_id: String(rule.id),
          ...payload,
        }),
        now,
        job.request_id,
        job.trace_id,
        now,
        now,
      ],
    );
  }
}
