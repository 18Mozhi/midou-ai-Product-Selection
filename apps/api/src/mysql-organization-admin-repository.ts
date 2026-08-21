import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  OrganizationAdminError,
  type OrganizationAdminRepository,
} from "./organization-admin-service.js";
const parse = (v: any) => (typeof v === "string" ? JSON.parse(v) : v),
  iso = (v: any) => (v == null ? null : (v instanceof Date ? v : new Date(v)).toISOString());
export class MySqlOrganizationAdminRepository implements OrganizationAdminRepository {
  constructor(
    private readonly pool: Pool,
    private readonly now = () => new Date(),
  ) {}
  async summary(i: any) {
    const [[o], [m], [w], [t], [a], [k], [e]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        "SELECT id,name,logo_url,timezone,data_retention_days,default_workspace_id," +
          "version,updated_at FROM organizations WHERE id=?",
        [i.organizationId],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) total,SUM(status='active') active FROM memberships WHERE organization_id=?",
        [i.organizationId],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) total,SUM(status='active') active FROM workspaces WHERE organization_id=?",
        [i.organizationId],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) total,SUM(status='active') active FROM teams WHERE organization_id=?",
        [i.organizationId],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) pending FROM approval_requests WHERE organization_id=? AND status='pending'",
        [i.organizationId],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) active FROM organization_api_tokens WHERE organization_id=? AND status='active' AND expires_at>?",
        [i.organizationId, this.now()],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) recent FROM audit_logs WHERE organization_id=? AND occurred_at>=DATE_SUB(?,INTERVAL 7 DAY)",
        [i.organizationId, this.now()],
      ),
    ]);
    if (!o[0]) throw new OrganizationAdminError("organization_not_found", 404, "重新选择组织。");
    return {
      organization: this.org(o[0]),
      members: { total: Number(m[0]?.total ?? 0), active: Number(m[0]?.active ?? 0) },
      workspaces: { total: Number(w[0]?.total ?? 0), active: Number(w[0]?.active ?? 0) },
      teams: { total: Number(t[0]?.total ?? 0), active: Number(t[0]?.active ?? 0) },
      pending_approvals: Number(a[0]?.pending ?? 0),
      active_tokens: Number(k[0]?.active ?? 0),
      recent_audit_events: Number(e[0]?.recent ?? 0),
      observed_at: this.now().toISOString(),
    };
  }
  async profile(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT id,name,logo_url,slug,status,timezone,data_retention_days,default_workspace_id," +
        "version,updated_at FROM organizations WHERE id=?",
      [i.organizationId],
    );
    if (!rows[0]) throw new OrganizationAdminError("organization_not_found", 404, "重新选择组织。");
    return this.org(rows[0]);
  }
  async updateProfile(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [ws] = await c.query<RowDataPacket[]>(
        "SELECT id FROM workspaces WHERE id=? AND organization_id=?",
        [i.value.default_workspace_id, i.organizationId],
      );
      if (!ws[0])
        throw new OrganizationAdminError("workspace_not_found", 404, "选择当前组织的工作区。");
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT version FROM organizations WHERE id=? FOR UPDATE",
        [i.organizationId],
      );
      this.version(rows[0], i.value.expected_version, "organization");
      await c.query(
        "UPDATE organizations SET name=?,logo_url=?,timezone=?,data_retention_days=?," +
          "default_workspace_id=?,version=version+1,updated_at=? WHERE id=?",
        [
          i.value.name,
          i.value.logo_url,
          i.value.timezone,
          i.value.data_retention_days,
          i.value.default_workspace_id,
          now,
          i.organizationId,
        ],
      );
      const result = {
        id: i.organizationId,
        version: Number(rows[0].version) + 1,
        updated_at: now.toISOString(),
      };
      await this.finish(
        c,
        i,
        "organization.profile.updated",
        "organization",
        i.organizationId,
        result,
        now,
      );
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async members(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT m.id,m.user_id,u.email,m.status,m.joined_at,m.version,GROUP_CONCAT(DISTINCT r.role_code " +
        "ORDER BY r.role_code) roles,GROUP_CONCAT(DISTINCT s.scope_type ORDER BY s.scope_type) " +
        "scopes,GROUP_CONCAT(DISTINCT t.id ORDER BY t.id) team_ids,GROUP_CONCAT(DISTINCT t.name " +
        "ORDER BY t.name SEPARATOR '||') team_names " +
        "FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN membership_role_assignments " +
        "r ON r.membership_id=m.id LEFT JOIN membership_data_scopes s ON s.membership_id=m.id " +
        "LEFT JOIN team_memberships tm ON tm.membership_id=m.id LEFT JOIN teams t ON t.id=tm.team_id " +
        "WHERE m.organization_id=? GROUP BY m.id,m.user_id,u.email,m.status,m.joined_at," +
        "m.version ORDER BY m.status,u.email",
      [i.organizationId],
    );
    const [invites] = await this.pool.query<RowDataPacket[]>(
      "SELECT id,email,role_code,status,expires_at,version,created_at FROM organization_invitations " +
        "WHERE organization_id=? AND status IN ('pending_delivery','pending_acceptance','expired','revoked') ORDER " +
        "BY created_at DESC",
      [i.organizationId],
    );
    return {
      items: rows.map((r) => ({
        ...r,
        joined_at: iso(r.joined_at),
        roles: r.roles ? String(r.roles).split(",") : [],
        scopes: r.scopes ? String(r.scopes).split(",") : [],
        team_ids: r.team_ids ? String(r.team_ids).split(",") : [],
        teams: r.team_names ? String(r.team_names).split("||") : [],
      })),
      invitations: invites.map((r) => ({
        ...r,
        expires_at: iso(r.expires_at),
        created_at: iso(r.created_at),
      })),
    };
  }
  async invite(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [dupe] = await c.query<RowDataPacket[]>(
        "SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=? " +
          "AND u.email_normalized=? UNION SELECT 1 FROM organization_invitations WHERE organization_id=? " +
          "AND email_normalized=? AND status IN ('pending_delivery','pending_acceptance') LIMIT " +
          "1",
        [i.organizationId, i.value.email, i.organizationId, i.value.email],
      );
      if (dupe[0])
        throw new OrganizationAdminError(
          "member_or_invitation_exists",
          409,
          "检查现有成员或邀请记录。",
        );
      await c.query(
        "INSERT INTO organization_invitations (id,organization_id,email,email_normalized," +
          "role_code,status,expires_at,invited_by,version,created_at,updated_at) VALUES (?," +
          "?,?,?,?,'pending_delivery',?,?,1,?,?)",
        [
          i.id,
          i.organizationId,
          i.value.email,
          i.value.email,
          i.value.role_code,
          i.value.expires_at,
          i.actorId,
          now,
          now,
        ],
      );
      const result = {
        id: i.id,
        email: i.value.email,
        role_code: i.value.role_code,
        status: "pending_delivery",
        expires_at: i.value.expires_at.toISOString(),
        delivery_mode: "provider_pending",
      };
      await this.finish(
        c,
        i,
        "organization.invitation.created",
        "organization_invitation",
        i.id,
        result,
        now,
      );
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async memberAction(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM memberships WHERE id=? AND organization_id=? FOR UPDATE",
        [i.membershipId, i.organizationId],
      );
      this.version(rows[0], i.value.expected_version, "membership");
      if (rows[0].user_id === i.actorId && i.value.action === "disable")
        throw new OrganizationAdminError(
          "self_disable_forbidden",
          409,
          "由另一位组织管理员禁用该成员。",
        );
      if (
        i.value.action === "disable" &&
        (await this.isLastAdmin(c, i.organizationId, i.membershipId))
      )
        throw new OrganizationAdminError("last_admin_forbidden", 409, "先分配另一位组织管理员。");
      const status = i.value.action === "disable" ? "disabled" : "active",
        version = Number(rows[0].version) + 1;
      await c.query("UPDATE memberships SET status=?,version=?,updated_at=? WHERE id=?", [
        status,
        version,
        now,
        i.membershipId,
      ]);
      const result = { id: i.membershipId, status, version };
      await this.finish(
        c,
        i,
        `organization.member.${i.value.action}d`,
        "membership",
        i.membershipId,
        result,
        now,
      );
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async roles(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT r.code,r.name,r.description,GROUP_CONCAT(rc.capability_code ORDER BY rc.capability_code) " +
        "capabilities FROM roles r LEFT JOIN role_capabilities rc ON rc.role_code=r.code WHERE " +
        "r.category='organization' AND r.status='active' GROUP BY r.code,r.name,r.description " +
        "ORDER BY r.code",
    );
    return rows.map((r) => ({
      ...r,
      capabilities: r.capabilities ? String(r.capabilities).split(",") : [],
    }));
  }
  async assignRole(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [m] = await c.query<RowDataPacket[]>(
        "SELECT * FROM memberships WHERE id=? AND organization_id=? FOR UPDATE",
        [i.membershipId, i.organizationId],
      );
      if (!m[0]) throw new OrganizationAdminError("membership_not_found", 404, "刷新成员列表。");
      const [existing] = await c.query<RowDataPacket[]>(
        "SELECT role_code FROM membership_role_assignments WHERE membership_id=?",
        [i.membershipId],
      );
      if (
        existing.some((x) => x.role_code === "organization_admin") &&
        i.value.role_code !== "organization_admin" &&
        (await this.isLastAdmin(c, i.organizationId, i.membershipId))
      )
        throw new OrganizationAdminError("last_admin_forbidden", 409, "先分配另一位组织管理员。");
      await c.query("DELETE FROM membership_role_assignments WHERE membership_id=?", [
        i.membershipId,
      ]);
      await c.query(
        "INSERT INTO membership_role_assignments (membership_id,role_code,created_by,created_at) VALUES (?,?,?,?)",
        [i.membershipId, i.value.role_code, i.actorId, now],
      );
      await c.query("UPDATE memberships SET version=version+1,updated_at=? WHERE id=?", [
        now,
        i.membershipId,
      ]);
      const result = {
        id: i.membershipId,
        role_code: i.value.role_code,
        version: Number(m[0].version) + 1,
      };
      await this.finish(
        c,
        i,
        "organization.member.role_assigned",
        "membership",
        i.membershipId,
        result,
        now,
      );
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async workspaces(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT w.*,COUNT(DISTINCT s.membership_id) member_count FROM workspaces w LEFT JOIN " +
        "membership_data_scopes s ON s.workspace_id=w.id WHERE w.organization_id=? GROUP BY w.id " +
        "ORDER BY w.status,w.name",
      [i.organizationId],
    );
    return rows.map((r) => ({
      ...r,
      member_count: Number(r.member_count),
      created_at: iso(r.created_at),
      updated_at: iso(r.updated_at),
    }));
  }
  async createWorkspace(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      await c.query(
        "INSERT INTO workspaces (id,organization_id,name,slug,status,created_by,version," +
          "created_at,updated_at) VALUES (?,?,?,?,'active',?,1,?,?)",
        [i.id, i.organizationId, i.value.name, i.value.slug, i.actorId, now, now],
      );
      const result = {
        id: i.id,
        name: i.value.name,
        slug: i.value.slug,
        status: "active",
        version: 1,
      };
      await this.finish(c, i, "organization.workspace.created", "workspace", i.id, result, now);
      await c.commit();
      return result;
    } catch (e: any) {
      await c.rollback();
      if (e?.code === "ER_DUP_ENTRY")
        throw new OrganizationAdminError("workspace_slug_conflict", 409, "更换工作区标识。");
      throw e;
    } finally {
      c.release();
    }
  }
  async workspaceAction(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT w.*,o.default_workspace_id FROM workspaces w JOIN organizations o ON o.id=w.organization_id " +
          "WHERE w.id=? AND w.organization_id=? FOR UPDATE",
        [i.workspaceId, i.organizationId],
      );
      this.version(rows[0], i.value.expected_version, "workspace");
      if (i.value.action === "archive" && rows[0].default_workspace_id === i.workspaceId)
        throw new OrganizationAdminError(
          "default_workspace_archive_forbidden",
          409,
          "先修改组织默认工作区。",
        );
      const status = i.value.action === "archive" ? "archived" : "active",
        version = Number(rows[0].version) + 1;
      await c.query("UPDATE workspaces SET status=?,version=?,updated_at=? WHERE id=?", [
        status,
        version,
        now,
        i.workspaceId,
      ]);
      const result = { id: i.workspaceId, status, version };
      await this.finish(
        c,
        i,
        `organization.workspace.${i.value.action}d`,
        "workspace",
        i.workspaceId,
        result,
        now,
      );
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async teams(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT t.*,u.email lead_email,COUNT(tm.membership_id) member_count FROM teams t LEFT " +
        "JOIN memberships lm ON lm.id=t.lead_membership_id LEFT JOIN users u ON u.id=lm.user_id " +
        "LEFT JOIN team_memberships tm ON tm.team_id=t.id WHERE t.organization_id=? GROUP BY " +
        "t.id,u.email ORDER BY t.status,t.name",
      [i.organizationId],
    );
    return rows.map((r) => ({
      ...r,
      member_count: Number(r.member_count),
      created_at: iso(r.created_at),
      updated_at: iso(r.updated_at),
    }));
  }
  async createTeam(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      if (i.value.lead_membership_id)
        await this.sameMember(c, i.organizationId, i.value.lead_membership_id);
      await c.query(
        "INSERT INTO teams (id,organization_id,name,lead_membership_id,default_workflow_key," +
          "status,created_by,version,created_at,updated_at) VALUES (?,?,?,?,?,'active'," +
          "?,1,?,?)",
        [
          i.id,
          i.organizationId,
          i.value.name,
          i.value.lead_membership_id,
          i.value.default_workflow_key,
          i.actorId,
          now,
          now,
        ],
      );
      if (i.value.lead_membership_id)
        await c.query(
          "INSERT INTO team_memberships (team_id,membership_id,created_by,created_at) VALUES (?,?,?,?)",
          [i.id, i.value.lead_membership_id, i.actorId, now],
        );
      const result = { id: i.id, name: i.value.name, status: "active", version: 1 };
      await this.finish(c, i, "organization.team.created", "team", i.id, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async teamMemberAction(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [t] = await c.query<RowDataPacket[]>(
        "SELECT id FROM teams WHERE id=? AND organization_id=? FOR UPDATE",
        [i.teamId, i.organizationId],
      );
      if (!t[0]) throw new OrganizationAdminError("team_not_found", 404, "刷新团队列表。");
      await this.sameMember(c, i.organizationId, i.value.membership_id);
      if (i.value.action === "assign")
        await c.query(
          "INSERT IGNORE INTO team_memberships (team_id,membership_id,created_by,created_at) VALUES (?,?,?,?)",
          [i.teamId, i.value.membership_id, i.actorId, now],
        );
      else
        await c.query("DELETE FROM team_memberships WHERE team_id=? AND membership_id=?", [
          i.teamId,
          i.value.membership_id,
        ]);
      const result = { id: i.teamId, membership_id: i.value.membership_id, action: i.value.action };
      await this.finish(
        c,
        i,
        `organization.team.member_${i.value.action}ed`,
        "team",
        i.teamId,
        result,
        now,
      );
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async approvals(i: any) {
    const [summary] = await this.pool.query<RowDataPacket[]>(
      "SELECT status,COUNT(*) count FROM approval_requests WHERE organization_id=? GROUP BY status",
      [i.organizationId],
    );
    const [items] = await this.pool.query<RowDataPacket[]>(
      "SELECT id,workspace_id,template_id,resource_type,resource_id,title,status," +
        "current_node_ordinal,requested_by,created_at,completed_at,version FROM approval_requests " +
        "WHERE organization_id=? ORDER BY created_at DESC LIMIT 100",
      [i.organizationId],
    );
    const [templates] = await this.pool.query<RowDataPacket[]>(
      "SELECT t.id,t.name,t.resource_type,t.status,t.current_version,t.revision,w.name " +
        "workspace_name,COUNT(n.id) node_count FROM approval_templates t JOIN workspaces w ON " +
        "w.id=t.workspace_id LEFT JOIN approval_template_versions v ON v.template_id=t.id AND " +
        "v.version_number=t.current_version LEFT JOIN approval_template_nodes n ON " +
        "n.template_version_id=v.id WHERE t.organization_id=? GROUP BY t.id,t.name,t.resource_type," +
        "t.status,t.current_version,t.revision,w.name ORDER BY t.status,t.name",
      [i.organizationId],
    );
    return {
      summary: Object.fromEntries(summary.map((r) => [String(r.status), Number(r.count)])),
      templates: templates.map((r) => ({ ...r, node_count: Number(r.node_count) })),
      items: items.map((r) => ({
        ...r,
        current_node_ordinal: Number(r.current_node_ordinal),
        created_at: iso(r.created_at),
        completed_at: iso(r.completed_at),
      })),
    };
  }
  async data(i: any) {
    const [comparisons] = await this.pool.query<RowDataPacket[]>(
      "SELECT w.id,w.name,w.status," +
        "(SELECT COUNT(*) FROM trend_topics t WHERE t.organization_id=w.organization_id AND t.workspace_id=w.id) trends," +
        "(SELECT COUNT(*) FROM opportunities o WHERE o.organization_id=w.organization_id AND o.workspace_id=w.id) opportunities," +
        "(SELECT COUNT(*) FROM tasks k WHERE k.organization_id=w.organization_id AND k.workspace_id=w.id AND k.deleted_at IS NULL) tasks," +
        "(SELECT COUNT(*) FROM report_exports e WHERE e.organization_id=w.organization_id AND e.workspace_id=w.id) exports " +
        "FROM workspaces w WHERE w.organization_id=? ORDER BY w.status,w.name",
      [i.organizationId],
    );
    const [exports] = await this.pool.query<RowDataPacket[]>(
      "SELECT e.id,e.report_type,e.status,e.row_count,e.created_at,e.updated_at,w.name workspace_name " +
        "FROM report_exports e JOIN workspaces w ON w.id=e.workspace_id WHERE e.organization_id=? " +
        "ORDER BY e.created_at DESC LIMIT 100",
      [i.organizationId],
    );
    return {
      comparisons: comparisons.map((r) => ({
        ...r,
        trends: Number(r.trends),
        opportunities: Number(r.opportunities),
        tasks: Number(r.tasks),
        exports: Number(r.exports),
      })),
      exports: exports.map((r) => ({
        ...r,
        row_count: r.row_count == null ? null : Number(r.row_count),
        created_at: iso(r.created_at),
        updated_at: iso(r.updated_at),
      })),
      observed_at: this.now().toISOString(),
    };
  }
  async tokens(i: any) {
    await this.pool.query(
      "UPDATE organization_api_tokens SET status='expired',version=version+1,updated_at=? WHERE " +
        "organization_id=? AND status='active' AND expires_at<=?",
      [this.now(), i.organizationId, this.now()],
    );
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT id,name,token_prefix,scopes_json,status,expires_at,last_used_at,version," +
        "created_at,updated_at FROM organization_api_tokens WHERE organization_id=? ORDER BY " +
        "created_at DESC",
      [i.organizationId],
    );
    return rows.map((r) => ({
      ...r,
      scopes: parse(r.scopes_json),
      scopes_json: undefined,
      expires_at: iso(r.expires_at),
      last_used_at: iso(r.last_used_at),
      created_at: iso(r.created_at),
      updated_at: iso(r.updated_at),
    }));
  }
  async createToken(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [count] = await c.query<RowDataPacket[]>(
        "SELECT COUNT(*) n FROM organization_api_tokens WHERE organization_id=? AND status='active' AND expires_at>? FOR UPDATE",
        [i.organizationId, now],
      );
      if (Number(count[0]?.n ?? 0) >= i.maxActive)
        throw new OrganizationAdminError("token_active_limit", 409, "撤销不用的 Token 后重试。");
      await c.query(
        "INSERT INTO organization_api_tokens (id,organization_id,name,token_prefix," +
          "token_hash,scopes_json,status,expires_at,created_by,version,created_at,updated_at) VALUES " +
          "(?,?,?,?,?,?,'active',?,?,1,?,?)",
        [
          i.id,
          i.organizationId,
          i.value.name,
          i.value.token_prefix,
          i.value.token_hash,
          JSON.stringify(i.value.scopes),
          i.value.expires_at,
          i.actorId,
          now,
          now,
        ],
      );
      const result = {
        id: i.id,
        name: i.value.name,
        token_prefix: i.value.token_prefix,
        scopes: i.value.scopes,
        status: "active",
        expires_at: i.value.expires_at.toISOString(),
        version: 1,
        secret: i.value.secret,
      };
      await this.finish(
        c,
        i,
        "organization.token.created",
        "organization_token",
        i.id,
        { ...result, secret: undefined },
        now,
        result,
      );
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async tokenAction(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM organization_api_tokens WHERE id=? AND organization_id=? FOR UPDATE",
        [i.tokenId, i.organizationId],
      );
      this.version(rows[0], i.value.expected_version, "token");
      if (rows[0].status !== "active")
        throw new OrganizationAdminError("token_not_active", 409, "刷新 Token 列表。");
      if (i.value.action === "revoke") {
        const version = Number(rows[0].version) + 1;
        await c.query(
          "UPDATE organization_api_tokens SET status='revoked',revoked_by=?,revoked_at=?,version=?,updated_at=? WHERE id=?",
          [i.actorId, now, version, now, i.tokenId],
        );
        const result = { id: i.tokenId, status: "revoked", version };
        await this.finish(
          c,
          i,
          "organization.token.revoked",
          "organization_token",
          i.tokenId,
          result,
          now,
        );
        await c.commit();
        return result;
      }
      await c.query(
        "UPDATE organization_api_tokens SET status='rotated',version=version+1,updated_at=? WHERE id=?",
        [now, i.tokenId],
      );
      await c.query(
        "INSERT INTO organization_api_tokens (id,organization_id,name,token_prefix," +
          "token_hash,scopes_json,status,expires_at,rotated_from_id,created_by,version," +
          "created_at,updated_at) VALUES (?,?,?,?,?,?,'active',?,?,?,1,?,?)",
        [
          i.id,
          i.organizationId,
          rows[0].name,
          i.value.token_prefix,
          i.value.token_hash,
          JSON.stringify(parse(rows[0].scopes_json)),
          i.value.expires_at,
          i.tokenId,
          i.actorId,
          now,
          now,
        ],
      );
      const result = {
        id: i.id,
        name: String(rows[0].name),
        token_prefix: i.value.token_prefix,
        scopes: parse(rows[0].scopes_json),
        status: "active",
        expires_at: i.value.expires_at.toISOString(),
        version: 1,
        secret: i.value.secret,
        rotated_from_id: i.tokenId,
      };
      await this.finish(
        c,
        i,
        "organization.token.rotated",
        "organization_token",
        i.id,
        { ...result, secret: undefined },
        now,
        result,
      );
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  private org(r: any) {
    return { ...r, version: Number(r.version), updated_at: iso(r.updated_at) };
  }
  private version(
    row: RowDataPacket | undefined,
    expected: number,
    type: string,
  ): asserts row is RowDataPacket {
    if (!row) throw new OrganizationAdminError(`${type}_not_found`, 404, "刷新页面。");
    if (!Number.isInteger(expected) || Number(row.version) !== expected)
      throw new OrganizationAdminError(`${type}_version_conflict`, 409, "刷新页面后重试。");
  }
  private async sameMember(c: PoolConnection, org: string, id: string) {
    const [r] = await c.query<RowDataPacket[]>(
      "SELECT id FROM memberships WHERE id=? AND organization_id=? AND status='active'",
      [id, org],
    );
    if (!r[0])
      throw new OrganizationAdminError("membership_not_found", 404, "选择当前组织的活动成员。");
  }
  private async isLastAdmin(c: PoolConnection, org: string, excluded: string) {
    const [r] = await c.query<RowDataPacket[]>(
      "SELECT COUNT(*) n FROM membership_role_assignments ra JOIN memberships m ON m.id=ra.membership_id " +
        "WHERE m.organization_id=? AND m.status='active' AND ra.role_code='organization_admin' " +
        "AND m.id<>?",
      [org, excluded],
    );
    return Number(r[0]?.n ?? 0) === 0;
  }
  private async operation(i: any) {
    const [r] = await this.pool.query<RowDataPacket[]>(
      "SELECT result_json FROM organization_admin_operations WHERE organization_id=? AND actor_id=? " +
        "AND route_key=? AND idempotency_key=?",
      [i.organizationId, i.actorId, i.route, i.idempotencyKey],
    );
    return r[0] ? parse(r[0].result_json) : null;
  }
  private async finish(
    c: PoolConnection,
    i: any,
    event: string,
    type: string,
    id: string,
    auditResult: any,
    now: Date,
    operationResult = auditResult,
  ) {
    const meta = { ...auditResult, reason: i.value?.reason ?? null },
      stored = { ...operationResult };
    delete meta.secret;
    delete stored.secret;
    await c.query(
      "INSERT INTO audit_logs (id,organization_id,workspace_id,actor_id,action," +
        "resource_type,resource_id,request_id,trace_id,metadata_json,occurred_at," +
        "schema_version) VALUES (?,?,NULL,?,?,?,?,?,?,?,?,1)",
      [
        randomUUID(),
        i.organizationId,
        i.actorId,
        event,
        type,
        id,
        i.requestId,
        i.traceId,
        JSON.stringify(meta),
        now,
      ],
    );
    await c.query(
      "INSERT INTO outbox_events (id,organization_id,workspace_id,event_type,schema_version," +
        "payload_json,status,attempt_count,available_at,request_id,trace_id,created_at," +
        "updated_at,version) VALUES (?,?,NULL,?,1,?,'pending',0,?,?,?,?,?,1)",
      [
        randomUUID(),
        i.organizationId,
        event,
        JSON.stringify({ resource_type: type, resource_id: id, ...auditResult, secret: undefined }),
        now,
        i.requestId,
        i.traceId,
        now,
        now,
      ],
    );
    await c.query(
      "INSERT INTO organization_admin_operations (id,organization_id,actor_id,route_key," +
        "idempotency_key,resource_id,result_json,created_at) VALUES (?,?,?,?,?,?," +
        "?,?)",
      [
        randomUUID(),
        i.organizationId,
        i.actorId,
        i.route,
        i.idempotencyKey,
        id,
        JSON.stringify(stored),
        now,
      ],
    );
  }
}
