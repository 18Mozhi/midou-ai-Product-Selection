/** Exercise production guards against read-only derived rows and existing primary evidence. */
export const skippedRecoveryScenarios = [
  { name: "primary_skip", expected: 1 },
  { name: "legacy_rule_skip", skipped: "not_rule_candidate", expected: 1 },
  { name: "real_success", skipped: null, expected: 0 },
  { name: "unknown_skip", skipped: "other", expected: 0 },
  ...[
    "queued",
    "leased",
    "waiting_evidence",
    "retry_scheduled",
    "dead_letter",
    "failed_terminal",
  ].map((status) => ({ name: status, status, expected: 0 })),
  { name: "wrong_org", wrongOrg: true, expected: 0 },
  { name: "wrong_workspace", wrongWorkspace: true, expected: 0 },
  { name: "inactive_org", organizationStatus: "inactive", expected: 0 },
  { name: "inactive_workspace", workspaceStatus: "inactive", expected: 0 },
  { name: "workspace_org_mismatch", workspaceOrgMismatch: true, expected: 0 },
  { name: "adopted", decision: "adopted", expected: 0 },
  { name: "archived", lifecycle: "archived", expected: 0 },
  { name: "deleted", lifecycle: "deleted", expected: 0 },
  { name: "primary_missing", primaryMissing: true, expected: 0 },
];
export function skippedRecoveryProbe({ candidateSql, updateSql, scope, scenario, point = false }) {
  const [originalId, org, ws] = scope,
    id = scenario.primaryMissing ? "00000000-0000-4000-8000-000000000000" : originalId;
  let sql = point
    ? "SELECT e.opportunity_id FROM automatic_selection_evaluations e " +
      updateSql.slice(updateSql.indexOf("WHERE e.opportunity_id=?"))
    : candidateSql;
  sql = sql
    .replace(
      "automatic_selection_evaluations e",
      "(SELECT CAST(? AS CHAR CHARACTER SET ascii) opportunity_id,CAST(? AS CHAR CHARACTER SET ascii) organization_id,CAST(? AS CHAR CHARACTER SET ascii) workspace_id,? status,CAST(? AS JSON) result_json,? available_at) e",
    )
    .replace(
      "opportunities o ",
      "(SELECT CAST(? AS CHAR CHARACTER SET ascii) id,CAST(? AS CHAR CHARACTER SET ascii) organization_id,CAST(? AS CHAR CHARACTER SET ascii) workspace_id,? decision_status,? lifecycle_status) o ",
    )
    .replace("organizations g ", "(SELECT CAST(? AS CHAR CHARACTER SET ascii) id,? status) g ")
    .replace(
      "workspaces w ",
      "(SELECT CAST(? AS CHAR CHARACTER SET ascii) id,CAST(? AS CHAR CHARACTER SET ascii) organization_id,? status) w ",
    );
  const params = [
    id,
    scenario.wrongOrg ? "other-org" : org,
    scenario.wrongWorkspace ? "other-ws" : ws,
    scenario.status ?? "succeeded",
    JSON.stringify({
      skipped:
        scenario.skipped === undefined
          ? "primary_product_missing_or_not_pending"
          : scenario.skipped,
    }),
    "2026-10-20 00:00:00",
  ];
  if (point) params.push(id, org, ws);
  params.push(
    id,
    org,
    ws,
    scenario.decision ?? "pending",
    scenario.lifecycle ?? "candidate",
    org,
    scenario.organizationStatus ?? "active",
    ws,
    scenario.workspaceOrgMismatch ? "other-org" : org,
    scenario.workspaceStatus ?? "active",
  );
  return {
    name: scenario.name + (point ? "_point" : "_candidate"),
    sql,
    params,
    expected: scenario.expected,
  };
}
