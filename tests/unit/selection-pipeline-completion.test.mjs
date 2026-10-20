import { primarySourceFixtureRead } from "../fixtures/primary-source-support.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { recordSelectionPipelineCompletion } from "../../apps/worker/dist/selection-pipeline-completion.js";
import {
  selectionPipelineCompletionProofSql,
  selectionCompletedCompetitorsSql,
} from "../../packages/database/dist/index.js";
import { dailySelectionCompletedSql } from "../../apps/api/dist/home-daily-selection.js";
import { MySqlOpportunityScoringWorker } from "../../apps/worker/dist/opportunity-scoring-worker.js";
import {
  automaticPrimaryEvidenceSql,
  automaticPrimaryDetailEvidenceSql,
  automaticSupplyEvidenceSql,
} from "../../apps/worker/dist/automatic-selection-evidence.js";
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
  profit_state: "calculated",
  score_coverage_percent: 100,
  score_missing_fields_json: [],
  profit_missing_fields_json: [],
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
        const source = primarySourceFixtureRead(sql, params);
        if (source) return source;
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

for (const sourceState of ["rejected", "unverified", "missing_origin"])
  test(`completion independently rejects ${sourceState} primary source support`, async () => {
    const f = fixture(),
      originalQuery = f.connection.query;
    f.connection.query = async (sql, params) => {
      if (sql.includes("SELECT payload_json FROM opportunity_events"))
        return sourceState === "unverified"
          ? [[]]
          : primarySourceFixtureRead(sql, params, { supported: false });
      if (
        sourceState === "missing_origin" &&
        sql.startsWith("SELECT o.source_type,e.id,e.payload_json FROM opportunities")
      )
        return [[]];
      return originalQuery(sql, params);
    };
    assert.equal(
      await recordSelectionPipelineCompletion(f.connection, scope, "worker", now),
      false,
    );
    assert.equal(f.events.size, 0);
    assert.equal(
      f.calls.some(({ sql }) => sql === selectionCompletedCompetitorsSql),
      false,
    );
  });

for (const [field, value] of [
  ["main_asin", "B000000001"],
  ["intelligence_record_id", "other-news"],
])
  test(`completion proof cannot borrow support from another ${field}`, async () => {
    const f = fixture({ ...proof, [field]: value });
    assert.equal(
      await recordSelectionPipelineCompletion(f.connection, scope, "worker", now),
      false,
    );
    assert.equal(f.events.size, 0);
  });

for (const compatible of [false, true]) {
  test(`completion recorder independently checks legacy automatic P75 evidence, compatible=${compatible}`, async () => {
    const p = {
      ...proof,
      purchase_source_type: "automatic_crawler_evidence",
      purchase_confirmation_mode: "automatic_evidence",
      purchase_source_ref_id: "1688:123456789:p75:3",
    };
    const f = fixture(p),
      originalQuery = f.connection.query;
    f.connection.query = async (sql, values) => {
      if (
        [
          automaticPrimaryEvidenceSql,
          automaticPrimaryDetailEvidenceSql,
          automaticSupplyEvidenceSql,
        ].includes(sql)
      ) {
        assert.deepEqual(values, ["op", "org", "ws"]);
        if (sql === automaticPrimaryEvidenceSql)
          return [
            [
              {
                payload_json: {
                  asin: proof.main_asin,
                  title: "iPhone 17 Pro Max Case",
                  price: 30,
                  currency: "USD",
                },
                observed_at: now,
              },
            ],
          ];
        if (sql === automaticPrimaryDetailEvidenceSql) return [[]];
        return [
          [1, 2, 3].map((id) => ({
            raw_evidence_id: id === 3 ? "supply-raw" : `raw-${id}`,
            created_at: now,
            payload_json: {
              external_id: id === 3 ? "123456789" : String(id),
              price: id === 3 ? 9.5 : id,
              currency: "CNY",
              title: compatible ? "苹果17ProMax手机壳" : "苹果18ProMax苹果17Pro手机壳",
            },
          })),
        ];
      }
      return originalQuery(sql, values);
    };
    assert.equal(
      await recordSelectionPipelineCompletion(f.connection, scope, "worker", now),
      compatible,
    );
    assert.equal(f.events.size, compatible ? 1 : 0);
  });
}

