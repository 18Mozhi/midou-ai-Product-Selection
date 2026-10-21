import { primarySourceFixtureRead } from "../fixtures/primary-source-support.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { MySqlProfitRepository } from "../../apps/api/dist/mysql-profit-repository.js";
import { calculateScoreProjection } from "../../packages/contracts/dist/index.js";
import { MySqlAutomaticSelectionEvaluationWorker } from "../../apps/worker/dist/automatic-selection-evaluation-worker.js";
import {
  automaticPrimaryEvidenceSql,
  automaticPrimarySnapshotSql,
  automaticPrimaryDetailEvidenceSql,
  automaticSupplyEvidenceSql,
} from "../../apps/worker/dist/automatic-selection-evidence.js";
import {
  selectionPipelineCompletionProofSql,
  selectionCompletedCompetitorsSql,
} from "../../packages/database/dist/index.js";

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
  const humanCosts = (options.noHumanCosts ? [] : ["sale_price", "purchase_price"]).map(
    (input_type) => ({
      id: input_type,
      input_type,
      evidence_id: `human-${input_type}`,
      input_version: 1,
      confirmation_mode: "human_review",
      created_at: now,
    }),
  );
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
      if (![automaticPrimaryEvidenceSql, automaticPrimaryDetailEvidenceSql].includes(sql)) {
        const source = primarySourceFixtureRead(sql, params, { asin: "B000000001" });
        if (source) return source;
      }
      if (sql === selectionPipelineCompletionProofSql)
        return [options.completionProof ? [options.completionProof] : []];
      if (sql.includes("s_sample.id snapshot_id,s_sample.review_count,s_sample.evidence_id FROM"))
        return [
          Array.from({ length: options.competitorCount ?? 5 }, (_, i) => ({
            asin: `B0COUNT${String(i + 1).padStart(3, "0")}`,
            review_count: 99,
            evidence_id: `detail-${i}`,
          })),
        ];
      if (sql === selectionCompletedCompetitorsSql)
        return [
          Array.from({ length: 5 }, (_, index) => ({
            asin: `B0COUNT${String(index + 1).padStart(3, "0")}`,
            competitor_id: `competitor-${index}`,
            snapshot_id: `snapshot-${index}`,
            evidence_id: `detail-${index}`,
          })),
        ];
      if (sql.startsWith("SELECT id FROM opportunity_events")) return [[]];
      if (
        options.failSupplyAudit &&
        sql.startsWith("INSERT INTO opportunity_events") &&
        params[3] === "opportunity.supply_title_classified"
      )
        throw new Error("supply audit unavailable");
      if (sql.startsWith("SELECT o.*")) return [[{ market: "US", score_rule_version: "v1" }]];
      if (sql.startsWith("SELECT opportunity_id FROM automatic_selection_evaluations"))
        return [[{ opportunity_id: "item" }]];
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
                  fee_lines_json: options.noFeePolicy ? [] : [{ type: "logistics" }],
                  conversion_rates_json: [
                    { base_currency: "CNY", quote_currency: "USD", effective_on: "2026-01-01" },
                  ],
                },
              ],
        ];
      if (sql === automaticPrimaryDetailEvidenceSql)
        return [options.detail ? [options.detail] : []];
      if (sql === automaticPrimaryEvidenceSql)
        return [
          options.noLinked
            ? []
            : [
                {
                  raw_evidence_id: "amazon-evidence",
                  observed_at: options.linkedAt ?? now,
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
                  availability: options.availability ?? "in_stock",
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
              title: options.supplyTitle ?? "苹果 17 Pro Max 手机壳",
              price: options.supplyPrice === undefined ? 5 : options.supplyPrice,
              price_description: options.priceDescription ?? null,
              currency: "CNY",
            },
          })),
        ];
      if (options.failPriceWrite && sql.startsWith("INSERT INTO opportunity_cost_inputs"))
        throw new Error("price write unavailable");
      if (sql.startsWith("INSERT INTO opportunity_cost_inputs")) {
        humanCosts.push({
          id: params[0],
          input_type: params[5],
          amount_value: params[6],
          currency: params[7],
          evidence_id: params[10],
          source_ref_id: params[9],
          input_version: params[12],
          confirmation_mode: "automatic_evidence",
          created_at: params[16],
        });
      }
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
    { getConnection: async () => connection, query: (...args) => connection.query(...args) },
    "worker",
    "actor",
    120,
    () => now,
    options.supplyClassifier,
  );
  return { worker, calls, inputs, prices: humanCosts, counts: () => ({ commits, rollbacks }) };
}

