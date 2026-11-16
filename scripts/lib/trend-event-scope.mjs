const joins = (rules = "trend_monitoring_rules", topics = "trend_topics") => `
  LEFT JOIN ${topics} t ON BINARY ev.resource_type='trend_topic' AND t.id=ev.resource_id
  LEFT JOIN trend_topic_change_requests c ON BINARY ev.resource_type='trend_topic_change_request' AND c.id=ev.resource_id
  LEFT JOIN ${topics} ct ON ct.id=c.target_topic_id
  LEFT JOIN ${rules} r ON BINARY ev.resource_type='trend_monitoring_rule' AND r.id=ev.resource_id`;
const scope = column => `COALESCE(t.${column},ct.${column},r.${column})`;
export const trendEventScopeRelation = (rules, topics) => `(SELECT ev.*,${scope("organization_id")} organization_id,
  ${scope("workspace_id")} workspace_id FROM trend_events ev ${joins(rules, topics)})`;

export async function trendTopicHistoricalScopeRelation(db) {
  const [rows] = await db.query(
    "SHOW COLUMNS FROM trend_topics WHERE Field IN ('account_id','organization_id','workspace_id')",
  );
  const shape = rows.map(row => row.Field).sort().join(",");
  if (shape === "organization_id,workspace_id") return "trend_topics";
  if (shape !== "account_id") throw new Error("trend_topic_scope_schema_invalid");
  return `(SELECT t.*,r.legacy_org_id organization_id,r.legacy_workspace_id workspace_id FROM trend_topics t
    LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
    LEFT JOIN account_retirement_records r ON r.run_id=c.source_run_id AND r.source_table='trend_topics' AND r.source_id=t.id)`;
}

async function legacy(pool, table) {
  const [columns] = await pool.query(`SHOW COLUMNS FROM ${table} WHERE Field IN ('organization_id','workspace_id')`);
  if (columns.length === 1) throw new Error(`partial_inherited_scope_schema:${table}`);
  return columns.length === 2;
}

export async function trendEventProbeScope(pool) {
  const old = await legacy(pool, "trend_events");
  const rules = old ? undefined : await trendRuleScopeRelation(pool);
  return {
    relation: old ? "trend_events" : trendEventScopeRelation(rules),
    cleanup: old ? "DELETE FROM trend_events WHERE organization_id IN (?,?)"
      : `DELETE ev FROM trend_events ev ${joins(rules)} WHERE ${scope("organization_id")} IN (?,?)`,
  };
}

export async function trendOutboxProbeScope(pool) {
  const old = await legacy(pool, "trend_outbox");
  const from = old ? "trend_outbox o" : `trend_outbox o JOIN ${(await trendEventProbeScope(pool)).relation} e ON e.id=o.id`;
  const org = old ? "o.organization_id" : "e.organization_id";
  return { from, org, cleanup: `DELETE o FROM ${from} WHERE ${org} IN (?,?)` };
}

export async function trendRuleScopeRelation(pool) {
  const [rows] = await pool.query(
    "SHOW COLUMNS FROM trend_monitoring_rules WHERE Field IN ('organization_id','workspace_id','historical_context')",
  );
  const shape = rows.map(row => row.Field).sort().join(",");
  if (shape === "organization_id,workspace_id") return "trend_monitoring_rules";
  if (shape !== "historical_context") throw new Error("trend_rule_scope_schema_invalid");
  const coordinate = key =>
    `CAST(JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.${key}')) AS CHAR CHARACTER SET ascii) COLLATE ascii_general_ci AS ${key}`;
  return `(SELECT trend_monitoring_rules.*,${coordinate("organization_id")},${coordinate("workspace_id")} FROM trend_monitoring_rules)`;
}
