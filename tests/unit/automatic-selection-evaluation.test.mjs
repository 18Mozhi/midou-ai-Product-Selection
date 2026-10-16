import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MySqlAutomaticSelectionEvaluationWorker } from "../../apps/worker/dist/automatic-selection-evaluation-worker.js";
import {
  automaticPrimaryEvidenceSql,
  automaticSupplyEvidenceSql,
} from "../../apps/worker/dist/automatic-selection-evidence.js";
import { selectionPrimaryAsinSql } from "../../packages/database/dist/index.js";
import { parseLan1688Result } from "../../apps/worker/dist/lan-1688-image-search.js";

import {
  calculateAutomaticScoreFacts,
  productIdentityConfidence,
  selectConservativeSupplyMatch,
} from "../../apps/worker/dist/automatic-selection-evaluation.js";

const supply = (id, title, price) => ({
  title,
  price,
  currency: "CNY",
  observedAt: new Date("2026-09-05T00:00:00Z"),
  evidenceId: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
  externalId: String(1000 + id),
});

test("historical repair only revives exact legacy rule skips and leaves leased or failed work untouched", async () => {
  const calls = [];
  const worker = new MySqlAutomaticSelectionEvaluationWorker(
    {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return [[]];
      },
    },
    "worker",
    "actor",
    120,
  );
  await worker.enqueueEligibleCandidates();
  assert.match(calls[0].sql, /INSERT IGNORE[\s\S]*e.opportunity_id IS NULL/);
  assert.match(
    calls[1].sql,
    /WHERE e.status='succeeded'[\s\S]*\$\.skipped'\)\)='not_rule_candidate'/,
  );
  assert.match(calls[1].sql, /result_json=NULL/);
  for (const { sql } of calls) {
    assert.match(sql, /o.decision_status='pending'/);
    assert.match(sql, /o.lifecycle_status NOT IN \('archived','deleted'\)/);
    assert.match(sql, /LIMIT 100/);
    assert.doesNotMatch(sql, /trend_monitoring_rules|recommendation_min_source_count/);
  }
});

test("automatic selection only matches the same phone family, model and compatible variant", () => {
  assert.ok(
    productIdentityConfidence(
      "Magnetic Case for iPhone 17 Pro Max",
      "适用苹果 iPhone 17 Pro Max 磁吸手机壳",
    ) >= 80,
  );
  assert.ok(
    productIdentityConfidence(
      "Magnetic Case for iPhone 17 Pro Max",
      "适用苹果17ProMax透明磁吸手机壳",
    ) >= 80,
  );
  assert.equal(
    productIdentityConfidence(
      "Magnetic Case for iPhone 17 Pro Max",
      "适用苹果 iPhone 16 Pro Max 磁吸手机壳",
    ),
    0,
  );
  assert.equal(
    productIdentityConfidence(
      "Magnetic Case for iPhone 17 Pro Max",
      "适用苹果 iPhone 17 Plus 磁吸手机壳",
    ),
    0,
  );
});

test("automatic selection requires three high-confidence 1688 offers and uses the conservative p75 price", () => {
  const title = "Magnetic Case for iPhone 17 Pro Max";
  assert.equal(
    selectConservativeSupplyMatch(title, [supply(1, "苹果 17 Pro Max 手机壳", 5)]),
    null,
  );
  const result = selectConservativeSupplyMatch(title, [
    supply(1, "苹果 17 Pro Max 手机壳", 5),
    supply(2, "苹果 17 Pro Max 保护壳", 7),
    supply(3, "iPhone 17 Pro Max 磁吸手机壳", 9),
    supply(4, "iPhone 17 Pro Max 防摔保护套", 20),
  ]);
  assert.ok(result);
  assert.equal(result.sampleCount, 4);
  assert.equal(result.conservativePrice, 9);
});

test("repeated observations of one 1688 offer cannot satisfy the independent sample requirement", () => {
  const title = "Magnetic Case for iPhone 17 Pro Max";
  const item = supply(1, "苹果 17 Pro Max 手机壳", 5);
  assert.equal(selectConservativeSupplyMatch(title, [item, { ...item }, { ...item }]), null);
  const result = selectConservativeSupplyMatch(title, [
    item,
    { ...item, price: 20, observedAt: new Date("2026-09-06T00:00:00Z") },
    supply(2, "苹果 17 Pro Max 手机壳", 7),
    supply(3, "苹果 17 Pro Max 手机壳", 9),
  ]);
  assert.equal(result.sampleCount, 3);
  assert.equal(result.conservativePrice, 20);
  assert.equal(result.item.externalId, item.externalId);
});

