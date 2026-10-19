import { opportunityCompletedFilterSql } from "../../apps/api/dist/opportunity-completed-filter.js";

/** Read-only MySQL 5.7 derived tables; no temporary tables or business writes. */
export function completedFilterCases() {
  const first = {
    id: "a",
    organization_id: "org",
    workspace_id: "ws",
    resource_id: "original",
    resource_type: "selection_pipeline",
    event_type: "opportunity.selection_pipeline_completed",
    actor_type: "worker",
    contract: "selection-pipeline-v2",
    main_asin: "B0GYL94HGW",
    occurred_at: "2026-10-19 12:00:00",
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
    ["unknown profit and not recommended count", [first], "original", 1],
    [
      "a repeated completion is one original product",
      [first, { ...first, id: "b", resource_id: "duplicate", occurred_at: "2026-10-20 12:00:00" }],
      "duplicate",
      0,
    ],
    [
      "first product remains",
      [first, { ...first, id: "b", resource_id: "duplicate" }],
      "original",
      1,
    ],
    [
      "equal timestamp resolves by event id",
      [first, { ...first, id: "b", resource_id: "duplicate" }],
      "duplicate",
      0,
    ],
    [
      "case insensitive ASIN deduplication",
      [first, { ...first, id: "b", main_asin: "b0gyl94hgw", resource_id: "duplicate" }],
      "duplicate",
      0,
    ],
    [
      "other workspace cannot suppress",
      [
        { ...first, workspace_id: "other" },
        { ...first, id: "b", resource_id: "duplicate" },
      ],
      "duplicate",
      1,
    ],
    [
      "other organization cannot suppress",
      [
        { ...first, organization_id: "other" },
        { ...first, id: "b", resource_id: "duplicate" },
      ],
      "duplicate",
      1,
    ],
    [
      "legacy completion contract counts",
      [{ ...first, contract: "selection-pipeline-v1" }],
      "original",
      1,
    ],
    [
      "different ASIN remains independent",
      [first, { ...first, id: "b", main_asin: "B0H5QYWY1Z", resource_id: "duplicate" }],
      "duplicate",
      1,
    ],
  ];
  for (const [key, value] of [
    ["contract", "unknown"],
    ["main_asin", "short"],
    ["actor_type", "user"],
    ["resource_type", "opportunity"],
    ["event_type", "opportunity.scored"],
  ]) {
    cases.push([`invalid ${key} never counts`, [{ ...first, [key]: value }], "original", 0]);
    cases.push([
      `invalid ${key} cannot suppress valid proof`,
      [
        { ...first, [key]: value },
        { ...first, id: "b", resource_id: "duplicate" },
      ],
      "duplicate",
      1,
    ]);
  }
  return cases.map(([name, events, opportunity, expected]) => ({
    name,
    expected,
    sql:
      "SELECT COUNT(*) actual FROM (SELECT 'org' organization_id,'ws' workspace_id," +
      literal(opportunity) +
      " id) o WHERE " +
      opportunityCompletedFilterSql.replaceAll(
        "FROM opportunity_events ",
        "FROM (" + events.map(row).join(" UNION ALL ") + ") ",
      ),
  }));
}