const bilingualOptions = {
  noHumanCosts: true,
  fields: { title: "Waterproof nylon makeup case with zipper" },
  supplyTitle: "防水尼龙化妆包拉链收纳",
  supplyClassifier: {
    async classifySupplies(input) {
      return input.candidates.map((candidate) => ({
        source_ref: candidate.source_ref,
        relation: "compatible",
        rationale: "Type and explicit material/function agree; SKU unverified.",
        attributes: [
          { kind: "product_type", product_excerpt: "makeup case", supply_excerpt: "化妆包" },
          { kind: "material", product_excerpt: "nylon", supply_excerpt: "尼龙" },
          { kind: "function", product_excerpt: "Waterproof", supply_excerpt: "防水" },
        ],
      }));
    },
  },
};

for (const [name, fields] of [
  ...[
    undefined,
    null,
    "",
    " ",
    0,
    -1,
    "0",
    "-1",
    Number.NaN,
    Number.POSITIVE_INFINITY,
    "invalid",
  ].map((price, index) => [`invalid price ${index}`, { price }]),
  ...[undefined, null, "", " ", 1].map((currency, index) => [
    `missing currency ${index}`,
    { currency },
  ]),
  ["blank title", { title: " " }],
]) {
  test(`sale preflight avoids supply reads and model work for ${name} while preserving the original waiting result`, async () => {
    let modelCalls = 0;
    const f = fixture({
      ...bilingualOptions,
      fields: { ...bilingualOptions.fields, ...fields },
      supplyClassifier: {
        classifySupplies: async () => {
          modelCalls++;
          throw new Error("unexpected model call");
        },
      },
    });
    const classification = await f.worker.classifySupplyTitles(job);
    assert.equal(classification, undefined);
    assert.equal(modelCalls, 0);
    assert.equal(
      f.calls.some((call) => call.sql === automaticSupplyEvidenceSql),
      false,
    );
    const result = await f.worker.evaluate(job, classification);
    assert.equal(result.status, "waiting_evidence");
    assert.equal(result.payload.error_code, "amazon_sale_facts_incomplete");
    assert.equal(
      f.calls.some(
        (call) =>
          call.sql.startsWith("INSERT INTO opportunity_cost_inputs") ||
          call.sql.startsWith("INSERT INTO opportunity_score_inputs"),
      ),
      false,
    );
  });
}

test("sale preflight uses the resolved atomic primary detail and does not block valid source prices", async () => {
  let modelCalls = 0;
  const f = fixture({
    ...bilingualOptions,
    fields: { ...bilingualOptions.fields, price: null, currency: null },
    detail: {
      raw_evidence_id: "new-primary",
      observed_at: new Date(now.getTime() + 1000),
      payload_json: {
        asin: "B000000001",
        title: bilingualOptions.fields.title,
        price: 25,
        currency: "USD",
      },
    },
    supplyClassifier: {
      classifySupplies: async (input) => {
        modelCalls++;
        return bilingualOptions.supplyClassifier.classifySupplies(input);
      },
    },
  });
  const classification = await f.worker.classifySupplyTitles(job);
  assert.equal(modelCalls, 1);
  assert.equal(classification.input.product_ref, "amazon:new-primary");
  assert.equal(classification.classifications.length, 3);
});

