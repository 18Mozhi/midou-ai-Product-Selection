import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAmazonProductPage,
  AmazonProductSearchAdapter,
} from "../../packages/provider-sources/dist/index.js";
import {
  readAmazonPublicSignals,
  amazonPublicSignalJoinSql,
} from "../../apps/api/dist/amazon-public-signals.js";
import { MySqlCompetitorRepository } from "../../apps/api/dist/mysql-competitor-repository.js";

const asin = "B000000001";
const card = (id, body = "") =>
  `<div data-component-type="s-search-result" data-asin="${id}"><div data-note="1 > 0"><h2><span>Portable Fan</span></h2><span class="a-offscreen">$17.99</span><span>4.7 out of 5 stars</span><a aria-label="4,862 ratings"></a>${body}</div></div>`;
const badge = (text) => `<span class="a-size-base a-color-secondary">${text}</span>`;
const search = (html) =>
  parseAmazonProductPage(
    `<html><body>${html}</body></html>`,
    "https://www.amazon.com/s?k=portable+fan",
    20,
  );

test("public purchase badge preserves the literal lower-bound and period, never exact sales", () => {
  for (const [text, expected, period] of [
    ["10K+ bought in past month", 10000, "past_month"],
    ["400+ bought in past month", 400, "past_month"],
    ["1,000+ bought in past week", 1000, "past_week"],
  ]) {
    const [{ payload }] = search(card(asin, badge(text)));
    assert.equal(payload.fields.sales_badge_text, text);
    assert.equal(payload.fields.sales_badge_quantity_lower_bound, expected);
    assert.equal(payload.fields.sales_badge_period, period);
    assert.equal(payload.fields.sponsored, null);
    assert.equal(payload.fields.position, 1);
    assert.equal(payload.fields.best_seller_rank, null);
    assert.match(payload.source_paths.sales_badge_text, /search_result.span.a-color-secondary/);
    assert.equal("exact_sales" in payload.fields, false);
  }
});

test("adjacent ads, footer text and nested tag-looking script cannot contaminate another product", () => {
  const first = card(asin, '<script>const a="</div><div>";</script><!-- </div> -->');
  const ad = `<div data-asin="">${badge("50K+ bought in past month")}<span class="puis-sponsored-label-text"><span>Sponsored</span></span></div>`;
  const records = search(
    first +
      ad +
      card("B000000002", badge("3K+ bought in past month")) +
      badge("99K+ bought in past month"),
  );
  assert.equal(records.length, 2);
  assert.equal(records[0].payload.fields.sales_badge_text, null);
  assert.equal(records[0].payload.fields.sponsored, null);
  assert.equal(records[1].payload.fields.sales_badge_quantity_lower_bound, 3000);
});

test("only an observed sponsored label in the same ASIN card is an advertising signal", () => {
  const [{ payload }] = search(
    card(
      asin,
      '<span class="puis-sponsored-label-text"><span class="a-size-mini a-color-secondary">Sponsored</span></span>',
    ),
  );
  assert.equal(payload.fields.sponsored, 1);
  assert.equal(
    search(card(asin, "<span>Sponsored product comparison</span>"))[0].payload.fields.sponsored,
    null,
  );
});

const mainHtml =
  '<div id="centerCol"><h1><span id="productTitle">Portable Fan</span></h1><span class="a-offscreen">$17.99</span><span>4.7 out of 5 stars</span><span id="acrCustomerReviewText" aria-label="4,862 Reviews">(4,862)</span><span id="social-proofing-faceout-title-tk_bought"><span class="a-text-bold">10K+ bought</span><span> in past month</span></span></div>';
const rankHtml =
  "<table><tr><th>Best Sellers Rank</th><td><ul><li><span>#222 in Home &amp; Kitchen (<a>See Top 100 in Home &amp; Kitchen</a>)</span></li><li>#1 in Personal Fans</li></ul></td></tr></table>";
