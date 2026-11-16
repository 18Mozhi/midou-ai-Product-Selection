import type { Pool, RowDataPacket } from "mysql2/promise";
import type {
  AuthorizationDecisionEvent,
  AuthorizationRepository,
  AuthorizationSubject,
  Capability,
  DataScopeType,
  RoleCategory,
  RoleDefinition,
} from "@scoutops/authorization";

export class MySqlAuthorizationRepository implements AuthorizationRepository {
  constructor(private readonly pool: Pool, private readonly accountOnly = false) {}
  async resourcesBelongToOrganization(
    organizationId: string | undefined,
    resources: { workspaceId?: string; teamId?: string },
  ) {
    if (this.accountOnly) return !organizationId && !resources.workspaceId && !resources.teamId;
    if (!organizationId && (resources.workspaceId || resources.teamId)) return false;
    if (resources.workspaceId) {
      const [rows] = await this.pool.query<RowDataPacket[]>(
        "SELECT 1 FROM workspaces WHERE id=? AND organization_id=? LIMIT 1",
        [resources.workspaceId, organizationId],
      );
      if (!rows[0]) return false;
    }
    if (resources.teamId) {
      const [rows] = await this.pool.query<RowDataPacket[]>(
        "SELECT 1 FROM teams WHERE id=? AND organization_id=? LIMIT 1",
        [resources.teamId, organizationId],
      );
      if (!rows[0]) return false;
    }
    return true;
  }
  async hasActiveMembership(actorId: string) {
    if (this.accountOnly) return false;
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT 1 FROM memberships m JOIN organizations o ON o.id=m.organization_id " +
        "WHERE m.user_id=? AND m.status='active' AND o.status='active' LIMIT 1",
      [actorId],
    );
    return Boolean(rows[0]);
  }
  async loadSubject(actorId: string, organizationId?: string): Promise<AuthorizationSubject> {
    const [platformRows] = await this.pool.query<RowDataPacket[]>(
      "SELECT DISTINCT pra.role_code,rc.capability_code FROM platform_role_assignments pra " +
        "JOIN roles r ON r.code=pra.role_code AND r.category='platform' AND r.status='active' " +
        "LEFT JOIN role_capabilities rc ON rc.role_code=r.code WHERE pra.user_id=?",
      [actorId],
    );
    let membershipId: string | null = null,
      membershipActive = false;
    let roleRows: RowDataPacket[] = [];
    let scopeRows: RowDataPacket[] = [];
    if (!this.accountOnly && organizationId) {
      const [memberships] = await this.pool.query<RowDataPacket[]>(
        "SELECT id,status FROM memberships WHERE user_id=? AND organization_id=? LIMIT 1",
        [actorId, organizationId],
      );
      const membership = memberships[0];
      membershipId = membership?.id ?? null;
      membershipActive = membership?.status === "active";
      if (membershipActive) {
        [roleRows] = await this.pool.query<RowDataPacket[]>(
          "SELECT DISTINCT mra.role_code,rc.capability_code FROM membership_role_assignments mra " +
            "JOIN roles r ON r.code=mra.role_code AND r.category='organization' AND r.status='active' " +
            "LEFT JOIN role_capabilities rc ON rc.role_code=r.code WHERE mra.membership_id=?",
          [membershipId],
        );
        [scopeRows] = await this.pool.query<RowDataPacket[]>(
          "SELECT scope_type,workspace_id,team_id FROM membership_data_scopes WHERE membership_id=?",
          [membershipId],
        );
      }
    }
    const values = (rows: RowDataPacket[], field: string) =>
      [...new Set(rows.map((row) => row[field]).filter(Boolean))] as string[];
    const platformRoles = values(platformRows, "role_code");
    return {
      actor_id: actorId,
      membership_id: membershipId,
      membership_active: membershipActive,
      role_codes: values(roleRows, "role_code"),
      capabilities: values(roleRows, "capability_code") as Capability[],
      scopes: [
        ...scopeRows.map((row) => ({
          scope: row.scope_type as DataScopeType,
          workspace_id: row.workspace_id,
          team_id: row.team_id,
        })),
        ...(platformRoles.length ? [{ scope: "platform" as const }] : []),
      ],
      platform_role_codes: platformRoles,
      platform_capabilities: values(platformRows, "capability_code") as Capability[],
    };
  }
  async appendDecision(event: AuthorizationDecisionEvent) {
    const [schema] = await this.pool.query<RowDataPacket[]>(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() " +
        "AND TABLE_NAME='authorization_decisions' AND COLUMN_NAME IN " +
        "('historical_context','organization_id','workspace_id','team_id')",
    );
    const names = new Set(schema.map((row) => row.COLUMN_NAME));
    const legacy = ["organization_id", "workspace_id", "team_id"].every((name) => names.has(name));
    if (names.has("historical_context") && names.size === 1) {
      const { organization_id, workspace_id, team_id } = event;
      const context = organization_id === null && workspace_id === null && team_id === null
        ? null : JSON.stringify({ organization_id, workspace_id, team_id });
      await this.pool.query(
        "INSERT INTO authorization_decisions (id,actor_id,historical_context,capability,surface,outcome," +
          "reason,request_id,trace_id,occurred_at,schema_version) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [event.id,event.actor_id,context,event.capability,event.surface,event.outcome,
          event.reason,event.request_id,event.trace_id,event.occurred_at,event.schema_version],
      );
      return;
    }
    if (!legacy || names.size !== 3) throw new Error("authorization_decision_schema_incomplete");
    await this.pool.query(
      "INSERT INTO authorization_decisions (id,actor_id,organization_id,workspace_id," +
        "team_id,capability,surface,outcome,reason,request_id,trace_id,occurred_at," +
        "schema_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        event.id,
        event.actor_id,
        event.organization_id,
        event.workspace_id,
        event.team_id,
        event.capability,
        event.surface,
        event.outcome,
        event.reason,
        event.request_id,
        event.trace_id,
        event.occurred_at,
        event.schema_version,
      ],
    );
  }
  async listRoles(category?: RoleCategory) {
    const params = category ? [category] : [];
    const where = category ? "WHERE r.category=? AND r.status='active'" : "WHERE r.status='active'";
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT r.code,r.name,r.category,r.description,rc.capability_code
       FROM roles r
       LEFT JOIN role_capabilities rc ON rc.role_code=r.code
       ${where}
       ORDER BY r.category,r.code,rc.capability_code`,
      params,
    );
    const roles = new Map<string, RoleDefinition>();
    for (const row of rows) {
      if (!roles.has(row.code))
        roles.set(row.code, {
          code: row.code,
          name: row.name,
          category: row.category,
          description: row.description,
          capabilities: [],
        });
      if (row.capability_code) roles.get(row.code)!.capabilities.push(row.capability_code);
    }
    return [...roles.values()];
  }
  async findSessionContext(sessionId: string, userId: string) {
    if (this.accountOnly) return null;
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT c.organization_id,c.workspace_id,o.name organization_name,w.name workspace_name " +
        "FROM user_session_contexts c JOIN organizations o ON o.id=c.organization_id JOIN workspaces " +
        "w ON w.id=c.workspace_id AND w.organization_id=c.organization_id WHERE c.session_id=? " +
        "AND c.user_id=? AND o.status='active' AND w.status='active' LIMIT 1",
      [sessionId, userId],
    );
    return rows[0]
      ? {
          organization_id: String(rows[0].organization_id),
          workspace_id: String(rows[0].workspace_id),
          organization_name: String(rows[0].organization_name),
          workspace_name: String(rows[0].workspace_name),
        }
      : null;
  }
}
