import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAmazonProductPage,
  AmazonProductSearchAdapter,
} from "../../packages/provider-sources/dist/index.js";
const asin = "B0F43SPZCY";
const image = "https://m.media-amazon.com/images/I/71gFgSDtiEL._AC_SL1500_.jpg";
const offer = (value, classes = "a-price") =>
  `<span class="${classes}"><span class="a-offscreen">${value}</span></span>`;
const priceBlock = (body, identity = asin) =>
  `<div id="corePriceDisplay_desktop_feature_div" data-csa-c-asin="${identity}">${body}</div>`;
const page = (body, left = "", other = "") =>
  `<html><body><div id="leftCol">${left}</div><div id="centerCol"><h1 id="productTitle">Portable handheld fan</h1>${body}</div>${other}</body></html>`;
const read = (html) =>
  parseAmazonProductPage(html, `https://www.amazon.com/dp/${asin}`, 1)[0].payload;

test("observed primary price skips empty labels and list price; image attributes can precede id", () => {
  const html = page(
    priceBlock(offer("$99.00", "a-price a-text-price") + offer(" ") + offer("$17.99")),
    `<img src="https://m.media-amazon.com/images/I/71gFgSDtiEL._AC_SY300_.jpg" data-old-hires="${image}" class="a-dynamic-image" id="landingImage">`,
  );
  const p = read(html);
  assert.equal(p.fields.price, 17.99);
  assert.equal(p.fields.currency, "USD");
  assert.equal(p.fields.image_url, image);
  assert.ok(p.raw_content.includes(image));
  assert.match(p.source_paths.price, /primary_offer/);
  assert.match(p.source_paths.image_url, /leftCol/);
});

for (const missing of ["", " ", "USD", "$", "See price in cart", "4.7 out of 5 stars"])
  test(`missing or non-price text stays unknown: ${JSON.stringify(missing)}`, () => {
    const p = read(page(priceBlock(offer(missing))));
    assert.equal(p.fields.price, null);
    assert.equal(p.fields.currency, null);
    assert.equal(p.fields.image_url, null);
  });

test("recommendation price/image and script lookalikes cannot supply primary facts", () => {
  const p = read(
    page(
      `<script>${priceBlock(offer("$7.99"))}</script>`,
      "",
      priceBlock(offer("$8.99"), "B000000002") + `<img id="landingImage" src="${image}">`,
    ),
  );
  assert.equal(p.fields.price, null);
  assert.equal(p.fields.image_url, null);
  const wrong = read(page(priceBlock(offer("$1.99"), "B000000002")));
  assert.equal(wrong.fields.price, null);
});

test("missing/invalid image attributes never resolve to the product page", () => {
  for (const src of [
    "",
    "/dp/B0F43SPZCY",
    "https://www.amazon.com/dp/B0F43SPZCY",
    "https://evil.test/image.jpg",
  ])
    assert.equal(read(page("", `<img id="landingImage" src="${src}">`)).fields.image_url, null);
  assert.equal(read(page("", `<img id="landingImage" src="${image}">`)).fields.image_url, image);
});

test("same-product JSON-LD missing facts use observed HTML with matching provenance", () => {
  const structured = `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", sku: asin, name: "Portable fan" })}</script>`;
  const p = read(
    page(priceBlock(offer("$17.99")), `<img src="${image}" id="landingImage">`, structured),
  );
  assert.equal(p.fields.price, 17.99);
  assert.equal(p.fields.currency, "USD");
  assert.equal(p.fields.image_url, image);
  assert.match(p.source_paths.price, /amazon.html/);
  assert.match(p.source_paths.image_url, /amazon.html/);
  assert.ok(JSON.parse(p.raw_content).image_html.includes(image));
});

test("explicit JSON-LD facts keep original provenance and parser version changes", () => {
  const data = {
    "@type": "Product",
    sku: asin,
    name: "Portable fan",
    offers: { price: "21.25", priceCurrency: "USD" },
    image,
  };
  const p = read(
    page(
      priceBlock(offer("$17.99")),
      "",
      `<script type="application/ld+json">${JSON.stringify(data)}</script>`,
    ),
  );
  assert.equal(p.fields.price, 21.25);
  assert.match(p.source_paths.price, /amazon.jsonld/);
  assert.equal(new AmazonProductSearchAdapter().version, "amazon-public-product-adapter-v9");
});

test("search blank labels and missing images remain unknown; attribute order is independent", () => {
  for (const img of ["", `<img src="${image}" class="s-image">`]) {
    const [record] = parseAmazonProductPage(
      `<html><div data-component-type="s-search-result" data-asin="${asin}"><h2><span>Fan</span></h2>${offer(" ")}${img}</div></html>`,
      "https://www.amazon.com/s?k=fan",
    );
    assert.equal(record.payload.fields.price, null);
    assert.equal(record.payload.fields.image_url, img ? image : null);
  }
});

test("observed primary buy-box outside center column needs an exact ASIN and preserves raw price evidence", () => {
  const html = page("", "", priceBlock(offer("$17.99")));
  const p = read(html);
  assert.equal(p.fields.price, 17.99);
  assert.equal(p.fields.currency, "USD");
  assert.ok(p.raw_content.includes(`data-csa-c-asin="${asin}"`));
  const withoutIdentity = html.replace(` data-csa-c-asin="${asin}"`, "");
  assert.equal(read(withoutIdentity).fields.price, null);
});

test("empty JSON-LD rating and review count remain unknown", () => {
  const p = read(
    page(
      "",
      "",
      `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", sku: asin, name: "Fan", aggregateRating: { ratingValue: null, reviewCount: " " } })}</script>`,
    ),
  );
  assert.equal(p.fields.rating_value, null);
  assert.equal(p.fields.review_count, null);
});

test("JSON-LD fallback outside both primary columns retains the actual price block", () => {
  const product = { "@type": "Product", sku: asin, name: "Fan" };
  const p = read(
    `<html>${priceBlock(offer("$17.99"))}<script type="application/ld+json">${JSON.stringify(product)}</script></html>`,
  );
  assert.equal(p.fields.price, 17.99);
  assert.equal(p.content_type, "application/json");
  assert.ok(JSON.parse(p.raw_content).price_html.includes(`data-csa-c-asin="${asin}"`));
});
