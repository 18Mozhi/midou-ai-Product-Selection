import assert from "node:assert/strict";
import test from "node:test";
import {
  AmazonProductSearchAdapter,
  parseAmazonProductPage,
} from "../../packages/provider-sources/dist/index.js";
import {
  readAmazonPublicSignals,
  readAmazonReviewSamples,
  amazonPublicSignalSelectSql,
  amazonPublicSignalsWithReviewsSelectSql,
} from "../../apps/api/dist/amazon-public-signals.js";

// Hook names and nesting observed on the live product page; review words are synthetic.
const review = (id = "RTEST123456789", extra = "") => `<div id="${id}" data-hook="review">
  <i data-hook="review-star-rating"><span>5 out of 5 stars</span></i>
  <h5 data-hook="reviewTitle"><span>Example &amp; useful title</span></h5>
  <span data-hook="review-date">Reviewed in the United States on October 5, 2026</span>
  <a data-hook="format-strip">Color: Pink</a><span data-hook="avp-badge">Verified Purchase</span>
  <div data-hook="reviewTextContainer">Brief content visible<div data-hook="reviewText">
  <div data-hook="reviewRichContentContainer"><span>Example review body.</span></div>Read more</div></div>
  <span data-hook="helpful-vote-statement">11 people found this helpful</span>${extra}</div>`;
const list = (body) => `<ul id="localTopReviewsList">${body}</ul>`;
const page = (body, structured = false) => `<html><body><header>private-account-header</header>
  ${structured ? '<script type="application/ld+json">{"@type":"Product","name":"Fan","sku":"B000000001","offers":{"price":20,"priceCurrency":"USD"}}</script>' : ""}
  <div id="centerCol"><h1 id="productTitle">Fan</h1><span class="a-offscreen">$20.00</span></div>${body}</body></html>`;
const parse = (html) =>
  parseAmazonProductPage(html, "https://www.amazon.com/dp/B000000001")[0].payload;

