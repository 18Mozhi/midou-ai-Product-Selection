import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  parseLan1688ItemDetails,
  LAN_1688_DETAIL_VERSION,
  Lan1688ImageSearch,
} from "../../packages/provider-sources/dist/index.js";
import { supplyFacts } from "../../apps/worker/dist/supply-facts-from-records.js";
import { supplyDetailText, supplySourceRef } from "../../apps/worker/dist/supply-detail-facts.js";
import {
  selectClassifiedSupplyQuote,
  selectConservativeSupplyMatch,
} from "../../apps/worker/dist/automatic-selection-evaluation.js";
import { sourcingSkuFacts } from "../../apps/api/dist/sourcing-sku-facts.js";
import { automaticSupplyCompletionQuoteValid } from "../../apps/worker/dist/automatic-supply-completion-guard.js";
import {
  automaticPrimaryEvidenceSql,
  automaticPrimaryDetailEvidenceSql,
  automaticSupplyEvidenceSql,
} from "../../apps/worker/dist/automatic-selection-evidence.js";

const fixture = JSON.parse(
  await readFile(new URL("../fixtures/lan-1688-item-detail.json", import.meta.url), "utf8"),
);
const ids = fixture.items.map((item) => item.offer_id);
const observed = "2026-10-20T10:00:00.000Z";
const image = "https://m.media-amazon.com/images/I/test.jpg";
const one = (item) => ({ ...fixture, total: 1, succeeded: 1, items: [item] });
const records = () => parseLan1688ItemDetails(structuredClone(fixture), ids, observed);
const rows = (raw) =>
  raw.map((record, index) => ({
    payload_json: record.payload.fields,
    raw_evidence_id: `raw-${index}`,
    created_at: observed,
  }));
const locate = (root, path) =>
  path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .slice(1)
    .reduce((value, key) => {
      assert.ok(value && Object.hasOwn(value, key), path);
      return value[key];
    }, root);

test("user-supplied detail examples retain eight individual SKU quotes, not the offer minimum", () => {
  const values = records();
  assert.equal(LAN_1688_DETAIL_VERSION, "1688-lan-item-detail-v1");
  assert.equal(values.length, 8);
  assert.equal(new Set(values.map((r) => r.externalId)).size, 8);
  assert.deepEqual(
    values.slice(0, 5).map((r) => r.payload.fields.price),
    [7.8, 7.8, 7.8, 7.8, 7.8],
  );
  assert.deepEqual(
    values.slice(5).map((r) => r.payload.fields.price),
    [1668, 489, 389],
  );
  assert.equal(values[5].payload.fields.sku_id, "6073913001698");
  assert.match(values[5].payload.fields.specification, /套装/);
  assert.equal(values[0].payload.fields.price_source, "discountPrice");
  assert.equal(values[5].payload.fields.price_source, "original.price");
  for (const record of values) {
    const raw = JSON.parse(record.payload.raw_content);
    for (const path of Object.values(record.payload.source_paths)) locate(raw, path);
    assert.equal(
      Number(locate(raw, record.payload.source_paths.price)),
      record.payload.fields.price,
    );
    assert.equal(locate(raw, record.payload.source_paths.sku_id), record.payload.fields.sku_id);
    assert.equal(
      raw.data.source_data,
      undefined,
      "duplicated upstream metadata is excluded from the raw projection",
    );
  }
});

test("mismatched or duplicate offer/SKU identities and crossed package identities fail closed", () => {
  for (const change of [
    (value) => (value.items[0].data.offer_id = ids[1]),
    (value) => (value.items[0].offer_id = "999"),
    (value) => (value.items[0].data.skus[1].sku_id = value.items[0].data.skus[0].sku_id),
    (value) => (value.items[0].data.skus[0].packages[0].skuId = "999"),
    (value) => (value.items[0].data.skus[0].price = "0.01"),
    (value) =>
      (value.items[0].data.product_url = "https://attacker.invalid/offer/835520608338.html"),
  ]) {
    const payload = structuredClone(fixture);
    change(payload);
    assert.throws(() => parseLan1688ItemDetails(payload, ids, observed), {
      code: "invalid_payload",
      retryable: false,
    });
  }
});

test("unknown price sources remain missing and partial batches cannot establish quotes", () => {
  const payload = structuredClone(fixture);
  payload.items[0].data.skus[0].price_source = "unknown";
  assert.equal(parseLan1688ItemDetails(payload, ids, observed)[0].payload.fields.price, null);
  payload.complete = false;
  payload.partial = true;
  payload.incomplete = 1;
  assert.throws(() => parseLan1688ItemDetails(payload, ids, observed), {
    code: "dependency_unavailable",
    retryable: true,
  });
});

