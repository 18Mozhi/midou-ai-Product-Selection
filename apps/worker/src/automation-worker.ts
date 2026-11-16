import {
  notificationScopeRelation,
  automationRuleScopeRelation,
  nativeAutomationOutbox,
} from "@scoutops/database";
import { appendBusinessAudit } from "@scoutops/database";
import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { usesNativeBusinessTasks } from "./business-task-storage.js";

// The seal and original delivery prove ownership. An archive row can only
// restrict old scope, never grant authority or cause a pre-seal replay.
const nativeTriggerProofSql = `
  JOIN outbox_events e ON e.id=n.source_event_id AND e.event_type=r.trigger_event_type
    AND e.status='published' AND e.created_at>=cut.created_at
  JOIN account_owned_records event_owner ON event_owner.source_table='outbox_events'
    AND event_owner.source_id=e.id AND event_owner.account_id=r.account_id
    AND (event_owner.reason='exclusive_owner' OR
      (event_owner.reason IN ('shared','unassigned') AND event_owner.account_id=cut.primary_account_id))
  LEFT JOIN outbox_event_scope_history scope_history ON scope_history.event_id=e.id`;
const nativeTriggerHistorySql = ` AND (scope_history.event_id IS NULL
  OR (scope_history.legacy_org_id IS NULL AND scope_history.legacy_workspace_id IS NULL)
  OR (scope_history.legacy_org_id=r.organization_id AND scope_history.legacy_workspace_id=r.workspace_id))`;