test("detail enrichment keeps main counters and category BSR separate from recommendations and search position", () => {
  const html = `<html><body>${mainHtml}${rankHtml}<div>${badge("99K+ bought in past month")}</div></body></html>`;
  const [{ payload }] = parseAmazonProductPage(html, `https://www.amazon.com/dp/${asin}`, 20);
  assert.equal(payload.fields.review_count, 4862);
  assert.equal(payload.fields.sales_badge_quantity_lower_bound, 10000);
  assert.equal(payload.fields.position, null);
  assert.equal(payload.fields.best_seller_rank, 222);
  assert.match(payload.fields.best_seller_rank_text, /^#222 in Home & Kitchen/);
  assert.ok(payload.raw_content.includes("Best Sellers Rank"));
});

test("JSON-LD supplement retains both original structured facts and scoped HTML evidence", () => {
  const product = {
    "@type": "Product",
    sku: asin,
    name: "Portable Fan",
    offers: { price: 17.99, priceCurrency: "USD" },
  };
  const html = `<html><script type="application/ld+json">${JSON.stringify(product)}</script>${mainHtml}${rankHtml}</html>`;
  const [{ payload }] = parseAmazonProductPage(html, `https://www.amazon.com/dp/${asin}`, 20);
  assert.equal(payload.content_type, "application/json");
  assert.equal(JSON.parse(payload.raw_content).structured_product.sku, asin);
  assert.ok(JSON.parse(payload.raw_content).product_html.includes("10K+ bought"));
  assert.equal(payload.fields.sales_badge_quantity_lower_bound, 10000);
  assert.equal(payload.fields.best_seller_rank, 222);
});

test("wrong-product JSON-LD does not replace a real main detail page", () => {
  const html = `<html><script type="application/ld+json">${JSON.stringify({ "@type": "Product", sku: "B000000002", name: "Other item" })}</script>${mainHtml}</html>`;
  assert.equal(
    parseAmazonProductPage(html, `https://www.amazon.com/dp/${asin}`, 20)[0].externalId,
    asin,
  );
});

test("unobserved, malformed or unsupported badges stay unknown instead of zero", () => {
  for (const text of [
    "No recent sales",
    "0+ bought in past month",
    "1,,000+ bought in past month",
    "1.5K+ bought in past month",
    "10K+ viewed in past month",
    "10K+ bought in past year",
  ]) {
    assert.equal(
      search(card(asin, badge(text)))[0].payload.fields.sales_badge_quantity_lower_bound,
      null,
    );
  }
  assert.equal(readAmazonPublicSignals({ sponsored: 0 }), null);
  assert.equal(readAmazonPublicSignals("invalid JSON"), null);
});

test("old parser configuration cannot relabel newly extracted evidence", async () => {
  let requests = 0;
  const adapter = new AmazonProductSearchAdapter(async () => {
    requests++;
    return new Response("never");
  });
  await assert.rejects(
    adapter.collect(
      {
        provider: { parserVersion: "amazon-structured-product-v2" },
        target: { query: "fan" },
        limit: 1,
      },
      AbortSignal.timeout(1000),
    ),
    (error) => error.code === "source_configuration_invalid",
  );
  assert.equal(requests, 0);
});

test("DTO exposes only whitelisted scoped public signals and no raw normalized payload", async () => {
  const fields = search(card(asin, badge("10K+ bought in past month")))[0].payload.fields;
  const repository = new MySqlCompetitorRepository({
    query: async () => [
      [
        {
          id: "competitor",
          latest_snapshot_id: "snapshot",
          public_signals_json: JSON.stringify({ ...fields, secret: "never return" }),
        },
      ],
    ],
  });
  const [item] = await repository.list({ organizationId: "org", workspaceId: "workspace" });
  assert.equal(item.latest_snapshot.public_signals.sales_badge.quantity_lower_bound, 10000);
  assert.equal(item.latest_snapshot.public_signals.sponsored, null);
  assert.ok(!JSON.stringify(item).includes("never return"));
  for (const binding of [
    "n_signal.organization_id=c.organization_id",
    "n_signal.workspace_id=c.workspace_id",
    "n_signal.raw_evidence_id=s.evidence_id",
    "p_snapshot.code='amazon_product'",
    "UPPER(c.external_id)",
  ])
    assert.ok(amazonPublicSignalJoinSql.includes(binding));
});
