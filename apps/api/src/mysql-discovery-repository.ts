import type { Pool, RowDataPacket } from "mysql2/promise";
import type { DiscoveryRepository } from "./discovery-service.js";
export class MySqlDiscoveryRepository implements DiscoveryRepository {
  constructor(private readonly pool: Pool) {}
  async search(input: Parameters<DiscoveryRepository["search"]>[0]) {
    if (!input.capabilities.length) return { items: [], nextCursor: null };
    const derivedSql = [
        "SELECT id,resource_type,resource_id,title,subtitle,route,required_capability,updated_at",
        "FROM search_documents WHERE organization_id=? AND workspace_id=?",
        "UNION ALL SELECT id,'task',id,title,description,CONCAT('/tasks/',id),'task:read',updated_at",
        "FROM tasks WHERE organization_id=? AND workspace_id=? AND deleted_at IS NULL",
        "UNION ALL SELECT id,'opportunity',id,name,CONCAT(market,' · ',COALESCE(category,'未分类'))," +
          "CONCAT('/opportunities/',id),'opportunity:read',updated_at",
        "FROM opportunities WHERE organization_id=? AND workspace_id=?",
        "UNION ALL SELECT e.id,'evidence',e.id,CONCAT('证据 · ',p.name),e.canonical_url," +
          "CONCAT('/platform-admin/data?evidence=',e.id),'platform:operate',e.created_at",
        "FROM raw_evidence e JOIN providers p ON p.id=e.provider_id " +
          "WHERE e.organization_id=? AND e.workspace_id=?",
        "UNION ALL SELECT id,'collection_task',id,CONCAT('采集任务 · ',LEFT(id,8))," +
          "CONCAT(status,IF(last_error_code IS NULL,'',CONCAT(' · ',last_error_code)))," +
          "CONCAT('/platform-admin/collection?task=',id),'collection:replay',updated_at",
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
      `SELECT id,resource_type,resource_id,title,subtitle,route,updated_at
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
          route: String(row.route),
          updated_at: new Date(row.updated_at).toISOString(),
        }));
    const items = mapped.slice(0, input.limit);
    return { items, nextCursor: mapped.length > input.limit ? (items.at(-1)?.id ?? null) : null };
  }
}
