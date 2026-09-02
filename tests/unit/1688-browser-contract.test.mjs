import test from "node:test";
import assert from "node:assert/strict";

import {
  ALIBABA_1688_BROWSER_PARSER_VERSION,
  ALIBABA_1688_SNAPSHOT_SCHEMAS,
  BUILTIN_PROVIDER_SOURCES,
  create1688BrowserExecutionRequest,
  parse1688OfferDetailSnapshot,
  parse1688SearchSnapshot,
  parse1688SupplierSnapshot,
} from "../../packages/provider-sources/dist/index.js";

const observedAt = "2026-08-19T08:30:00.000Z";
const searchItem = {
  offer_id: "1234567890",
  title: "折叠桌面灯",
  supplier_id: "supplier-100",
  supplier_name: "示例供应商",
  quoted_price: 12.5,
  currency: "CNY",
  moq: 100,
  location: "广东 惠州",
  canonical_url: "https://detail.1688.com/offer/1234567890.html",
  dom_fragment: '<article data-offer-id="1234567890">折叠桌面灯</article>',
  source_paths: {
    title: "article h2",
    supplier_name: "article .company-name",
    quoted_price: "article .price",
    moq: "article .moq",
    location: "article .location",
    canonical_url: "article a.offer-link[href]",
  },
};

test("1688 execution uses the live GBK search form and current mobile offer cards", () => {
  const request = create1688BrowserExecutionRequest({ query: "桌面灯", acceptance_run: true });
  assert.equal(request.purpose, "acceptance");
  assert.equal(request.plan.start_url, "https://s.1688.com/selloffer/offer_search.htm");
  assert.deepEqual(request.plan.search, {
    input_selector: "#alisearch-input",
    query: "桌面灯",
    submit_selector: ".input-button",
  });
  assert.equal(request.plan.item_selector, 'a.search-offer-wrapper[href*="offerId="]');
  assert.equal(request.plan.search_snapshot.schema_version, "1688.search.v1");
  assert.equal(request.plan.search_snapshot.max_items, 15);
  assert.equal(request.plan.search_snapshot.price_selector, ".offer-price-row .price-item");
  assert.equal(request.plan.max_details, 0);
  assert.equal("detail_link_selector" in request.plan, false);
});

test("1688 search contract preserves evidence paths and explicit complete fields", () => {
  const records = parse1688SearchSnapshot({
    schema_version: ALIBABA_1688_SNAPSHOT_SCHEMAS.search,
    source_url:
      "https://s.1688.com/selloffer/offer_search.htm?keywords=%E6%A1%8C%E9%9D%A2%E7%81%AF",
    observed_at: observedAt,
    items: [searchItem],
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].externalId, "1688-search:1234567890");
  assert.match(records[0].evidenceRef, /^1688-search:[a-f0-9]{64}$/);
  assert.equal(records[0].payload.content_type, "text/html");
  assert.equal(records[0].payload.fields.currency, "CNY");
  assert.equal(records[0].payload.fields.missing_fields_json, "[]");
  assert.equal(records[0].payload.source_paths.title, "article h2");
});

test("1688 search contract reports missing price MOQ and location without inventing values", () => {
  const records = parse1688SearchSnapshot({
    schema_version: ALIBABA_1688_SNAPSHOT_SCHEMAS.search,
    source_url: "https://s.1688.com/selloffer/offer_search.htm?keywords=lamp",
    observed_at: observedAt,
    items: [
      {
        ...searchItem,
        quoted_price: null,
        currency: null,
        moq: null,
        location: null,
      },
    ],
  });

  assert.equal(records[0].payload.fields.price, null);
  assert.equal(records[0].payload.fields.missing_fields_json, '["quoted_price","moq","location"]');
});