test("a new unusable observation does not revive an older cheap quote from the same offer", () => {
  const title = "Magnetic Case for iPhone 17 Pro Max";
  const item = supply(1, "苹果 17 Pro Max 手机壳", 5);
  assert.equal(
    selectConservativeSupplyMatch(title, [
      item,
      { ...item, price: 0, observedAt: new Date("2026-09-06T00:00:00Z") },
      supply(2, "苹果 17 Pro Max 手机壳", 7),
      supply(3, "苹果 17 Pro Max 手机壳", 9),
      { ...supply(4, "苹果 17 Pro Max 手机壳", 10), externalId: "" },
      { ...supply(5, "苹果 17 Pro Max 手机壳", 10), observedAt: new Date("invalid") },
    ]),
    null,
  );
});

test("an observed LAN newcomer price is preserved as evidence but cannot become an unconditional automatic purchase cost", () => {
  const title = "Magnetic Case for iPhone 17 Pro Max";
  const [record] = parseLan1688Result(
    {
      success: true,
      items: [
        {
          offerId: "12345",
          title: "苹果 17 Pro Max 手机壳",
          shop_name: "厂商",
          price: "1.5",
          price_description: "新人价",
        },
      ],
    },
    "2026-09-06T00:00:00Z",
  );
  const fields = record.payload.fields;
  const newcomer = {
    ...supply(1, fields.title, fields.price),
    priceDescription: fields.price_description,
  };
  assert.equal(fields.price, 1.5);
  assert.equal(fields.price_description, "新人价");
  assert.equal(
    selectConservativeSupplyMatch(title, [
      newcomer,
      supply(2, "苹果 17 Pro Max 手机壳", 7),
      supply(3, "苹果 17 Pro Max 手机壳", 9),
    ]),
    null,
  );
  const result = selectConservativeSupplyMatch(title, [
    newcomer,
    supply(2, "苹果 17 Pro Max 手机壳", 7),
    supply(3, "苹果 17 Pro Max 手机壳", 9),
    supply(4, "苹果 17 Pro Max 手机壳", 10),
  ]);
  assert.equal(result.sampleCount, 3);
  assert.equal(result.conservativePrice, 10);
});

test("automatic evaluation binds primary identity and supply tasks to the current opportunity", async () => {
  const calls = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {},
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT o.*")) return [[{ market: "US" }]];
      if (sql.startsWith("SELECT id,version_code,dimensions_json")) return [[{ id: "score" }]];
      if (sql.startsWith("SELECT id,version_code,fee_lines_json"))
        return [
          [
            {
              id: "cost",
              automatic_scope_json: { product_family: "phone_case" },
            },
          ],
        ];
      if (sql === automaticPrimaryEvidenceSql)
        return [
          [
            {
              raw_evidence_id: "main-evidence",
              payload_json: {
                asin: "B000000001",
                title: "Magnetic Case for iPhone 17 Pro Max",
                price: 20,
                currency: "USD",
              },
            },
          ],
        ];
      if (sql.startsWith("SELECT s.* FROM competitors")) return [[{ id: "primary-snapshot" }]];
      if (sql === automaticSupplyEvidenceSql)
        return [
          [
            ...[1, 2, 3].map((id) => ({
              raw_evidence_id: `supply-${id}`,
              payload_json: {
                external_id: String(id),
                title: "苹果 17 Pro Max 手机壳",
                price: 5,
                currency: "CNY",
              },
              created_at: new Date("2026-09-05T00:00:00Z"),
            })),
            {
              raw_evidence_id: "new-invalid-supply-1",
              payload_json: {
                external_id: "1",
                title: "苹果 17 Pro Max 手机壳",
                price: null,
                currency: "CNY",
              },
              created_at: new Date("2026-09-06T00:00:00Z"),
            },
          ],
        ];
      return [{ affectedRows: 1 }];
    },
  };
  const worker = new MySqlAutomaticSelectionEvaluationWorker(
    { getConnection: async () => connection },
    "worker",
    "actor",
    120,
  );
  const job = {
    opportunityId: "opportunity",
    organizationId: "org",
    workspaceId: "workspace",
    attemptCount: 0,
  };
  const result = await worker.evaluate(job);
  assert.equal(result.payload.error_code, "high_confidence_1688_match_missing");
  for (const sql of [automaticPrimaryEvidenceSql, automaticSupplyEvidenceSql])
    assert.deepEqual(calls.find((call) => call.sql === sql).params, [
      "opportunity",
      "org",
      "workspace",
    ]);
  assert.ok(automaticPrimaryEvidenceSql.includes(selectionPrimaryAsinSql));
  assert.match(automaticSupplyEvidenceSql, /ss.input_type='opportunity' AND ss.input_ref=\?/);
  assert.match(automaticSupplyEvidenceSql, /n.raw_evidence_id=l.raw_evidence_id/);
  assert.doesNotMatch(
    calls.map((call) => call.sql).join("\n"),
    /INSERT INTO opportunity_cost_inputs/,
  );
  const invalidation = calls.find((call) => call.sql.startsWith("UPDATE opportunities o"));
  assert.ok(invalidation);
  assert.match(invalidation.sql, /ci.confirmation_mode='automatic_evidence'/);
  assert.match(invalidation.sql, /ci.input_type='purchase_price' AND ci.is_current=1/);
  assert.match(invalidation.sql, /o.decision_status='pending'/);
  assert.match(invalidation.sql, /o.recommendation_status='recommend'/);
  assert.deepEqual(invalidation.params.slice(1), ["opportunity", "org", "workspace"]);
});

