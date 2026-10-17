import assert from "node:assert/strict";
import test from "node:test";
import { recordSelectionPipelineCompletion } from "../../apps/worker/dist/selection-pipeline-completion.js";
import {
  selectionPipelineCompletionProofSql,
  selectionCompletedCompetitorsSql,
} from "../../packages/database/dist/index.js";
import { dailySelectionCompletedSql } from "../../apps/api/dist/home-daily-selection.js";
const scope = {
  opportunityId: "op",
  organizationId: "org",
  workspaceId: "ws",
  requestId: "req",
  traceId: "trace",
};
const now = new Date("2026-10-17T00:00:00Z");
const proof = {
  main_asin: "B0COUNT000",
  score_run_id: "score",
  overall_score: 0,
  recommendation_status: "reject",
  intelligence_record_id: "news",
  intelligence_evidence_id: "news-raw",
  purchase_input_id: "cost",
  purchase_price: "9.500000",
  purchase_currency: "CNY",
  supply_record_id: "supply",
  supply_evidence_id: "supply-raw",
  supply_offer_id: "123456789",
};
// Ten-character ASINs, distinct from the primary.
const competitors = Array.from({ length: 10 }, (_, i) => ({
  asin: `B0COUNT${String(i + 1).padStart(3, "0")}`,
  competitor_id: `c${i}`,
  snapshot_id: `s${i}`,
  evidence_id: `e${i}`,
}));
function fixture(p = proof, rows = competitors.slice(0, 5)) {
  const calls = [],
    events = new Map();
  return {
    calls,
    events,
    connection: {
      query: async (sql, params) => {
        calls.push({ sql, params });
        if (
          sql === selectionPipelineCompletionProofSql ||
          sql === selectionCompletedCompetitorsSql
        ) {
          assert.deepEqual(params, ["op", "org", "ws"]);
          return [sql === selectionPipelineCompletionProofSql ? (p ? [p] : []) : rows];
        }
        if (sql.startsWith("SELECT id FROM opportunity_events")) {
          assert.match(sql, /FOR UPDATE$/);
          assert.deepEqual(params, [
            "org",
            "ws",
            "selection_pipeline",
            "op",
            "opportunity.selection_pipeline_completed",
            p.main_asin,
          ]);
          return [events.has(`org:ws:op:${p.main_asin}`) ? [{ id: "first" }] : []];
        }
        assert.match(sql, /INSERT INTO opportunity_events[\s\S]*VALUES/);
        const body = JSON.parse(params[9]),
          key = `${params[1]}:${params[2]}:${params[5]}:${body.main_asin}`;
        assert.equal(
          events.has(key),
          false,
          "duplicate insert must be stopped by scoped current read",
        );
        events.set(key, body);
        return [{ affectedRows: 1 }];
      },
    },
  };
}

test("low score and reject outcome still record a fully evidenced pipeline", async () => {
  const f = fixture();
  assert.equal(await recordSelectionPipelineCompletion(f.connection, scope, "worker", now), true);
  const e = [...f.events.values()][0];
  assert.equal(e.overall_score, 0);
  assert.equal(e.recommendation_status, "reject");
  assert.equal(e.purchase_price, 9.5);
  assert.equal(e.competitors.length, 5);
  assert.equal(e.completed_at, now.toISOString());
  assert.equal(e.intelligence_evidence_id, "news-raw");
  assert.equal(e.supply_evidence_id, "supply-raw");
});

test("refresh or retry never overwrites the first completion time", async () => {
  const f = fixture();
  assert.equal(await recordSelectionPipelineCompletion(f.connection, scope, "worker", now), true);
  assert.equal(
    await recordSelectionPipelineCompletion(
      f.connection,
      scope,
      "worker",
      new Date("2026-10-18T00:00:00Z"),
    ),
    false,
  );
  assert.equal(f.events.size, 1);
  assert.equal([...f.events.values()][0].completed_at, now.toISOString());
});

for (const [name, p, rows] of [
  ["missing pipeline proof", null, competitors],
  ["missing numeric score", { ...proof, overall_score: null }, competitors],
  ["missing news proof", { ...proof, intelligence_evidence_id: "" }, competitors],
  ["invalid purchase price", { ...proof, purchase_price: "invalid" }, competitors],
  ["four competitors", proof, competitors.slice(0, 4)],
  ["duplicates cannot fill five slots", proof, Array(5).fill(competitors[0])],
  [
    "primary cannot count as a competitor",
    proof,
    [{ ...competitors[0], asin: proof.main_asin }, ...competitors.slice(1, 5)],
  ],
  [
    "missing detailed snapshot",
    proof,
    competitors.slice(0, 5).map((x) => ({ ...x, snapshot_id: null })),
  ],
])
  test(`incomplete evidence never creates completion: ${name}`, async () => {
    const f = fixture(p, rows);
    assert.equal(
      await recordSelectionPipelineCompletion(f.connection, scope, "worker", now),
      false,
    );
    assert.equal(f.events.size, 0);
  });

test("comparison evidence is bounded to ten independent products", async () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({
    ...competitors[0],
    asin: `B0EXTRA${String(i).padStart(3, "0")}`,
  }));
  const f = fixture(proof, rows);
  assert.equal(await recordSelectionPipelineCompletion(f.connection, scope, "worker", now), true);
  assert.equal([...f.events.values()][0].competitors.length, 10);
});

test("completion counts first event per scoped ASIN, not a recommendation threshold or discovery date", () => {
  assert.match(dailySelectionCompletedSql, /MIN\(occurred_at\)/);
  assert.match(dailySelectionCompletedSql, /GROUP BY UPPER/);
  assert.match(dailySelectionCompletedSql, /organization_id=\? AND workspace_id=\?/);
  assert.match(dailySelectionCompletedSql, /completed_at>=\? AND completed.completed_at<\?/);
  assert.doesNotMatch(
    dailySelectionCompletedSql,
    /recommendation_status|quality_passed|created_at|lifecycle_status/,
  );
  assert.match(selectionPipelineCompletionProofSql, /intelligence_source_record_id/);
  assert.match(selectionPipelineCompletionProofSql, /ss.input_ref=o.id/);
  assert.match(selectionPipelineCompletionProofSql, /cost_score.evidence_ids_json/);
  assert.doesNotMatch(
    selectionPipelineCompletionProofSql,
    /recommendation_status='recommend'|risk_level='low'/,
  );
});

test("completion write failure propagates to the parent transaction without committing", async () => {
  const f = fixture(),
    query = f.connection.query;
  f.connection.query = async (sql, params) => {
    if (sql.startsWith("INSERT INTO opportunity_events"))
      throw new Error("completion-write-failed");
    return query(sql, params);
  };
  await assert.rejects(
    recordSelectionPipelineCompletion(f.connection, scope, "worker", now),
    /completion-write-failed/,
  );
  assert.equal(f.events.size, 0);
  assert.equal(
    f.calls.some(({ sql }) => /COMMIT|ROLLBACK/.test(sql)),
    false,
  );
});
