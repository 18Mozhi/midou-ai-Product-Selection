import type { PoolConnection, RowDataPacket } from "mysql2/promise";

// A record without a sealed owner must not acquire a migrated account's rule.
export async function hasLegacyScoreRuleScope(
  db: Pick<PoolConnection, "query">,
  table: "score_rules" | "cost_rules" = "score_rules",
) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SHOW COLUMNS FROM ${table} WHERE Field IN ('organization_id','workspace_id','account_id','historical_context')`,
  );
  const shape = rows
    .map(({ Field }) => Field)
    .sort()
    .join(",");
  if (shape === "organization_id,workspace_id") return true;
  if (shape === "account_id,historical_context") return false;
  throw new Error(`partial_inherited_scope_schema:${table}`);
}
