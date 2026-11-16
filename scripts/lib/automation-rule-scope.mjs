export async function automationRuleScopeRelation(db) {
  const [rows] = await db.query(
    "SHOW COLUMNS FROM automation_rules WHERE Field IN ('organization_id','workspace_id','account_id','historical_context')",
  );
  const shape = rows.map(row => row.Field).sort().join(",");
  if (shape === "organization_id,workspace_id") return "automation_rules";
  if (shape !== "account_id,historical_context") throw new Error("automation_rule_scope_schema_invalid");
  const coordinate = name =>
    `CAST(JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.${name}')) AS CHAR CHARACTER SET ascii) COLLATE ascii_general_ci AS ${name}`;
  return `(SELECT automation_rules.*,${coordinate("organization_id")},${coordinate("workspace_id")} FROM automation_rules)`;
}