test("normal enrichment binds only the actually image-selected SKU and preserves newcomer conditions", async () => {
  const calls = [];
  const client = new Lan1688ImageSearch("test-only", 1000, async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, body });
    assert.equal(options.redirect, "error");
    if (url.endsWith("/image-search"))
      return Response.json({
        success: true,
        items: [
          {
            offerId: ids[1],
            title: fixture.items[1].data.title,
            shop_name: "供应商",
            price: "389",
            min_order_quantity: 1,
            sku_id: "6073913001698",
            price_description: "新人价",
          },
        ],
      });
    assert.deepEqual(body, { offer_ids: [ids[1]] });
    return Response.json(one(fixture.items[1]));
  });
  const result = await client.collectEnriched(image, async () => {});
  assert.equal(calls.length, 2);
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].payload.fields.price_eligible, false);
  const detail = result.records[1];
  assert.equal(detail.payload.fields.sku_id, "6073913001698");
  assert.equal(detail.payload.fields.price, 1668, "never borrow the single-chair 389 quote");
  assert.equal(detail.payload.fields.price_description, "新人价");
  assert.equal(
    locate(JSON.parse(detail.payload.raw_content), detail.payload.source_paths.price_description),
    "新人价",
  );
});

test("an unavailable image SKU retains detail context but never selects a cheaper alternative", async () => {
  const client = new Lan1688ImageSearch("test-only", 1000, async (url) =>
    Response.json(
      url.endsWith("/image-search")
        ? {
            success: true,
            items: [
              {
                offerId: ids[1],
                title: "桌椅套装",
                shop_name: "供应商",
                price: 389,
                min_order_quantity: 1,
                sku_id: "999",
              },
            ],
          }
        : one(fixture.items[1]),
    ),
  );
  const value = await client.collectEnriched(image, async () => {});
  assert.equal(value.records[1].payload.fields.record_type, "offer_detail_unselected");
  assert.equal(value.records[1].payload.fields.price, null);
  assert.equal(supplyFacts(rows(value.records)).length, 0);
});

test("detail batching shares six-node single-host exclusion with image requests", async () => {
  const active = new Map(),
    calls = [];
  const client = new Lan1688ImageSearch("test-only", 1000, async (url, options) => {
    const host = new URL(url).host,
      body = JSON.parse(options.body);
    assert.equal(active.get(host) ?? 0, 0);
    active.set(host, 1);
    assert.equal(body.offer_ids.length <= 2, true);
    calls.push({ host, ids: body.offer_ids });
    await new Promise((resolve) => setTimeout(resolve, 5));
    active.set(host, 0);
    return Response.json({
      ...fixture,
      total: body.offer_ids.length,
      succeeded: body.offer_ids.length,
      items: body.offer_ids.map((offerId) => {
        const item = structuredClone(fixture.items[0]);
        item.offer_id = offerId;
        item.data.offer_id = offerId;
        item.data.product_url = `https://detail.1688.com/offer/${offerId}.html`;
        return item;
      }),
    });
  });
  const list = Array.from({ length: 14 }, (_, i) => String(800000000000 + i));
  const result = await client.collectItemDetails(list, async () => {});
  assert.equal(calls.length, 7);
  assert.equal(new Set(calls.map((c) => c.host)).size, 6);
  assert.equal(result.records.length, 70);
});

test("detail auth errors are fatal, unauthorized IDs never transmit and caller cancellation propagates", async () => {
  let calls = 0;
  const client = new Lan1688ImageSearch("test-only", 1000, async () => {
    calls++;
    return new Response(null, { status: 403 });
  });
  await assert.rejects(
    client.collectItemDetails(["https://attacker.invalid"], async () => {}),
    { code: "invalid_payload" },
  );
  assert.equal(calls, 0);
  await assert.rejects(
    client.collectItemDetails(ids, async () => {}),
    { code: "permission_denied", retryable: false },
  );
  assert.equal(calls, 1);
  const controller = new AbortController();
  const reason = new Error("canceled");
  controller.abort(reason);
  await assert.rejects(
    client.collectItemDetails(ids, async () => {}, controller.signal),
    (error) => error === reason,
  );
  assert.equal(calls, 1);
});

test("API SKU packaging retains source units and cannot contaminate product matching text", () => {
  const fields = records()[0].payload.fields,
    view = sourcingSkuFacts(fields);
  assert.equal(view.sku_id, "5855334264484");
  assert.equal(view.packages[0].weight, 120);
  assert.equal(view.package_units.weight, "g");
  const facts = supplyFacts(rows(records()))[0],
    text = supplyDetailText(facts);
  assert.match(text, /pu/);
  assert.doesNotMatch(text, /120|24|13|14/);
});

