import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export async function nativeAutomationOutbox(db: Pick<PoolConnection, "query">) {
  const [columns] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM outbox_events WHERE Field IN ('organization_id','workspace_id')",
  );
  if (columns.length === 0) return true;
  if (
    columns
      .map((row) => row.Field)
      .sort()
      .join(",") === "organization_id,workspace_id"
  )
    return false;
  throw new Error("automation_outbox_scope_schema_invalid");
}

export async function automationRuleScopeRelation(db: Pick<PoolConnection, "query">) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM automation_rules WHERE Field IN ('organization_id','workspace_id','account_id','historical_context')",
  );
  const shape = rows
    .map((row) => row.Field)
    .sort()
    .join(",");
  if (shape === "organization_id,workspace_id") return "automation_rules";
  if (shape !== "account_id,historical_context")
    throw new Error("automation_rule_scope_schema_invalid");
  const coordinate = (name: string) =>
    `CAST(JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.${name}')) AS CHAR CHARACTER SET ascii) COLLATE ascii_general_ci AS ${name}`;
  return `(SELECT automation_rules.*,${coordinate("organization_id")},${coordinate("workspace_id")} FROM automation_rules)`;
}
