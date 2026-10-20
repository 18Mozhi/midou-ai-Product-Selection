import { dailySelectionCompletedSql } from "../../apps/api/dist/home-daily-selection.js";
import {
  opportunityAnalysisCompletedAtSql,
  opportunityCompletedFilterSql,
} from "../../apps/api/dist/opportunity-completed-filter.js";
import { selectionCompletionSourceNotRejectedSql } from "../../packages/database/dist/index.js";

/** SELECT-only synthetic rows; no production tables, writes, persisted fixtures or counted products. */
export function completionSourceRevocationCases() {
  const receipt = {
    id: "receipt",
    organization_id: "org",
    workspace_id: "ws",
    resource_id: "op",
    resource_type: "selection_pipeline",
    actor_type: "worker",
    event_type: "opportunity.selection_pipeline_completed",
    occurred_at: "2026-10-20 00:00:00.000",
    payload: {
      contract: "selection-pipeline-v2",
      main_asin: "B0GYL94HGW",
      intelligence_record_id: "news",
    },
  };
  const rejection = {
    ...receipt,
    id: "source-audit",
    resource_type: "opportunity",
    event_type: "opportunity.primary_source_support_checked",
    occurred_at: "2026-10-20 01:00:00.000",
    payload: {
      revision: "persisted-primary-source-support-v1",
      fingerprint: "a".repeat(64),
      origin_event_id: "origin",
      primary_asin: receipt.payload.main_asin,
      intelligence_record_id: "news",
      supported: false,
      rationale: "The test-only news does not support this test-only product.",
    },
  };
  const origin = {
    ...receipt,
    id: "origin",
    resource_type: "trend_topic",
    resource_id: "topic",
    event_type: "trend.intelligence.primary_selected",
    occurred_at: "2026-10-19 23:00:00.000",
    payload: { opportunity_id: "op", intelligence_source_record_id: "news" },
  };
  const cases = [
    [
      "a new selection after the old receipt cannot revoke the older selection",
      [receipt, rejection],
      receipt.occurred_at,
      [{ ...origin, occurred_at: "2026-10-20 00:30:00.000" }],
    ],
    ["no rejection preserves historical completion", [receipt], receipt.occurred_at],
    ["definite later rejection invalidates the old receipt", [receipt, rejection], null],
    [
      "support after rejection does not retroactively repair the old receipt",
      [
        receipt,
        rejection,
        {
          ...rejection,
          id: "approved",
          occurred_at: "2026-10-20 02:00:00.000",
          payload: { ...rejection.payload, supported: true },
        },
      ],
      null,
    ],
    [
      "a genuinely new completion after correction is the first valid receipt",
      [
        receipt,
        rejection,
        {
          ...receipt,
          id: "new-receipt",
          occurred_at: "2026-10-20 03:00:00.000",
        },
      ],
      "2026-10-20 03:00:00.000",
    ],
  ];
  for (const [key, value] of [
    ["organization_id", "other"],
    ["workspace_id", "other"],
    ["resource_id", "other"],
    ["resource_type", "selection_pipeline"],
    ["actor_type", "user"],
    ["event_type", "opportunity.scored"],
    ["occurred_at", "2026-10-19 23:00:00.000"],
  ])
    cases.push([
      `different or earlier ${key} cannot revoke`,
      [receipt, { ...rejection, [key]: value }],
      receipt.occurred_at,
    ]);
  for (const [key, value] of [
    ["revision", "unknown"],
    ["primary_asin", "B000000001"],
    ["intelligence_record_id", "other"],
    ["supported", true],
    ["supported", "false"],
    ["supported", null],
    ["fingerprint", "short"],
    ["origin_event_id", ""],
    ["rationale", "original_intelligence_or_primary_missing"],
    ["rationale", null],
  ])
    cases.push([
      `unrelated or incomplete ${key}=${value} cannot revoke`,
      [receipt, { ...rejection, payload: { ...rejection.payload, [key]: value } }],
      receipt.occurred_at,
    ]);
  cases.push([
    "lowercase ASIN still binds the rejection",
    [
      receipt,
      {
        ...rejection,
        payload: { ...rejection.payload, primary_asin: receipt.payload.main_asin.toLowerCase() },
      },
    ],
    null,
  ]);
  const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
  const row = ({ payload, ...columns }) =>
    "SELECT " +
    Object.entries({ ...columns, payload_json: JSON.stringify(payload) })
      .map(
        ([key, value]) =>
          (key.endsWith("_id") || key === "id"
            ? `CONVERT(${literal(value)} USING ascii)`
            : literal(value)) +
          " " +
          key,
      )
      .join(",");
  const out = [];
  for (const [name, events, firstTime, origins = [origin]] of cases) {
    const virtual = "FROM (" + events.map(row).join(" UNION ALL ") + ") ";
    const replace = (sql) =>
      sql
        .replaceAll("FROM opportunity_events ", virtual)
        .replaceAll("FROM trend_events ", "FROM (" + origins.map(row).join(" UNION ALL ") + ") ");
    out.push({
      name: name + " / daily",
      sql: replace(dailySelectionCompletedSql),
      params: ["org", "ws", "2026-10-20 00:00:00.000", "2026-10-21 00:00:00.000"],
      field: "completed_count",
      expected: firstTime ? 1 : 0,
    });
    out.push({
      name: name + " / detail",
      sql: replace(opportunityAnalysisCompletedAtSql),
      params: ["org", "ws", "op", receipt.payload.main_asin],
      field: "occurred_at",
      expected: firstTime,
    });
    const parent =
      " FROM (SELECT CONVERT('org' USING ascii) organization_id,CONVERT('ws' USING ascii) workspace_id,CONVERT('op' USING ascii) id) o WHERE ";
    out.push({
      name: name + " / catalogue",
      sql: "SELECT COUNT(*) actual" + parent + replace(opportunityCompletedFilterSql),
      params: [],
      field: "actual",
      expected: firstTime ? 1 : 0,
    });
    out.push({
      name: name + " / writer-prior",
      sql: replace(
        "SELECT MIN(c.occurred_at) first_time FROM opportunity_events c " +
          "WHERE c.resource_type='selection_pipeline' AND " +
          selectionCompletionSourceNotRejectedSql("c"),
      ),
      params: [],
      field: "first_time",
      expected: firstTime,
    });
  }
  return out;
}
