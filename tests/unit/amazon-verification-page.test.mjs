import test from "node:test";
import assert from "node:assert/strict";
import {
  AmazonProductSearchAdapter,
  parseAmazonProductPage,
} from "../../packages/provider-sources/dist/index.js";

const url = "https://www.amazon.com/s?k=storage+box";
const product =
  '<div data-component-type="s-search-result" data-asin="B0ABCDEF12"><h2><span>Storage Box</span></h2></div>';
const verification =
  '<meta http-equiv="refresh" content="5; URL=\'/s?k=storage+box&bm-verify=synthetic-test-only\'">';
const page = (head, body = "") => `<html><head>${head}</head><body>${body}</body></html>`;

for (const meta of [
  verification,
  '<meta content="5; URL=/s?k=storage+box&amp;bm-verify=synthetic-test-only" http-equiv="REFRESH">',
  "<meta HTTP-EQUIV = 'refresh' CONTENT = '0; url=https://www.amazon.com/s?bm-verify=synthetic-test-only'>",
]) {
  test(`observed verification refresh is denied before product extraction: ${meta.slice(0, 36)}`, () => {
    assert.throws(() => parseAmazonProductPage(page(meta, product), url), {
      code: "permission_denied",
      retryable: false,
    });
  });
}

for (const head of [
  '<meta name="description" content="An explanation of bm-verify= text">',
  '<meta http-equiv="refresh" content="5; URL=/s?k=storage+box">',
  `<!-- ${verification} -->`,
  `<script>const template = ${JSON.stringify(verification)};</script>`,
]) {
  test(`ordinary content retains its actual product: ${head.slice(0, 38)}`, () => {
    assert.equal(parseAmazonProductPage(page(head, product), url)[0].externalId, "B0ABCDEF12");
  });
}

test("unrecognized HTML remains a structural failure", () => {
  assert.throws(() => parseAmazonProductPage(page(""), url), { code: "source_changed" });
});

test("verification response is not retried, followed or replaced by control products", async () => {
  const calls = [];
  const adapter = new AmazonProductSearchAdapter(async (input) => {
    calls.push(String(input));
    return new Response(page(verification));
  });
  await assert.rejects(
    () =>
      adapter.collect(
        {
          provider: { parserVersion: "amazon-public-product-v5" },
          target: { query: "a specific product" },
          limit: 20,
        },
        AbortSignal.timeout(1000),
      ),
    { code: "permission_denied" },
  );
  assert.deepEqual(calls, ["https://www.amazon.com/s?k=a%20specific%20product"]);
  const health = await adapter.healthCheck(
    { provider: { parserVersion: "amazon-public-product-v5" } },
    AbortSignal.timeout(1000),
  );
  assert.equal(health.errorCode, "permission_denied");
  assert.equal(health.status, "degraded");
  assert.equal(calls.length, 2);
  assert.ok(calls.every((value) => !value.includes("bm-verify")));
});