test("newer unmatched detail prevents stale SKU or image prices from returning", () => {
  const raw = records()[0],
    old = rows([raw])[0];
  const newer = {
    ...old,
    payload_json: {
      ...raw.payload.fields,
      record_type: "offer_detail_unselected",
      observed_at: "2026-10-20T11:00:00Z",
      price: null,
      sku_id: null,
    },
  };
  assert.deepEqual(supplyFacts([old, newer]), []);
});

test("separate SKU colors from one offer never satisfy three independent P75 samples", () => {
  const base = {
    title: "iPhone 16 Pro Max phone case",
    price: 8,
    currency: "CNY",
    observedAt: new Date(observed),
    evidenceId: "e",
    externalId: "123",
    skuId: "1",
    detailComplete: true,
    priceAmount: 1,
    stock: 5,
    skuProperties: [{ name: "型号", value: "iPhone 16 Pro Max" }],
  };
  assert.equal(
    selectConservativeSupplyMatch("iPhone 16 Pro Max phone case", [
      base,
      { ...base, skuId: "2" },
      { ...base, skuId: "3" },
    ]),
    null,
  );
  const match = selectConservativeSupplyMatch("iPhone 16 Pro Max phone case", [
    base,
    { ...base, externalId: "124" },
    { ...base, externalId: "125" },
  ]);
  assert.equal(match.sampleCount, 3);
  assert.equal(
    selectConservativeSupplyMatch("iPhone 15 Pro Max phone case", [
      base,
      { ...base, externalId: "124" },
      { ...base, externalId: "125" },
    ]),
    null,
  );
});

test("SKU attribute citations can establish a real quote without accepting another SKU or a component", () => {
  const item = supplyFacts(rows(records()))[0];
  const product = "Waterproof PU makeup bag",
    ref = supplySourceRef(item);
  const candidate = { source_ref: ref, title: item.title, details: supplyDetailText(item) };
  const classification = {
    source_ref: ref,
    relation: "compatible",
    rationale: "明确同类材质功能",
    attributes: [
      { kind: "product_type", product_excerpt: "makeup bag", supply_excerpt: "化妆包" },
      { kind: "material", product_excerpt: "PU", supply_excerpt: "pu" },
      { kind: "function", product_excerpt: "Waterproof", supply_excerpt: "防水" },
    ],
  };
  const context = {
    input: { product_ref: "amazon:test", product_title: product, candidates: [candidate] },
    classifications: [classification],
  };
  assert.equal(
    selectClassifiedSupplyQuote("amazon:test", product, [item], context).conservativePrice,
    7.8,
  );
  assert.equal(
    selectClassifiedSupplyQuote("amazon:test", product, [{ ...item, skuId: "999" }], context),
    null,
  );
  assert.equal(
    selectClassifiedSupplyQuote("amazon:test", product, [{ ...item, priceAmount: 2 }], context),
    null,
  );
  assert.equal(
    selectClassifiedSupplyQuote(
      "amazon:test",
      product,
      [{ ...item, priceDescription: "新人价" }],
      context,
    ),
    null,
  );
});

test("one failed appliance can fail over while the other five batches remain in flight", async () => {
  const calls = [];
  const client = new Lan1688ImageSearch("test-only", 1000, async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push(url);
    if (new URL(url).hostname === "192.168.1.221") return new Response(null, { status: 503 });
    await new Promise((resolve) => setTimeout(resolve, 5));
    return Response.json({
      ...fixture,
      total: body.offer_ids.length,
      succeeded: body.offer_ids.length,
      items: body.offer_ids.map((offerId) => {
        const value = structuredClone(fixture.items[0]);
        value.offer_id = offerId;
        value.data.offer_id = offerId;
        value.data.product_url = `https://detail.1688.com/offer/${offerId}.html`;
        return value;
      }),
    });
  });
  const result = await client.collectItemDetails(
    Array.from({ length: 12 }, (_, i) => String(800000000000 + i)),
    async () => {},
  );
  assert.equal(result.records.length, 60);
  assert.ok(calls.length >= 7);
});

