import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { AuditEvent, AuditFilter, AuditRepository, SeedAdminInput } from "@scoutops/audit";
import { AuditError } from "@scoutops/audit";
import { withTransaction } from "@scoutops/database";
const eventColumns =
  "id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version";
const mapEvent = (row: RowDataPacket): AuditEvent =>
  ({
    ...row,
    metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
    occurred_at: new Date(row.occurred_at),
  }) as AuditEvent;
export class MySqlAuditRepository implements AuditRepository {
  constructor(private readonly pool: Pool) {}
  async seedPlatformAdmin(input: SeedAdminInput) {
    return withTransaction(this.pool, async (connection) => {
      const [seedRows] = await connection.query<RowDataPacket[]>(
        "SELECT status,user_id FROM platform_seed_runs WHERE seed_key='platform-super-admin-v1' FOR UPDATE",
      );
      const seed = seedRows[0];
      if (!seed)
        throw new AuditError("seed_state_missing", 503, "先在宝塔发布任务执行 M01-06 数据迁移。");
      if (seed.status === "completed")
        return { status: "already_seeded" as const, userId: String(seed.user_id) };
      const [roleRows] = await connection.query<RowDataPacket[]>(
        "SELECT COUNT(*) count FROM platform_role_assignments WHERE role_code='platform_super_admin'",
      );
      if (Number(roleRows[0]?.count) > 0)
        throw new AuditError("seed_conflict", 409, "已有平台超级管理员；不要再次运行种子任务。");
      try {
        await connection.query(
          "INSERT INTO users (id,email,email_normalized,password_hash,status,email_verified_at," +
            "failed_login_count,locked_until,password_changed_at,must_change_password," +
            "must_enroll_mfa,security_setup_completed_at,version,created_at,updated_at) VALUES (?," +
            "?,?,?,'active',?,0,NULL,?,1,1,NULL,1,?,?)",
          [
            input.id,
            input.email,
            input.email,
            input.passwordHash,
            input.now,
            input.now,
            input.now,
            input.now,
          ],
        );
      } catch (error) {
        if (typeof error === "object" && error && "code" in error && error.code === "ER_DUP_ENTRY")
          throw new AuditError(
            "seed_email_conflict",
            409,
            "种子邮箱已存在；请由安全管理员核对账号。",
          );
        throw error;
      }
      await connection.query(
        "INSERT INTO platform_role_assignments (user_id,role_code,created_by,created_at) VALUES (?,'platform_super_admin',?,?)",
        [input.id, input.id, input.now],
      );
      await this.insert(connection, {
        id: randomUUID(),
        organization_id: null,
        workspace_id: null,
        actor_id: input.id,
        action: "platform_admin.seeded",
        resource_type: "user",
        resource_id: input.id,
        outcome: "succeeded",
        request_id: input.requestId,
        trace_id: input.traceId,
        metadata: {
          email_hash: input.emailHash,
          role_code: "platform_super_admin",
          forced_security_setup: true,
        },
        occurred_at: input.now,
        schema_version: 1,
      });
      await connection.query(
        "UPDATE platform_seed_runs SET status='completed',user_id=?,email_hash=?," +
          "request_id=?,trace_id=?,completed_at=? WHERE seed_key='platform-super-admin-v1' AND " +
          "status='pending'",
        [input.id, input.emailHash, input.requestId, input.traceId, input.now],
      );
      return { status: "created" as const, userId: input.id };
    });
  }
  private async insert(connection: Pool | PoolConnection, event: AuditEvent) {
    await connection.query(
      "INSERT INTO platform_audit_events (id,organization_id,workspace_id,actor_id," +
        "action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at," +
        "schema_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        event.id,
        event.organization_id,
        event.workspace_id,
        event.actor_id,
        event.action,
        event.resource_type,
        event.resource_id,
        event.outcome,
        event.request_id,
        event.trace_id,
        JSON.stringify(event.metadata),
        event.occurred_at,
        event.schema_version,
      ],
    );
  }
  async append(event: AuditEvent) {
    await this.insert(this.pool, event);
  }
  async list(filter: AuditFilter) {
    const scopedSource =
        filter.organizationId === undefined
          ? `(SELECT ${eventColumns} FROM platform_audit_events WHERE organization_id IS NULL) scoped_audit`
          : `(SELECT ${eventColumns} FROM platform_audit_events WHERE organization_id=?
             UNION ALL
             SELECT id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,
               'succeeded' outcome,request_id,trace_id,metadata_json metadata,occurred_at,schema_version
             FROM audit_logs WHERE organization_id=?) scoped_audit`,
      scopeParams =
        filter.organizationId === undefined ? [] : [filter.organizationId, filter.organizationId];
    const platformClauses = [
        filter.organizationId === undefined ? "organization_id IS NULL" : "organization_id=?",
      ],
      platformParams: unknown[] =
        filter.organizationId === undefined ? [] : [filter.organizationId],
      logClauses = filter.organizationId === undefined ? [] : ["organization_id=?"],
      logParams: unknown[] = filter.organizationId === undefined ? [] : [filter.organizationId],
      addBoth = (sql: string, value: unknown) => {
        platformClauses.push(sql);
        platformParams.push(value);
        if (filter.organizationId !== undefined) {
          logClauses.push(sql);
          logParams.push(value);
        }
      };
    if (filter.action) addBoth("action=?", filter.action);
    if (filter.outcome) {
      platformClauses.push("outcome=?");
      platformParams.push(filter.outcome);
      if (filter.organizationId !== undefined && filter.outcome !== "succeeded")
        logClauses.push("1=0");
    }
    if (filter.resourceType) addBoth("resource_type=?", filter.resourceType);
    if (filter.requestId) addBoth("request_id=?", filter.requestId);
    if (filter.traceId) addBoth("trace_id=?", filter.traceId);
    if (filter.occurredFrom) addBoth("occurred_at>=?", filter.occurredFrom);
    if (filter.occurredTo) addBoth("occurred_at<=?", filter.occurredTo);
    if (filter.cursor) {
      const [cursorRows] = await this.pool.query<RowDataPacket[]>(
        `SELECT occurred_at FROM ${scopedSource} WHERE id=? LIMIT 1`,
        [...scopeParams, filter.cursor],
      );
      if (!cursorRows[0])
        throw new AuditError("audit_cursor_invalid", 400, "cursor 不属于当前审计范围。");
      const cursorClause = "(occurred_at<? OR (occurred_at=? AND id<?))";
      platformClauses.push(cursorClause);
      platformParams.push(cursorRows[0].occurred_at, cursorRows[0].occurred_at, filter.cursor);
      if (filter.organizationId !== undefined) {
        logClauses.push(cursorClause);
        logParams.push(cursorRows[0].occurred_at, cursorRows[0].occurred_at, filter.cursor);
      }
    }
    const filteredSource =
        filter.organizationId === undefined
          ? `(SELECT ${eventColumns} FROM platform_audit_events WHERE ${platformClauses.join(" AND ")}) scoped_audit`
          : `(SELECT ${eventColumns} FROM platform_audit_events WHERE ${platformClauses.join(" AND ")}
             UNION ALL
             SELECT id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,
               'succeeded' outcome,request_id,trace_id,metadata_json metadata,occurred_at,schema_version
             FROM audit_logs WHERE ${logClauses.join(" AND ")}) scoped_audit`,
      params = [...platformParams, ...logParams],
      limit = filter.limit ?? 50;
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT ${eventColumns} FROM ${filteredSource} ORDER BY occurred_at DESC,id DESC LIMIT ?`,
      [...params, limit + 1],
    );
    const items = rows.slice(0, limit).map(mapEvent);
    return { items, nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null };
  }
}