test("classified source writes its exact original quote and evidence audit without phone fees or profit", async () => {
  const f = fixture(bilingualOptions);
  const classification = await f.worker.classifySupplyTitles(job);
  const result = await f.worker.evaluate(job, classification);
  assert.equal(result.status, "waiting_evidence");
  const purchase = f.prices.find((item) => item.input_type === "purchase_price");
  assert.equal(purchase.amount_value, 5);
  assert.equal(purchase.evidence_id, "supply-1");
  assert.equal(purchase.source_ref_id, "1688:1:classified-title:v1");
  const audit = f.calls.find(
    (call) =>
      call.sql.startsWith("INSERT INTO opportunity_events") &&
      call.params[3] === "opportunity.supply_title_classified",
  );
  const payload = JSON.parse(audit.params[8]);
  assert.equal(payload.purchase_evidence_id, "supply-1");
  assert.equal(payload.similarity_percent, null);
  assert.deepEqual(
    payload.classifications[0].attributes,
    classification.classifications[0].attributes,
  );
  assert.equal(
    f.calls.some((call) => call.sql.startsWith("INSERT INTO opportunity_profit_jobs")),
    false,
  );
  assert.deepEqual(f.counts(), { commits: 1, rollbacks: 0 });
});

test("classified source cannot replace manually reviewed purchase prices", async () => {
  const f = fixture({ ...bilingualOptions, noHumanCosts: false });
  await f.worker.evaluate(job, await f.worker.classifySupplyTitles(job));
  assert.equal(f.prices.length, 2);
  assert.equal(
    f.calls.some((call) => call.sql.startsWith("INSERT INTO opportunity_cost_inputs")),
    false,
  );
  assert.equal(
    f.calls.some((call) => call.params?.[3] === "opportunity.supply_title_classified"),
    false,
  );
});

test("stale classified main evidence cannot write purchase price", async () => {
  const f = fixture(bilingualOptions);
  const context = await f.worker.classifySupplyTitles(job);
  context.input.product_ref = "amazon:old-main-evidence";
  await f.worker.evaluate(job, context);
  assert.equal(
    f.prices.some((item) => item.input_type === "purchase_price"),
    false,
  );
});

test("classified quote and its source audit share one rollback boundary", async () => {
  const f = fixture({ ...bilingualOptions, failSupplyAudit: true });
  const classification = await f.worker.classifySupplyTitles(job);
  await assert.rejects(f.worker.evaluate(job, classification), /supply audit unavailable/);
  assert.deepEqual(f.counts(), { commits: 0, rollbacks: 1 });
  assert.equal(
    f.calls.some((call) => call.sql.startsWith("UPDATE automatic_selection_evaluations")),
    false,
  );
});

test("model timeout preserves factual sale and non-profit scoring without inventing a purchase quote", async () => {
  const f = fixture({
    ...bilingualOptions,
    supplyClassifier: {
      async classifySupplies() {
        throw Object.assign(new Error("timeout"), { code: "intelligence_model_timeout" });
      },
    },
  });
  f.worker.enqueueEligibleCandidates = async () => {};
  f.worker.claim = async () => job;
  const result = await f.worker.processOnce();
  assert.equal(result.status, "waiting_evidence");
  assert.equal(result.supply_title_classification_error, "intelligence_model_timeout");
  assert.equal(f.prices.find((item) => item.input_type === "sale_price").amount_value, 25);
  assert.equal(
    f.prices.some((item) => item.input_type === "purchase_price"),
    false,
  );
  assert.ok(f.inputs.has("market_demand"));
  assert.equal(f.inputs.get("profit").score_value, null);
  assert.deepEqual(f.counts(), { commits: 1, rollbacks: 0 });
});

