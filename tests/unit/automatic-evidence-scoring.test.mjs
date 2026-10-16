import assert from "node:assert/strict";
import test from "node:test";
import { calculateScoreProjection } from "../../packages/contracts/dist/index.js";
import { MySqlAutomaticSelectionEvaluationWorker } from "../../apps/worker/dist/automatic-selection-evaluation-worker.js";
import {
  automaticPrimaryEvidenceSql,
  automaticSupplyEvidenceSql,
} from "../../apps/worker/dist/automatic-selection-evidence.js";

const now = new Date("2026-10-17T00:00:00Z");
const job = {
  opportunityId: "item",
  organizationId: "org",
  workspaceId: "workspace",
  attemptCount: 1,
};
const dimensions = ["market_demand", "competition", "profit", "risk", "data_quality"].map(
  (code) => ({
    code,
    required: true,
    weight: 20,
    evidence_group:
      code === "profit"
        ? "cost"
        : code === "competition"
          ? "competition"
          : code === "market_demand"
            ? "market"
            : "other",
  }),
);

function fixture(options = {}) {
  const calls = [],
    inputs = new Map();
  const humanCosts = ["sale_price", "purchase_price"].map((input_type) => ({
    id: input_type,
    input_type,
    evidence_id: `human-${input_type}`,
    input_version: 1,
    confirmation_mode: "human_review",
    created_at: now,
  }));
  let commits = 0,
    rollbacks = 0;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {
      commits++;
    },
    rollback: async () => {
      rollbacks++;
    },
    release() {},
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT o.*")) return [[{ market: "US", score_rule_version: "v1" }]];
      if (sql.startsWith("SELECT id,version_code,dimensions_json"))
        return [options.noScoreRule ? [] : [{ id: "score-rule", dimensions_json: dimensions }]];
      if (sql.startsWith("SELECT id,version_code,fee_lines_json"))
        return [
          options.noCostRule
            ? []
            : [
                {
                  id: "phone-cost",
                  automatic_scope_json: { product_family: "phone_case" },
                  fee_lines_json: [{ type: "logistics" }],
                  conversion_rates_json: [
                    { base_currency: "CNY", quote_currency: "USD", effective_on: "2026-01-01" },
                  ],
                },
              ],
        ];
      if (sql === automaticPrimaryEvidenceSql)
        return [
          [
            {
              raw_evidence_id: "amazon-evidence",
              observed_at: now,
              provider_status: "enabled",
              payload_json: {
                asin: "B000000001",
                title: options.phone
                  ? "Magnetic case for iPhone 17 Pro Max"
                  : "Stainless steel kitchen storage rack",
                price: 25,
                currency: "USD",
                review_count: 300,
                rating_value: 4.5,
                ...options.fields,
              },
            },
          ],
        ];
      if (sql.startsWith("SELECT s.* FROM competitors"))
        return [
          options.noSnapshot
            ? []
            : [
                {
                  evidence_id: "snapshot-evidence",
                  availability: "in_stock",
                  source_status: "healthy",
                  freshness: "fresh",
                },
              ],
        ];
      if (sql === automaticSupplyEvidenceSql)
        return [
          [1, 2, 3].map((id) => ({
            raw_evidence_id: `supply-${id}`,
            created_at: now,
            payload_json: {
              external_id: String(id),
              title: "苹果 17 Pro Max 手机壳",
              price: 5,
              currency: "CNY",
            },
          })),
        ];
      if (sql.startsWith("SELECT * FROM opportunity_cost_inputs"))
        return [[humanCosts.find((row) => row.input_type === params[4])]];
      if (sql.startsWith("SELECT id,input_type,evidence_id,input_version")) return [humanCosts];
      if (sql.startsWith("SELECT * FROM opportunity_profit_runs"))
        return [
          options.pendingProfit
            ? []
            : [{ status: "calculated", net_margin_percent: 35, calculated_at: now }],
        ];
      if (sql.startsWith("SELECT id FROM opportunity_profit_jobs")) return [[]];
      if (sql.startsWith("SELECT COUNT(*) blocked"))
        return [[{ blocked: options.blocked ? 1 : 0 }]];
      if (sql.startsWith("SELECT * FROM opportunity_score_inputs"))
        return [[inputs.get(params[1])].filter(Boolean)];
      if (sql.startsWith("SELECT COALESCE(MAX(input_version)")) return [[{ next_version: 1 }]];
      if (sql.startsWith("SELECT id FROM opportunity_score_jobs")) return [[]];
      if (options.failScoreWrite && sql.startsWith("INSERT INTO opportunity_score_inputs"))
        throw new Error("score write unavailable");
      if (sql.startsWith("INSERT INTO opportunity_score_inputs"))
        inputs.set(params[4], {
          score_value: params[6],
          evidence_ids_json: params[9],
          missing_fields_json: params[10],
          source_ref_id: params[8],
        });
      if (sql.startsWith("SELECT")) throw new Error(`Unexpected read: ${sql}`);
      return [{ affectedRows: 1 }];
    },
  };
  const worker = new MySqlAutomaticSelectionEvaluationWorker(
    { getConnection: async () => connection },
    "worker",
    "actor",
    120,
    () => now,
  );
  return { worker, calls, inputs, counts: () => ({ commits, rollbacks }) };
}