export class AutomationWorker {
  private legacyScope: boolean | undefined;
  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly leaseSeconds: number,
    private readonly retryLimit: number,
    private readonly now = () => new Date(),
  ) {}
  async processOnce() {
    if (this.legacyScope === undefined) {
      const [columns] = await this.pool.query<RowDataPacket[]>(
        "SHOW COLUMNS FROM automation_executions WHERE Field IN ('organization_id','workspace_id')",
      );
      if (columns.length === 1)
        throw new Error("partial_inherited_scope_schema:automation_executions");
      this.legacyScope = columns.length === 2;
    }
    const rules = await automationRuleScopeRelation(this.pool);
    const accountMode = rules !== "automation_rules";
    if (accountMode && this.legacyScope) throw new Error("automation_account_schema_not_ready");
    const nativeOutbox = accountMode && (await nativeAutomationOutbox(this.pool));
    await this.discover(this.legacyScope, rules, accountMode, nativeOutbox);
    const job: any = await this.claim(this.legacyScope, rules, accountMode, nativeOutbox);
    if (!job) return { status: "idle" as const };
    const now = this.now();
    try {
      const [rows] = await this.pool.query<RowDataPacket[]>(
          accountMode
            ? "SELECT * FROM automation_rules WHERE id=? AND account_id=?"
            : `SELECT * FROM ${rules} r WHERE id=? AND organization_id=? AND workspace_id=?`,
          accountMode
            ? [job.rule_id, job.account_id]
            : [job.rule_id, job.organization_id, job.workspace_id],
        ),
        rule = rows[0];
      if (!rule || rule.status !== "active") {
        await this.finish(job, "succeeded", null, null, "rule_paused_before_execution");
        return { status: "suppressed" as const, execution_id: String(job.id) };
      }
      const since = new Date(now.valueOf() - Number(rule.rate_limit_window_minutes) * 60000),
        [counts] = await this.pool.query<RowDataPacket[]>(
          "SELECT COUNT(*) total FROM automation_executions WHERE rule_id=? AND status='succeeded' AND updated_at>=?",
          [rule.id, since],
        );
      if (!accountMode && Number(counts[0]?.total) >= Number(rule.rate_limit_count)) {
        await this.finish(job, "rate_limited", null, null, "rate_limit_exceeded");
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
        if (accountMode) {
          const [held] = await actionConnection.query<RowDataPacket[]>(
            "SELECT x.id FROM automation_executions x JOIN automation_rules r ON r.id=x.rule_id " +
              "JOIN account_owned_records ro ON ro.source_table='automation_rules' AND ro.source_id=r.id AND ro.account_id=r.account_id " +
              "JOIN account_owned_records xo ON xo.source_table='automation_executions' AND xo.source_id=x.id AND xo.account_id=ro.account_id AND xo.reason=ro.reason " +
              "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
              "AND (ro.reason='exclusive_owner' OR (ro.reason IN ('shared','unassigned') AND ro.account_id=cut.primary_account_id)) " +
              "WHERE x.id=? AND x.status='leased' AND x.leased_by=? AND x.attempt_count=? AND x.lease_expires_at>? " +
              "AND r.id=? AND r.account_id=? AND r.version=? AND ro.reason=? AND r.status='active' FOR UPDATE",
            [
              job.id,
              this.workerId,
              job.attempt_count,
              this.now(),
              rule.id,
              job.account_id,
              rule.version,
              job.ownership_reason,
            ],
          );
          if (!held.length || Number(job.rule_version) !== Number(rule.version))
            throw new Error("automation_execution_lease_or_rule_changed");
          const [currentCounts] = await actionConnection.query<RowDataPacket[]>(
            "SELECT COUNT(*) total FROM automation_executions WHERE rule_id=? AND status='succeeded' AND updated_at>=?",
            [rule.id, since],
          );
          if (Number(currentCounts[0]?.total) >= Number(rule.rate_limit_count)) {
            await this.finish(
              job,
              "rate_limited",
              null,
              null,
              "rate_limit_exceeded",
              actionConnection,
            );
            await this.event(
              job,
              rule,
              "automation.rate_limited",
              {
                execution_id: String(job.id),
                rule_version: Number(job.rule_version),
              },
              actionConnection,
              nativeOutbox,
            );
            await actionConnection.commit();
            return { status: "rate_limited" as const, execution_id: String(job.id) };
          }
        }
        const register = async (source: string, resource: string) => {
          if (accountMode)
            await actionConnection.query(
              "INSERT INTO account_owned_records(source_table,source_id,account_id,reason) VALUES(?,?,?,?)",
              [source, resource, job.account_id, job.ownership_reason],
            );
        };
        if (rule.action_type === "notify_owner") {
          type = "notification";
          id = randomUUID();
          await actionConnection.query(
            `INSERT INTO outbox_events (id,${nativeOutbox ? "" : "organization_id,workspace_id,"}event_type,schema_version,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at,version) VALUES (${nativeOutbox ? "?" : "?,?,?"},'automation.notification.queued',1,?,'pending',0,?,?,?,?,?,1)`,
            [
              id,
              ...(nativeOutbox ? [] : [job.organization_id, job.workspace_id]),
              JSON.stringify({
                resource_type: "automation_rule",
                resource_id: String(rule.id),
                recipient_id: String(rule.owner_id),
                title: String(rule.action_title),
                automation_execution_id: String(job.id),
                ...(nativeOutbox ? { automation_account_contract: 25 } : {}),
              }),
              now,
              job.request_id,
              job.trace_id,
              now,
              now,
            ],
          );
          await register("outbox_events", id);
        } else {
          type = "task";
          id = randomUUID();
          const nativeTask = await usesNativeBusinessTasks(actionConnection);
          if (nativeTask && (!accountMode || !job.account_id || !job.ownership_reason))
            throw new Error("automation_task_projection_owner_missing");
          const assignee = String(rule.action_assignee_id);
          await actionConnection.query(
            `INSERT INTO tasks (id,${nativeTask ? "account_id" : "organization_id,workspace_id"},title,description,status,priority,assignee_id,source_type,source_ref_id,due_at,created_by,version,created_at,updated_at) VALUES (${nativeTask ? "?,?,?,?" : "?,?,?,?,?"},'todo','normal',?,'automation',?,NULL,?,1,?,?)`,
            [
              id,
              ...(nativeTask ? [job.account_id] : [job.organization_id, job.workspace_id]),
              String(rule.action_title),
              `由自动化规则 ${rule.name}（版本 ${job.rule_version}）创建；请人工判断与处理。`,
              assignee,
              job.id,
              rule.owner_id,
              now,
              now,
            ],
          );
          const eventId = randomUUID(),
            outboxId = nativeTask ? eventId : randomUUID();
          await actionConnection.query(
            "INSERT INTO task_events (id,task_id,event_type,actor_id,payload_json,request_id,trace_id,created_at) VALUES (?,?, 'task.created',?,?,?,?,?)",
            [
              eventId,
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
            `INSERT INTO outbox_events (id,${nativeTask ? "" : "organization_id,workspace_id,"}event_type,schema_version,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at,version) VALUES (${nativeTask ? "?" : "?,?,?"},'task.created',1,?,'pending',0,?,?,?,?,?,1)`,
            [
              outboxId,
              ...(nativeTask ? [] : [job.organization_id, job.workspace_id]),
              JSON.stringify({
                resource_type: "task",
                resource_id: id,
                task_id: id,
                assignee_id: assignee,
                source_type: "automation",
                ...(nativeTask ? { task_account_contract: 25 } : {}),
              }),
              now,
              job.request_id,
              job.trace_id,
              now,
              now,
            ],
          );
          await register("tasks", id);
          await register("task_events", eventId);
          await register("outbox_events", outboxId);
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
          nativeOutbox,
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
        "UPDATE automation_executions SET status=?,available_at=DATE_ADD(?,INTERVAL 60 SECOND),lease_expires_at=NULL,last_error_code='action_failed',updated_at=? WHERE id=?" +
          (accountMode ? " AND status='leased' AND leased_by=? AND attempt_count=?" : ""),
        [
          dead ? "dead_letter" : "retry_scheduled",
          now,
          now,
          job.id,
          ...(accountMode ? [this.workerId, job.attempt_count] : []),
        ],
      );
      return {
        status: dead ? ("dead_letter" as const) : ("retry_scheduled" as const),
        execution_id: String(job.id),
        error: error instanceof Error ? error.message : "unknown",
      };
    }
  }
  private async discover(
    legacy: boolean,
    rules: string,
    accountMode: boolean,
    nativeOutbox: boolean,
  ) {
    const now = this.now();
    const notificationSource = nativeOutbox
      ? "notifications"
      : await notificationScopeRelation(this.pool);
    if (accountMode) {
      const c = await this.pool.getConnection();
      try {
        await c.beginTransaction();
        const [rows] = await c.query<RowDataPacket[]>(
          `SELECT r.id rule_id,r.version,n.id notification_id,e.request_id,e.trace_id,r.account_id,o.reason
           FROM ${rules} r JOIN account_owned_records o ON o.source_table='automation_rules' AND o.source_id=r.id AND o.account_id=r.account_id
           JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
             AND (o.reason='exclusive_owner' OR (o.reason IN ('shared','unassigned') AND o.account_id=cut.primary_account_id))
           JOIN ${notificationSource} n ON n.recipient_id=r.account_id${
             nativeOutbox
               ? nativeTriggerProofSql
               : " AND n.organization_id=r.organization_id AND n.workspace_id=r.workspace_id JOIN outbox_events e ON e.id=n.source_event_id AND e.event_type=r.trigger_event_type"
           }
           WHERE r.status='active' AND (r.condition_severity='any' OR r.condition_severity=n.severity)
             AND n.created_at>=cut.created_at
             AND EXISTS(SELECT 1 FROM notification_deliveries d WHERE d.notification_id=n.id AND d.recipient_id=n.recipient_id AND d.channel='in_app' AND d.status='delivered')
             AND NOT EXISTS(SELECT 1 FROM automation_executions x WHERE x.rule_id=r.id AND x.notification_id=n.id)
             ${nativeOutbox ? nativeTriggerHistorySql : ""}
           ORDER BY n.created_at,n.id,r.id LIMIT 100`,
        );
        for (const row of rows) {
          const id = randomUUID();
          try {
            await c.query(
              "INSERT INTO automation_executions(id,rule_id,rule_version,notification_id,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES(?,?,?,?,'queued',0,?,?,?,?,?)",
              [
                id,
                row.rule_id,
                row.version,
                row.notification_id,
                now,
                row.request_id,
                row.trace_id,
                now,
                now,
              ],
            );
          } catch (error) {
            if ((error as { code?: string }).code === "ER_DUP_ENTRY") continue;
            throw error;
          }
          await c.query(
            "INSERT INTO account_owned_records(source_table,source_id,account_id,reason) VALUES('automation_executions',?,?,?)",
            [id, row.account_id, row.reason],
          );
        }
        await c.commit();
      } catch (error) {
        await c.rollback();
        throw error;
      } finally {
        c.release();
      }
      return;
    }
    await this.pool.query(
      `INSERT IGNORE INTO automation_executions (id,${legacy ? "organization_id,workspace_id," : ""}rule_id,rule_version,notification_id,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at)
       SELECT UUID(),${legacy ? "r.organization_id,r.workspace_id," : ""}r.id,r.version,n.id,'queued',0,?,e.request_id,e.trace_id,?,?
       FROM automation_rules r JOIN ${notificationSource} n ON n.organization_id=r.organization_id AND n.workspace_id=r.workspace_id
       JOIN outbox_events e ON e.id=n.source_event_id AND e.event_type=r.trigger_event_type
       WHERE r.status='active' AND (r.condition_severity='any' OR r.condition_severity=n.severity)
       ORDER BY n.created_at LIMIT 100`,
      [now, now, now],
    );
  }
  private async claim(legacy: boolean, rules: string, accountMode: boolean, nativeOutbox: boolean) {
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
          legacy
            ? "SELECT * FROM automation_executions WHERE ((status IN ('queued','retry_scheduled') AND available_at<=?) OR (status='leased' AND lease_expires_at<=?)) ORDER BY available_at,id LIMIT 1 FOR UPDATE"
            : `SELECT x.*,r.organization_id,r.workspace_id${accountMode ? ",r.account_id,ro.reason ownership_reason" : ""} FROM automation_executions x
               JOIN ${rules} r ON r.id=x.rule_id
               JOIN ${nativeOutbox ? "notifications" : await notificationScopeRelation(c)} n ON n.id=x.notification_id${nativeOutbox ? "" : " AND n.organization_id=r.organization_id AND n.workspace_id=r.workspace_id"}
               ${
                 accountMode
                   ? "AND n.recipient_id=r.account_id " +
                     "JOIN account_owned_records ro ON ro.source_table='automation_rules' AND ro.source_id=r.id AND ro.account_id=r.account_id " +
                     "JOIN account_owned_records xo ON xo.source_table='automation_executions' AND xo.source_id=x.id AND xo.account_id=r.account_id " +
                     "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 AND n.created_at>=cut.created_at " +
                     "AND (ro.reason='exclusive_owner' OR (ro.reason IN ('shared','unassigned') AND ro.account_id=cut.primary_account_id)) " +
                     "JOIN notification_deliveries d ON d.notification_id=n.id AND d.recipient_id=n.recipient_id AND d.channel='in_app' AND d.status='delivered'"
                   : ""
               }
               ${nativeOutbox ? nativeTriggerProofSql : ""}
               WHERE ((x.status IN ('queued','retry_scheduled') AND x.available_at<=?) OR (x.status='leased' AND x.lease_expires_at<=?))
               ${nativeOutbox ? nativeTriggerHistorySql : ""}
               ${nativeOutbox ? "AND BINARY x.request_id=BINARY e.request_id AND BINARY x.trace_id=BINARY e.trace_id" : ""}
               ORDER BY x.available_at,x.id LIMIT 1 FOR UPDATE`,
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
    nativeOutbox = false,
  ) {
    const now = this.now();
    await appendBusinessAudit(
      queryable,
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
    const eventId = randomUUID();
    await queryable.query(
      `INSERT INTO outbox_events (id,${nativeOutbox ? "" : "organization_id,workspace_id,"}event_type,schema_version,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at,version) VALUES (${nativeOutbox ? "?,?" : "?,?,?,?"},1,?,'pending',0,?,?,?,?,?,1)`,
      [
        eventId,
        ...(nativeOutbox ? [] : [job.organization_id, job.workspace_id]),
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
    if (job.account_id)
      await queryable.query(
        "INSERT INTO account_owned_records(source_table,source_id,account_id,reason) VALUES('outbox_events',?,?,?)",
        [eventId, job.account_id, job.ownership_reason],
      );
  }
}
