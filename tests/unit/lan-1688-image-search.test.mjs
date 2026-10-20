import test from "node:test";
import assert from "node:assert/strict";
import {
  Lan1688ImageSearch,
  LAN_1688_ENDPOINTS,
  LAN_1688_RESULT_LIMIT,
  parseLan1688Result,
} from "../../apps/worker/dist/lan-1688-image-search.js";
import { MySqlSourcingProjectionWorker } from "../../apps/worker/dist/sourcing-projection-worker.js";
import { MySqlSourcingRepository } from "../../apps/api/dist/mysql-sourcing-repository.js";
import { ProviderSourceExecutor } from "../../apps/worker/dist/provider-source-executor.js";

const image = "https://m.media-amazon.com/images/I/test.jpg";
const result = {
  success: true,
  items: [
    {
      offerId: "835520608338",
      title: "旅行化妆包",
      shop_name: "箱包厂",
      price: "3.8",
      price_description: "新人价",
      min_order_quantity: 1,
      monthly_sales: null,
      shipping_fee: null,
      sales_quantity: "19200",
    },
  ],
};
const fullPage = {
  ...result,
  items: Array.from({ length: 60 }, (_, index) => ({
    ...result.items[0],
    offerId: String(835520608338 + index),
  })),
};

test("1688 exhausted rate-limited nodes retain the existing retry classification", async () => {
  for (const statuses of [Array(6).fill(429), [429, 503, 503, 503, 503, 503]]) {
    let calls = 0,
      canceled = 0;
    const client = new Lan1688ImageSearch("test-only", 1000, async () => {
      const response = new Response(null, { status: statuses[calls++] });
      Object.defineProperty(response, "body", {
        value: {
          cancel: async () => {
            canceled++;
          },
        },
      });
      return response;
    });
    await assert.rejects(
      client.collect(image, async () => {}),
      {
        code: "rate_limited",
        retryable: true,
      },
    );
    assert.equal(calls, 6);
    assert.equal(canceled, 6);
  }
});

test("1688 pool health retains rate limits without masking fatal failures or healthy failover", async () => {
  for (const [statuses, expected] of [
    [[503, 429, 503, 503, 503, 503], "rate_limited"],
    [[429, 403, 503, 503, 503, 503], "permission_denied"],
    [[503, 503, 503, 503, 503, 503], "dependency_unavailable"],
  ]) {
    let calls = 0;
    const client = new Lan1688ImageSearch(
      "test-only",
      1000,
      async () => new Response(null, { status: statuses[calls++] }),
    );
    await assert.rejects(client.checkPoolHealth(image, new AbortController().signal), {
      code: expected,
    });
    assert.equal(calls, 6);
  }
  let calls = 0;
  const client = new Lan1688ImageSearch("test-only", 1000, async () =>
    ++calls === 1 ? new Response(null, { status: 429 }) : Response.json(result),
  );
  assert.equal((await client.collect(image, async () => {})).records.length, 1);
  assert.equal(calls, 2);
});

test("LAN 429 reaches the Worker rate-limit cooldown without persisting supplier facts", async () => {
  const provider = {
    id: "source",
    code: "1688_search",
    access_mode: "authenticated_browser",
    target_url: "https://s.1688.com/selloffer/offer_search.htm",
    parser_version: "1688-browser-contract-v3",
    timeout_ms: 20000,
    fields_json: ["title"],
    status: "enabled",
    runtime_circuit_state: "closed",
    created_by: "actor",
    circuit_failure_threshold: 5,
  };
  const query = async (sql) =>
    sql.includes("FROM providers p")
      ? [[provider]]
      : sql.startsWith("SELECT")
        ? [[]]
        : [{ affectedRows: 1 }];
  const pool = {
    query,
    getConnection: async () => ({
      query,
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release() {},
    }),
  };
  let persisted = 0;
  const client = new Lan1688ImageSearch(
    "test-only",
    1000,
    async () => new Response(null, { status: 429 }),
  );
  const executor = new ProviderSourceExecutor(
    pool,
    {},
    {
      persist: async () => {
        persisted++;
        throw new Error("unexpected supplier facts");
      },
    },
    "worker",
    undefined,
    undefined,
    client,
  );
  const started = Date.now();
  await assert.rejects(
    executor.execute(
      {
        id: "task",
        organizationId: "org",
        workspaceId: "workspace",
        requestId: "request",
        traceId: "trace",
        subqueries: [
          { id: "query", providerId: "source", required: true, target: { image_url: image } },
        ],
      },
      async () => {},
    ),
    (error) => {
      assert.equal(error.code, "rate_limited");
      assert.ok(error.rateLimitResetAt instanceof Date);
      assert.ok(error.rateLimitResetAt.getTime() >= started + 300000);
      return true;
    },
  );
  assert.equal(persisted, 0);
});

