import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export async function hasLegacyCompetitorRuleScope(db: Pick<PoolConnection, "query">) {
  const [columns] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM competitor_monitor_rules WHERE Field IN ('organization_id','workspace_id','historical_context')",
  );
  const shape = columns
    .map(({ Field }) => Field)
    .sort()
    .join(",");
  if (shape === "organization_id,workspace_id") return true;
  if (shape === "historical_context") return false;
  throw new Error("partial_inherited_scope_schema:competitor_monitor_rules");
}
