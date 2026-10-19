import { automaticPrimaryRefreshRecheckSql } from "../../apps/worker/dist/automatic-primary-detail-refresh.js";

// Scoped real-data SELECT probes; no table is created or changed.
export function automaticPrimaryRefreshEvaluationCases(target, before, capacity) {
  const ids = [
    target.competitorId,
    target.organizationId,
    target.workspaceId,
    target.opportunityId,
  ];
  const realSql = automaticPrimaryRefreshRecheckSql.replace(/ FOR UPDATE$/, "");
  const sql = realSql.replace(
    "automatic_selection_evaluations e_wait",
    "(SELECT CAST(? AS CHAR CHARACTER SET ascii) opportunity_id,CAST(? AS CHAR CHARACTER SET ascii) organization_id,CAST(? AS CHAR CHARACTER SET ascii) workspace_id,CAST(? AS CHAR CHARACTER SET ascii) status,CAST(? AS CHAR CHARACTER SET ascii) last_error_code) e_wait",
  );
  const evaluation = [
    target.opportunityId,
    target.organizationId,
    target.workspaceId,
    "waiting_evidence",
    "amazon_competitor_snapshot_missing",
  ];
  const build = (name, expected, changes = {}) => ({
    name,
    expected,
    sql,
    params: [
      ...(changes.ids ?? ids),
      ...(changes.evaluation ?? evaluation),
      ...(changes.tail ?? [before, before, capacity]),
    ],
  });
  return [
    {
      name: "actual-current-state",
      expected: 1,
      sql: realSql,
      params: [...ids, before, before, capacity],
    },
    build("waiting-missing-detail", 1),
    build("waiting-missing-sale", 1, {
      evaluation: [...evaluation.slice(0, 4), "amazon_sale_facts_incomplete"],
    }),
    ...[
      "queued",
      "leased",
      "waiting_profit",
      "succeeded",
      "retry_scheduled",
      "failed_terminal",
      "dead_letter",
    ].map((status) =>
      build(`exclude-status-${status}`, 0, {
        evaluation: [...evaluation.slice(0, 3), status, evaluation[4]],
      }),
    ),
    ...[
      "automatic_rules_not_active",
      "high_confidence_1688_match_missing",
      "automatic_cost_scope_mismatch",
      "amazon_product_evidence_missing",
      null,
    ].map((reason) =>
      build(`exclude-reason-${reason}`, 0, { evaluation: [...evaluation.slice(0, 4), reason] }),
    ),
    ...[0, 1, 2].map((index) =>
      build(`exclude-evaluation-scope-${index}`, 0, {
        evaluation: evaluation.map((value, i) => (i === index ? "foreign-scope" : value)),
      }),
    ),
    ...[0, 1, 2, 3].map((index) =>
      build(`exclude-selected-identity-${index}`, 0, {
        ids: ids.map((value, i) => (i === index ? "foreign-selected" : value)),
      }),
    ),
    build("before-observation-age", 0, { tail: [new Date(0), before, capacity] }),
    build("capacity-held", 0, { tail: [before, before, 0] }),
  ];
}
