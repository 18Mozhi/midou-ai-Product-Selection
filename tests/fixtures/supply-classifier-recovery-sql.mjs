/** Read-only derived rows exercise the shipped SQL guards without creating tables or jobs. */
export const classifierRecoveryScenarios = [
  { name: "legacy_failure", expected: 1 },
  { name: "older_revision", revision: "old", expected: 1 },
  { name: "current_revision", revision: "current", expected: 0 },
  ...["queued", "leased", "retry_scheduled", "succeeded", "dead_letter", "failed_terminal"].map(
    (status) => ({ name: status, status, expected: 0 }),
  ),
  { name: "model_timeout", error: "intelligence_model_timeout", expected: 0 },
  { name: "no_classification_error", error: null, expected: 0 },
  { name: "wrong_organization", wrongOrg: true, expected: 0 },
  { name: "wrong_workspace", wrongWorkspace: true, expected: 0 },
  { name: "adopted", decision: "adopted", expected: 0 },
  { name: "archived", lifecycle: "archived", expected: 0 },
  { name: "deleted", lifecycle: "deleted", expected: 0 },
];

export function buildClassifierRecoveryProbe({
  candidateSql,
  updateSql,
  revision,
  scope,
  scenario,
  point = false,
}) {
  const [opportunityId, organizationId, workspaceId] = scope;
  const result = {
    supply_title_classification_error:
      scenario.error === undefined ? "supply_title_classification_failed" : scenario.error,
  };
  if (scenario.revision)
    result.supply_title_classifier_revision =
      scenario.revision === "current" ? revision : scenario.revision;
  const virtualEvaluation =
    "(SELECT CAST(? AS CHAR CHARACTER SET ascii) opportunity_id,CAST(? AS CHAR CHARACTER SET ascii) organization_id,CAST(? AS CHAR CHARACTER SET ascii) workspace_id,? status,CAST(? AS JSON) result_json,? available_at) e";
  const virtualOpportunity =
    "(SELECT CAST(? AS CHAR CHARACTER SET ascii) id,CAST(? AS CHAR CHARACTER SET ascii) organization_id,CAST(? AS CHAR CHARACTER SET ascii) workspace_id,? decision_status,? lifecycle_status) o ";
  let sql = point
    ? "SELECT e.opportunity_id,e.organization_id,e.workspace_id FROM automatic_selection_evaluations e " +
      updateSql.slice(updateSql.indexOf("WHERE e.opportunity_id=?"))
    : candidateSql;
  sql = sql
    .replace("automatic_selection_evaluations e", virtualEvaluation)
    .replace("opportunities o ", virtualOpportunity);
  const params = [
    opportunityId,
    scenario.wrongOrg ? "00000000-0000-4000-8000-000000000001" : organizationId,
    scenario.wrongWorkspace ? "00000000-0000-4000-8000-000000000002" : workspaceId,
    scenario.status ?? "waiting_evidence",
    JSON.stringify(result),
    "2026-10-20 00:00:00",
  ];
  if (point) params.push(opportunityId, organizationId, workspaceId);
  params.push(
    revision,
    opportunityId,
    organizationId,
    workspaceId,
    scenario.decision ?? "pending",
    scenario.lifecycle ?? "active",
  );
  return {
    name: scenario.name + (point ? "_point" : "_candidate"),
    sql,
    params,
    expected: scenario.expected,
  };
}