for (const structured of [false, true]) {
  test(`review excerpts retain scoped raw support with ${structured ? "JSON-LD" : "HTML"} product facts`, () => {
    const payload = parse(page(list(review()), structured));
    const [sample] = JSON.parse(payload.fields.review_samples_json);
    assert.equal(sample.title, "Example & useful title");
    assert.equal(sample.text, "Example review body.");
    assert.equal(sample.rating, 5);
    assert.equal(sample.variation_text, "Color: Pink");
    assert.equal(sample.verified_purchase, 1);
    assert.equal(sample.helpful_votes, 11);
    assert.match(sample.date_text, /October 5, 2026/);
    assert.match(payload.raw_content, /localTopReviewsList/);
    assert.doesNotMatch(payload.raw_content, /private-account-header/);
    assert.match(payload.source_paths.review_samples_json, /ul#localTopReviewsList/);
    assert.doesNotMatch(sample.text, /Brief content|Read more/);
  });
}

test("search cards and other-country or fake review containers do not become current detail samples", () => {
  const card =
    '<div data-component-type="s-search-result" data-asin="B000000001"><h2><span>Fan</span></h2></div>';
  const [search] = parseAmazonProductPage(
    `<html>${card}${list(review())}</html>`,
    "https://www.amazon.com/s?k=fan",
  );
  assert.equal(search.payload.fields.review_samples_json, null);
  for (const html of [
    `<ul id="internationalTopReviewsList">${review()}</ul>`,
    `<ul data-id="localTopReviewsList">${review()}</ul>`,
    `<!-- ${list(review())} -->`,
    `<script>const fake = '${list(review())}'</script>`,
    '<ul id="localTopReviewsList"><div data-hook="review" id="RINCOMPLETE"><h5 data-hook="reviewTitle">Incomplete</h5></div>',
  ])
    assert.equal(parse(page(html)).fields.review_samples_json, null);
});

test("missing fields stay unknown and the observed singular helpful label remains exact", () => {
  let html = review()
    .replace(/<i[\s\S]*?<\/i>/, "")
    .replace(/<span data-hook="avp-badge">[\s\S]*?<\/span>/, "")
    .replace(/<span data-hook="helpful-vote-statement">[\s\S]*?<\/span>/, "");
  const [missing] = JSON.parse(parse(page(list(html))).fields.review_samples_json);
  assert.equal(missing.rating, null);
  assert.equal(missing.verified_purchase, null);
  assert.equal(missing.helpful_votes, null);
  html = review().replace("11 people found this helpful", "One person found this helpful");
  assert.equal(JSON.parse(parse(page(list(html))).fields.review_samples_json)[0].helpful_votes, 1);
});

test("sample count, duplicate identities, field lengths and script lookalikes are bounded", () => {
  const html = list(
    review() + review() + Array.from({ length: 30 }, (_, i) => review(`REXAMPLE${i}`)).join(""),
  );
  const samples = JSON.parse(parse(page(html)).fields.review_samples_json);
  assert.equal(samples.length, 10);
  assert.equal(new Set(samples.map((s) => s.review_id)).size, 10);
  const long = review().replace("Example review body.", "A".repeat(5000));
  assert.equal(JSON.parse(parse(page(list(long))).fields.review_samples_json)[0].text.length, 2000);
  const fake = review().replace(
    '<h5 data-hook="reviewTitle">',
    '<script><h5 data-hook="reviewTitle">Fake</h5></script><h5 data-hook="reviewTitle">',
  );
  assert.equal(
    JSON.parse(parse(page(list(fake))).fields.review_samples_json)[0].title,
    "Example & useful title",
  );
});

test("API publishes only typed review fields and rejects malformed data without hiding other signals", () => {
  const fields = parse(page(list(review()))).fields;
  const rows = JSON.parse(fields.review_samples_json);
  rows[0].author_account = "never-return";
  rows[0].raw_html = "<private>never-return</private>";
  const result = readAmazonPublicSignals({ review_samples_json: JSON.stringify(rows) });
  assert.equal(result.review_samples.length, 1);
  assert.equal(result.review_samples[0].verified_purchase, true);
  assert.equal(JSON.stringify(result).includes("never-return"), false);
  assert.match(amazonPublicSignalsWithReviewsSelectSql, /review_samples_json/);
  assert.doesNotMatch(amazonPublicSignalSelectSql, /review_samples_json/);
  for (const value of [
    "{bad",
    "x".repeat(120001),
    {},
    [null],
    [{ review_id: "wrong", title: "x", text: "y" }],
  ])
    assert.deepEqual(readAmazonReviewSamples(value), []);
  const old = readAmazonPublicSignals({ sponsored: 1, review_samples_json: "{bad" });
  assert.equal(old.sponsored, true);
  assert.equal(Object.hasOwn(old, "review_samples"), false);
  assert.equal(readAmazonPublicSignals({ review_samples_json: null }), null);
});

test("review fields and provenance survive adapter normalization without widening parser versions", () => {
  const record = parseAmazonProductPage(
    page(list(review())),
    "https://www.amazon.com/dp/B000000001",
  )[0];
  const adapter = new AmazonProductSearchAdapter();
  const normalized = adapter.normalize(record, {
    provider: { id: "provider-test", parserVersion: "amazon-public-product-v5" },
  });
  assert.equal(normalized.fields.review_samples_json, record.payload.fields.review_samples_json);
  assert.equal(
    readAmazonPublicSignals(normalized.fields).review_samples[0].title,
    "Example & useful title",
  );
  assert.equal(normalized.provenance.parser_version, "amazon-public-product-v5");
  assert.equal(normalized.provenance.adapter_version, "amazon-public-product-adapter-v10");
  assert.throws(
    () => adapter.normalize(record, { provider: { parserVersion: "amazon-public-product-v3" } }),
    /source_configuration_invalid/,
  );
});
