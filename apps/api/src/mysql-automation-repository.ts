import { notificationScopeRelation, automationRuleScopeRelation, nativeAutomationOutbox } from "@scoutops/database";
import { appendBusinessAudit, appendPlatformAudit } from "@scoutops/database";
import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { rehearsalOwns, requireAccountReadRehearsal } from "./account-read-rehearsal.js";
import { AutomationServiceError, type AutomationRepository } from "./automation-service.js";

const ruleOwnerJoin = `JOIN account_owned_records owner ON owner.source_table='automation_rules' AND owner.source_id=r.id
  JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
    AND (owner.reason='exclusive_owner' OR (owner.reason IN ('shared','unassigned') AND owner.account_id=cut.primary_account_id))`;
const parse = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v),
  iso = (v: unknown) =>
    v == null ? null : (v instanceof Date ? v : new Date(String(v))).toISOString();
async function legacyExecutionScope(pool: Pick<Pool, "query">) {
  const [columns] = await pool.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM automation_executions WHERE Field IN ('organization_id','workspace_id')",
  );
  if (columns.length === 1) throw new Error("partial_inherited_scope_schema:automation_executions");
  return columns.length === 2;
}
export class MySqlAutomationRepository implements AutomationRepository {
  constructor(
    private readonly pool: Pool,
    private readonly now = () => new Date(),
  ) {}
  private view(r: any) {
    return {
      id: String(r.id),
      name: String(r.name),
      trigger_event_type: String(r.trigger_event_type),
      condition_severity: String(r.condition_severity),
      action_type: String(r.action_type),
      owner_id: String(r.owner_id),
      action_assignee_id: r.action_assignee_id ? String(r.action_assignee_id) : null,
      action_title: String(r.action_title),
      rate_limit_count: Number(r.rate_limit_count),
      rate_limit_window_minutes: Number(r.rate_limit_window_minutes),
      status: String(r.status),
      version: Number(r.version),
      latest_execution_status: r.latest_execution_status ? String(r.latest_execution_status) : null,
      latest_execution_at: iso(r.latest_execution_at),
      latest_error_code: r.latest_error_code ? String(r.latest_error_code) : null,
      created_at: iso(r.created_at),
      updated_at: iso(r.updated_at),
    };
  }
  async list(i: any) {
    const accountMode = "accountId" in i;
    if (accountMode) await requireAccountReadRehearsal(this.pool);
    const rules = await automationRuleScopeRelation(this.pool);
    const sameScope = await legacyExecutionScope(this.pool)
      ? " AND e2.organization_id=r.organization_id AND e2.workspace_id=r.workspace_id" : "";
    if (accountMode) {
      const [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT r.*,e.status latest_execution_status,e.updated_at latest_execution_at,
                e.last_error_code latest_error_code
         FROM ${rules} r
         ${ruleOwnerJoin}
         LEFT JOIN automation_executions e ON e.id=(
           SELECT e2.id FROM automation_executions e2 WHERE e2.rule_id=r.id${sameScope}
             AND ${rehearsalOwns("automation_executions", "e2.id", "owner.account_id")}
           ORDER BY e2.created_at DESC,e2.id DESC LIMIT 1
         )
         WHERE owner.account_id=?${rules === "automation_rules" ? "" : " AND r.account_id=owner.account_id"} ORDER BY r.updated_at DESC,r.id`,
        [i.accountId],
      );
      return rows.map((row) => this.view(row));
    }
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT r.*,e.status latest_execution_status,e.updated_at latest_execution_at," +
        `e.last_error_code latest_error_code FROM ${rules} r LEFT JOIN automation_executions e ` +
        `ON e.id=(SELECT e2.id FROM automation_executions e2 WHERE e2.rule_id=r.id${sameScope} ORDER BY ` +
        "e2.created_at DESC,e2.id DESC LIMIT 1) WHERE r.organization_id=? AND r.workspace_id=? " +
        "ORDER BY r.updated_at DESC,r.id",
      [i.organizationId, i.workspaceId],
    );
    return rows.map((r) => this.view(r));
  }
  async preview(i: any) {
    await this.member(i.organizationId, i.workspaceId, i.value.owner_id);
    if (i.value.action_assignee_id)
      await this.member(i.organizationId, i.workspaceId, i.value.action_assignee_id);
    const previewNow = this.now(),
      thirtyDaysAgo = new Date(previewNow.valueOf() - 30 * 24 * 60 * 60 * 1000),
      rateWindowStart = new Date(
        previewNow.valueOf() - i.value.rate_limit_window_minutes * 60 * 1000,
      ),
      severitySql = i.value.condition_severity === "any" ? "" : " AND n.severity=?",
      args = [
        i.organizationId,
        i.workspaceId,
        i.value.trigger_event_type,
        ...(severitySql ? [i.value.condition_severity] : []),
      ],
      [counts] = await this.pool.query<RowDataPacket[]>(
        "SELECT SUM(n.created_at>=?) matched_30d,SUM(n.created_at>=?) matched_in_window " +
          `FROM ${await notificationScopeRelation(this.pool)} n JOIN outbox_events e ON e.id=n.source_event_id ` +
          "WHERE n.organization_id=? AND n.workspace_id=? AND e.event_type=?" +
          severitySql,
        [thirtyDaysAgo, rateWindowStart, ...args],
      ),
      [samples] = await this.pool.query<RowDataPacket[]>(
        "SELECT n.id notification_id,n.title,n.severity,n.created_at,e.event_type " +
          `FROM ${await notificationScopeRelation(this.pool)} n JOIN outbox_events e ON e.id=n.source_event_id ` +
          "WHERE n.organization_id=? AND n.workspace_id=? AND e.event_type=?" +
          severitySql +
          " ORDER BY n.created_at DESC,n.id DESC LIMIT 5",
        args,
      ),
      matchedInWindow = Number(counts[0]?.matched_in_window ?? 0),
      projected = Math.min(matchedInWindow, i.value.rate_limit_count);
    return {
      mode: "read_only",
      matched_30d: Number(counts[0]?.matched_30d ?? 0),
      matched_in_rate_window: matchedInWindow,
      projected_action_count: projected,
      projected_task_count: i.value.action_type === "create_task" ? projected : 0,
      projected_notification_count: i.value.action_type === "notify_owner" ? projected : 0,
      rate_limit_count: i.value.rate_limit_count,
      rate_limit_window_minutes: i.value.rate_limit_window_minutes,
      samples: samples.map((row) => ({
        notification_id: String(row.notification_id),
        title: String(row.title),
        severity: String(row.severity),
        event_type: String(row.event_type),
        created_at: iso(row.created_at),
      })),
    };
  }
  async detail(i: any) {
    const accountId = "accountId" in i ? String(i.accountId) : null;
    if (accountId !== null) await requireAccountReadRehearsal(this.pool);
    const rules = await automationRuleScopeRelation(this.pool);
    const [rows] = await this.pool.query<RowDataPacket[]>(
      accountId === null
        ? `SELECT * FROM ${rules} r WHERE id=? AND organization_id=? AND workspace_id=?`
        : `SELECT r.* FROM ${rules} r ${ruleOwnerJoin} WHERE r.id=? AND owner.account_id=?${rules === "automation_rules" ? "" : " AND r.account_id=owner.account_id"}`,
      accountId === null ? [i.ruleId, i.organizationId, i.workspaceId] : [i.ruleId, accountId],
    );
    if (!rows[0])
      throw new AutomationServiceError("automation_rule_not_found", 404, "刷新规则列表。");
    const legacy = await legacyExecutionScope(this.pool);
    const scope = legacy ? "e" : "r";
    const ruleJoin = legacy ? "" : `JOIN ${rules} r ON r.id=e.rule_id`;
    const accountRule = accountId !== null && rules !== "automation_rules";
    const nativeOutbox = accountRule && await nativeAutomationOutbox(this.pool);
    let nativeTask = nativeOutbox;
    if (accountRule && !nativeOutbox) {
      const [columns] = await this.pool.query<RowDataPacket[]>(
        "SHOW COLUMNS FROM tasks WHERE Field IN ('account_id','organization_id','workspace_id')",
      );
      const shape = columns.map(row => row.Field).sort().join(",");
      if (shape !== "account_id" && shape !== "organization_id,workspace_id")
        throw new Error("automation_task_scope_schema_invalid");
      nativeTask = shape === "account_id";
    }
    if (nativeOutbox && legacy) throw new Error("automation_account_schema_not_ready");
    const [executions] = await this.pool.query<RowDataPacket[]>(
      accountId === null
        ? "SELECT e.id,e.rule_version,e.notification_id,e.status,e.attempt_count,e.action_resource_type," +
            "e.action_resource_id,e.last_error_code,e.created_at,e.updated_at FROM automation_executions e " +
            `${ruleJoin} WHERE e.rule_id=? AND ${scope}.organization_id=? AND ${scope}.workspace_id=? ORDER BY e.created_at DESC LIMIT ` +
            "100"
        : `SELECT e.id,e.rule_version,n.id notification_id,e.status,e.attempt_count,e.action_resource_type,
                t.id action_resource_id,e.last_error_code,e.created_at,e.updated_at
         FROM automation_executions e ${ruleJoin}
         LEFT JOIN ${nativeOutbox ? "notifications" : await notificationScopeRelation(this.pool)} n ON n.id=e.notification_id AND n.recipient_id=?
           ${nativeOutbox ? `AND (
             EXISTS (SELECT 1 FROM outbox_event_scope_history h WHERE h.event_id=n.source_event_id
               AND h.legacy_org_id=r.organization_id AND h.legacy_workspace_id=r.workspace_id)
             OR (NOT EXISTS (SELECT 1 FROM outbox_event_scope_history h WHERE h.event_id=n.source_event_id
               AND (h.legacy_org_id IS NOT NULL OR h.legacy_workspace_id IS NOT NULL))
               AND ${rehearsalOwns("outbox_events", "n.source_event_id", "r.account_id")})
           )` : `AND n.organization_id=${scope}.organization_id AND n.workspace_id=${scope}.workspace_id`}
         LEFT JOIN tasks t ON e.action_resource_type='task' AND t.id=e.action_resource_id
           ${nativeTask ? "AND t.account_id=r.account_id" : `AND t.organization_id=${scope}.organization_id AND t.workspace_id=${scope}.workspace_id`}
           AND t.deleted_at IS NULL AND ${rehearsalOwns("tasks", "t.id", "?")}
         WHERE e.rule_id=? ${nativeOutbox ? "AND r.account_id=?" : `AND ${scope}.organization_id=? AND ${scope}.workspace_id=?`}
           AND ${rehearsalOwns("automation_executions", "e.id", "?")}
         ORDER BY e.created_at DESC,e.id DESC LIMIT 100`,
      accountId === null
        ? [i.ruleId, i.organizationId, i.workspaceId]
        : [
            accountId,
            accountId,
            i.ruleId,
            ...(nativeOutbox ? [accountId] : [rows[0].organization_id, rows[0].workspace_id]),
            accountId,
          ],
    );
    return {
      ...this.view(rows[0]),
      executions: executions.map((r) => ({
        ...r,
        rule_version: Number(r.rule_version),
        attempt_count: Number(r.attempt_count),
        created_at: iso(r.created_at),
        updated_at: iso(r.updated_at),
      })),
    };
  }
  async create(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    await this.member(i.organizationId, i.workspaceId, i.value.owner_id);
    if (i.value.action_assignee_id)
      await this.member(i.organizationId, i.workspaceId, i.value.action_assignee_id);
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      await c.query(
        "INSERT INTO automation_rules (id,organization_id,workspace_id,name,trigger_event_type," +
          "condition_severity,action_type,owner_id,action_assignee_id,action_title," +
          "rate_limit_count,rate_limit_window_minutes,status,version,created_by,created_at," +
          "updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'active',1,?,?,?)",
        [
          i.id,
          i.organizationId,
          i.workspaceId,
          i.value.name,
          i.value.trigger_event_type,
          i.value.condition_severity,
          i.value.action_type,
          i.value.owner_id,
          i.value.action_assignee_id,
          i.value.action_title,
          i.value.rate_limit_count,
          i.value.rate_limit_window_minutes,
          i.actorId,
          now,
          now,
        ],
      );
      const result = { id: i.id, status: "active", version: 1 };
      await this.record(
        c,
        i,
        "automation.rule.created",
        i.id,
        {
          ...result,
          trigger_event_type: i.value.trigger_event_type,
          action_type: i.value.action_type,
        },
        now,
      );
      await this.save(c, i, i.id, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async update(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    await this.member(i.organizationId, i.workspaceId, i.value.owner_id);
    if (i.value.action_assignee_id)
      await this.member(i.organizationId, i.workspaceId, i.value.action_assignee_id);
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT version FROM automation_rules WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
        [i.ruleId, i.organizationId, i.workspaceId],
      );
      if (!rows[0])
        throw new AutomationServiceError("automation_rule_not_found", 404, "刷新规则列表。");
      if (Number(rows[0].version) !== i.value.expected_version)
        throw new AutomationServiceError(
          "automation_version_conflict",
          409,
          "规则已被其他人修改，刷新后重试。",
        );
      const next = i.value.expected_version + 1;
      await c.query(
        "UPDATE automation_rules SET name=?,trigger_event_type=?,condition_severity=?," +
          "action_type=?,owner_id=?,action_assignee_id=?,action_title=?,rate_limit_count=?," +
          "rate_limit_window_minutes=?,version=?,updated_at=? WHERE id=?",
        [
          i.value.name,
          i.value.trigger_event_type,
          i.value.condition_severity,
          i.value.action_type,
          i.value.owner_id,
          i.value.action_assignee_id,
          i.value.action_title,
          i.value.rate_limit_count,
          i.value.rate_limit_window_minutes,
          next,
          now,
          i.ruleId,
        ],
      );
      const result = { id: i.ruleId, version: next };
      await this.record(
        c,
        i,
        "automation.rule.updated",
        i.ruleId,
        { ...result, reason: i.value.reason },
        now,
      );
      await this.save(c, i, i.ruleId, result, now);
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async changeStatus(i: any) {
    const account = "accountId" in i;
    if (account) i = { ...i, actorId: i.accountId, route: i.route + "#account-v1" };
    const old = account ? null : await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      if (account) {
        await requireAccountReadRehearsal(c, { lockForTransaction: true });
        if (await automationRuleScopeRelation(c) === "automation_rules")
          throw new AutomationServiceError("automation_account_schema_not_ready", 503, "先应用隔离规则迁移。");
        const [actors] = await c.query<RowDataPacket[]>(
          "SELECT id FROM users WHERE id=? AND status='active' AND email_verified_at IS NOT NULL FOR UPDATE", [i.actorId]);
        if (!actors.length) throw new AutomationServiceError("automation_actor_forbidden", 403, "请使用已验证账号。");
      }
      const [rows] = await c.query<RowDataPacket[]>(
        account ? `SELECT r.* FROM automation_rules r ${ruleOwnerJoin} WHERE r.id=? AND r.account_id=? AND owner.account_id=r.account_id FOR UPDATE`
          : "SELECT * FROM automation_rules WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
        account ? [i.ruleId,i.actorId] : [i.ruleId, i.organizationId, i.workspaceId],
      );
      const r = rows[0];
      if (!r) throw new AutomationServiceError("automation_rule_not_found", 404, "刷新规则列表。");
      if (account) {
        const [receipts] = await c.query<RowDataPacket[]>(
          "SELECT rule_id,result_json FROM automation_operations WHERE actor_id=? AND route_key=? AND idempotency_key=? FOR UPDATE",
          [i.actorId,i.route,i.idempotencyKey]);
        if (receipts[0]) {
          const data = parse(receipts[0].result_json);
          if (receipts[0].rule_id !== i.ruleId || data.action !== i.value.action ||
              data.expected_version !== i.value.expected_version || data.reason !== i.value.reason)
            throw new AutomationServiceError("automation_idempotency_conflict",409,"请为不同操作使用新的幂等键。");
          await c.commit();
          return data.result;
        }
      }
      if (Number(r.version) !== i.value.expected_version)
        throw new AutomationServiceError("automation_version_conflict", 409, "刷新规则后重试。");
      const target = i.value.action === "pause" ? "paused" : "active";
      if (r.status === target)
        throw new AutomationServiceError(
          "automation_state_invalid",
          409,
          `规则已经${target === "paused" ? "暂停" : "启用"}。`,
        );
      const version = Number(r.version) + 1;
      await c.query("UPDATE automation_rules SET status=?,version=?,updated_at=? WHERE id=?", [
        target,
        version,
        now,
        i.ruleId,
      ]);
      const result = { id: i.ruleId, status: target, version };
      if (account) await appendPlatformAudit(c,
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) VALUES(?,NULL,NULL,?,?,'automation_rule',?,'succeeded',?,?,?,?,1)",
        [randomUUID(),i.actorId,target === "paused" ? "automation.rule.paused" : "automation.rule.resumed",
          i.ruleId,i.requestId,i.traceId,JSON.stringify({...result,reason:i.value.reason}),now]);
      else await this.record(
        c,
        i,
        target === "paused" ? "automation.rule.paused" : "automation.rule.resumed",
        i.ruleId,
        { ...result, reason: i.value.reason },
        now,
      );
      await this.save(c, i, i.ruleId, account ? { ...i.value,result } : result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  private async member(org: string, ws: string, user: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT m.id FROM memberships m LEFT JOIN membership_data_scopes s ON s.membership_id=m.id " +
        "WHERE m.organization_id=? AND m.user_id=? AND m.status='active' AND (s.scope_type='organization' " +
        "OR (s.scope_type='workspace' AND s.workspace_id=?)) LIMIT 1",
      [org, user, ws],
    );
    if (!rows[0])
      throw new AutomationServiceError(
        "automation_member_scope_invalid",
        409,
        "选择可访问当前工作区的活动成员。",
      );
  }
  private async operation(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT result_json FROM automation_operations WHERE actor_id=? AND route_key=? AND idempotency_key=?",
      [i.actorId, i.route, i.idempotencyKey],
    );
    return rows[0] ? parse(rows[0].result_json) : null;
  }
  private save(c: PoolConnection, i: any, id: string, result: any, now: Date) {
    return c.query(
      "INSERT INTO automation_operations (id,actor_id,route_key,idempotency_key," +
        "rule_id,result_json,created_at) VALUES (?,?,?,?,?,?,?)",
      [randomUUID(), i.actorId, i.route, i.idempotencyKey, id, JSON.stringify(result), now],
    );
  }
  private async record(
    c: PoolConnection,
    i: any,
    event: string,
    id: string,
    payload: any,
    now: Date,
  ) {
    await appendBusinessAudit(c,
        "INSERT INTO audit_logs (id,organization_id,workspace_id,actor_id,action," +
        "resource_type,resource_id,request_id,trace_id,metadata_json,occurred_at," +
        "schema_version) VALUES (?,?,?,?,?,'automation_rule',?,?,?,?,?,1)",
      [
        randomUUID(),
        i.organizationId,
        i.workspaceId,
        i.actorId,
        event,
        id,
        i.requestId,
        i.traceId,
        JSON.stringify(payload),
        now,
      ],
    );
    await c.query(
      "INSERT INTO outbox_events (id,organization_id,workspace_id,event_type,schema_version," +
        "payload_json,status,attempt_count,available_at,request_id,trace_id,created_at," +
        "updated_at,version) VALUES (?,?,?,?,1,?,'pending',0,?,?,?,?,?,1)",
      [
        randomUUID(),
        i.organizationId,
        i.workspaceId,
        event,
        JSON.stringify({
          resource_type: "automation_rule",
          resource_id: id,
          ...payload,
        }),
        now,
        i.requestId,
        i.traceId,
        now,
        now,
      ],
    );
  }
}
