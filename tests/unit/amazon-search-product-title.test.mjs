import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAmazonProductPage,
  sourceEvidencePayload,
} from "../../packages/provider-sources/dist/index.js";
import { providerEvidenceDedupeKey } from "../../apps/worker/dist/provider-source-executor.js";

const asin = "B0FJQG31PK";
const parse = (content, url = "https://www.amazon.com/s?k=transformers") =>
  sourceEvidencePayload(
    parseAmazonProductPage(
      `<html><body><div data-component-type="s-search-result" data-asin="${asin}">${content}</div></body></html>`,
      url,
      20,
    )[0],
  );
const name =
  "Studio Series Age of Extinction Grimlock, Collectible Converting 15-inch Titan Class Action Figure, 15+";
test("brand heading cannot replace the ASIN-linked product heading in the observed current layout", () => {
  const result = parse(
    `<h2 class="brand"><span>Transformers</span></h2><a href="/dp/${asin}/ref=search"><h2 aria-label="${name}" class="a-size-base-plus a-spacing-none a-color-base a-text-normal"><span>${name}</span></h2></a>`,
  );
  assert.equal(result.fields.title, name);
  assert.equal(result.fields.asin, asin);
  assert.match(result.raw_content, /Transformers/);
});
test("legacy heading wrapping a product link retains all title spans", () => {
  assert.equal(
    parse(`<h2><a href="/dp/${asin}"><span>Studio Series</span> <span>Grimlock</span></a></h2>`)
      .fields.title,
    "Studio Series Grimlock",
  );
});
test("image links and a foreign product heading cannot steal the selected ASIN's title", () => {
  assert.equal(
    parse(
      `<a href="/dp/${asin}"><img src="https://images.example/product.jpg"></a><a href="/dp/B0G2P1T18N"><h2><span>Different Product</span></h2></a><a href="/dp/${asin}?tag=listing"><h2>${name}</h2></a>`,
    ).fields.title,
    name,
  );
});
test("script and commented product headings are never title candidates", () => {
  assert.equal(
    parse(
      `<!-- <a href="/dp/${asin}"><h2>Comment</h2></a> --><script>const html='<a href="/dp/${asin}"><h2>Script</h2></a>';</script><a href="/dp/${asin}"><h2><span>${name}</span></h2></a>`,
    ).fields.title,
    name,
  );
});
test("unlinked legacy headings keep their existing fallback", () => {
  assert.equal(
    parse("<h2><span>Legacy Product Name</span></h2>").fields.title,
    "Legacy Product Name",
  );
});
test("a foreign-host link with the same ASIN is not a product-title authority", () => {
  assert.equal(
    parse(
      `<a href="https://other.example/dp/${asin}"><h2>Foreign</h2></a><a href="/dp/${asin}"><h2>${name}</h2></a>`,
    ).fields.title,
    name,
  );
});
test("detail productTitle remains authoritative over a search-style brand heading", () => {
  assert.equal(
    parse(
      `<h2><span>Brand</span></h2><span id="productTitle">Actual Detail Product</span>`,
      `https://www.amazon.com/dp/${asin}`,
    ).fields.title,
    "Actual Detail Product",
  );
});
test("Amazon normalizer upgrades create new evidence identities without changing other providers", () => {
  const provider = { code: "amazon_product", parserVersion: "parser-v1" },
    key = `amazon:search:task:${asin}`;
  const identity = (version) =>
    providerEvidenceDedupeKey(provider, asin, "task", "same raw bytes", key, version);
  assert.equal(identity("adapter-v19"), identity("adapter-v19"));
  assert.notEqual(identity("adapter-v18"), identity("adapter-v19"));
  assert.notEqual(identity(undefined), identity("adapter-v19"));
  const other = { code: "1688_search", parserVersion: "parser-v1" };
  assert.equal(
    providerEvidenceDedupeKey(other, "offer", "task", "body", undefined, "v1"),
    providerEvidenceDedupeKey(other, "offer", "task", "body", undefined, "v2"),
  );
});
