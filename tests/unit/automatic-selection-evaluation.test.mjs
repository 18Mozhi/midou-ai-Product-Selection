import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

test("bulk automatic reevaluation only queues enabled-rule candidates above their source threshold", async () => {
  const paths = [
      "apps/api/src/mysql-profit-repository.ts",
      "apps/api/src/mysql-scoring-repository.ts",
      "apps/worker/src/trend-projection-persistence.ts",
    ],
    sources = await Promise.all(paths.map((path) => readFile(path, "utf8")));
  for (const source of sources) {
    assert.match(source, /automatic_selection_evaluations/);
    assert.match(source, /opportunity_rule_matches/);
    assert.match(source, /trend_monitoring_rules/);
    assert.match(source, /r\.status='enabled'/);
    assert.match(source, /o\.source_count>=r\.recommendation_min_source_count/);
  }
});