for (const noCostRule of [false, true]) {
  test(`generic product publishes factual scores with ${noCostRule ? "no cost rule" : "phone-only costs"}`, async () => {
    const f = fixture({ noCostRule });
    const result = await f.worker.evaluate(job);
    const reason = noCostRule ? "automatic_rules_not_active" : "automatic_cost_scope_mismatch";
    assert.equal(result.status, "waiting_evidence");
    assert.equal(result.payload.error_code, reason);
    assert.equal(result.payload.score_inputs_changed, true);
    for (const code of ["market_demand", "competition", "risk", "data_quality"])
      assert.equal(typeof f.inputs.get(code)?.score_value, "number", code);
    assert.equal(f.inputs.get("profit").score_value, null);
    assert.deepEqual(JSON.parse(f.inputs.get("profit").missing_fields_json), [
      `automatic_evaluation.profit.${reason}`,
    ]);
    assert.deepEqual(JSON.parse(f.inputs.get("profit").evidence_ids_json), []);
    assert.deepEqual(JSON.parse(f.inputs.get("competition").evidence_ids_json), [
      "snapshot-evidence",
    ]);
    assert.equal(
      f.calls.filter(({ sql }) => sql.startsWith("INSERT INTO opportunity_score_jobs")).length,
      1,
    );
    assert.equal(
      f.calls.some(({ sql }) => /INSERT INTO opportunity_(cost_inputs|profit_jobs)/.test(sql)),
      false,
    );
    const risk = f.calls.find(({ sql }) => sql.startsWith("UPDATE opportunities SET risk_level"));
    assert.equal(risk.params[1], true, "missing profit immediately withdraws stale recommendation");
    assert.deepEqual(risk.params.slice(3), [
      job.opportunityId,
      job.organizationId,
      job.workspaceId,
    ]);
    const audit = f.calls.find(({ sql }) => sql.startsWith("INSERT INTO opportunity_events"));
    assert.equal(audit.params[3], "opportunity.automatic_quality_evaluated");
    assert.equal(JSON.parse(audit.params[8]).missing_profit_reason, reason);
    assert.deepEqual(f.counts(), { commits: 1, rollbacks: 0 });
  });
}

test("blocked evidence stays missing across all dimensions without cost writes", async () => {
  const f = fixture({ blocked: true });
  await f.worker.evaluate(job);
  for (const input of f.inputs.values()) {
    assert.equal(input.score_value, null);
    assert.deepEqual(JSON.parse(input.missing_fields_json), [
      "automatic_evaluation.quality_blocked",
    ]);
  }
  const quality = f.calls.find(({ sql }) => sql.startsWith("SELECT COUNT(*) blocked"));
  assert.deepEqual(quality.params, ["org", "workspace", "amazon-evidence", "snapshot-evidence"]);
});

test("missing review facts are not fabricated to make generic scoring complete", async () => {
  const f = fixture({ fields: { review_count: null, rating_value: null } });
  await f.worker.evaluate(job);
  assert.equal(f.inputs.get("market_demand").score_value, null);
  assert.equal(f.inputs.get("competition").score_value, null);
  assert.equal(f.inputs.get("profit").score_value, null);
  assert.ok(f.inputs.get("data_quality").score_value < 100);
});