test("automatic quality facts remain missing when source metrics are absent and penalize blocked evidence", () => {
  const base = {
    title: "Phone case",
    price: 19.99,
    currency: "USD",
    reviewCount: 1200,
    rating: 4.5,
    availability: "in_stock",
    observedAt: new Date("2026-09-05T00:00:00Z"),
    evidenceId: "00000000-0000-4000-8000-000000000001",
    providerHealthy: true,
    qualityBlocked: false,
  };
  const healthy = calculateAutomaticScoreFacts({
    product: base,
    netMarginPercent: 35,
    evidenceAgeHours: 1,
    requiredFieldsPresent: 5,
    requiredFieldCount: 5,
  });
  assert.ok(healthy.market_demand > 60);
  assert.ok(healthy.profit > 80);
  assert.equal(healthy.riskLevel, "low");

  const blocked = calculateAutomaticScoreFacts({
    product: { ...base, qualityBlocked: true },
    netMarginPercent: null,
    evidenceAgeHours: 200,
    requiredFieldsPresent: 3,
    requiredFieldCount: 5,
  });
  assert.equal(blocked.profit, null);
  assert.equal(blocked.riskLevel, "unknown");
  assert.equal(blocked.data_quality, 0);

  const missingRating = calculateAutomaticScoreFacts({
    product: { ...base, reviewCount: 100, rating: null },
    netMarginPercent: 30,
    evidenceAgeHours: 1,
    requiredFieldsPresent: 4,
    requiredFieldCount: 5,
  });
  assert.equal(missingRating.market_demand, null);
  assert.notEqual(missingRating.competition, null);
});

test("automatic worker preserves human costs and clears a stale recommendation on blocked evidence", async () => {
  const source = await readFile("apps/worker/src/automatic-selection-evaluation-worker.ts", "utf8");
  assert.match(source, /confirmation_mode === "human_review"/);
  assert.match(source, /date\(profitRun\.calculated_at\)\.getTime\(\) < newestCostInputAt/);
  assert.match(source, /recommendation_status=IF\(\?,'insufficient_data',/);
  assert.match(source, /profit: currentCostEvidenceIds/);
});

test("bulk automatic reevaluation uses the same primary identity policy as the worker", async () => {
  const paths = [
      "apps/api/src/mysql-profit-repository.ts",
      "apps/api/src/mysql-scoring-repository.ts",
      "apps/worker/src/automatic-selection-evaluation-worker.ts",
    ],
    sources = await Promise.all(paths.map((path) => readFile(path, "utf8")));
  for (const source of sources) {
    assert.match(source, /automatic_selection_evaluations/);
    assert.match(source, /selectionCandidateSql/);
    assert.doesNotMatch(source, /o\.source_count>=r\.recommendation_min_source_count/);
  }
});
