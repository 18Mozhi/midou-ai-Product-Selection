async function historicalScopeRelation(pool, table) {
  const [columns] = await pool.query(
    `SHOW COLUMNS FROM \`${table}\` WHERE Field IN ('organization_id','workspace_id','historical_context')`,
  );
  const shape = columns.map(row => row.Field).sort().join(",");
  if (shape === "organization_id,workspace_id") return table;
  if (shape !== "historical_context") throw new Error(`partial_inherited_scope_schema:${table}`);
  const coordinate = column => `CONVERT(JSON_UNQUOTE(JSON_EXTRACT(q.historical_context,'$.${column}')) USING ascii) ${column}`;
  return `(SELECT q.*,${coordinate("organization_id")},${coordinate("workspace_id")} FROM ${table} q)`;
}

export const reconciliationScopeRelation = pool => historicalScopeRelation(pool, "reconciliation_runs");
export const qualityIssueScopeRelation = pool => historicalScopeRelation(pool, "data_quality_issues");
export async function evidenceAccountScopeRelations(db) {
  const shapes = [];
  for (const table of ["raw_evidence", "normalized_records"]) {
    const [rows] = await db.query(`SHOW COLUMNS FROM ${table} WHERE Field IN ('account_id','organization_id','workspace_id')`);
    shapes.push(rows.map(row => row.Field).sort().join(","));
  }
  if (shapes.every(shape => shape === "organization_id,workspace_id"))
    return { raw: "raw_evidence", normalized: "normalized_records" };
  if (!shapes.every(shape => shape === "account_id")) throw new Error("evidence_account_scope_schema_invalid");
  return {
    raw: `(SELECT r.*,t.organization_id,t.workspace_id FROM raw_evidence r
      LEFT JOIN collection_tasks t ON t.id=r.collection_task_id)`,
    normalized: `(SELECT n.*,t.organization_id,t.workspace_id FROM normalized_records n
      LEFT JOIN raw_evidence r ON r.id=n.raw_evidence_id AND r.provider_id=n.provider_id AND r.account_id=n.account_id
      LEFT JOIN collection_tasks t ON t.id=r.collection_task_id)`,
  };
}

const evidenceEventParentJoins = (reconciliation, issue, raw = "raw_evidence") => `
  LEFT JOIN ${raw} r ON BINARY e.resource_type='raw_evidence' AND r.id=e.resource_id
  LEFT JOIN browser_evidence_artifacts b ON BINARY e.resource_type='browser_evidence_artifact' AND b.id=e.resource_id
  LEFT JOIN collection_tasks t ON t.id=b.collection_task_id
  LEFT JOIN ${issue} i ON BINARY e.resource_type='data_quality_issue' AND i.id=e.resource_id
  LEFT JOIN ${reconciliation} c ON BINARY e.resource_type='reconciliation_run' AND c.id=e.resource_id`;
const ownerScope = (column) => `COALESCE(r.${column},t.${column},i.${column},c.${column})`;
const evidenceScopeRelation = (table, reconciliation, issue, raw) => `(SELECT e.*,${ownerScope("organization_id")} organization_id,
  ${ownerScope("workspace_id")} workspace_id FROM ${table} e ${evidenceEventParentJoins(reconciliation, issue, raw)})`;
export const evidenceEventScopeRelation = (reconciliation, issue = "data_quality_issues", raw) => evidenceScopeRelation("evidence_data_events", reconciliation, issue, raw);
export const evidenceOutboxScopeRelation = (reconciliation, issue = "data_quality_issues", raw) => evidenceScopeRelation("evidence_data_outbox", reconciliation, issue, raw);

async function evidenceCleanupSql(pool, table) {
  const [scope] = await pool.query(
    `SHOW COLUMNS FROM ${table} WHERE Field IN ('organization_id','workspace_id')`,
  );
  if (scope.length === 1) throw new Error(`partial_inherited_scope_schema:${table}`);
  if (scope.length === 2) return `DELETE FROM ${table} WHERE organization_id IN (?,?)`;
  return `DELETE e FROM ${table} e ${evidenceEventParentJoins(await reconciliationScopeRelation(pool), await qualityIssueScopeRelation(pool))}
    WHERE ${ownerScope("organization_id")} IN (?,?)`;
}
export const evidenceEventCleanupSql = (pool) => evidenceCleanupSql(pool, "evidence_data_events");
export const evidenceOutboxCleanupSql = (pool) => evidenceCleanupSql(pool, "evidence_data_outbox");

export async function qualityIssueCleanupSql(pool) {
  const relation = await qualityIssueScopeRelation(pool);
  return relation === "data_quality_issues" ? "DELETE FROM data_quality_issues WHERE organization_id IN (?,?)"
    : "DELETE q FROM data_quality_issues q WHERE " +
      "CONVERT(JSON_UNQUOTE(JSON_EXTRACT(q.historical_context,'$.organization_id')) USING ascii) IN (?,?)";
}
