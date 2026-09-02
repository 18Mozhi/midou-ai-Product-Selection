import test from "node:test";
import assert from "node:assert/strict";

import { matchesTrendMonitoringRule } from "../../apps/worker/dist/trend-projection-alerts.js";
import {
  projectedTrendProviderContext,
  isAutomaticProductDiscoveryProvider,
  isConcreteProductEvidence,
} from "../../apps/worker/dist/trend-projection-worker.js";

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
});
