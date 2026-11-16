import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export async function accountReportScope(
  db: Pick<PoolConnection, "query">,
  table: "opportunities" | "trend_topics",
) {
  // Only owned source facts may enter either a live aggregate or an exported CSV.
  if (table !== "opportunities" && table !== "trend_topics")
    throw new Error("account_report_source_invalid");
  const [columns] = await db.query<RowDataPacket[]>(
    `SHOW COLUMNS FROM ${table} WHERE Field IN ('account_id','organization_id','workspace_id')`,
  );
  const shape = columns
    .map((column) => column.Field)
    .sort()
    .join(",");
  if (shape !== "account_id" && shape !== "organization_id,workspace_id")
    throw new Error("account_report_scope_shape_invalid");
  return (
    `EXISTS (SELECT 1 FROM account_owned_records o ` +
    `JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 ` +
    `WHERE o.source_table='${table}' AND o.source_id=${table}.id AND o.account_id=? ` +
    (shape === "account_id" ? `AND o.account_id=${table}.account_id ` : "") +
    `AND (o.reason='exclusive_owner' OR (o.reason IN ('shared','unassigned') AND o.account_id=cut.primary_account_id)))`
  );
}
