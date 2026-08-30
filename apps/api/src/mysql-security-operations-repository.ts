import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { SecurityOperationsRepository } from "./security-operations-service.js";

const number = (value: any) => Number(value ?? 0);
const iso = (value: any) => (value ? new Date(value).toISOString() : null);
const escapedLike = (value: string) =>
  `%${value.replaceAll("=", "==").replaceAll("%", "=%").replaceAll("_", "=_")}%`;
const emptyPagination = (pageSize: number) => ({
  page: 1,
  page_size: pageSize,
  total: 0,
  total_pages: 1,
});
const effectiveStatus = (alias: string) =>
  `CASE WHEN ${alias}.status='active' AND ${alias}.expires_at IS NOT NULL AND ${alias}.expires_at<=? ` +
  `THEN 'expired' ELSE ${alias}.status END`;
const deviceSummary = (value: unknown) => {
  const label = String(value ?? "");
  if (!label) return "未标记设备";
  const os = /Windows/i.test(label)
    ? "Windows"
    : /Android/i.test(label)
      ? "Android"
      : /iPhone|iPad|iOS/i.test(label)
        ? "iOS"
        : /Macintosh|macOS/i.test(label)
          ? "macOS"
          : /Linux/i.test(label)
            ? "Linux"
            : "其他系统";
  const browser = /Edg\//i.test(label)
    ? "Edge"
    : /Chrome\//i.test(label)
      ? "Chrome"
      : /Firefox\//i.test(label)
        ? "Firefox"
        : /Safari\//i.test(label)
          ? "Safari"
          : "浏览器";
  return `${os} · ${browser}`;
};

export class MySqlSecurityOperationsRepository implements SecurityOperationsRepository {
  constructor(
    private readonly pool: Pool,
    private readonly now = () => new Date(),
  ) {}