test("completion rechecks the exact offer, SKU, price, quantity and source evidence", async () => {
  const evidence = rows(records());
  const proof = {
    purchase_source_type: "automatic_crawler_evidence",
    purchase_confirmation_mode: "automatic_evidence",
    purchase_source_ref_id: `1688:${ids[0]}:sku:5855334264484:classified-details:v1`,
    supply_evidence_id: "raw-0",
    supply_offer_id: ids[0],
    purchase_price: 7.8,
  };
  const parameters = ["op", "org", "workspace"];
  const connection = {
    query: async (sql, args) => {
      assert.deepEqual(args, parameters);
      if (sql === automaticPrimaryEvidenceSql)
        return [
          [
            {
              raw_evidence_id: "main",
              observed_at: observed,
              payload_json: { title: "Waterproof PU makeup bag", price: 20, currency: "USD" },
            },
          ],
        ];
      if (sql === automaticPrimaryDetailEvidenceSql) return [[]];
      assert.equal(sql, automaticSupplyEvidenceSql);
      return [evidence];
    },
  };
  assert.equal(await automaticSupplyCompletionQuoteValid(connection, parameters, proof), true);
  for (const change of [
    { purchase_price: 0.01 },
    { supply_evidence_id: "raw-1" },
    { purchase_source_ref_id: `1688:${ids[0]}:sku:999:classified-details:v1` },
    { purchase_source_ref_id: `1688:${ids[0]}:sku:garbage` },
  ]) {
    assert.equal(
      await automaticSupplyCompletionQuoteValid(connection, parameters, { ...proof, ...change }),
      false,
    );
  }
  evidence[0].payload_json.price_amount = 2;
  assert.equal(await automaticSupplyCompletionQuoteValid(connection, parameters, proof), false);
  assert.equal(
    await automaticSupplyCompletionQuoteValid(connection, parameters, {
      ...proof,
      purchase_confirmation_mode: "human_review",
    }),
    true,
  );
});

test("SKU projection retains the selected quote and specification without duplicating its image offer", async () => {
  const { MySqlSourcingProjectionWorker } =
    await import("../../apps/worker/dist/sourcing-projection-worker.js");
  const selected = records()[0].payload.fields;
  const calls = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {},
    async query(sql, args) {
      calls.push({ sql, args });
      if (sql.startsWith("SELECT * FROM sourcing_projection_jobs"))
        return [
          [
            {
              id: "job",
              organization_id: "org",
              workspace_id: "workspace",
              search_id: "search",
              request_id: "request",
              trace_id: "trace",
              attempt_count: 0,
            },
          ],
        ];
      if (sql.startsWith("SELECT collection_task_id")) return [[{ collection_task_id: "task" }]];
      if (sql.startsWith("SELECT n.*"))
        return [
          [
            {
              id: "image",
              provider_id: "1688",
              raw_evidence_id: "image-evidence",
              payload_json: { ...selected, record_type: "search_offer", price_eligible: false },
            },
            {
              id: "sku",
              provider_id: "1688",
              raw_evidence_id: "sku-evidence",
              payload_json: selected,
            },
          ],
        ];
      return [{ affectedRows: 1 }];
    },
  };
  const worker = new MySqlSourcingProjectionWorker(
    { getConnection: async () => connection },
    "worker",
    120,
    () => new Date(observed),
  );
  const result = await worker.processOnce();
  assert.equal(result.candidate_count, 1);
  const inserts = calls.filter(({ sql }) =>
    sql.startsWith("INSERT IGNORE INTO sourcing_candidates"),
  );
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].args[5], "sku");
  assert.equal(inserts[0].args[6], "sku-evidence");
  assert.equal(inserts[0].args[10], selected.specification);
  assert.equal(inserts[0].args[12], 7.8);
  assert.equal(inserts[0].args[14], selected.location);
  assert.ok(!JSON.parse(inserts[0].args[17]).includes("specification"));
});

test("detail 409/429 Retry-After stops fanout and prevents requests during the declared cooldown", async () => {
  for (const status of [409, 429]) {
    let calls = 0;
    const client = new Lan1688ImageSearch("test-only", 1000, async () => {
      calls++;
      return new Response(null, { status, headers: { "Retry-After": "300" } });
    });
    const offers = Array.from({ length: 12 }, (_, i) => String(800000000000 + i));
    await assert.rejects(
      client.collectItemDetails(offers, async () => {}),
      { code: "rate_limited" },
    );
    assert.ok(calls > 0 && calls <= 6);
    const previous = calls;
    await assert.rejects(
      client.collectItemDetails(offers, async () => {}),
      { code: "rate_limited" },
    );
    assert.equal(calls, previous);
    await assert.rejects(
      client.collectEnriched(image, async () => {}),
      { code: "rate_limited" },
    );
    assert.equal(calls, previous);
  }
});