test("an unchanged unknown-profit analysis can finish when the final competitor evidence becomes available", async () => {
  const options = { noHumanCosts: true, supplyTitle: "Stainless steel kitchen storage rack" };
  const f = fixture(options);
  await f.worker.evaluate(job);
  const projection = calculateScoreProjection(
    dimensions,
    { recommend_min: 70, observe_min: 50 },
    dimensions.map((dimension) => ({
      dimension_code: dimension.code,
      evidence_group: dimension.evidence_group,
      score_value: f.inputs.get(dimension.code).score_value,
      evidence_ids: JSON.parse(f.inputs.get(dimension.code).evidence_ids_json),
      missing_fields: JSON.parse(f.inputs.get(dimension.code).missing_fields_json),
    })),
  );
  assert.equal(projection.complete_core_evidence, false);
  assert.notEqual(projection.recommendation_status, "recommend");
  const purchase = f.prices.find((item) => item.input_type === "purchase_price");
  options.completionProof = {
    main_asin: "B000000001",
    score_run_id: "partial-score",
    overall_score: projection.overall_score,
    recommendation_status: projection.recommendation_status,
    profit_state: "unknown",
    score_coverage_percent: projection.coverage_percent,
    score_missing_fields_json: projection.missing_fields,
    profit_missing_fields_json: JSON.parse(f.inputs.get("profit").missing_fields_json),
    intelligence_record_id: "news",
    intelligence_evidence_id: "news-raw",
    purchase_input_id: purchase.id,
    purchase_price: purchase.amount_value,
    purchase_currency: purchase.currency,
    supply_record_id: "supply-record",
    supply_evidence_id: purchase.evidence_id,
    supply_offer_id: "1",
  };
  await f.worker.evaluate(job);
  const completion = f.calls.find(
    (call) =>
      call.sql.startsWith("INSERT INTO opportunity_events") &&
      call.params[3] === "opportunity.selection_pipeline_completed",
  );
  assert.ok(completion);
  assert.equal(JSON.parse(completion.params[9]).profit_status, "unknown");
  assert.equal(JSON.parse(completion.params[9]).overall_score, projection.overall_score);
});

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
      ...Array.from({ length: 5 }, (_, i) => `detail-${i}`),
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
    assert.equal(
      risk.params[2],
      true,
      "missing profit invalidates the current calculated-profit status",
    );
    assert.deepEqual(risk.params.slice(4), [
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
  assert.deepEqual(quality.params, [
    "org",
    "workspace",
    "amazon-evidence",
    ...Array.from({ length: 5 }, (_, i) => `detail-${i}`),
    "snapshot-evidence",
  ]);
});