  async read(input: any) {
    const observedAt = this.now();
    const since = new Date(observedAt.getTime() - input.windowHours * 3_600_000);
    const [summaryRows] = await this.pool.query<RowDataPacket[]>(
      "SELECT (SELECT COUNT(*) FROM auth_security_events WHERE occurred_at>=?) security_events," +
        "(SELECT COUNT(*) FROM auth_security_events WHERE occurred_at>=? AND outcome IN ('failed','blocked')) risk_events," +
        "(SELECT COUNT(*) FROM user_sessions WHERE status='active' AND expires_at>?) active_sessions," +
        "(SELECT COUNT(*) FROM credential_assets WHERE status='active' AND (expires_at IS NULL OR expires_at>?)) active_credentials," +
        "(SELECT COUNT(*) FROM credential_assets WHERE status='active' AND expires_at>? AND expires_at<=DATE_ADD(?,INTERVAL 7 DAY)) credentials_expiring," +
        "(SELECT COUNT(*) FROM organization_api_tokens WHERE status='active' AND (expires_at IS NULL OR expires_at>?)) active_org_tokens",
      [since, since, observedAt, observedAt, observedAt, observedAt, observedAt],
    );
    const result: any = {
      window: input.window,
      view: input.view,
      summary: Object.fromEntries(
        Object.entries(summaryRows[0] ?? {}).map(([key, value]) => [key, number(value)]),
      ),
      security_events: [],
      sessions: [],
      credential_assets: [],
      organization_tokens: [],
      audit_events: [],
      pagination: {
        security_events: emptyPagination(input.pageSize),
        sessions: emptyPagination(input.pageSize),
        credential_assets: emptyPagination(input.pageSize),
        organization_tokens: emptyPagination(input.tokenPageSize),
        audit_events: emptyPagination(input.pageSize),
      },
      links: {
        credential_assets: "/platform-admin/credentials",
        audit_search: "/platform-admin/security?view=audit",
      },
      observed_at: observedAt.toISOString(),
    };

    if (input.view === "events") await this.readEvents(result, input, since);
    if (input.view === "sessions") await this.readSessions(result, input, observedAt);
    if (input.view === "credentials") await this.readCredentials(result, input, observedAt);
    if (input.view === "audit") await this.readAudits(result, input, since);

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        "INSERT INTO security_operations_views(id,actor_id,request_id,trace_id,observed_at) VALUES(?,?,?,?,?)",
        [randomUUID(), input.actorId, input.requestId, input.traceId, observedAt],
      );
      await connection.query(
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id," +
          "action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at," +
          "schema_version) VALUES(?,NULL,NULL,?,'platform.security.operations.read'," +
          "'security_operations',NULL,'succeeded',?,?,?, ?,1)",
        [
          randomUUID(),
          input.actorId,
          input.requestId,
          input.traceId,
          JSON.stringify({
            window: input.window,
            view: input.view,
            status: input.status,
            has_query: Boolean(input.query),
            page: input.page,
            token_page: input.tokenPage,
          }),
          observedAt,
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return result;
  }

  private async readEvents(result: any, input: any, since: Date) {
    const conditions = ["e.occurred_at>=?"];
    const parameters: unknown[] = [since];
    if (input.status) {
      conditions.push("e.outcome=?");
      parameters.push(input.status);
    }
    if (input.query) {
      conditions.push(
        "LOWER(CONCAT_WS(' ',e.event_type,e.outcome,COALESCE(e.user_id,''),COALESCE(e.request_id,''),COALESCE(e.trace_id,''))) LIKE LOWER(?) ESCAPE '='",
      );
      parameters.push(escapedLike(input.query));
    }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const [countRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) total FROM auth_security_events e ${where}`,
      parameters,
    );
    const pagination = this.pagination(countRows, input.page, input.pageSize);
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT e.id,e.user_id,e.event_type,e.outcome,e.request_id,e.trace_id,e.occurred_at " +
        `FROM auth_security_events e ${where} ORDER BY e.occurred_at DESC,e.id DESC LIMIT ? OFFSET ?`,
      [...parameters, input.pageSize, (pagination.page - 1) * input.pageSize],
    );
    result.pagination.security_events = pagination;
    result.security_events = rows.map((row: any) => ({
      ...row,
      occurred_at: iso(row.occurred_at),
    }));
  }

  private async readSessions(result: any, input: any, observedAt: Date) {
    const statusExpression = effectiveStatus("s");
    const conditions: string[] = [];
    const parameters: unknown[] = [];
    if (input.status) {
      conditions.push(`${statusExpression}=?`);
      parameters.push(observedAt, input.status);
    }
    if (input.query) {
      conditions.push(
        "LOWER(CONCAT_WS(' ',u.email,COALESCE(s.device_label,''),s.id,s.user_id)) LIKE LOWER(?) ESCAPE '='",
      );
      parameters.push(escapedLike(input.query));
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [countRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) total FROM user_sessions s JOIN users u ON u.id=s.user_id ${where}`,
      parameters,
    );
    const pagination = this.pagination(countRows, input.page, input.pageSize);
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT s.id,s.user_id,u.email,${statusExpression} status,s.device_label,s.expires_at,` +
        `s.last_seen_at,s.created_at FROM user_sessions s JOIN users u ON u.id=s.user_id ${where} ` +
        "ORDER BY s.last_seen_at DESC,s.id DESC LIMIT ? OFFSET ?",
      [observedAt, ...parameters, input.pageSize, (pagination.page - 1) * input.pageSize],
    );
    result.pagination.sessions = pagination;
    result.sessions = rows.map((row: any) => ({
      ...row,
      device_label: deviceSummary(row.device_label),
      expires_at: iso(row.expires_at),
      last_seen_at: iso(row.last_seen_at),
      created_at: iso(row.created_at),
    }));
  }

  private async readCredentials(result: any, input: any, observedAt: Date) {
    const assetStatus = effectiveStatus("a");
    const assetConditions: string[] = [];
    const assetParameters: unknown[] = [];
    if (input.status) {
      assetConditions.push(`${assetStatus}=?`);
      assetParameters.push(observedAt, input.status);
    }
    if (input.query) {
      assetConditions.push(
        "LOWER(CONCAT_WS(' ',a.name,p.name,a.kind,a.id,a.provider_id)) LIKE LOWER(?) ESCAPE '='",
      );
      assetParameters.push(escapedLike(input.query));
    }
    const assetWhere = assetConditions.length ? `WHERE ${assetConditions.join(" AND ")}` : "";
    const [assetCount] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) total FROM credential_assets a JOIN providers p ON p.id=a.provider_id ${assetWhere}`,
      assetParameters,
    );
    const assetPagination = this.pagination(assetCount, input.page, input.pageSize);
    const [assets] = await this.pool.query<RowDataPacket[]>(
      `SELECT a.id,a.provider_id,p.name provider_name,a.name,a.kind,a.key_version,a.fingerprint,${assetStatus} status,` +
        `a.expires_at,a.rotated_at,a.version,a.updated_at FROM credential_assets a JOIN providers p ON p.id=a.provider_id ${assetWhere} ` +
        "ORDER BY a.updated_at DESC,a.id DESC LIMIT ? OFFSET ?",
      [observedAt, ...assetParameters, input.pageSize, (assetPagination.page - 1) * input.pageSize],
    );

