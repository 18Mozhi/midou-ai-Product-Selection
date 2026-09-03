import test from "node:test";
import assert from "node:assert/strict";

import { matchesTrendMonitoringRule } from "../../apps/worker/dist/trend-projection-alerts.js";
import {
  projectedTrendProviderContext,
  isAutomaticProductDiscoveryProvider,
  isConcreteProductEvidence,
} from "../../apps/worker/dist/trend-projection-worker.js";
import { calculateTrendProjection } from "../../apps/worker/dist/trend-projection-calculation.js";

const topic = {
  title: "portable espresso maker for travel",
  market: "US",
  language: "en-US",
  category: "ecommerce",
};

test("automatic selection matches a category-scoped rule", () => {
  assert.equal(
    matchesTrendMonitoringRule(
      {
        include_keywords_json: '["espresso"]',
        negative_keywords_json: "[]",
        market: "US",
        language: "en-US",
        category: "ECOMMERCE",
      },
      topic,
    ),
    true,
  );
});

test("automatic selection rejects negative keywords and mismatched categories", () => {
  assert.equal(
    matchesTrendMonitoringRule(
      {
        include_keywords_json: ["espresso"],
        negative_keywords_json: ["travel"],
        market: "US",
        language: "en-US",
        category: "ecommerce",
      },
      topic,
    ),
    false,
  );
  assert.equal(
    matchesTrendMonitoringRule(
      {
        include_keywords_json: ["espresso"],
        negative_keywords_json: [],
        market: "US",
        language: "en-US",
        category: "news",
      },
      topic,
    ),
    false,
  );
});

test("global and multi-language monitoring rules match concrete market records", () => {
  assert.equal(
    matchesTrendMonitoringRule(
      {
        include_keywords_json: ["espresso"],
        negative_keywords_json: [],
        market: "GLOBAL",
        language: "multi",
        category: "ecommerce",
      },
      topic,
    ),
    true,
  );
});

test("automatic product channels preserve their source category", () => {
  const context = projectedTrendProviderContext("gnews_us_amazon");
  assert.equal(context.accepted, true);
  assert.equal(context.accepted && context.category, "ecommerce");
  assert.equal(isAutomaticProductDiscoveryProvider("gnews_us_amazon"), true);
});

test("Amazon public-search records enter the rule projection context", () => {
  const context = projectedTrendProviderContext("amazon_product");
  assert.deepEqual(context, {
    accepted: true,
    automatic: true,
    market: "US",
    language: "en-US",
    category: "ecommerce",
  });
});

test("1688 browser records enter the automatic product projection context", () => {
  const context = projectedTrendProviderContext("1688_search");
  assert.deepEqual(context, {
    accepted: true,
    automatic: true,
    market: "GLOBAL",
    language: "und",
    category: "ecommerce",
  });
  assert.equal(isAutomaticProductDiscoveryProvider("1688_search"), true);

  const projection = calculateTrendProjection({
    id: "job-1688",
    organizationId: "org-1688",
    workspaceId: "workspace-1688",
    normalizedRecordId: "record-1688",
    providerId: "provider-1688",
    providerCode: "1688_search",
    rawEvidenceId: "evidence-1688",
    collectionTaskId: "task-1688",
    payload: {
      title: "手机壳透明防摔款",
      supplier_name: "验收供应商",
      canonical_url: "https://detail.1688.com/offer/123456789.html",
      observed_at: "2026-09-04T00:00:00.000Z",
    },
    actorId: "actor-1688",
    requestId: "request-1688",
    traceId: "trace-1688",
    attemptCount: 1,
  });
  assert.equal(projection.publisher, "验收供应商");
  assert.equal(projection.providerContext.category, "ecommerce");
});

test("automatic selection requires concrete product evidence after a rule match", () => {
  assert.equal(
    isConcreteProductEvidence(
      { price: 29.9, image_url: "https://example.com/product.jpg" },
      "https://www.amazon.com/dp/B0ABCDEF12",
    ),
    true,
  );
  assert.equal(
    isConcreteProductEvidence(
      { summary: "portable espresso is trending" },
      "https://example.com/news/portable-espresso",
    ),
    false,
  );
  assert.equal(
    isConcreteProductEvidence(
      { title: "手机壳透明防摔款", supplier_name: "验收供应商" },
      "https://detail.1688.com/offer/123456789.html",
    ),
    true,
  );
});
