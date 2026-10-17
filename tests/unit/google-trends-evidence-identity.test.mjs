import test from "node:test";
import assert from "node:assert/strict";
import { providerEvidenceDedupeKey } from "../../apps/worker/dist/provider-source-executor.js";

const trends = { code: "feed_google_trends_us", parserVersion: "google-trends-rss-v1" };
test("same Trends content deduplicates across polls but changed content gets immutable evidence", () => {
  const first = providerEvidenceDedupeKey(trends, "term", "poll-1", "original");
  assert.equal(first, providerEvidenceDedupeKey(trends, "term", "poll-2", "original"));
  assert.notEqual(first, providerEvidenceDedupeKey(trends, "term", "poll-2", "updated headline"));
  assert.notEqual(first, providerEvidenceDedupeKey(trends, "other-term", "poll-1", "original"));
});
test("ordinary RSS identity remains unchanged", () => {
  assert.equal(
    providerEvidenceDedupeKey(
      { code: "feed_ars_technica", parserVersion: "syndication-feed-v1" },
      "guid",
      "poll",
      "body",
    ),
    "guid",
  );
});

for (const code of [
  "amazon_product",
  "1688_search",
  "dhgate_supplier_search",
  "made_in_china_search",
  "ec21_supplier_search",
])
  test(`${code} retries deduplicate identical bytes and preserve changed content as a new version`, () => {
    const product = { code, parserVersion: "parser-v1" };
    assert.equal(
      providerEvidenceDedupeKey(product, "asin", "task-1", "body"),
      providerEvidenceDedupeKey(product, "asin", "task-1", "body"),
    );
    assert.notEqual(
      providerEvidenceDedupeKey(product, "asin", "task-1", "body"),
      providerEvidenceDedupeKey(product, "asin", "task-1", "changed body"),
    );
    assert.notEqual(
      providerEvidenceDedupeKey(product, "asin", "task-1", "body"),
      providerEvidenceDedupeKey(
        { ...product, parserVersion: "parser-v2" },
        "asin",
        "task-1",
        "body",
      ),
    );
    assert.notEqual(
      providerEvidenceDedupeKey(product, "asin", "task-1", "body"),
      providerEvidenceDedupeKey(product, "other", "task-1", "body"),
    );
    assert.notEqual(
      providerEvidenceDedupeKey(product, "asin", "task-1", "body"),
      providerEvidenceDedupeKey(product, "asin", "task-2", "body"),
    );
  });
