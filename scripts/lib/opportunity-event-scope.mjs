const joins = (rateRelation, scoreRelation, costRelation) => `
  LEFT JOIN opportunities o ON BINARY ev.resource_type IN ('opportunity','selection_pipeline') AND o.id=ev.resource_id
  LEFT JOIN ${costRelation} c ON BINARY ev.resource_type='cost_rule' AND c.id=ev.resource_id
  LEFT JOIN ${scoreRelation} s ON BINARY ev.resource_type='score_rule' AND s.id=ev.resource_id
  LEFT JOIN ${rateRelation} x ON BINARY ev.resource_type='exchange_rate' AND x.id=ev.resource_id`;
const scope = column => `COALESCE(o.${column},c.${column},s.${column},x.${column})`;
export const opportunityEventScopeRelation = (rateRelation = "exchange_rate_quotes", scoreRelation = "score_rules", costRelation = "cost_rules") =>
  `(SELECT ev.*,${scope("organization_id")} organization_id,
  ${scope("workspace_id")} workspace_id FROM opportunity_events ev ${joins(rateRelation, scoreRelation, costRelation)})`;

export async function scoreRuleScopeRelation(pool) {
  const [columns] = await pool.query(
    "SHOW COLUMNS FROM score_rules WHERE Field IN ('organization_id','workspace_id','account_id','historical_context')",
  );
  const shape = columns.map(row => row.Field).sort().join(",");
  if (shape === "organization_id,workspace_id") return "score_rules";
  if (shape !== "account_id,historical_context") throw new Error("partial_inherited_scope_schema:score_rules");
  const coordinate = column =>
    `CAST(JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.${column}')) AS CHAR CHARACTER SET ascii) COLLATE ascii_general_ci AS ${column}`;
  return `(SELECT score_rules.*,${coordinate("organization_id")},${coordinate("workspace_id")} FROM score_rules)`;
}

export async function costRuleScopeRelation(pool) {
  const [columns] = await pool.query(
    "SHOW COLUMNS FROM cost_rules WHERE Field IN ('organization_id','workspace_id','account_id','historical_context')",
  );
  const shape = columns.map(row => row.Field).sort().join(",");
  if (shape === "organization_id,workspace_id") return "cost_rules";
  if (shape !== "account_id,historical_context") throw new Error("partial_inherited_scope_schema:cost_rules");
  const coordinate = column =>
    `CAST(JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.${column}')) AS CHAR CHARACTER SET ascii) COLLATE ascii_general_ci AS ${column}`;
  return `(SELECT cost_rules.*,${coordinate("organization_id")},${coordinate("workspace_id")} FROM cost_rules)`;
}

export async function exchangeRateQuoteScopeRelation(pool) {
  const [columns] = await pool.query(
    "SHOW COLUMNS FROM exchange_rate_quotes WHERE Field IN ('organization_id','workspace_id','historical_context')",
  );
  const shape = columns.map(row => row.Field).sort().join(",");
  if (shape === "organization_id,workspace_id") return "exchange_rate_quotes";
  if (shape !== "historical_context") throw new Error("partial_inherited_scope_schema:exchange_rate_quotes");
  const coordinate = column => `CONVERT(JSON_UNQUOTE(JSON_EXTRACT(q.historical_context,'$.${column}')) USING ascii) ${column}`;
  return `(SELECT q.*,${coordinate("organization_id")},${coordinate("workspace_id")} FROM exchange_rate_quotes q)`;
}

export async function opportunityEventProbeScope(pool) {
  const [columns] = await pool.query(
    "SHOW COLUMNS FROM opportunity_events WHERE Field IN ('organization_id','workspace_id')",
  );
  if (columns.length === 1) throw new Error("partial_inherited_scope_schema:opportunity_events");
  const legacy = columns.length === 2;
  const rates = legacy ? null : await exchangeRateQuoteScopeRelation(pool);
  const scores = legacy ? null : await scoreRuleScopeRelation(pool);
  const costs = legacy ? null : await costRuleScopeRelation(pool);
  return {
    relation: legacy ? "opportunity_events" : opportunityEventScopeRelation(rates, scores, costs),
    cleanup: legacy ? "DELETE FROM opportunity_events WHERE organization_id IN (?,?)"
      : `DELETE ev FROM opportunity_events ev ${joins(rates, scores, costs)} WHERE ${scope("organization_id")} IN (?,?)`,
  };
}