test("low score and reject outcome still record a fully evidenced pipeline", async () => {
  const f = fixture();
  assert.equal(await recordSelectionPipelineCompletion(f.connection, scope, "worker", now), true);
  const e = [...f.events.values()][0];
  assert.equal(e.overall_score, 0);
  assert.equal(e.contract, "selection-pipeline-v2");
  assert.equal(e.profit_status, "calculated");
  assert.equal(e.recommendation_status, "reject");
  assert.equal(e.purchase_price, 9.5);
  assert.equal(e.competitors.length, 5);
  assert.equal(e.completed_at, now.toISOString());
  assert.equal(e.intelligence_evidence_id, "news-raw");
  assert.equal(e.supply_evidence_id, "supply-raw");
});

test("analyzed unknown-profit product records actual partial score, missing reasons and explicit unknown state", async () => {
  const f = fixture({
    ...proof,
    overall_score: 68.5,
    recommendation_status: "insufficient_data",
    profit_state: "unknown",
    score_coverage_percent: 80,
    score_missing_fields_json: '["automatic_evaluation.profit.automatic_cost_scope_mismatch"]',
    profit_missing_fields_json: '["automatic_evaluation.profit.automatic_cost_scope_mismatch"]',
  });
  assert.equal(await recordSelectionPipelineCompletion(f.connection, scope, "worker", now), true);
  const e = [...f.events.values()][0];
  assert.equal(e.analysis_status, "complete_with_unknown_profit");
  assert.equal(e.profit_status, "unknown");
  assert.equal(e.overall_score, 68.5);
  assert.equal(e.score_coverage_percent, 80);
  assert.deepEqual(e.profit_missing_fields, [
    "automatic_evaluation.profit.automatic_cost_scope_mismatch",
  ]);
  assert.equal(e.purchase_price, 9.5);
});

