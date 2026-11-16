export async function approvalTemplateScopeRelation(db) {
  const [rows] = await db.query(
    "SHOW COLUMNS FROM approval_templates WHERE Field IN ('organization_id','workspace_id','account_id','historical_context')",
  );
  const shape = rows.map(row => row.Field).sort().join(",");
  if (shape === "organization_id,workspace_id") return "approval_templates";
  if (shape !== "account_id,historical_context") throw new Error("approval_template_scope_schema_invalid");
  const coordinate = name =>
    `CAST(JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.${name}')) AS CHAR CHARACTER SET ascii) COLLATE ascii_general_ci AS ${name}`;
  return `(SELECT approval_templates.*,${coordinate("organization_id")},${coordinate("workspace_id")} FROM approval_templates)`;
}