    const tokenStatus = effectiveStatus("t");
    const tokenConditions: string[] = [];
    const tokenParameters: unknown[] = [];
    if (input.status) {
      tokenConditions.push(`${tokenStatus}=?`);
      tokenParameters.push(observedAt, input.status);
    }
    if (input.query) {
      tokenConditions.push(
        "LOWER(CONCAT_WS(' ',t.name,t.token_prefix,t.id,t.organization_id)) LIKE LOWER(?) ESCAPE '='",
      );
      tokenParameters.push(escapedLike(input.query));
    }
    const tokenWhere = tokenConditions.length ? `WHERE ${tokenConditions.join(" AND ")}` : "";
    const [tokenCount] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) total FROM organization_api_tokens t ${tokenWhere}`,
      tokenParameters,
    );
    const tokenPagination = this.pagination(tokenCount, input.tokenPage, input.tokenPageSize);
    const [tokens] = await this.pool.query<RowDataPacket[]>(
      `SELECT t.id,t.organization_id,t.name,t.token_prefix,t.scopes_json,${tokenStatus} status,` +
        `t.expires_at,t.last_used_at,t.version,t.updated_at FROM organization_api_tokens t ${tokenWhere} ` +
        "ORDER BY t.updated_at DESC,t.id DESC LIMIT ? OFFSET ?",
      [
        observedAt,
        ...tokenParameters,
        input.tokenPageSize,
        (tokenPagination.page - 1) * input.tokenPageSize,
      ],
    );
    result.pagination.credential_assets = assetPagination;
    result.pagination.organization_tokens = tokenPagination;
    result.credential_assets = assets.map((row: any) => ({
      ...row,
      expires_at: iso(row.expires_at),
      rotated_at: iso(row.rotated_at),
      updated_at: iso(row.updated_at),
    }));
    result.organization_tokens = tokens.map((row: any) => {
      const { scopes_json: scopesJson, ...safe } = row;
      return {
        ...safe,
        scopes: typeof scopesJson === "string" ? JSON.parse(scopesJson) : scopesJson,
        expires_at: iso(row.expires_at),
        last_used_at: iso(row.last_used_at),
        updated_at: iso(row.updated_at),
      };
    });
  }

  private async readAudits(result: any, input: any, since: Date) {
    const conditions = ["a.occurred_at>=?"];
    const parameters: unknown[] = [since];
    if (input.status) {
      conditions.push("a.outcome=?");
      parameters.push(input.status);
    }
    if (input.query) {
      conditions.push(
        "LOWER(CONCAT_WS(' ',a.action,a.resource_type,COALESCE(a.resource_id,''),a.actor_id,a.request_id,a.trace_id)) LIKE LOWER(?) ESCAPE '='",
      );
      parameters.push(escapedLike(input.query));
    }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const [countRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) total FROM platform_audit_events a ${where}`,
      parameters,
    );
    const pagination = this.pagination(countRows, input.page, input.pageSize);
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT a.id,a.actor_id,a.action,a.resource_type,a.resource_id,a.outcome,a.request_id,a.trace_id,a.occurred_at " +
        `FROM platform_audit_events a ${where} ORDER BY a.occurred_at DESC,a.id DESC LIMIT ? OFFSET ?`,
      [...parameters, input.pageSize, (pagination.page - 1) * input.pageSize],
    );
    result.pagination.audit_events = pagination;
    result.audit_events = rows.map((row: any) => ({
      ...row,
      occurred_at: iso(row.occurred_at),
    }));
  }

  private pagination(countRows: RowDataPacket[], requestedPage: number, pageSize: number) {
    const total = number(countRows[0]?.total);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      page: Math.min(requestedPage, totalPages),
      page_size: pageSize,
      total,
      total_pages: totalPages,
    };
  }
}
