import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { AutomationServiceError, type AutomationRepository } from "./automation-service.js";
const parse = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v),
  iso = (v: unknown) =>
    v == null ? null : (v instanceof Date ? v : new Date(String(v))).toISOString();
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
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT r.*,e.status latest_execution_status,e.updated_at latest_execution_at," +
        "e.last_error_code latest_error_code FROM automation_rules r LEFT JOIN automation_executions e " +
        "ON e.id=(SELECT e2.id FROM automation_executions e2 WHERE e2.rule_id=r.id AND " +
        "e2.organization_id=r.organization_id AND e2.workspace_id=r.workspace_id ORDER BY " +
        "e2.created_at DESC,e2.id DESC LIMIT 1) WHERE r.organization_id=? AND r.workspace_id=? " +
        "ORDER BY r.updated_at DESC,r.id",
      [i.organizationId, i.workspaceId],
    );
    return rows.map((r) => this.view(r));
  }
  async detail(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM automation_rules WHERE id=? AND organization_id=? AND workspace_id=?",
      [i.ruleId, i.organizationId, i.workspaceId],
    );
    if (!rows[0])
      throw new AutomationServiceError("automation_rule_not_found", 404, "刷新规则列表。");
    const [executions] = await this.pool.query<RowDataPacket[]>(
      "SELECT id,rule_version,notification_id,status,attempt_count,action_resource_type," +
        "action_resource_id,last_error_code,created_at,updated_at FROM automation_executions " +
        "WHERE rule_id=? AND organization_id=? AND workspace_id=? ORDER BY created_at DESC LIMIT " +
        "100",
      [i.ruleId, i.organizationId, i.workspaceId],
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
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM automation_rules WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
        [i.ruleId, i.organizationId, i.workspaceId],
      );
      const r = rows[0];
      if (!r) throw new AutomationServiceError("automation_rule_not_found", 404, "刷新规则列表。");
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
      await this.record(
        c,
        i,
        target === "paused" ? "automation.rule.paused" : "automation.rule.resumed",
        i.ruleId,
        { ...result, reason: i.value.reason },
        now,
      );
      await this.save(c, i, i.ruleId, result, now);
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
    await c.query(
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
