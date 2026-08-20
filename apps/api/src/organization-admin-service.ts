import { createHash, randomBytes, randomUUID } from "node:crypto";

export class OrganizationAdminError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
    message = code,
  ) {
    super(message);
    this.name = "OrganizationAdminError";
  }
}
const uuid = (v: unknown, label = "resource") => {
  const x = String(v ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x))
    throw new OrganizationAdminError(`${label}_id_invalid`, 400, "提交有效资源标识。");
  return x;
};
const text = (v: unknown, label: string, max: number) => {
  const x = String(v ?? "").trim();
  if (!x || x.length > max)
    throw new OrganizationAdminError(`${label}_invalid`, 400, `填写 1–${max} 个字符。`);
  return x;
};
const slug = (v: unknown) => {
  const x = String(v ?? "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x))
    throw new OrganizationAdminError("slug_invalid", 400, "使用 1–63 位小写字母、数字或连字符。");
  return x;
};
const email = (v: unknown) => {
  const x = String(v ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x) || x.length > 254)
    throw new OrganizationAdminError("invitation_email_invalid", 400, "填写有效邮箱地址。");
  return x;
};
const reason = (v: unknown) => text(v, "reason", 500);
const roles = new Set([
  "member",
  "selection_manager",
  "procurement_member",
  "organization_admin",
  "auditor",
]);
const scopes = new Set(["task:read", "trend:read", "opportunity:read", "report:read"]);
export interface OrganizationAdminRepository {
  summary(i: any): Promise<any>;
  profile(i: any): Promise<any>;
  updateProfile(i: any): Promise<any>;
  members(i: any): Promise<any>;
  invite(i: any): Promise<any>;
  memberAction(i: any): Promise<any>;
  roles(i: any): Promise<any>;
  assignRole(i: any): Promise<any>;
  workspaces(i: any): Promise<any>;
  createWorkspace(i: any): Promise<any>;
  workspaceAction(i: any): Promise<any>;
  teams(i: any): Promise<any>;
  createTeam(i: any): Promise<any>;
  teamMemberAction(i: any): Promise<any>;
  approvals(i: any): Promise<any>;
  data(i: any): Promise<any>;
  tokens(i: any): Promise<any>;
  createToken(i: any): Promise<any>;
  tokenAction(i: any): Promise<any>;
}
export class OrganizationAdminService {
  constructor(
    private readonly repo: OrganizationAdminRepository,
    private readonly invitationTtlHours = 72,
    private readonly tokenDefaultTtlDays = 90,
    private readonly tokenMaxActive = 20,
    private readonly now = () => new Date(),
  ) {}
  summary(i: any) {
    return this.repo.summary(i);
  }
  profile(i: any) {
    return this.repo.profile(i);
  }
  members(i: any) {
    return this.repo.members(i);
  }
  roles(i: any) {
    return this.repo.roles(i);
  }
  workspaces(i: any) {
    return this.repo.workspaces(i);
  }
  teams(i: any) {
    return this.repo.teams(i);
  }
  approvals(i: any) {
    return this.repo.approvals(i);
  }
  data(i: any) {
    return this.repo.data(i);
  }
  tokens(i: any) {
    return this.repo.tokens(i);
  }
  updateProfile(i: any) {
    const v = i.value ?? {},
      retention = Number(v.data_retention_days);
    if (!Number.isInteger(retention) || retention < 30 || retention > 3650)
      throw new OrganizationAdminError("retention_invalid", 400, "数据保留天数必须为 30–3650。");
    const logo =
      v.logo_url == null || String(v.logo_url).trim() === "" ? null : String(v.logo_url).trim();
    if (logo && !/^https:\/\//i.test(logo))
      throw new OrganizationAdminError("logo_url_invalid", 400, "Logo 必须使用 HTTPS 地址。");
    return this.repo.updateProfile({
      ...i,
      id: randomUUID(),
      route: "PATCH:/api/v1/org/admin/profile",
      value: {
        name: text(v.name, "organization_name", 120),
        logo_url: logo,
        timezone: text(v.timezone, "timezone", 64),
        data_retention_days: retention,
        default_workspace_id: uuid(v.default_workspace_id, "workspace"),
        expected_version: Number(v.expected_version),
        reason: reason(v.reason),
      },
    });
  }
  invite(i: any) {
    const v = i.value ?? {},
      role = String(v.role_code ?? "");
    if (!roles.has(role))
      throw new OrganizationAdminError("role_invalid", 400, "选择组织角色模板。");
    return this.repo.invite({
      ...i,
      id: randomUUID(),
      route: "POST:/api/v1/org/admin/invitations",
      value: {
        email: email(v.email),
        role_code: role,
        expires_at: new Date(this.now().getTime() + this.invitationTtlHours * 3600000),
        reason: reason(v.reason),
      },
    });
  }
  memberAction(i: any) {
    const action = String(i.value?.action ?? "");
    if (!["disable", "restore"].includes(action))
      throw new OrganizationAdminError("member_action_invalid", 400, "选择禁用或恢复。");
    return this.repo.memberAction({
      ...i,
      id: randomUUID(),
      membershipId: uuid(i.membershipId, "membership"),
      route: "POST:/api/v1/org/admin/members/:id/actions",
      value: {
        action,
        expected_version: Number(i.value?.expected_version),
        reason: reason(i.value?.reason),
      },
    });
  }
  assignRole(i: any) {
    const role = String(i.value?.role_code ?? "");
    if (!roles.has(role))
      throw new OrganizationAdminError("role_invalid", 400, "选择组织角色模板。");
    return this.repo.assignRole({
      ...i,
      id: randomUUID(),
      membershipId: uuid(i.membershipId, "membership"),
      route: "POST:/api/v1/org/admin/members/:id/roles",
      value: { role_code: role, reason: reason(i.value?.reason) },
    });
  }
  createWorkspace(i: any) {
    return this.repo.createWorkspace({
      ...i,
      id: randomUUID(),
      route: "POST:/api/v1/org/admin/workspaces",
      value: {
        name: text(i.value?.name, "workspace_name", 120),
        slug: slug(i.value?.slug),
        reason: reason(i.value?.reason),
      },
    });
  }
  workspaceAction(i: any) {
    const action = String(i.value?.action ?? "");
    if (!["archive", "restore"].includes(action))
      throw new OrganizationAdminError("workspace_action_invalid", 400, "选择归档或恢复。");
    return this.repo.workspaceAction({
      ...i,
      id: randomUUID(),
      workspaceId: uuid(i.workspaceId, "workspace"),
      route: "POST:/api/v1/org/admin/workspaces/:id/actions",
      value: {
        action,
        expected_version: Number(i.value?.expected_version),
        reason: reason(i.value?.reason),
      },
    });
  }
  createTeam(i: any) {
    const lead = i.value?.lead_membership_id
      ? uuid(i.value.lead_membership_id, "membership")
      : null;
    return this.repo.createTeam({
      ...i,
      id: randomUUID(),
      route: "POST:/api/v1/org/admin/teams",
      value: {
        name: text(i.value?.name, "team_name", 120),
        lead_membership_id: lead,
        default_workflow_key: i.value?.default_workflow_key
          ? text(i.value.default_workflow_key, "workflow_key", 80)
          : null,
        reason: reason(i.value?.reason),
      },
    });
  }
  teamMemberAction(i: any) {
    const action = String(i.value?.action ?? "");
    if (!["assign", "remove"].includes(action))
      throw new OrganizationAdminError("team_member_action_invalid", 400, "选择分配或移除。");
    return this.repo.teamMemberAction({
      ...i,
      id: randomUUID(),
      teamId: uuid(i.teamId, "team"),
      route: "POST:/api/v1/org/admin/teams/:id/members",
      value: {
        action,
        membership_id: uuid(i.value?.membership_id, "membership"),
        reason: reason(i.value?.reason),
      },
    });
  }
  createToken(i: any) {
    const requested: string[] = Array.isArray(i.value?.scopes)
      ? [...new Set<string>(i.value.scopes.map((x: unknown) => String(x)))]
      : [];
    if (!requested.length || requested.some((x) => !scopes.has(x)))
      throw new OrganizationAdminError("token_scope_invalid", 400, "选择允许的只读组织 scope。");
    const ttl = Number(i.value?.ttl_days ?? this.tokenDefaultTtlDays);
    if (!Number.isInteger(ttl) || ttl < 1 || ttl > 365)
      throw new OrganizationAdminError("token_ttl_invalid", 400, "Token 有效期必须为 1–365 天。");
    const secret = `sco_org_${randomBytes(32).toString("base64url")}`;
    return this.repo.createToken({
      ...i,
      id: randomUUID(),
      route: "POST:/api/v1/org/admin/tokens",
      maxActive: this.tokenMaxActive,
      value: {
        name: text(i.value?.name, "token_name", 120),
        scopes: requested,
        token_prefix: secret.slice(0, 20),
        token_hash: createHash("sha256").update(secret).digest("hex"),
        secret,
        expires_at: new Date(this.now().getTime() + ttl * 86400000),
        reason: reason(i.value?.reason),
      },
    });
  }
  tokenAction(i: any) {
    const action = String(i.value?.action ?? "");
    if (!["rotate", "revoke"].includes(action))
      throw new OrganizationAdminError("token_action_invalid", 400, "选择轮换或撤销。");
    const secret = action === "rotate" ? `sco_org_${randomBytes(32).toString("base64url")}` : null;
    return this.repo.tokenAction({
      ...i,
      id: randomUUID(),
      tokenId: uuid(i.tokenId, "token"),
      route: "POST:/api/v1/org/admin/tokens/:id/actions",
      value: {
        action,
        expected_version: Number(i.value?.expected_version),
        reason: reason(i.value?.reason),
        secret,
        token_prefix: secret?.slice(0, 20),
        token_hash: secret ? createHash("sha256").update(secret).digest("hex") : null,
        expires_at: new Date(this.now().getTime() + this.tokenDefaultTtlDays * 86400000),
      },
    });
  }
}