test("actual zero-score non-recommended analysis counts with profit unknown instead of fabricated zero profit", async () => {
  const f = fixture({
    ...proof,
    overall_score: 0,
    recommendation_status: "not_recommend",
    profit_state: "unknown",
    score_coverage_percent: 80,
    score_missing_fields_json: ["profit.fees"],
    profit_missing_fields_json: ["profit.fees"],
  });
  assert.equal(await recordSelectionPipelineCompletion(f.connection, scope, "worker", now), true);
  const event = [...f.events.values()][0];
  assert.equal(event.overall_score, 0);
  assert.equal(event.profit_status, "unknown");
  assert.equal(event.recommendation_status, "not_recommend");
  assert.equal("net_profit" in event, false);
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
  ["unlabelled unknown profit", { ...proof, profit_state: "unknown" }, competitors],
  [
    "unknown profit cannot be recommended",
    {
      ...proof,
      profit_state: "unknown",
      recommendation_status: "recommend",
      score_missing_fields_json: ["missing fee"],
      profit_missing_fields_json: ["missing fee"],
    },
    competitors,
  ],
  ["malformed missing reasons", { ...proof, score_missing_fields_json: "not-json" }, competitors],
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
  assert.match(
    selectionPipelineCompletionProofSql,
    /cost_score.input_score IS NULL[\s\S]*profit_status='insufficient_data'/,
  );
  assert.match(
    selectionPipelineCompletionProofSql,
    /'market_demand','competition','risk','data_quality'/,
  );
  assert.match(
    selectionPipelineCompletionProofSql,
    /incomplete_component.dimension_code<>'profit'/,
  );
  assert.match(
    dailySelectionCompletedSql,
    /IN \('selection-pipeline-v1','selection-pipeline-v2'\)/,
  );
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

for (const [profitWeight, failCompletion] of [
  [20, false],
  [20, true],
  [30, false],
  [30, true],
])
  test(`scoring warning result and unknown-profit completion share the parent transaction, profitWeight=${profitWeight}, failure=${failCompletion}`, async () => {
    const missing = ["profit.fee_policy"],
      p = {
        ...proof,
        overall_score: 75,
        recommendation_status: "insufficient_data",
        profit_state: "unknown",
        score_coverage_percent: 80,
        score_missing_fields_json: missing,
        profit_missing_fields_json: missing,
      },
      f = fixture(p),
      sourceQuery = f.connection.query,
      dimensions = ["market_demand", "competition", "profit", "risk", "data_quality"].map(
        (code) => ({
          code,
          required: true,
          weight:
            profitWeight === 20
              ? 20
              : { market_demand: 25, competition: 20, profit: 30, risk: 15, data_quality: 10 }[
                  code
                ],
          evidence_group:
            code === "profit"
              ? "cost"
              : code === "market_demand"
                ? "market"
                : code === "competition"
                  ? "competition"
                  : "other",
        }),
      );
    let commits = 0,
      rollbacks = 0;
    const c = {
      ...f.connection,
      async beginTransaction() {},
      async commit() {
        commits++;
      },
      async rollback() {
        rollbacks++;
      },
      release() {},
      async query(sql, params) {
        const source = primarySourceFixtureRead(sql, params);
        if (source) return source;
        if (sql.startsWith("SELECT version_code,dimensions_json"))
          return [
            [
              {
                version_code: "confirmed",
                dimensions_json: dimensions,
                thresholds_json: { recommend_min: 70, observe_min: 50 },
              },
            ],
          ];
        if (sql.startsWith("SELECT id,owner_id FROM opportunities"))
          return [[{ id: "op", owner_id: null }]];
        if (sql.startsWith("SELECT * FROM opportunity_score_inputs"))
          return [
            dimensions.map((d) => ({
              id: d.code,
              input_version: 1,
              dimension_code: d.code,
              evidence_group: d.evidence_group,
              score_value: d.code === "profit" ? null : 75,
              evidence_ids_json: [d.code + "-raw"],
              missing_fields_json: d.code === "profit" ? missing : [],
            })),
          ];
        if (sql.includes("reconciliation_status") && sql.includes("FROM raw_evidence")) return [[]];
        if (
          sql === selectionPipelineCompletionProofSql ||
          sql === selectionCompletedCompetitorsSql ||
          sql.startsWith("SELECT id FROM opportunity_events")
        )
          return sourceQuery(sql, params);
        if (
          sql.startsWith("INSERT INTO opportunity_events") &&
          params[3] === "opportunity.selection_pipeline_completed"
        ) {
          if (failCompletion) throw new Error("completion-write-failed");
          return sourceQuery(sql, params);
        }
        if (sql.startsWith("SELECT")) throw new Error("Unexpected read: " + sql);
        return [{ affectedRows: 1 }];
      },
    };
    const worker = new MySqlOpportunityScoringWorker(
      { getConnection: async () => c },
      "worker",
      120,
      () => now,
    );
    const job = { ...scope, id: "job", ruleId: "rule", triggerTaskId: null, attemptCount: 1 };
    if (failCompletion) {
      await assert.rejects(worker.calculate(job), /completion-write-failed/);
      assert.equal(commits, 0);
      assert.equal(rollbacks, 1);
    } else {
      const result = await worker.calculate(job);
      assert.equal(result.complete, false);
      assert.equal(result.coverage, 80);
      assert.equal([...f.events.values()][0].score_coverage_percent, 80);
      assert.equal([...f.events.values()][0].profit_status, "unknown");
      assert.equal(commits, 1);
      assert.equal(rollbacks, 0);
    }
  });