test("missing review facts are not fabricated to make generic scoring complete", async () => {
  const f = fixture({ fields: { review_count: null, rating_value: null } });
  await f.worker.evaluate(job);
  assert.equal(f.inputs.get("market_demand").score_value, null);
  assert.equal(f.inputs.get("competition").score_value, 60);
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

for (const noCostRule of [false, true]) {
  test(`generic matched procurement price persists with ${noCostRule ? "no fee rule" : "phone-only fee rule"} while profit stays unknown`, async () => {
    const f = fixture({
      noCostRule,
      noHumanCosts: true,
      supplyTitle: "Stainless steel kitchen storage rack",
    });
    const result = await f.worker.evaluate(job);
    assert.equal(result.status, "waiting_evidence");
    assert.equal(
      result.payload.error_code,
      noCostRule ? "automatic_rules_not_active" : "automatic_cost_scope_mismatch",
    );
    assert.deepEqual(
      f.prices.map((item) => [item.input_type, item.amount_value, item.currency]),
      [
        ["sale_price", 25, "USD"],
        ["purchase_price", 5, "CNY"],
      ],
    );
    const purchase = f.prices.find((item) => item.input_type === "purchase_price");
    assert.equal(purchase.confirmation_mode, "automatic_evidence");
    assert.match(purchase.source_ref_id, /^1688:[123]:p75:3$/);
    assert.match(purchase.evidence_id, /^supply-[123]$/);
    for (const write of f.calls.filter((call) =>
      call.sql.startsWith("INSERT INTO opportunity_cost_inputs"),
    )) {
      assert.deepEqual(write.params.slice(1, 5), [
        job.organizationId,
        job.workspaceId,
        job.opportunityId,
        "amazon",
      ]);
    }
    assert.equal(f.inputs.get("profit").score_value, null);
    assert.equal(
      f.calls.some((call) => call.sql.includes("INSERT INTO opportunity_profit_jobs")),
      false,
    );
    assert.deepEqual(f.counts(), { commits: 1, rollbacks: 0 });
    f.calls.length = 0;
    await f.worker.evaluate(job);
    assert.equal(
      f.calls.some((call) => call.sql.startsWith("INSERT INTO opportunity_cost_inputs")),
      false,
      "same source price is idempotent",
    );
  });
}

for (const priceOptions of [
  { supplyTitle: "unrelated phone case" },
  { supplyPrice: null },
  { priceDescription: "新人价" },
]) {
  test(`generic missing or conditional offer never becomes purchase cost: ${JSON.stringify(priceOptions)}`, async () => {
    const f = fixture({
      noCostRule: true,
      noHumanCosts: true,
      supplyTitle: "Stainless steel kitchen storage rack",
      ...priceOptions,
    });
    await f.worker.evaluate(job);
    assert.deepEqual(
      f.prices.map((item) => item.input_type),
      ["sale_price"],
    );
    assert.equal(f.inputs.get("profit").score_value, null);
  });
}

test("phone product records source prices without fee policy but never queues estimated profit", async () => {
  const f = fixture({ phone: true, noFeePolicy: true, noHumanCosts: true });
  const result = await f.worker.evaluate(job);
  assert.equal(result.payload.error_code, "automatic_cost_policy_incomplete");
  assert.equal(f.prices.length, 2);
  assert.equal(
    f.calls.some((call) => call.sql.startsWith("INSERT INTO opportunity_profit_jobs")),
    false,
  );
  assert.equal(f.inputs.get("profit").score_value, null);
});

test("price write failure rolls back before completing a waiting evaluation", async () => {
  const f = fixture({ noHumanCosts: true, noCostRule: true, failPriceWrite: true });
  await assert.rejects(f.worker.evaluate(job), /price write unavailable/);
  assert.deepEqual(f.counts(), { commits: 0, rollbacks: 1 });
  assert.equal(
    f.calls.some((call) => call.sql.startsWith("UPDATE automatic_selection_evaluations")),
    false,
  );
});

test("profit API returns sourced prices even without a profit run or fee rule", async () => {
  const f = fixture({
    noHumanCosts: true,
    noCostRule: true,
    supplyTitle: "Stainless steel kitchen storage rack",
  });
  await f.worker.evaluate(job);
  const reads = [];
  const repo = new MySqlProfitRepository({
    query: async (sql, params) => {
      reads.push({ sql, params });
      if (sql.startsWith("SELECT id FROM opportunities")) return [[{ id: job.opportunityId }]];
      if (sql.includes("FROM opportunity_cost_inputs WHERE"))
        return [
          f.prices.map((item) => ({
            ...item,
            platform: "amazon",
            source_type: "automatic_crawler_evidence",
            observed_at: now,
          })),
        ];
      if (
        sql.includes("FROM opportunity_profit_runs") ||
        sql.includes("FROM opportunity_cost_input_reviews")
      )
        return [[]];
      throw new Error("unexpected analysis read");
    },
  });
  const result = await repo.getAnalysis({ ...job, actorId: "actor" });
  assert.equal(result.latest_run, null);
  assert.deepEqual(
    result.current_inputs.map((item) => [item.input_type, item.amount_value, item.currency]),
    [
      ["sale_price", 25, "USD"],
      ["purchase_price", 5, "CNY"],
    ],
  );
  assert.equal(
    result.current_inputs.every(
      (item) => item.evidence_id && item.observed_at === now.toISOString(),
    ),
    true,
  );
  assert.equal(
    reads.some((item) => item.sql.includes("FROM cost_rules")),
    false,
  );
  for (const read of reads)
    assert.deepEqual(read.params, [job.opportunityId, job.organizationId, job.workspaceId]);
});

const detailEvidence = (observedAt = now, fields = {}) => ({
  raw_evidence_id: "detail-evidence",
  observed_at: observedAt,
  provider_status: "enabled",
  payload_json: {
    asin: "B000000001",
    canonical_url: "https://www.amazon.com/dp/B000000001",
    title: "Stainless steel kitchen storage rack",
    price: 29,
    currency: "USD",
    review_count: 1200,
    rating_value: 4.8,
    ...fields,
  },
});

for (const [label, linkedAt, noLinked, expectedEvidence, expectedPrice] of [
  ["newer detail", new Date(now.getTime() - 60000), false, "detail-evidence", 29],
  ["same-time detail", now, false, "detail-evidence", 29],
  ["detail without trend link", now, true, "detail-evidence", 29],
  ["newer valid search", new Date(now.getTime() + 60000), false, "amazon-evidence", 25],
]) {
  test(`automatic scoring and sale input use ${label} with original provenance`, async () => {
    const f = fixture({
      noHumanCosts: true,
      noCostRule: true,
      linkedAt,
      noLinked,
      detail: detailEvidence(),
    });
    const result = await f.worker.evaluate(job);
    assert.equal(result.status, "waiting_evidence");
    assert.equal(result.payload.error_code, "automatic_rules_not_active");
    const sale = f.prices.find((p) => p.input_type === "sale_price");
    assert.equal(sale.amount_value, expectedPrice);
    assert.equal(sale.evidence_id, expectedEvidence);
    assert.deepEqual(JSON.parse(f.inputs.get("market_demand").evidence_ids_json), [
      expectedEvidence,
    ]);
    const qualityRead = f.calls.find(({ sql }) => sql.startsWith("SELECT COUNT(*) blocked"));
    assert.ok(qualityRead.params.includes(expectedEvidence));
    assert.equal(f.inputs.get("profit").score_value, null);
    f.calls.length = 0;
    await f.worker.evaluate(job);
    assert.equal(
      f.calls.some(({ sql }) => sql.startsWith("INSERT INTO opportunity_cost_inputs")),
      false,
    );
    assert.equal(
      f.calls.some(({ sql }) => sql.startsWith("INSERT INTO opportunity_score_inputs")),
      false,
    );
  });
}

test("newer incomplete detail does not borrow the old search price to make scoring pass", async () => {
  const f = fixture({
    noHumanCosts: true,
    linkedAt: new Date(now.getTime() - 60000),
    detail: detailEvidence(now, { price: null }),
  });
  const result = await f.worker.evaluate(job);
  assert.equal(result.payload.error_code, "amazon_sale_facts_incomplete");
  assert.deepEqual(result.payload.missing, ["price"]);
  assert.equal(f.prices.length, 0);
  assert.equal(f.inputs.size, 0);
});

test("newer detail evidence cannot overwrite human-confirmed sale or purchase prices", async () => {
  const f = fixture({ detail: detailEvidence() });
  await f.worker.evaluate(job);
  assert.equal(
    f.calls.some(({ sql }) => sql.startsWith("INSERT INTO opportunity_cost_inputs")),
    false,
  );
  assert.deepEqual(
    f.prices.map((p) => p.confirmation_mode),
    ["human_review", "human_review"],
  );
  assert.deepEqual(JSON.parse(f.inputs.get("market_demand").evidence_ids_json), [
    "detail-evidence",
  ]);
});

test("missing primary detail skips supplier reads and model work but retains the original evidence wait", async () => {
  let modelCalls = 0;
  const f = fixture({
    ...bilingualOptions,
    noSnapshot: true,
    fields: { ...bilingualOptions.fields, canonical_url: "https://www.amazon.com/dp/B000000001" },
    supplyClassifier: {
      classifySupplies: async () => {
        modelCalls++;
        throw new Error("unexpected model");
      },
    },
  });
  const classification = await f.worker.classifySupplyTitles(job);
  assert.equal(classification, undefined);
  assert.equal(modelCalls, 0);
  assert.equal(f.calls.filter((x) => x.sql === automaticPrimarySnapshotSql).length, 1);
  assert.deepEqual(f.calls.find((x) => x.sql === automaticPrimarySnapshotSql).params, [
    job.opportunityId,
    job.organizationId,
    job.workspaceId,
    "B000000001",
  ]);
  assert.equal(
    f.calls.some((x) => x.sql === automaticSupplyEvidenceSql),
    false,
  );
  const result = await f.worker.evaluate(job, classification);
  assert.equal(result.status, "waiting_evidence");
  assert.equal(result.payload.error_code, "amazon_competitor_snapshot_missing");
  assert.equal(f.calls.filter((x) => x.sql === automaticPrimarySnapshotSql).length, 2);
  assert.equal(
    f.calls.some((x) => /INSERT INTO opportunity_(cost|score)_inputs/.test(x.sql)),
    false,
  );
});
test("a primary snapshot with valid sale facts still permits original supplier classification", async () => {
  let modelCalls = 0;
  const f = fixture({
    ...bilingualOptions,
    fields: { ...bilingualOptions.fields, canonical_url: "https://www.amazon.com/dp/B000000001" },
    supplyClassifier: {
      classifySupplies: async (input) => {
        modelCalls++;
        return bilingualOptions.supplyClassifier.classifySupplies(input);
      },
    },
  });
  const classification = await f.worker.classifySupplyTitles(job);
  assert.equal(modelCalls, 1);
  assert.equal(classification.classifications.length, 3);
  assert.equal(f.calls.filter((x) => x.sql === automaticPrimarySnapshotSql).length, 1);
  assert.equal(f.calls.filter((x) => x.sql === automaticSupplyEvidenceSql).length, 1);
});
test("evaluation rechecks primary detail after preflight rather than trusting its earlier snapshot", async () => {
  const options = {
    ...bilingualOptions,
    noSnapshot: false,
    supplyClassifier: {
      classifySupplies: async (input) => {
        options.noSnapshot = true;
        return bilingualOptions.supplyClassifier.classifySupplies(input);
      },
    },
  };
  const f = fixture(options);
  const classification = await f.worker.classifySupplyTitles(job);
  assert.ok(classification);
  const result = await f.worker.evaluate(job, classification);
  assert.equal(result.payload.error_code, "amazon_competitor_snapshot_missing");
  assert.equal(f.calls.filter((x) => x.sql === automaticPrimarySnapshotSql).length, 2);
  assert.equal(
    f.calls.some((x) => /INSERT INTO opportunity_(cost|score)_inputs/.test(x.sql)),
    false,
  );
});

test("unknown availability stays missing instead of low risk or complete data quality", async () => {
  const f = fixture({ availability: "unknown", noCostRule: true });
  await f.worker.evaluate(job);
  assert.equal(f.inputs.get("risk").score_value, null);
  assert.deepEqual(JSON.parse(f.inputs.get("risk").missing_fields_json), [
    "automatic_evaluation.risk.unsupported",
  ]);
  assert.equal(f.inputs.get("data_quality").score_value, 80);
  assert.match(f.inputs.get("risk").source_ref_id, /crawler-evidence-v3/);
});

test("competition with four detailed related competitors stays unknown, without primary fallback", async () => {
  const f = fixture({ competitorCount: 4 });
  await f.worker.evaluate(job);
  assert.equal(f.inputs.get("competition").score_value, null);
  assert.deepEqual(JSON.parse(f.inputs.get("competition").evidence_ids_json), []);
  const query = f.calls.find(({ sql }) =>
    sql.includes("s_sample.id snapshot_id,s_sample.review_count"),
  );
  assert.ok(query.sql.includes("opportunity.competitors_classified"));
  assert.ok(query.sql.includes("s_sample.freshness='fresh'"));
  assert.deepEqual(query.params, [job.opportunityId, job.organizationId, job.workspaceId]);
});
