import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export async function approvalTemplateScopeRelation(db: Pick<PoolConnection, "query">) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM approval_templates WHERE Field IN ('organization_id','workspace_id','account_id','historical_context')",
  );
  const shape = rows
    .map((row) => row.Field)
    .sort()
    .join(",");
  if (shape === "organization_id,workspace_id") return "approval_templates";
  if (shape !== "account_id,historical_context")
    throw new Error("approval_template_scope_schema_invalid");
  const coordinate = (name: string) =>
    `CAST(JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.${name}')) AS CHAR CHARACTER SET ascii) COLLATE ascii_general_ci AS ${name}`;
  return `(SELECT approval_templates.*,${coordinate("organization_id")},${coordinate("workspace_id")} FROM approval_templates)`;
}

// Current request events still feed the shared legacy outbox. The resource,
// not the template, supplies its coordinates for newly account-owned templates.
export const approvalRequestCoordinates = (
  alias: "r" | "q",
  column: "organization_id" | "workspace_id",
) =>
  `CASE ${alias}.resource_type
    WHEN 'task' THEN (SELECT a.${column} FROM tasks a WHERE a.id=${alias}.resource_id)
    WHEN 'opportunity_decision' THEN (SELECT a.${column} FROM opportunity_decisions d
      JOIN opportunities a ON a.id=d.opportunity_id WHERE d.id=${alias}.resource_id)
    END`;
