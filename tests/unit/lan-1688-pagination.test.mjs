import test from "node:test";
import assert from "node:assert/strict";
import {
  Lan1688ImageSearch,
  LAN_1688_COLLECTION_LIMIT,
} from "../../packages/provider-sources/dist/index.js";

const image = "https://m.media-amazon.com/images/I/test.jpg";
const pageResult = (page, options = {}) => ({
  success: true,
  begin_page: page,
  has_more: true,
  items: Array.from({ length: 60 }, (_, index) => ({
    offerId: String(page * 1000 + index),
    title: "真实候选标题",
    shop_name: "真实供应商",
    price: 15,
    min_order_quantity: 1,
  })),
  ...options,
});

test("normal collection follows only one advertised page with original four-field requests", async () => {
  const calls = [];
  const client = new Lan1688ImageSearch("test-only", 1000, async (url, options) => {
    const request = JSON.parse(options.body);
    calls.push({ url, request });
    assert.deepEqual(Object.keys(request).sort(), [
      "begin_page",
      "image_url",
      "page_size",
      "result_limit",
    ]);
    assert.equal(request.page_size, 60);
    assert.equal(request.result_limit, 60);
    return Response.json(pageResult(request.begin_page));
  });
  let heartbeats = 0;
  const value = await client.collect(image, async () => {
    heartbeats++;
  });
  assert.equal(LAN_1688_COLLECTION_LIMIT, 120);
  assert.deepEqual(
    calls.map((c) => c.request.begin_page),
    [1, 2],
  );
  assert.equal(calls[0].url, calls[1].url);
  assert.equal(value.records.length, 120);
  assert.equal(value.nextCursor, null);
  assert.equal(heartbeats, 4);
  const record = value.records[60];
  assert.equal(record.payload.fields.external_id, "2000");
  assert.equal(JSON.parse(record.payload.raw_content).offerId, "2000");
  assert.equal(record.payload.source_paths.quoted_price, "$.price");
});

test("empty, terminal and legacy responses never invent a next page", async () => {
  for (const options of [{ has_more: false }, { has_more: undefined }, { items: [] }]) {
    let calls = 0;
    const client = new Lan1688ImageSearch("test-only", 1000, async () => {
      calls++;
      return Response.json(pageResult(1, options));
    });
    await client.collect(image, async () => {});
    assert.equal(calls, 1);
  }
});

test("page overlap retains the first observed offer rather than counting it twice", async () => {
  const client = new Lan1688ImageSearch("test-only", 1000, async (_url, options) => {
    const page = JSON.parse(options.body).begin_page;
    return Response.json(
      pageResult(page, {
        items: [{ offerId: "123", title: "实际商品", shop_name: "供应商", price: page }],
      }),
    );
  });
  const value = await client.collect(image, async () => {});
  assert.equal(value.records.length, 1);
  assert.equal(value.records[0].payload.fields.price, 1);
});

test("wrong page identity and non-boolean continuation fail without fallback or partial facts", async () => {
  for (const bad of [{ begin_page: 1 }, { has_more: "true" }]) {
    let calls = 0;
    const client = new Lan1688ImageSearch("test-only", 1000, async (_url, options) => {
      calls++;
      const page = JSON.parse(options.body).begin_page;
      return Response.json(pageResult(page, page === 2 ? bad : {}));
    });
    await assert.rejects(
      client.collect(image, async () => {}),
      { code: "invalid_payload", retryable: false },
    );
    assert.equal(calls, 2);
  }
});

test("page-two authorization failure never returns page-one facts or tries another host", async () => {
  let calls = 0;
  const client = new Lan1688ImageSearch("test-only", 1000, async () =>
    ++calls === 1 ? Response.json(pageResult(1)) : new Response(null, { status: 403 }),
  );
  await assert.rejects(
    client.collect(image, async () => {}),
    { code: "permission_denied", retryable: false },
  );
  assert.equal(calls, 2);
});

test("health checks retain one page per appliance even when more pages exist", async () => {
  const pages = [];
  const client = new Lan1688ImageSearch("test-only", 1000, async (_url, options) => {
    pages.push(JSON.parse(options.body).begin_page);
    return Response.json(pageResult(1));
  });
  await client.checkPoolHealth(image, new AbortController().signal);
  assert.equal(pages.length, 6);
  assert.ok(pages.every((page) => page === 1));
});

test("cancellation after page one prevents page two and returns no partial batch", async () => {
  const controller = new AbortController();
  let calls = 0,
    beats = 0;
  const reason = new Error("collection canceled");
  const client = new Lan1688ImageSearch("test-only", 1000, async () => {
    calls++;
    return Response.json(pageResult(1));
  });
  await assert.rejects(
    client.collect(
      image,
      async () => {
        if (++beats === 2) controller.abort(reason);
      },
      controller.signal,
    ),
    (error) => error === reason,
  );
  assert.equal(calls, 1);
});

test("retryable page-two failure discards the partial node and restarts at page one", async () => {
  const calls = [];
  const client = new Lan1688ImageSearch("test-only", 1000, async (url, options) => {
    const page = JSON.parse(options.body).begin_page;
    calls.push({ url, page });
    if (calls.length === 2) return new Response(null, { status: 503 });
    return Response.json(
      pageResult(page, {
        items: [
          {
            offerId: calls.length <= 2 ? "111" : String(200 + page),
            title: "实际商品",
            shop_name: "供应商",
            price: 15,
          },
        ],
      }),
    );
  });
  const value = await client.collect(image, async () => {});
  assert.deepEqual(
    calls.map((call) => call.page),
    [1, 2, 1, 2],
  );
  assert.notEqual(calls[0].url, calls[2].url);
  assert.deepEqual(
    value.records.map((r) => r.payload.fields.external_id),
    ["201", "202"],
  );
});
