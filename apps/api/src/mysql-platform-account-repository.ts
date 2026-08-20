import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { PlatformAccountRepository } from "./platform-account-service.js";
import { PlatformAccountError } from "./platform-account-service.js";
const iso = (v: unknown) =>
  v === null || v === undefined ? null : new Date(v as string | Date).toISOString();
export class MySqlPlatformAccountRepository implements PlatformAccountRepository {
  constructor(private readonly pool: Pool) {}
  async overview(input: Parameters<PlatformAccountRepository["overview"]>[0]) {
    const like = `%${input.query.replace(/[\\%_]/g, "\\$&")}%`,
      status = input.status;
    const [organizations, users, admins, summary] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        "SELECT o.id,o.name,o.slug,o.status,o.timezone,o.data_retention_days,o.created_at," +
          "o.updated_at,COUNT(DISTINCT m.id) member_count,COUNT(DISTINCT w.id) workspace_count " +
          "FROM organizations o LEFT JOIN memberships m ON m.organization_id=o.id LEFT JOIN workspaces " +
          "w ON w.organization_id=o.id WHERE (?='' OR o.name LIKE ? ESCAPE '\\\\' OR o.slug LIKE " +
          "? ESCAPE '\\\\') AND (?='' OR o.status=?) GROUP BY o.id ORDER BY o.updated_at DESC LIMIT " +
          "?",
        [input.query, like, like, status, status, input.limit],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT u.id,u.email,u.status,u.must_change_password,u.must_enroll_mfa,u.created_at," +
          "u.updated_at,COUNT(DISTINCT m.organization_id) organization_count,GROUP_CONCAT(DISTINCT " +
          "o.name ORDER BY o.name SEPARATOR '、') organization_names,GROUP_CONCAT(DISTINCT pra.role_code " +
          "ORDER BY pra.role_code SEPARATOR ',') platform_roles,(SELECT COUNT(*) FROM user_sessions " +
          "s WHERE s.user_id=u.id AND s.status='active' AND s.expires_at>UTC_TIMESTAMP(3)) active_session_count " +
          "FROM users u LEFT JOIN memberships m ON m.user_id=u.id LEFT JOIN organizations o ON " +
          "o.id=m.organization_id LEFT JOIN platform_role_assignments pra ON pra.user_id=u.id WHERE " +
          "(?='' OR u.email LIKE ? ESCAPE '\\\\') AND (?='' OR u.status=?) GROUP BY u.id ORDER BY " +
          "u.updated_at DESC LIMIT ?",
        [input.query, like, status, status, input.limit],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT u.id,u.email,u.status,GROUP_CONCAT(pra.role_code ORDER BY pra.role_code SEPARATOR " +
          "',') roles,MIN(pra.created_at) granted_at FROM users u LEFT JOIN platform_role_assignments " +
          "pra ON pra.user_id=u.id WHERE (?='' OR u.email LIKE ? ESCAPE '\\\\') AND (?='' OR u.status=?) " +
          "GROUP BY u.id ORDER BY (MIN(pra.created_at) IS NULL),MIN(pra.created_at)," +
          "u.email LIMIT ?",
        [input.query, like, status, status, input.limit],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT (SELECT COUNT(*) FROM organizations) organizations,(SELECT COUNT(*) FROM organizations " +
          "WHERE status='active') active_organizations,(SELECT COUNT(*) FROM users) users," +
          "(SELECT COUNT(*) FROM users WHERE status='active') active_users,(SELECT COUNT(DISTINCT " +
          "user_id) FROM platform_role_assignments) platform_admins",
        [],
      ),
    ]);
    return {
      summary: {
        organizations: Number(summary[0][0]?.organizations ?? 0),
        active_organizations: Number(summary[0][0]?.active_organizations ?? 0),
        users: Number(summary[0][0]?.users ?? 0),
        active_users: Number(summary[0][0]?.active_users ?? 0),
        platform_admins: Number(summary[0][0]?.platform_admins ?? 0),
      },
      organizations: organizations[0].map((r) => ({
        ...r,
        member_count: Number(r.member_count),
        workspace_count: Number(r.workspace_count),
        created_at: iso(r.created_at),
        updated_at: iso(r.updated_at),
      })),
      users: users[0].map((r) => ({
        ...r,
        organization_count: Number(r.organization_count),
        active_session_count: Number(r.active_session_count),
        organization_names: r.organization_names ?? "",
        platform_roles: r.platform_roles ? String(r.platform_roles).split(",") : [],
        created_at: iso(r.created_at),
        updated_at: iso(r.updated_at),
      })),
      admins: admins[0].map((r) => ({
        ...r,
        roles: r.roles ? String(r.roles).split(",") : [],
        granted_at: iso(r.granted_at),
      })),
    };
  }
  async createOrganization(input: Parameters<PlatformAccountRepository["createOrganization"]>[0]) {
    return this.write(input, async (c) => {
      const organizationId = randomUUID(),
        workspaceId = randomUUID(),
        membershipId = randomUUID(),
        now = input.now;
      await c
        .query("SELECT id FROM users WHERE id=? AND status='active' FOR UPDATE", [
          input.initialAdminUserId,
        ])
        .then(([rows]: any) => {
          if (!rows[0])
            throw new PlatformAccountError(
              "initial_admin_unavailable",
              409,
              "首位组织管理员不存在或已停用。",
            );
        });
      await c.query(
        "INSERT INTO organizations (id,name,slug,status,timezone,data_retention_days," +
          "default_workspace_id,created_by,version,created_at,updated_at) VALUES (?," +
          "?,?,'active','Asia/Shanghai',365,NULL,?,1,?,?)",
        [organizationId, input.name, input.slug, input.actorId, now, now],
      );
      await c.query(
        "INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version," +
          "created_at,updated_at) VALUES (?,?,?,'default','active',?,1,?,?)",
        [workspaceId, organizationId, "默认工作区", input.actorId, now, now],
      );
      await c.query("UPDATE organizations SET default_workspace_id=? WHERE id=?", [
        workspaceId,
        organizationId,
      ]);
      await c.query(
        "INSERT INTO memberships (id,organization_id,user_id,status,joined_at,version," +
          "created_at,updated_at) VALUES (?,?,?,'active',?,1,?,?)",
        [membershipId, organizationId, input.initialAdminUserId, now, now, now],
      );
      await c.query(
        "INSERT INTO membership_role_assignments (membership_id,role_code,created_by," +
          "created_at) VALUES (?,'organization_admin',?,?)",
        [membershipId, input.actorId, now],
      );
      await c.query(
        "INSERT INTO membership_data_scopes (id,membership_id,scope_type,scope_key," +
          "workspace_id,team_id,created_by,version,created_at) VALUES (?,?,'organization'," +
          "'organization',NULL,NULL,?,1,?)",
        [randomUUID(), membershipId, input.actorId, now],
      );
      const result = {
        id: organizationId,
        name: input.name,
        slug: input.slug,
        status: "active",
        default_workspace_id: workspaceId,
        initial_admin_user_id: input.initialAdminUserId,
      };
      await this.audit(c, input, "organization.created", "organization", organizationId, {
        name: input.name,
        slug: input.slug,
        initial_admin_user_id: input.initialAdminUserId,
      });
      return result;
    });
  }
  async updateOrganization(input: Parameters<PlatformAccountRepository["updateOrganization"]>[0]) {
    return this.write(input, async (c) => {
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT id,version FROM organizations WHERE id=? FOR UPDATE",
        [input.organizationId],
      );
      if (!rows[0])
        throw new PlatformAccountError("organization_not_found", 404, "刷新组织列表后重试。");
      await c.query(
        "UPDATE organizations SET name=?,timezone=?,data_retention_days=?,version=version+1,updated_at=? WHERE id=?",
        [input.name, input.timezone, input.dataRetentionDays, input.now, input.organizationId],
      );
      const result = {
        id: input.organizationId,
        name: input.name,
        timezone: input.timezone,
        data_retention_days: input.dataRetentionDays,
        version: Number(rows[0].version) + 1,
      };
      await this.audit(c, input, "organization.updated", "organization", input.organizationId, {
        name: input.name,
        timezone: input.timezone,
        data_retention_days: input.dataRetentionDays,
        reason: input.reason,
      });
      return result;
    });
  }
  async createUser(input: Parameters<PlatformAccountRepository["createUser"]>[0]) {
    return this.write(input, async (c) => {
      if (input.organizationId) {
        const [orgs] = await c.query<RowDataPacket[]>(
          "SELECT id FROM organizations WHERE id=? AND status='active' FOR UPDATE",
          [input.organizationId],
        );
        if (!orgs[0])
          throw new PlatformAccountError("organization_not_available", 409, "选择仍在使用的组织。");
      }
      await c.query(
        "INSERT INTO users (id,email,email_normalized,password_hash,status,email_verified_at," +
          "failed_login_count,locked_until,password_changed_at,must_change_password," +
          "must_enroll_mfa,security_setup_completed_at,version,created_at,updated_at) VALUES (?," +
          "?,?,?,'active',?,0,NULL,?,1,?,NULL,1,?,?)",
        [
          input.userId,
          input.email,
          input.email,
          input.passwordHash,
          input.now,
          input.now,
          input.platformRoleCode ? 1 : 0,
          input.now,
          input.now,
        ],
      );
      if (input.platformRoleCode)
        await c.query(
          "INSERT INTO platform_role_assignments (user_id,role_code,created_by,created_at) VALUES (?,?,?,?)",
          [input.userId, input.platformRoleCode, input.actorId, input.now],
        );
      if (input.organizationId) {
        const membershipId = randomUUID();
        await c.query(
          "INSERT INTO memberships (id,organization_id,user_id,status,joined_at,version," +
            "created_at,updated_at) VALUES (?,?,?,'active',?,1,?,?)",
          [membershipId, input.organizationId, input.userId, input.now, input.now, input.now],
        );
        await c.query(
          "INSERT INTO membership_role_assignments (membership_id,role_code,created_by,created_at) VALUES (?,?,?,?)",
          [membershipId, input.organizationRoleCode, input.actorId, input.now],
        );
        await c.query(
          "INSERT INTO membership_data_scopes (id,membership_id,scope_type,scope_key," +
            "workspace_id,team_id,created_by,version,created_at) VALUES (?,?,'organization'," +
            "'organization',NULL,NULL,?,1,?)",
          [randomUUID(), membershipId, input.actorId, input.now],
        );
      }
      const result = {
        id: input.userId,
        email: input.email,
        status: "active",
        platform_role_code: input.platformRoleCode,
        organization_id: input.organizationId,
        must_change_password: true,
        must_enroll_mfa: Boolean(input.platformRoleCode),
      };
      await this.audit(c, input, "user.created", "user", input.userId, {
        email: input.email,
        platform_role_code: input.platformRoleCode,
        organization_id: input.organizationId,
        organization_role_code: input.organizationRoleCode,
        forced_security_setup: true,
      });
      return result;
    });
  }
  async userDetail(input: Parameters<PlatformAccountRepository["userDetail"]>[0]) {
    const [[users], [memberships], [sessions]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        "SELECT id,email,status,must_change_password,must_enroll_mfa,password_changed_at," +
          "created_at,updated_at FROM users WHERE id=? LIMIT 1",
        [input.userId],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT m.id,m.organization_id,o.name organization_name,m.status,m.joined_at," +
          "m.version,GROUP_CONCAT(mra.role_code ORDER BY mra.role_code SEPARATOR ',') roles FROM " +
          "memberships m JOIN organizations o ON o.id=m.organization_id LEFT JOIN membership_role_assignments " +
          "mra ON mra.membership_id=m.id WHERE m.user_id=? GROUP BY m.id ORDER BY m.updated_at " +
          "DESC",
        [input.userId],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT id,status,device_label,expires_at,last_seen_at,created_at FROM user_sessions " +
          "WHERE user_id=? ORDER BY last_seen_at DESC LIMIT 100",
        [input.userId],
      ),
    ]);
    if (!users[0]) throw new PlatformAccountError("user_not_found", 404, "刷新用户列表后重试。");
    return {
      user: {
        ...users[0],
        must_change_password: Boolean(users[0].must_change_password),
        must_enroll_mfa: Boolean(users[0].must_enroll_mfa),
        password_changed_at: iso(users[0].password_changed_at),
        created_at: iso(users[0].created_at),
        updated_at: iso(users[0].updated_at),
      },
      memberships: memberships.map((r: any) => ({
        ...r,
        roles: r.roles ? String(r.roles).split(",") : [],
        joined_at: iso(r.joined_at),
      })),
      sessions: sessions.map((r: any) => ({
        ...r,
        expires_at: iso(r.expires_at),
        last_seen_at: iso(r.last_seen_at),
        created_at: iso(r.created_at),
      })),
    };
  }
  async resetUserPassword(input: Parameters<PlatformAccountRepository["resetUserPassword"]>[0]) {
    return this.write(input, async (c) => {
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT id,version FROM users WHERE id=? FOR UPDATE",
        [input.userId],
      );
      if (!rows[0]) throw new PlatformAccountError("user_not_found", 404, "刷新用户列表后重试。");
      await c.query(
        "UPDATE users SET password_hash=?,password_changed_at=?,must_change_password=1," +
          "failed_login_count=0,locked_until=NULL,status='active',version=version+1," +
          "updated_at=? WHERE id=?",
        [input.passwordHash, input.now, input.now, input.userId],
      );
      await c.query(
        "UPDATE user_sessions SET status='revoked',revoked_at=? WHERE user_id=? AND status='active'",
        [input.now, input.userId],
      );
      const result = {
        id: input.userId,
        must_change_password: true,
        version: Number(rows[0].version) + 1,
      };
      await this.audit(c, input, "user.password.forced_reset", "user", input.userId, {
        reason: input.reason,
        sessions_revoked: true,
      });
      return result;
    });
  }
  async revokeUserSessions(input: Parameters<PlatformAccountRepository["revokeUserSessions"]>[0]) {
    return this.write(input, async (c) => {
      const [users] = await c.query<RowDataPacket[]>("SELECT id FROM users WHERE id=? FOR UPDATE", [
        input.userId,
      ]);
      if (!users[0]) throw new PlatformAccountError("user_not_found", 404, "刷新用户列表后重试。");
      const [result]: any = input.sessionId
        ? await c.query(
            "UPDATE user_sessions SET status='revoked',revoked_at=? WHERE id=? AND user_id=? AND status='active'",
            [input.now, input.sessionId, input.userId],
          )
        : await c.query(
            "UPDATE user_sessions SET status='revoked',revoked_at=? WHERE user_id=? AND status='active'",
            [input.now, input.userId],
          );
      const value = {
        id: input.userId,
        session_id: input.sessionId,
        revoked_count: Number(result.affectedRows ?? 0),
      };
      await this.audit(c, input, "user.sessions.revoked", "user", input.userId, {
        session_id: input.sessionId,
        revoked_count: value.revoked_count,
        reason: input.reason,
      });
      return value;
    });
  }
  async setOrganizationStatus(
    input: Parameters<PlatformAccountRepository["setOrganizationStatus"]>[0],
  ) {
    return this.write(input, async (c) => {
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT id,status,version FROM organizations WHERE id=? FOR UPDATE",
        [input.organizationId],
      );
      if (!rows[0])
        throw new PlatformAccountError("organization_not_found", 404, "刷新组织列表后重试。");
      await c.query("UPDATE organizations SET status=?,version=version+1,updated_at=? WHERE id=?", [
        input.status,
        input.now,
        input.organizationId,
      ]);
      const result = {
        id: input.organizationId,
        status: input.status,
        version: Number(rows[0].version) + 1,
      };
      await this.audit(
        c,
        input,
        "organization.status.changed",
        "organization",
        input.organizationId,
        { status: input.status, reason: input.reason },
      );
      return result;
    });
  }
  async setUserStatus(input: Parameters<PlatformAccountRepository["setUserStatus"]>[0]) {
    return this.write(input, async (c) => {
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT id,status,version FROM users WHERE id=? FOR UPDATE",
        [input.userId],
      );
      if (!rows[0]) throw new PlatformAccountError("user_not_found", 404, "刷新用户列表后重试。");
      await c.query("UPDATE users SET status=?,version=version+1,updated_at=? WHERE id=?", [
        input.status,
        input.now,
        input.userId,
      ]);
      if (input.status === "disabled")
        await c.query(
          "UPDATE user_sessions SET status='revoked',revoked_at=? WHERE user_id=? AND status='active'",
          [input.now, input.userId],
        );
      const result = {
        id: input.userId,
        status: input.status,
        version: Number(rows[0].version) + 1,
      };
      await this.audit(c, input, "user.status.changed", "user", input.userId, {
        status: input.status,
        reason: input.reason,
      });
      return result;
    });
  }
  async setPlatformRole(input: Parameters<PlatformAccountRepository["setPlatformRole"]>[0]) {
    return this.write(input, async (c) => {
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE id=? AND status<>'disabled' FOR UPDATE",
        [input.userId],
      );
      if (!rows[0])
        throw new PlatformAccountError("user_not_available", 409, "用户不存在或已停用。");
      if (input.enabled)
        await c.query(
          "INSERT IGNORE INTO platform_role_assignments (user_id,role_code,created_by,created_at) VALUES (?,?,?,?)",
          [input.userId, input.roleCode, input.actorId, input.now],
        );
      else
        await c.query("DELETE FROM platform_role_assignments WHERE user_id=? AND role_code=?", [
          input.userId,
          input.roleCode,
        ]);
      const result = {
        id: input.userId,
        role_code: input.roleCode,
        enabled: input.enabled,
      };
      await this.audit(c, input, "platform.role.changed", "user", input.userId, {
        role_code: input.roleCode,
        enabled: input.enabled,
        reason: input.reason,
      });
      return result;
    });
  }
  private async write<T>(
    input: {
      actorId: string;
      route?: string;
      idempotencyKey: string;
      requestId: string;
      traceId: string;
      now: Date;
    },
    work: (c: PoolConnection) => Promise<T>,
  ) {
    const route = input.route ?? this.routeFromInput(input);
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [operations] = await c.query<RowDataPacket[]>(
        "SELECT result_json FROM platform_account_operations WHERE actor_id=? AND route=? AND idempotency_key=? LIMIT 1",
        [input.actorId, route, input.idempotencyKey],
      );
      if (operations[0]) {
        await c.commit();
        const value = operations[0].result_json;
        return (typeof value === "string" ? JSON.parse(value) : value) as T;
      }
      const result = await work(c);
      await c.query(
        "INSERT INTO platform_account_operations (id,actor_id,route,idempotency_key,result_json,created_at) VALUES (?,?,?,?,?,?)",
        [
          randomUUID(),
          input.actorId,
          route,
          input.idempotencyKey,
          JSON.stringify(result),
          input.now,
        ],
      );
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      if (error instanceof PlatformAccountError) throw error;
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new PlatformAccountError(
          "platform_account_conflict",
          409,
          "标识或状态已变化，请刷新后重试。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
  private routeFromInput(input: any) {
    if (input.organizationId) return "/platform/accounts/organizations/status";
    if (input.userId && input.roleCode) return "/platform/accounts/admin-role";
    if (input.userId) return "/platform/accounts/users/status";
    return "/platform/accounts/organizations";
  }
  private audit(
    c: PoolConnection,
    input: any,
    action: string,
    type: string,
    id: string,
    metadata: unknown,
  ) {
    return c.query(
      "INSERT INTO platform_audit_events (id,organization_id,workspace_id,actor_id," +
        "action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at," +
        "schema_version) VALUES (?,NULL,NULL,?,?,?,?,'succeeded',?,?,?,?,1)",
      [
        randomUUID(),
        input.actorId,
        action,
        type,
        id,
        input.requestId,
        input.traceId,
        JSON.stringify(metadata),
        input.now,
      ],
    );
  }
}
