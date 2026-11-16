import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export async function trendRuleScopeRelation(db: Pick<PoolConnection, "query">) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM trend_monitoring_rules WHERE Field IN ('organization_id','workspace_id','historical_context')",
  );
  const shape = rows
    .map((row) => row.Field)
    .sort()
    .join(",");
  if (shape === "organization_id,workspace_id") return "trend_monitoring_rules";
  if (shape !== "historical_context") throw new Error("trend_rule_scope_schema_invalid");
  const coordinate = (key: string) =>
    `CAST(JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.${key}')) AS CHAR CHARACTER SET ascii) COLLATE ascii_general_ci AS ${key}`;
  return `(SELECT trend_monitoring_rules.*,${coordinate("organization_id")},${coordinate("workspace_id")} FROM trend_monitoring_rules)`;
}