test("1688 offer-detail contract keeps specification and lead-time separate from search", () => {
  const canonicalUrl = "https://detail.1688.com/offer/1234567890.html";
  const record = parse1688OfferDetailSnapshot({
    schema_version: ALIBABA_1688_SNAPSHOT_SCHEMAS.offerDetail,
    source_url: canonicalUrl,
    observed_at: observedAt,
    offer: {
      ...searchItem,
      specification: "白色 / USB-C",
      lead_time_days: 7,
      source_paths: {
        ...searchItem.source_paths,
        supplier_id: "#company[data-id]",
        specification: "#specifications",
        lead_time_days: "#delivery-time",
      },
    },
  });

  assert.equal(record.externalId, "1688-offer:1234567890");
  assert.equal(record.payload.fields.specification, "白色 / USB-C");
  assert.equal(record.payload.fields.lead_time_days, 7);
  assert.equal(record.payload.fields.missing_fields_json, "[]");
});

test("1688 supplier contract records missing location explicitly", () => {
  const canonicalUrl = "https://example.1688.com/page/index.html";
  const record = parse1688SupplierSnapshot({
    schema_version: ALIBABA_1688_SNAPSHOT_SCHEMAS.supplier,
    source_url: canonicalUrl,
    observed_at: observedAt,
    supplier: {
      supplier_id: "supplier-100",
      supplier_name: "示例供应商",
      location: null,
      canonical_url: canonicalUrl,
      dom_fragment: "<main><h1>示例供应商</h1></main>",
      source_paths: {
        supplier_name: "main h1",
        location: "main .location",
        canonical_url: "link[rel=canonical]",
      },
    },
  });

  assert.equal(record.externalId, "1688-supplier:supplier-100");
  assert.equal(record.payload.fields.location, null);
  assert.equal(record.payload.fields.missing_fields_json, '["location"]');
});

test("1688 contracts fail closed on schema, scope, identity, path and size drift", () => {
  const base = {
    schema_version: ALIBABA_1688_SNAPSHOT_SCHEMAS.search,
    source_url: "https://s.1688.com/selloffer/offer_search.htm?keywords=lamp",
    observed_at: observedAt,
    items: [searchItem],
  };
  assert.throws(
    () => parse1688SearchSnapshot({ ...base, schema_version: "1688.search.v2" }),
    (error) => error.code === "source_changed",
  );
  assert.throws(
    () => parse1688SearchSnapshot({ ...base, source_url: "https://evil.test/" }),
    (error) => error.code === "source_configuration_invalid",
  );
  assert.throws(
    () =>
      parse1688SearchSnapshot({
        ...base,
        items: [{ ...searchItem, canonical_url: "https://detail.1688.com/offer/2.html" }],
      }),
    (error) => error.code === "source_changed",
  );
  assert.throws(
    () =>
      parse1688SearchSnapshot({
        ...base,
        items: [
          {
            ...searchItem,
            canonical_url: "https://example.1688.com/offer/1234567890.html",
          },
        ],
      }),
    (error) => error.code === "source_changed",
  );
  assert.throws(
    () =>
      parse1688SearchSnapshot({
        ...base,
        items: [{ ...searchItem, source_paths: { ...searchItem.source_paths, moq: "" } }],
      }),
    (error) => error.code === "source_changed",
  );
  assert.throws(
    () =>
      parse1688SearchSnapshot({
        ...base,
        items: [{ ...searchItem, dom_fragment: "x".repeat(250_001) }],
      }),
    (error) => error.code === "source_changed",
  );
});

test("1688 catalog remains disabled until the authenticated browser execution chain is real", () => {
  const source = BUILTIN_PROVIDER_SOURCES.find((item) => item.code === "1688_search");
  assert.equal(source?.access_mode, "authenticated_browser");
  assert.equal(source?.availability, "setup_required");
  assert.equal(source?.status, "disabled");
  assert.equal(source?.parser_version, ALIBABA_1688_BROWSER_PARSER_VERSION);
  assert.deepEqual(source?.fields, [
    "title",
    "supplier_name",
    "quoted_price",
    "currency",
    "moq",
    "specification",
    "lead_time_days",
    "location",
    "canonical_url",
    "observed_at",
  ]);
});