test("unchanged waiting evidence does not create score-input or queued-score versions again", async () => {
  const f = fixture();
  await f.worker.evaluate(job);
  f.calls.length = 0;
  const second = await f.worker.evaluate(job);
  assert.equal(second.payload.score_inputs_changed, false);
  assert.equal(
    f.calls.some(({ sql }) => sql.startsWith("INSERT INTO opportunity_score")),
    false,
  );
});

for (const options of [{ noScoreRule: true }, { noSnapshot: true }]) {
  test(`partial scoring retains required ${options.noScoreRule ? "active score rule" : "primary snapshot"} gate`, async () => {
    const f = fixture(options);
    const result = await f.worker.evaluate(job);
    assert.equal(result.status, "waiting_evidence");
    assert.equal(f.inputs.size, 0);
    assert.equal(
      f.calls.some(({ sql }) => sql.startsWith("INSERT INTO opportunity_score_jobs")),
      false,
    );
  });
}

for (const pendingProfit of [false, true]) {
  test(`existing phone-cost flow ${pendingProfit ? "queues profit while publishing partial scores" : "publishes calculated profit"} and preserves human costs`, async () => {
    const f = fixture({ phone: true, pendingProfit });
    const result = await f.worker.evaluate(job);
    assert.equal(result.status, pendingProfit ? "waiting_profit" : "succeeded");
    assert.equal(
      f.calls.some(({ sql }) => sql.startsWith("INSERT INTO opportunity_cost_inputs")),
      false,
    );
    assert.equal(typeof f.inputs.get("market_demand").score_value, "number");
    assert.equal(f.inputs.get("profit").score_value, pendingProfit ? null : 83.33);
    assert.deepEqual(
      JSON.parse(f.inputs.get("profit").evidence_ids_json),
      pendingProfit ? [] : ["human-sale_price", "human-purchase_price"],
    );
    assert.equal(
      f.calls.filter(({ sql }) => sql.startsWith("INSERT INTO opportunity_profit_jobs")).length,
      pendingProfit ? 1 : 0,
    );
    assert.equal(
      f.calls.find(({ sql }) => sql.startsWith("UPDATE opportunities SET risk_level")).params[1],
      pendingProfit,
    );
    assert.deepEqual(f.counts(), { commits: 1, rollbacks: 0 });
  });
}

test("a previous automatic profit score is replaced with explicit missing evidence on scope mismatch", async () => {
  const f = fixture();
  f.inputs.set("profit", {
    score_value: 95,
    evidence_ids_json: '["old-cost"]',
    missing_fields_json: "[]",
    source_ref_id: "old",
  });
  await f.worker.evaluate(job);
  assert.equal(f.inputs.get("profit").score_value, null);
  assert.deepEqual(JSON.parse(f.inputs.get("profit").evidence_ids_json), []);
});

test("partial score write failure rolls back and cannot commit the waiting state", async () => {
  const f = fixture({ failScoreWrite: true });
  await assert.rejects(f.worker.evaluate(job), /score write unavailable/);
  assert.deepEqual(f.counts(), { commits: 0, rollbacks: 1 });
  assert.equal(
    f.calls.some(({ sql }) => sql.startsWith("INSERT INTO opportunity_score_jobs")),
    false,
  );
});

test("production score projection displays partial coverage without recommending missing-cost products", async () => {
  const f = fixture();
  await f.worker.evaluate(job);
  const inputs = dimensions.map((dimension) => {
    const input = f.inputs.get(dimension.code);
    return {
      dimension_code: dimension.code,
      evidence_group: dimension.evidence_group,
      score_value: input.score_value,
      evidence_ids: JSON.parse(input.evidence_ids_json),
      missing_fields: JSON.parse(input.missing_fields_json),
    };
  });
  const projection = calculateScoreProjection(
    dimensions,
    { recommend_min: 70, observe_min: 50 },
    inputs,
  );
  assert.equal(projection.coverage_percent, 80);
  assert.equal(projection.complete_core_evidence, false);
  assert.notEqual(projection.recommendation_status, "recommend");
  assert.ok(
    projection.missing_fields.includes("automatic_evaluation.profit.automatic_cost_scope_mismatch"),
  );
});
