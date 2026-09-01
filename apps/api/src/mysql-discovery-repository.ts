import type { Pool, RowDataPacket } from "mysql2/promise";
import type { DiscoveryRepository } from "./discovery-service.js";
export class MySqlDiscoveryRepository implements DiscoveryRepository {
  constructor(private readonly pool: Pool) {}
  async search(input: Parameters<DiscoveryRepository["search"]>[0]) {
    if (!input.capabilities.length) return { items: [], nextCursor: null };
    const normalizeText = (expression: string) =>
        `CONVERT(${expression} USING utf8mb4) COLLATE utf8mb4_unicode_ci`,
      nullText = normalizeText("CAST(NULL AS CHAR)"),
      derivedSql = [
        `SELECT id,${normalizeText("resource_type")} resource_type,resource_id,` +
          `${normalizeText("title")} title,${normalizeText("subtitle")} subtitle,` +
          `${nullText} status,${nullText} assignee_id,${nullText} assignee_name,` +
          `${normalizeText("route")} route,${normalizeText("required_capability")} required_capability,updated_at`,
        "FROM search_documents WHERE organization_id=? AND workspace_id=?",
        `UNION ALL SELECT t.id,${normalizeText("'task'")},t.id,${normalizeText("t.title")},` +
          `${normalizeText("t.description")},${normalizeText("t.status")},${normalizeText("t.assignee_id")},` +
          `${normalizeText("COALESCE(NULLIF(task_profile.display_name,''),task_user.email)")},` +
          `${normalizeText(`CONCAT('/tasks/',${normalizeText("t.id")})`)},${normalizeText("'task:read'")},t.updated_at`,
        "FROM tasks t LEFT JOIN users task_user ON task_user.id=t.assignee_id " +
          "LEFT JOIN user_profiles task_profile ON task_profile.user_id=t.assignee_id " +
          "WHERE t.organization_id=? AND t.workspace_id=? AND t.deleted_at IS NULL",
        `UNION ALL SELECT o.id,${normalizeText("'opportunity'")},o.id,${normalizeText("o.name")},` +
          `${normalizeText("CONCAT(o.market,' · ',COALESCE(o.category,'未分类'))")},` +
          `${normalizeText("o.lifecycle_status")},${normalizeText("o.owner_id")},` +
          `${normalizeText("COALESCE(NULLIF(owner_profile.display_name,''),owner_user.email)")},` +
          `${normalizeText(`CONCAT('/opportunities/',${normalizeText("o.id")})`)},` +
          `${normalizeText("'opportunity:read'")},o.updated_at`,
        "FROM opportunities o LEFT JOIN users owner_user ON owner_user.id=o.owner_id " +
          "LEFT JOIN user_profiles owner_profile ON owner_profile.user_id=o.owner_id " +
          "WHERE o.organization_id=? AND o.workspace_id=?",
        `UNION ALL SELECT e.id,${normalizeText("'evidence'")},e.id,` +
          `${normalizeText("CONCAT('证据 · ',p.name)")},${normalizeText("e.canonical_url")},` +
          `${normalizeText("e.status")},${nullText},${nullText},` +
          `${normalizeText(`CONCAT('/platform-admin/data?evidence=',${normalizeText("e.id")})`)},` +
          `${normalizeText("'platform:operate'")},e.created_at`,
        "FROM raw_evidence e JOIN providers p ON p.id=e.provider_id " +
          "WHERE e.organization_id=? AND e.workspace_id=?",
        `UNION ALL SELECT id,${normalizeText("'collection_task'")},id,` +
          `${normalizeText(`CONCAT('采集任务 · ',LEFT(${normalizeText("id")},8))`)},` +
          `${normalizeText(`CONCAT(status,IF(last_error_code IS NULL,'',CONCAT(' · ',${normalizeText("last_error_code")})))`)},` +
          `${normalizeText("status")},${nullText},${nullText},` +
          `${normalizeText(`CONCAT('/platform-admin/collection?task=',${normalizeText("id")})`)},` +
          `${normalizeText("'collection:replay'")},updated_at`,
        "FROM collection_tasks WHERE organization_id=? AND workspace_id=?",
      ].join(" "),
      scopeParams = [
        input.organizationId,
        input.workspaceId,
        input.organizationId,
        input.workspaceId,
        input.organizationId,
        input.workspaceId,
        input.organizationId,
        input.workspaceId,
        input.organizationId,
        input.workspaceId,
      ],
      clauses = [
        "required_capability IN (?)",
        "route LIKE '/%'",
        "route NOT LIKE '//%'",
        "(title LIKE ? ESCAPE '!' OR subtitle LIKE ? ESCAPE '!')",
      ],
      params: unknown[] = [...scopeParams, input.capabilities];
    const escaped = input.query.replace(/[!%_]/g, (value) => `!${value}`),
      pattern = `%${escaped}%`;
    params.push(pattern, pattern);
    if (input.resourceType) {
      clauses.push("resource_type=?");
      params.push(input.resourceType);
    }
    if (input.status) {
      clauses.push("status=?");
      params.push(input.status);
    }
    if (input.assignee) {
      const escapedAssignee = input.assignee.replace(/[!%_]/g, (value) => `!${value}`);
      clauses.push("(assignee_id=? OR assignee_name LIKE ? ESCAPE '!')");
      params.push(input.assignee, `%${escapedAssignee}%`);
    }
    if (input.cursor) {
      const [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT updated_at,id FROM (${derivedSql}) cursor_documents WHERE id=? LIMIT 1`,
        [...scopeParams, input.cursor],
      );
      if (!rows[0]) return { items: [], nextCursor: null };
      clauses.push("(updated_at<? OR (updated_at=? AND id<?))");
      params.push(rows[0].updated_at, rows[0].updated_at, input.cursor);
    }
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT id,resource_type,resource_id,title,subtitle,status,assignee_id,assignee_name,route,updated_at
       FROM (${derivedSql}) search_scope
       WHERE ${clauses.join(" AND ")}
       ORDER BY updated_at DESC,id DESC LIMIT ?`,
      [...params, input.limit * 2 + 1],
    );
    const seen = new Set<string>(),
      mapped = rows
        .filter((row) => {
          const key = `${row.resource_type}:${row.resource_id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((row) => ({
          id: String(row.id),
          resource_type: String(row.resource_type),
          resource_id: String(row.resource_id),
          title: String(row.title),
          subtitle: row.subtitle === null ? null : String(row.subtitle),
          status: row.status === null ? null : String(row.status),
          assignee_id: row.assignee_id === null ? null : String(row.assignee_id),
          assignee_name: row.assignee_name === null ? null : String(row.assignee_name),
          route: String(row.route),
          updated_at: new Date(row.updated_at).toISOString(),
        }));
    const items = mapped.slice(0, input.limit);
    return { items, nextCursor: mapped.length > input.limit ? (items.at(-1)?.id ?? null) : null };
  }
}
