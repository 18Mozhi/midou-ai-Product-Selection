import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

type Column = "organization_id" | "workspace_id";

export async function dataQualityIssueScope(db: Pool | PoolConnection, accountMode: boolean) {
  let historical = false;
  if (accountMode) {
    const [columns] = await db.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM data_quality_issues WHERE Field IN ('organization_id','workspace_id','historical_context')",
    );
    const shape = columns
      .map((row) => row.Field)
      .sort()
      .join(",");
    if (shape !== "historical_context" && shape !== "organization_id,workspace_id")
      throw new Error("data_quality_issue_scope_schema_incomplete");
    historical = shape === "historical_context";
  }
  const coordinate = (alias: "i" | "q", column: Column) =>
    historical
      ? `CONVERT(JSON_UNQUOTE(JSON_EXTRACT(${alias}.historical_context,'$.${column}')) USING ascii)`
      : `${alias}.${column}`;
  const scopeFilter = (sql: string, alias: "i" | "q") =>
    sql
      .replaceAll(`${alias}.organization_id`, coordinate(alias, "organization_id"))
      .replaceAll(`${alias}.workspace_id`, coordinate(alias, "workspace_id"));
  return {
    coordinate,
    scopeFilter,
    select: historical
      ? `i.*,${coordinate("i", "organization_id")} organization_id,${coordinate("i", "workspace_id")} workspace_id`
      : "i.*",
    columns: historical ? "historical_context" : "organization_id,workspace_id",
    placeholders: historical ? "?" : "?,?",
    values: (organizationId: string, workspaceId: string) =>
      historical
        ? [JSON.stringify({ organization_id: organizationId, workspace_id: workspaceId })]
        : [organizationId, workspaceId],
  };
}