test("1688 retains a full verified page and rejects an over-limit response", async () => {
  const client = new Lan1688ImageSearch("test-only", 1000, async (_url, options) => {
    assert.equal(JSON.parse(options.body).result_limit, 60);
    return Response.json(fullPage);
  });
  const collected = await client.collect(image, async () => {});
  assert.equal(LAN_1688_RESULT_LIMIT, 60);
  assert.equal(collected.records.length, 60);
  assert.equal(new Set(collected.records.map((record) => record.externalId)).size, 60);
  assert.equal(collected.records[59].payload.fields.monthly_sales, null);
  assert.equal(collected.records[59].payload.fields.price_description, "新人价");
  const last = collected.records[59].payload,
    raw = JSON.parse(last.raw_content);
  assert.equal(last.source_paths.title, "$.title");
  assert.equal(last.source_paths.quoted_price, "$.price");
  assert.equal(last.source_paths.external_id, "$.offerId");
  assert.equal(raw[last.source_paths.title.slice(2)], last.fields.title);
  assert.equal(Number(raw[last.source_paths.quoted_price.slice(2)]), last.fields.quoted_price);
  assert.equal(last.source_paths.currency, "$", "fixed currency is derived from the offer context");
  assert.equal(last.source_paths.sku_id, "$", "absent fields must not claim a raw key exists");
  assert.throws(() =>
    parseLan1688Result(
      { ...fullPage, items: [...fullPage.items, fullPage.items[0]] },
      "2026-10-17",
    ),
  );
});
test("1688 keeps actual quote qualifications and unknown fields", () => {
  const [record] = parseLan1688Result(result, "2026-10-16T00:00:00.000Z");
  assert.equal(record.payload.fields.quoted_price, 3.8);
  assert.equal(record.payload.fields.price_description, "新人价");
  assert.equal(record.payload.fields.monthly_sales, null);
  assert.equal(record.payload.fields.shipping_fee, null);
  assert.equal(record.payload.fields.sales_quantity, 19200);
  assert.equal(record.payload.canonical_url, "https://detail.1688.com/offer/835520608338.html");
  assert.throws(() => parseLan1688Result({ success: false, items: [] }, "2026-10-16"));
  assert.throws(() => parseLan1688Result({ success: true, items: [{}] }, "2026-10-16"));
});
test("1688 rotates nodes and fails over with the same four request fields", async () => {
  const calls = [];
  let heartbeats = 0;
  const client = new Lan1688ImageSearch("test-only", 1000, async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) throw new Error("connection refused");
    return Response.json(result);
  });
  assert.equal(
    (
      await client.collect(image, async () => {
        heartbeats++;
      })
    ).records.length,
    1,
  );
  assert.deepEqual(
    calls.map((c) => c.url),
    LAN_1688_ENDPOINTS.slice(0, 2),
  );
  assert.equal(calls[1].options.redirect, "error");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    image_url: image,
    begin_page: 1,
    page_size: 60,
    result_limit: 60,
  });
  assert.equal(heartbeats, 3);
});
test("1688 never transmits tokens to user-supplied endpoints or redirects", async () => {
  let calls = 0;
  const client = new Lan1688ImageSearch("test-only", 1000, async () => {
    calls++;
    return new Response(null, { status: 401 });
  });
  await assert.rejects(client.collect("http://127.0.0.1/private", async () => {}));
  assert.equal(calls, 0);
  await assert.rejects(
    client.collect(image, async () => {}),
    { code: "permission_denied" },
  );
  assert.equal(calls, 1);
});
test("1688 bounds malformed and excessive responses", async () => {
  const client = new Lan1688ImageSearch(
    "test-only",
    1000,
    async () => new Response("x".repeat(2 * 1024 * 1024 + 1)),
  );
  await assert.rejects(
    client.collect(image, async () => {}),
    { code: "invalid_payload" },
  );
});
test("1688 uses another appliance for concurrent calls", async () => {
  let release;
  const hold = new Promise((resolve) => {
    release = resolve;
  });
  const urls = [];
  const client = new Lan1688ImageSearch("test-only", 1000, async (url) => {
    urls.push(url);
    if (urls.length === 1) await hold;
    return Response.json(result);
  });
  const first = client.collect(image, async () => {});
  await new Promise((resolve) => setImmediate(resolve));
  await client.collect(image, async () => {});
  release();
  await first;
  assert.equal(new Set(urls).size, 2);
});
test("1688 evidence projects to supplier candidates through the scoped current task", async () => {
  const calls = [];
  const now = new Date("2026-10-16T00:00:00Z");
  const [record] = parseLan1688Result(result, now.toISOString());
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
              id: "normalized",
              provider_id: "1688",
              raw_evidence_id: "evidence",
              payload_json: record.payload.fields,
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
    () => now,
  );
  const projected = await worker.processOnce();
  assert.equal(projected.candidate_count, 1);
  const query = calls.find((c) => c.sql.startsWith("SELECT n.*"));
  assert.match(query.sql, /p.code='1688_search'/);
  assert.match(query.sql, /n.organization_id=l.organization_id AND n.workspace_id=l.workspace_id/);
  assert.deepEqual(query.args, ["task", "org", "workspace"]);
  const insert = calls.find((c) => c.sql.startsWith("INSERT IGNORE INTO sourcing_candidates"));
  assert.equal(insert.args[11], 3.8);
  assert.equal(insert.args[12], "CNY");
});
test("LAN JSON evidence is never labelled as a browser DOM capture", async () => {
  for (const pages of [1, 2]) {
    const provider = {
      id: "source",
      code: "1688_search",
      access_mode: "authenticated_browser",
      target_url: "https://s.1688.com/selloffer/offer_search.htm",
      parser_version: "1688-browser-contract-v3",
      timeout_ms: 20000,
      fields_json: ["title"],
      status: "enabled",
      runtime_circuit_state: "closed",
      created_by: "actor",
      circuit_failure_threshold: 5,
    };
    const query = async (sql) =>
      sql.includes("FROM providers p")
        ? [[provider]]
        : sql.startsWith("SELECT")
          ? [[]]
          : [{ affectedRows: 1 }];
    const pool = {
      query,
      getConnection: async () => ({
        query,
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release() {},
      }),
    };
    const stored = [];
    const registry = {
      normalize: (_code, raw, context) => ({
        external_id: raw.externalId,
        observed_at: raw.observedAt,
        canonical_url: raw.payload.canonical_url,
        fields: raw.payload.fields,
        evidence_ref: raw.evidenceRef,
        provenance: {
          adapter_version: "old-browser",
          parser_version: context.provider.parserVersion,
        },
      }),
    };
    const client = new Lan1688ImageSearch("test-only", 1000, async (url, options) => {
      const body = JSON.parse(options.body);
      if (url.endsWith("/item-detail"))
        return Response.json({
          success: true,
          complete: true,
          partial: false,
          failed: 0,
          incomplete: 0,
          total: body.offer_ids.length,
          succeeded: body.offer_ids.length,
          items: body.offer_ids.map((offerId) => {
            const skuId = String(900000000000 + Number(offerId) - 835520608338);
            return {
              offer_id: offerId,
              success: true,
              data: {
                offer_id: offerId,
                title: "旅行化妆包",
                product_url: `https://detail.1688.com/offer/${offerId}.html`,
                complete: true,
                status: "PUBLISHED",
                missing_fields: [],
                attributes: [],
                shop: { companyName: "箱包厂" },
                price: { min_order_quantity: 1, unit: "个" },
                sku_count: 1,
                skus: [
                  {
                    sku_id: skuId,
                    price: "9",
                    price_source: "original.price",
                    price_amount: 1,
                    stock: 5,
                    spec_attrs: "黑色",
                    properties: [{ name: "颜色", value: "黑色" }],
                    packages: [],
                    source_data: { skuId, price: "9" },
                  },
                ],
              },
            };
          }),
        });
      const page = body.begin_page;
      return Response.json({
        ...fullPage,
        begin_page: page,
        has_more: page < pages,
        items: fullPage.items.map((item, index) => ({
          ...item,
          offerId: String(835520608338 + (page - 1) * 60 + index),
          sku_id: String(900000000000 + (page - 1) * 60 + index),
        })),
      });
    });
    const executor = new ProviderSourceExecutor(
      pool,
      registry,
      {
        persist: async (input) => {
          stored.push(input);
          return { deduplicated: false };
        },
      },
      "worker",
      undefined,
      undefined,
      client,
    );
    await executor.execute(
      {
        id: "task",
        organizationId: "org",
        workspaceId: "workspace",
        requestId: "request",
        traceId: "trace",
        subqueries: [
          { id: "query", providerId: "source", required: true, target: { image_url: image } },
        ],
      },
      async () => {},
    );
    assert.equal(stored.length, pages * 120);
    assert.equal(new Set(stored.map((row) => row.normalizedPayload.external_id)).size, pages * 60);
    assert.equal(stored[0].parserVersion, "1688-lan-image-detail-context-v1");
    assert.equal(stored[0].adapterVersion, "1688-lan-image-detail-context-v1");
    assert.equal(stored[0].contentType, "application/json");
    assert.match(stored[0].content.toString(), /新人价/);
    for (const evidence of stored) {
      const price = evidence.provenance.find((item) => item.fieldPath === "quoted_price");
      assert.match(price.sourcePath, /price$/);
      assert.equal(
        price.transformVersion,
        evidence.normalizedPayload.record_type === "offer_sku_detail"
          ? "1688-lan-item-detail-v1"
          : "1688-lan-image-detail-context-v1",
      );
      assert.equal(
        Number(
          price.sourcePath
            .replace(/\[(\d+)\]/g, ".$1")
            .split(".")
            .slice(1)
            .reduce((value, key) => value[key], JSON.parse(evidence.content)),
        ),
        evidence.normalizedPayload.quoted_price,
      );
    }
  }
});
test("image searches dispatch only to enabled 1688 and never silently substitute another supplier", async () => {
  const calls = [];
  const pool = {
    query: async () => [[]],
    getConnection: async () => ({
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release() {},
      query: async (sql, args) => {
        calls.push({ sql, args });
        return [
          sql.startsWith("SELECT id FROM providers") ? [{ id: "lan-source" }] : { affectedRows: 1 },
        ];
      },
    }),
  };
  const repository = new MySqlSourcingRepository(pool);
  await repository.createSearch({
    id: "search",
    taskId: "task",
    organizationId: "org",
    workspaceId: "workspace",
    actorId: "actor",
    route: "/sourcing",
    idempotencyKey: "key",
    requestId: "request",
    traceId: "trace",
    value: { input_type: "image", input_ref: image },
  });
  const inserted = calls.find((c) => c.sql.startsWith("INSERT INTO collection_subqueries"));
  assert.ok(inserted);
  assert.ok(inserted.args.includes("lan-source"));
  const target = inserted.args.find((v) => typeof v === "string" && v.startsWith("{"));
  assert.equal(JSON.parse(target).image_url, image);
});
