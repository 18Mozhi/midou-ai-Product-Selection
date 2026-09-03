import { randomUUID } from "node:crypto";
export type EntityStatus = "active" | "archived";
export type MembershipStatus = "active" | "disabled";
export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: EntityStatus;
  timezone: string;
  data_retention_days: number;
  default_workspace_id: string | null;
  created_by: string;
  version: number;
  created_at: Date;
  updated_at: Date;
}
export interface Workspace {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  status: EntityStatus;
  created_by: string;
  version: number;
  created_at: Date;
  updated_at: Date;
}
export interface Team {
  id: string;
  organization_id: string;
  name: string;
  status: EntityStatus;
  created_by: string;
  version: number;
  created_at: Date;
  updated_at: Date;
}
export interface Membership {
  id: string;
  organization_id: string;
  user_id: string;
  status: MembershipStatus;
  joined_at: Date;
  version: number;
  created_at: Date;
  updated_at: Date;
}
export interface SessionContext {
  session_id: string;
  user_id: string;
  organization_id: string;
  workspace_id: string;
  selected_at: Date;
}
export interface TenancyContext {
  requestId: string;
  traceId: string;
  actorId: string;
  sessionId: string;
}
export class TenancyError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
  ) {
    super(code);
    this.name = "TenancyError";
  }
}
export interface TenancyRepository {
  provision(input: {
    organization: Organization;
    workspace: Workspace;
    membership: Membership;
    audit: TenancyAuditEvent;
  }): Promise<void>;
  listOrganizations(
    userId: string,
  ): Promise<Array<{ organization: Organization; membership: Membership }>>;
  findActiveMembership(userId: string, organizationId: string): Promise<Membership | null>;
  findOrganization(id: string): Promise<Organization | null>;
  findWorkspace(id: string): Promise<Workspace | null>;
  listWorkspaces(organizationId: string): Promise<Workspace[]>;
  listTeams(organizationId: string): Promise<Team[]>;
  saveContext(context: SessionContext, audit: TenancyAuditEvent): Promise<void>;
}
export interface TenancyAuditEvent {
  id: string;
  organization_id: string;
  workspace_id: string | null;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  request_id: string;
  trace_id: string;
  occurred_at: Date;
  schema_version: 1;
}
const validName = (value: string) => {
  const name = value.trim();
  if (name.length < 2 || name.length > 120)
    throw new TenancyError("invalid_name", 400, "名称长度应为 2–120 个字符。");
  return name;
};
const validSlug = (value: string) => {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug))
    throw new TenancyError("invalid_slug", 400, "使用 2–63 位小写字母、数字或连字符。");
  return slug;
};
export class TenancyService {
  constructor(
    private readonly repository: TenancyRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async provisionOrganization(
    input: {
      name: string;
      slug: string;
      timezone: string;
      dataRetentionDays: number;
      defaultWorkspaceName: string;
      defaultWorkspaceSlug: string;
    },
    context: Omit<TenancyContext, "sessionId">,
  ) {
    const now = this.now();
    if (!input.timezone.trim() || input.timezone.length > 64)
      throw new TenancyError("invalid_timezone", 400, "提供有效 IANA 时区。");
    if (
      !Number.isSafeInteger(input.dataRetentionDays) ||
      input.dataRetentionDays < 1 ||
      input.dataRetentionDays > 3650
    )
      throw new TenancyError("invalid_retention", 400, "数据保留天数应为 1–3650。");
    const orgId = randomUUID(),
      workspaceId = randomUUID();
    const organization: Organization = {
      id: orgId,
      name: validName(input.name),
      slug: validSlug(input.slug),
      status: "active",
      timezone: input.timezone.trim(),
      data_retention_days: input.dataRetentionDays,
      default_workspace_id: workspaceId,
      created_by: context.actorId,
      version: 1,
      created_at: now,
      updated_at: now,
    };
    const workspace: Workspace = {
      id: workspaceId,
      organization_id: orgId,
      name: validName(input.defaultWorkspaceName),
      slug: validSlug(input.defaultWorkspaceSlug),
      status: "active",
      created_by: context.actorId,
      version: 1,
      created_at: now,
      updated_at: now,
    };
    const membership: Membership = {
      id: randomUUID(),
      organization_id: orgId,
      user_id: context.actorId,
      status: "active",
      joined_at: now,
      version: 1,
      created_at: now,
      updated_at: now,
    };
    await this.repository.provision({
      organization,
      workspace,
      membership,
      audit: this.audit(
        orgId,
        workspaceId,
        context,
        "organization.provisioned",
        "organization",
        orgId,
        now,
      ),
    });
    return { organization, workspace };
  }
  async provisionPersonalWorkspace(context: TenancyContext) {
    const memberships = await this.repository.listOrganizations(context.actorId);
    let created = false;
    let organization = memberships.find(
      (item) => item.organization.status === "active" && item.membership.status === "active",
    )?.organization;
    let workspace = organization?.default_workspace_id
      ? await this.repository.findWorkspace(organization.default_workspace_id)
      : null;
    if (!organization) {
      try {
        const result = await this.provisionOrganization(
          {
            name: "我的选品空间",
            slug: `personal-${context.actorId.replaceAll("-", "")}`,
            timezone: "Asia/Shanghai",
            dataRetentionDays: 365,
            defaultWorkspaceName: "默认工作区",
            defaultWorkspaceSlug: "default",
          },
          context,
        );
        organization = result.organization;
        workspace = result.workspace;
        created = true;
      } catch (error) {
        if (!(error instanceof TenancyError) || error.code !== "organization_slug_conflict")
          throw error;
        const concurrent = await this.repository.listOrganizations(context.actorId);
        organization = concurrent.find(
          (item) => item.organization.status === "active" && item.membership.status === "active",
        )?.organization;
        workspace = organization?.default_workspace_id
          ? await this.repository.findWorkspace(organization.default_workspace_id)
          : null;
      }
    }
    if (!organization || !workspace || workspace.status !== "active")
      throw new TenancyError(
        "personal_workspace_unavailable",
        409,
        "当前账号没有可进入的工作区，请联系平台管理员。",
      );
    const selected = await this.selectContext(
      { organizationId: organization.id, workspaceId: workspace.id },
      context,
    );
    return { ...selected, created };
  }
  async listOrganizations(userId: string) {
    return (await this.repository.listOrganizations(userId)).map(
      ({ organization, membership }) => ({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
        timezone: organization.timezone,
        default_workspace_id: organization.default_workspace_id,
        membership_status: membership.status,
      }),
    );
  }
  async listWorkspaces(userId: string, organizationId: string) {
    await this.guard(userId, organizationId);
    return (await this.repository.listWorkspaces(organizationId)).map(this.workspaceSummary);
  }
  async listTeams(userId: string, organizationId: string) {
    await this.guard(userId, organizationId);
    return (await this.repository.listTeams(organizationId)).map((item) => ({
      id: item.id,
      organization_id: item.organization_id,
      name: item.name,
      status: item.status,
      version: item.version,
    }));
  }
  async selectContext(
    input: { organizationId: string; workspaceId: string },
    context: TenancyContext,
  ) {
    const organization = await this.guard(context.actorId, input.organizationId);
    const workspace = await this.repository.findWorkspace(input.workspaceId);
    if (!workspace || workspace.organization_id !== organization.id)
      throw new TenancyError("workspace_not_found", 404, "选择当前组织内的工作区。");
    if (workspace.status !== "active")
      throw new TenancyError("workspace_archived", 409, "选择未归档的工作区。");
    const selected: SessionContext = {
      session_id: context.sessionId,
      user_id: context.actorId,
      organization_id: organization.id,
      workspace_id: workspace.id,
      selected_at: this.now(),
    };
    await this.repository.saveContext(
      selected,
      this.audit(
        organization.id,
        workspace.id,
        context,
        "context.selected",
        "workspace",
        workspace.id,
        selected.selected_at,
      ),
    );
    return {
      organization: { id: organization.id, name: organization.name },
      workspace: this.workspaceSummary(workspace),
    };
  }
  private async guard(userId: string, organizationId: string) {
    const [membership, organization] = await Promise.all([
      this.repository.findActiveMembership(userId, organizationId),
      this.repository.findOrganization(organizationId),
    ]);
    if (!membership || !organization || organization.status !== "active")
      throw new TenancyError("organization_forbidden", 403, "选择本人仍为活动成员的组织。");
    return organization;
  }
  private workspaceSummary(item: Workspace) {
    return {
      id: item.id,
      organization_id: item.organization_id,
      name: item.name,
      slug: item.slug,
      status: item.status,
      version: item.version,
    };
  }
  private audit(
    org: string,
    ws: string | null,
    context: { actorId: string; requestId: string; traceId: string },
    action: string,
    type: string,
    id: string,
    now: Date,
  ): TenancyAuditEvent {
    return {
      id: randomUUID(),
      organization_id: org,
      workspace_id: ws,
      actor_id: context.actorId,
      action,
      resource_type: type,
      resource_id: id,
      request_id: context.requestId,
      trace_id: context.traceId,
      occurred_at: now,
      schema_version: 1,
    };
  }
}
export class InMemoryTenancyRepository implements TenancyRepository {
  organizations: Organization[] = [];
  workspaces: Workspace[] = [];
  teams: Team[] = [];
  memberships: Membership[] = [];
  contexts: SessionContext[] = [];
  audits: TenancyAuditEvent[] = [];
  async provision(x: {
    organization: Organization;
    workspace: Workspace;
    membership: Membership;
    audit: TenancyAuditEvent;
  }) {
    if (this.organizations.some((o) => o.slug === x.organization.slug))
      throw new TenancyError("organization_slug_conflict", 409, "更换组织标识后重试。");
    this.organizations.push(x.organization);
    this.workspaces.push(x.workspace);
    this.memberships.push(x.membership);
    this.audits.push(x.audit);
  }
  async listOrganizations(u: string) {
    return this.memberships
      .filter((m) => m.user_id === u && m.status === "active")
      .flatMap((m) => {
        const o = this.organizations.find((x) => x.id === m.organization_id);
        return o ? [{ organization: o, membership: m }] : [];
      });
  }
  async findActiveMembership(u: string, o: string) {
    return (
      this.memberships.find(
        (x) => x.user_id === u && x.organization_id === o && x.status === "active",
      ) ?? null
    );
  }
  async findOrganization(id: string) {
    return this.organizations.find((x) => x.id === id) ?? null;
  }
  async findWorkspace(id: string) {
    return this.workspaces.find((x) => x.id === id) ?? null;
  }
  async listWorkspaces(o: string) {
    return this.workspaces.filter((x) => x.organization_id === o);
  }
  async listTeams(o: string) {
    return this.teams.filter((x) => x.organization_id === o);
  }
  async saveContext(c: SessionContext, a: TenancyAuditEvent) {
    this.contexts = this.contexts.filter((x) => x.session_id !== c.session_id);
    this.contexts.push(c);
    this.audits.push(a);
  }
}
