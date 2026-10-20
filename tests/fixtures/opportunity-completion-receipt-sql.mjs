import { opportunityAnalysisCompletedAtSql } from "../../apps/api/dist/opportunity-completed-filter.js";

/** MySQL5.7 SELECT-only fixtures; no tables or persisted test records. */
export function completionReceiptCases() {
  const first = {
    id: "a",
    organization_id: "org",
    workspace_id: "ws",
    resource_id: "original",
    resource_type: "selection_pipeline",
    event_type: "opportunity.selection_pipeline_completed",
    actor_type: "worker",
    occurred_at: "2026-10-19 12:00:00.000",
    contract: "selection-pipeline-v2",
    main_asin: "B0GYL94HGW",
  };
  const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
  const row = (value) => {
    const { contract, main_asin, ...columns } = value;
    return (
      "SELECT " +
      Object.entries({
        ...columns,
        payload_json: JSON.stringify({
          contract,
          main_asin,
          profit_status: "unknown",
          recommendation_status: "not_recommend",
        }),
      })
        .map(([key, item]) => literal(item) + " " + key)
        .join(",")
    );
  };
  const cases = [
    [
      "unknown profit and low recommendation still have a receipt",
      [first],
      first.main_asin,
      first.occurred_at,
    ],
    [
      "legacy v1 remains readable",
      [{ ...first, contract: "selection-pipeline-v1" }],
      first.main_asin,
      first.occurred_at,
    ],
    [
      "case-insensitive current ASIN",
      [{ ...first, main_asin: first.main_asin.toLowerCase() }],
      first.main_asin,
      first.occurred_at,
    ],
    ["a changed primary does not inherit the old receipt", [first], "B0H5QYWY1Z", null],
    ["no current primary means no completion", [first], "", null],
    [
      "repeated completion keeps the earliest time",
      [first, { ...first, id: "b", occurred_at: "2026-10-20 12:00:00.000" }],
      first.main_asin,
      first.occurred_at,
    ],
  ];
  for (const [key, value] of [
    ["organization_id", "other"],
    ["workspace_id", "other"],
    ["resource_id", "other"],
    ["actor_type", "user"],
    ["resource_type", "opportunity"],
    ["event_type", "opportunity.scored"],
    ["contract", "unknown"],
    ["main_asin", "short"],
  ])
    cases.push([
      `invalid ${key} cannot supply a receipt`,
      [{ ...first, [key]: value }],
      first.main_asin,
      null,
    ]);
  return cases.map(([name, events, asin, expected]) => ({
    name,
    expected,
    sql: opportunityAnalysisCompletedAtSql.replace(
      "FROM opportunity_events receipt",
      "FROM (" + events.map(row).join(" UNION ALL ") + ") receipt",
    ),
    params: ["org", "ws", "original", asin],
  }));
}
