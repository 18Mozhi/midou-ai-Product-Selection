import {
  nativeAutomaticEvaluationCandidatePresenceSql,
  nativeAutomaticEvaluationParentSql,
  accountAutomaticEvaluationPresenceSql,
  accountAutomaticEvaluationParentSql,
} from "./automatic-selection-evaluation-admission.js";

const owner = (table: string, id: string) =>
  `EXISTS (SELECT 1 FROM account_owned_records a WHERE a.source_table='${table}' AND a.source_id=${id} AND a.account_id=ao.account_id)`;

export function nativeEvaluationRecoverySql(candidates: string, update: string, presence: string) {
  const adapted = (sql: string, point: boolean) =>
    sql.replace("opportunities o JOIN organizations", () =>
      // Preserve the existing inactive-source guard until the parent scope retires.
      `${nativeAutomaticEvaluationParentSql}JOIN users u ON u.id=ao.account_id AND u.status='active' JOIN organizations`)
      .replace(presence, () => nativeAutomaticEvaluationCandidatePresenceSql)
      .replace("WHERE o.id=e.opportunity_id ", () =>
        `WHERE o.id=e.opportunity_id AND ao.account_id=${point ? "?" : "scan_owner.account_id"} `)
      .replace("AND ci.is_current=1", () => `AND ${owner("opportunity_cost_inputs", "ci.id")} AND ci.is_current=1`);
  const scan = adapted(candidates, false)
    .replace("p.workspace_id FROM", "p.workspace_id,scan_owner.account_id FROM")
    .replace("p.id=e.opportunity_id WHERE",
      "p.id=e.opportunity_id JOIN account_owned_records scan_owner ON scan_owner.source_table='opportunities' AND scan_owner.source_id=p.id WHERE");
  const write = adapted(update, true);
  if (scan === candidates || write === update || !scan.includes("active_task_owner") || !write.includes("active_task_owner"))
    throw new Error("automatic_evaluation_recovery_sql_shape_changed");
  return { candidates: scan, update: write };
}

export function accountEvaluationRecoverySql(candidates: string, update: string, presence: string) {
  const adapted = (sql: string, point: boolean) => sql
    .replace(/opportunities o JOIN organizations g ON g\.id=o\.organization_id AND g\.status='active' JOIN workspaces w ON w\.id=o\.workspace_id AND w\.organization_id=o\.organization_id AND w\.status='active' /,
      accountAutomaticEvaluationParentSql)
    .replace(presence, () => accountAutomaticEvaluationPresenceSql)
    .replace("WHERE o.id=e.opportunity_id ", () =>
      `WHERE o.id=e.opportunity_id AND o.account_id=ao.account_id AND ao.account_id=${point ? "?" : "p.account_id"} `)
    .replace("AND ci.is_current=1", () => `AND ${owner("opportunity_cost_inputs", "ci.id")} AND ci.is_current=1`);
  const scan = adapted(candidates, false).replace("p.organization_id,p.workspace_id", "p.account_id");
  const write = adapted(update, true)
    .replace("AND EXISTS (SELECT 1 FROM opportunities p WHERE p.id=e.opportunity_id AND p.organization_id=? AND p.workspace_id=?) ", "");
  for (const sql of [scan, write]) {
    if (/organization_id|workspace_id|\b(?:organizations|workspaces)\b/.test(sql) || !sql.includes("active_task_owner"))
      throw new Error("account_automatic_evaluation_recovery_sql_shape_changed");
  }
  return { candidates: scan, update: write };
}
