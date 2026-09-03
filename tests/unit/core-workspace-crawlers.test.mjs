import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BUILTIN_PROVIDER_SOURCES,
  parseAmazonProductPage,
  parseDhgateSupplierSearchPage,
  parseEc21SupplierSearchPage,
  parseMadeInChinaSearchPage,
  AmazonProductSearchAdapter,
  Ec21SupplierSearchAdapter,
  MadeInChinaSearchAdapter,
} from "../../packages/provider-sources/dist/index.js";

const withTransactionConnection = (pool) => ({
  ...pool,
  getConnection: async () => ({
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: pool.query,
  }),
});

test("core workspace public crawlers are enabled without official API credentials", () => {
  const amazon = BUILTIN_PROVIDER_SOURCES.find((item) => item.code === "amazon_product");
  const supplier = BUILTIN_PROVIDER_SOURCES.find((item) => item.code === "made_in_china_search");
  assert.equal(amazon?.access_mode, "public_page");
  assert.equal(amazon?.status, "enabled");
  assert.equal(amazon?.availability, "manual");
  assert.equal(amazon?.parser_version, "amazon-structured-product-v2");
  assert.ok(amazon?.fields.includes("rating_value"));
  assert.equal(supplier?.access_mode, "public_page");
  assert.equal(supplier?.availability, "manual");
  assert.equal(
    BUILTIN_PROVIDER_SOURCES.find((item) => item.code === "ec21_supplier_search")?.access_mode,
    "public_page",
  );
  assert.equal(
    BUILTIN_PROVIDER_SOURCES.find((item) => item.code === "dhgate_supplier_search")?.status,
    "enabled",
  );
});

test("DHgate supplier parser preserves store price currency and product evidence", () => {
  const html = [
    '<html><body><div class="gitem" itemcode="1086031311">',
    '<a class="pic" supplierid="supplier-1" itemcode="1086031311" ',
    'href="https://www.dhgate.com/product/storage-box/1086031311.html?sku=1">',
    '<img src="//img.dhresource.com/box.jpg" alt="Foldable Storage Box"></a>',
    '<p class="name"><a href="https://www.dhgate.com/product/storage-box/1086031311.html">',
    "Foldable <strong>Storage</strong> Box</a></p>",
    '<div class="pro-price"><strong>US $7.34 - 8.75</strong>/ Piece</div>',
    '<div class="pro-store"><a href="https://www.dhgate.com/store/1" ',
    'supplierid="supplier-1"><i></i>Box Factory</a></div></div></body></html>',
  ].join("");
  const [record] = parseDhgateSupplierSearchPage(
    html,
    "https://www.dhgate.com/wholesale/storage-box.html",
    5,
  );
  assert.equal(record.externalId, "1086031311");
  assert.equal(record.payload.fields.supplier_name, "Box Factory");
  assert.equal(record.payload.fields.price, 7.34);
  assert.equal(record.payload.fields.currency, "USD");
  assert.equal(record.payload.fields.moq, null);
  assert.equal(
    record.payload.canonical_url,
    "https://www.dhgate.com/product/storage-box/1086031311.html",
  );
});

test("EC21 fallback parser preserves supplier price MOQ and product URL", () => {
  const html = [
    '<html><body><li class="galleryLs positionR"><div class="front"><h2 class="pdtName">',
    '<a href="https://www.ec21.com/product-details/Foldable-Storage-Box--123.html">',
    'Foldable <strong>Storage</strong> Box</a></h2><img src="https://image.ec21.com/box.jpg" itemprop="image">',
    '<ol><li itemprop="offers"><span itemprop="priceCurrency" content="USD">US$</span>',
    '<span itemprop="price">3.5</span></li><li><span class="pr5">3000</span>',
    '<span class="pr5">Set</span>(Min. Order)</li><li class="pdtCompany">',
    '<a title="Ningbo Storage Co., Ltd.">Ningbo Storage Co., Ltd.</a></li></ol></div></li></body></html>',
  ].join("");
  const [record] = parseEc21SupplierSearchPage(
    html,
    "https://www.ec21.com/ec-market/storage-box.html",
    5,
  );
  assert.equal(record.payload.fields.supplier_name, "Ningbo Storage Co., Ltd.");
  assert.equal(record.payload.fields.price, 3.5);
  assert.equal(record.payload.fields.moq, 3000);
  assert.match(record.payload.canonical_url, /ec21\.com\/product-details/);
});

test("supplier adapters accept proxy responses whose native url field is empty", async () => {
  const ec21Html = [
      '<html><body><li class="galleryLs"><h2 class="pdtName">',
      '<a href="https://www.ec21.com/product-details/Box--123.html">Storage Box</a></h2>',
      '<span itemprop="priceCurrency" content="USD"></span><span itemprop="price">3.5</span>',
      '<li class="pdtCompany"><a title="Box Factory"></a></li></li></body></html>',
    ].join(""),
    micProduct = {
      "@type": "Product",
      name: "Storage Box",
      offers: {
        lowPrice: "3.2",
        priceCurrency: "USD",
        seller: { name: "Box Factory" },
      },
    },
    micHtml = [
      '<html><head><script type="application/ld+json">',
      JSON.stringify(micProduct),
      '</script></head><body><a href="https://box.en.made-in-china.com/product/abc.html">',
      "box</a></body></html>",
    ].join(""),
    response = (html) =>
      new Response(html, { status: 200, headers: { "content-type": "text/html" } });
  assert.equal(
    (
      await new Ec21SupplierSearchAdapter(async () => response(ec21Html)).collect(
        { target: { query: "storage box" }, limit: 1 },
        AbortSignal.timeout(1000),
      )
    ).records.length,
    1,
  );
  assert.equal(
    (
      await new MadeInChinaSearchAdapter(async () => response(micHtml)).collect(
        { target: { query: "storage box" }, limit: 1 },
        AbortSignal.timeout(1000),
      )
    ).records.length,
    1,
  );
});

test("Made-in-China verification redirects are classified as captcha instead of parser drift", async () => {
  const adapter = new MadeInChinaSearchAdapter(async () =>
    Object.defineProperty(new Response("<html><title>请验证</title></html>"), "url", {
      value: "https://captcha.made-in-china.com/verification.html",
    }),
  );
  await assert.rejects(
    adapter.collect({ target: { query: "storage box" }, limit: 1 }, AbortSignal.timeout(1000)),
    (error) => error?.code === "captcha" && error?.retryable === false,
  );
});

test("Amazon product parser preserves real listing metrics and evidence URL", () => {
  const html = [
    '<html><body><div data-component-type="s-search-result" data-asin="B0ABCDEF12">',
    '<h2><a href="/dp/B0ABCDEF12"><span>Foldable Storage Box</span></a></h2>',
    '<span class="a-price"><span class="a-offscreen">$29.99</span></span>',
    '<span aria-label="4.6 out of 5 stars"></span><span aria-label="1,234 ratings"></span>',
    '<img class="s-image" src="https://images.example/box.jpg"></div></body></html>',
  ].join("");
  const [record] = parseAmazonProductPage(html, "https://www.amazon.com/s?k=storage+box", 5);
  assert.equal(record.externalId, "B0ABCDEF12");
  assert.equal(record.payload.fields.price, 29.99);
  assert.equal(record.payload.fields.currency, "USD");
  assert.equal(record.payload.fields.rating_value, 4.6);
  assert.equal(record.payload.fields.review_count, 1234);
  assert.equal(record.payload.canonical_url, "https://www.amazon.com/dp/B0ABCDEF12");
});

test("Amazon product parser preserves the response currency instead of forcing USD", () => {
  const html = [
    '<html><body><div data-component-type="s-search-result" data-asin="B0CNYPRC01">',
    '<h2><a href="/dp/B0CNYPRC01"><span>Portable Storage Box</span></a></h2>',
    '<span class="a-price"><span class="a-offscreen">CNY&nbsp;181.41</span></span>',
    '<img class="s-image" src="https://images.example/cny-box.jpg"></div></body></html>',
  ].join("");
  const [record] = parseAmazonProductPage(html, "https://www.amazon.com/s?k=storage+box", 1);
  assert.equal(record.payload.fields.price, 181.41);
  assert.equal(record.payload.fields.currency, "CNY");
});

test("Amazon adapter keeps injected transports for deterministic replay and reports v4", async () => {
  let requestedUrl = "";
  const adapter = new AmazonProductSearchAdapter(async (url) => {
    requestedUrl = String(url);
    return new Response(
      '<html><body><div data-component-type="s-search-result" data-asin="B0ABCDEF12">' +
        '<h2><a href="/dp/B0ABCDEF12"><span>Storage Box</span></a></h2>' +
        '<span class="a-price"><span class="a-offscreen">$29.99</span></span>' +
        '<img class="s-image" src="https://images.example/box.jpg"></div></body></html>',
      { status: 200 },
    );
  });
  const result = await adapter.collect(
    { target: { query: "storage box" }, limit: 1 },
    AbortSignal.timeout(1000),
  );
  assert.equal(adapter.version, "amazon-structured-product-adapter-v4");
  assert.match(requestedUrl, /^https:\/\/www\.amazon\.com\/s\?k=storage%20box$/);
  assert.equal(result.records.length, 1);
});

test("Amazon adapter confirms a transient source change once before failing closed", async () => {
  let recoveredCalls = 0;
  const recovered = new AmazonProductSearchAdapter(async () => {
      recoveredCalls += 1;
      return new Response(
        recoveredCalls === 1
          ? "<html><body><p>Temporary incomplete response</p></body></html>"
          : '<html><body><div data-component-type="s-search-result" data-asin="B0ABCDEF12">' +
              "<h2><span>Storage Box</span></h2>" +
              '<span class="a-price"><span class="a-offscreen">$29.99</span></span>' +
              '<img class="s-image" src="https://images.example/box.jpg"></div></body></html>',
        { status: 200 },
      );
    }),
    recoveredResult = await recovered.collect(
      { target: { query: "storage box" }, limit: 1 },
      AbortSignal.timeout(1000),
    );
  assert.equal(recoveredCalls, 2);
  assert.equal(recoveredResult.records[0].externalId, "B0ABCDEF12");

  let failedCalls = 0;
  const failed = new AmazonProductSearchAdapter(async () => {
    failedCalls += 1;
    return new Response("<html><body><p>Still incomplete</p></body></html>", { status: 200 });
  });
  await assert.rejects(
    () => failed.collect({ target: { query: "storage box" }, limit: 1 }, AbortSignal.timeout(1000)),
    (error) => error?.code === "source_changed" && error?.retryable === false,
  );
  assert.equal(failedCalls, 2);
});

test("Amazon product links that no longer exist close as empty results instead of permission denial", async () => {
  const adapter = new AmazonProductSearchAdapter(
    async () => new Response("not found", { status: 404 }),
  );
  await assert.rejects(
    () =>
      adapter.collect(
        { target: { page_url: "https://www.amazon.com/dp/B000000000" }, limit: 1 },
        AbortSignal.timeout(1000),
      ),
    (error) => error?.code === "empty_result" && error?.retryable === false,
  );
});

test("Amazon product parser prefers versioned JSON-LD product facts", () => {
  const product = {
      "@context": "https://schema.org",
      "@type": "Product",
      sku: "B0ZYXWV987",
      name: "Structured Storage Box",
      url: "https://www.amazon.com/dp/B0ZYXWV987?ref_=search",
      image: ["https://images.example/structured-box.jpg"],
      offers: {
        "@type": "Offer",
        price: "31.50",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
      aggregateRating: { ratingValue: "4.8", reviewCount: "2,345" },
    },
    html = [
      '<html><head><script type="application/ld+json">',
      JSON.stringify(product),
      '</script></head><body><div data-component-type="s-search-result" ',
      'data-asin="B0FALLBACK1"><h2><span>Fallback title</span></h2></div></body></html>',
    ].join(""),
    [record] = parseAmazonProductPage(html, "https://www.amazon.com/s?k=storage+box", 5);
  assert.equal(record.externalId, "B0ZYXWV987");
  assert.equal(record.payload.content_type, "application/ld+json");
  assert.equal(record.payload.fields.price, 31.5);
  assert.equal(record.payload.fields.currency, "USD");
  assert.equal(record.payload.fields.rating_value, 4.8);
  assert.equal(record.payload.fields.review_count, 2345);
  assert.equal(record.payload.fields.availability, "instock");
  assert.equal(record.payload.canonical_url, "https://www.amazon.com/dp/B0ZYXWV987");
  assert.match(record.payload.source_paths.title, /jsonld/);
});

test("public supplier parser keeps missing MOQ truthful instead of inventing a value", () => {
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Plastic Storage Box",
    image: "https://images.example/supplier-box.jpg",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "3.20",
      priceCurrency: "USD",
      seller: { "@type": "Organization", name: "Guangdong Box Factory" },
    },
  };
  const html = [
    '<html><head><script type="application/ld+json">',
    JSON.stringify(product),
    '</script></head><body><a href="https://box-factory.en.made-in-china.com/product/abc123.html">',
    "product</a></body></html>",
  ].join("");
  const [record] = parseMadeInChinaSearchPage(
    html,
    "https://www.made-in-china.com/products-search/hot-china-products/Storage_Box.html",
    5,
  );
  assert.equal(record.payload.fields.supplier_name, "Guangdong Box Factory");
  assert.equal(record.payload.fields.price, 3.2);
  assert.equal(record.payload.fields.moq, null);
  assert.match(record.payload.canonical_url, /made-in-china\.com\/product\//);
});

test("core workspace migration is MySQL 5.7 compatible and keeps crawler projections auditable", async () => {
  const [up, down, enable, structuredParser] = await Promise.all([
    readFile("database/migrations/0044e_core_collection_projection.up.sql", "utf8"),
    readFile("database/migrations/0044e_core_collection_projection.down.sql", "utf8"),
    readFile("database/migrations/0044f_enable_amazon_public_crawler.up.sql", "utf8"),
    readFile("database/migrations/0052a_amazon_structured_parser.up.sql", "utf8"),
  ]);
  assert.match(up, /core_collection_projection_runs/);
  assert.match(enable, /amazon_product/);
  assert.match(structuredParser, /amazon-structured-product-v2/);
  assert.match(down, /DROP TABLE IF EXISTS `core_collection_projection_runs`/);
  assert.doesNotMatch(up, /CHECK\s*\(|utf8mb4_0900|JSON_TABLE|WITH\s+RECURSIVE/i);
  assert.doesNotMatch(structuredParser, /CHECK\s*\(|utf8mb4_0900|JSON_TABLE|WITH\s+RECURSIVE/i);
});

test("core list pages expose explicit detail and operational actions", async () => {
  const [tasks, opportunities, competitors, sourcing] = await Promise.all(
    [
      ["TaskWorkspace.vue", "TaskListPanel.vue", "TaskDetailPanel.vue"],
      "OpportunityWorkspace.vue",
      "CompetitorMonitor.vue",
      ["SourcingWorkspace.vue", "SourcingComparisonPanel.vue"],
    ].map((name) =>
      Array.isArray(name)
        ? Promise.all(name.map((file) => readFile(`apps/web/src/components/${file}`, "utf8"))).then(
            (parts) => parts.join("\n"),
          )
        : readFile(`apps/web/src/components/${name}`, "utf8"),
    ),
  );
  assert.match(tasks, /查看详情.*删除/s);
  assert.match(opportunities, /采集 Amazon 竞品.*采集公开供应商/s);
  assert.match(competitors, /立即采集.*采集快照.*删除竞品监控/s);
  assert.match(sourcing, /重新采集.*删除找货记录/s);
  assert.match(sourcing, /供应商报价对比历史/);
});

test("opportunity summaries reuse crawled Amazon images and real downstream counts", async () => {
  const repository = await readFile("apps/api/src/mysql-opportunity-repository.ts", "utf8");
  assert.match(repository, /RIGHT\(s\.source_ref_id,36\)/);
  assert.match(repository, /JSON_EXTRACT\(n\.payload_json,'\$\.image_url'\)/);
  assert.match(repository, /competitor_count/);
  assert.match(repository, /supplier_candidate_count/);
});

test("core crawler entrypoints reject enabled providers whose compliance review is missing or expired", async () => {
  const [competitor, sourcing] = await Promise.all([
    readFile("apps/api/src/mysql-competitor-repository.ts", "utf8"),
    readFile("apps/api/src/mysql-sourcing-repository.ts", "utf8"),
  ]);
  for (const repository of [competitor, sourcing]) {
    assert.match(repository, /terms_review_status='approved'/);
    assert.match(repository, /terms_reference_url IS NOT NULL/);
    assert.match(repository, /terms_version IS NOT NULL/);
    assert.match(repository, /terms_expires_at>NOW\(3\)/);
  }
});

test("sourcing lists show opportunity names while retaining internal trace ids", async () => {
  const [repository, workspace] = await Promise.all([
    readFile("apps/api/src/mysql-sourcing-repository.ts", "utf8"),
    readFile("apps/web/src/components/SourcingWorkspace.vue", "utf8"),
  ]);
  assert.match(
    repository,
    /COALESCE\(o\.name,s\.input_ref\) ELSE (?:(?:["'`]\s*\+\s*["'`])?)s\.input_ref END display_name/,
  );
  assert.match(repository, /CONVERT\(o\.id USING utf8mb4\) COLLATE utf8mb4_unicode_ci/);
  assert.match(workspace, /searchName\(item\)[\s\S]*机会编号 \{\{ selected\.input_ref \}\}/);
  assert.match(workspace, /opportunity: "选品机会"[\s\S]*succeeded_empty: "未找到可用候选"/);
});

test("collection worker quarantines exhausted queue entries without blocking fresh crawls", async () => {
  const worker = (
    await Promise.all(
      ["collection-task-state-machine.ts", "collection-task-dead-letter.ts"].map((name) =>
        readFile(`apps/worker/src/${name}`, "utf8"),
      ),
    )
  ).join("\n");
  assert.match(worker, /status='queued' AND attempt_count>=4/);
  assert.match(worker, /collection_attempt_overflow/);
  assert.match(worker, /status='queued' AND attempt_count<4/);
  assert.match(worker, /retry_exhausted:\s*true/);
});

test("dynamic product crawls use task-scoped evidence keys and auditable record versions", async () => {
  const [executor, persistence] = await Promise.all([
    readFile("apps/worker/src/provider-source-executor.ts", "utf8"),
    readFile("apps/worker/src/evidence-persistence.ts", "utf8"),
  ]);
  assert.match(executor, /VERSIONED_PRODUCT_SOURCES[\s\S]*amazon_product/);
  assert.match(executor, /VERSIONED_PRODUCT_SOURCES[\s\S]*1688_search/);
  assert.match(executor, /task_id: task\.id, external_id: normalized\.external_id/);
  assert.match(persistence, /findExistingRecord\(connection, value\)/);
  assert.match(persistence, /SET status='superseded'/);
  assert.match(persistence, /previousRecord \? Number\(previousRecord\.record_version\) \+ 1 : 1/);
  assert.match(persistence, /supersedes_record_id: previousRecord\.record_id/);
});

test("automatic downstream tasks use crawler contracts and recover malformed historic tasks", async () => {
  const worker = (
    await Promise.all(
      ["trend-projection-worker.ts", "trend-projection-persistence.ts"].map((name) =>
        readFile(`apps/worker/src/${name}`, "utf8"),
      ),
    )
  ).join("\n");
  assert.match(worker, /page_url: String\(row\.product_url\)/);
  assert.match(worker, /page_url: canonicalUrl/);
  assert.match(worker, /JSON_EXTRACT\(q\.target_json,'\$\.page_url'\).*IS NOT NULL/s);
  assert.match(
    worker,
    /CHAR_LENGTH\(JSON_UNQUOTE\(JSON_EXTRACT\(q\.target_json,'\$\.query'\)\)\) BETWEEN 1 AND 300/,
  );
  assert.match(worker, /query: buildSupplierSearchQuery\(String\(row\.name\)\)/);
  assert.match(worker, /query: buildSupplierSearchQuery\(title\)/);
  assert.match(worker, /query_contract: "supplier-keywords-v2"/);
});

test("adapter failures keep their source error across duplicated package instances", async () => {
  const { classifyProviderAdapterFailure } =
    await import("../../packages/provider-adapters/dist/index.js");
  const failure = Object.assign(new Error("source_changed"), {
    name: "ProviderAdapterFailure",
    code: "source_changed",
    retryable: false,
  });
  assert.deepEqual(classifyProviderAdapterFailure(failure), {
    code: "source_changed",
    retryable: false,
    status: "degraded",
  });
});

test("RSS execution distinguishes empty success, parse failure and no new content", async () => {
  const [{ ProviderSourceExecutor }, { ProviderAdapterFailure }] = await Promise.all([
      import("../../apps/worker/dist/provider-source-executor.js"),
      import("../../packages/provider-adapters/dist/index.js"),
    ]),
    provider = {
      id: "55555555-5555-4555-8555-555555555559",
      code: "rss-result-kind-test",
      access_mode: "public_rss",
      target_url: "https://example.test/feed.xml",
      parser_version: "rss-result-kind-v1",
      timeout_ms: 20000,
      fields_json: ["title"],
      status: "enabled",
      circuit_failure_threshold: 3,
      terms_review_status: "approved",
      terms_reference_url: "https://example.test/terms",
      terms_version: "2026-08",
      terms_expires_at: "2099-08-31T00:00:00.000Z",
      created_by: "66666666-6666-4666-8666-666666666666",
    },
    completedEvents = [],
    pool = {
      query: async (sql, values = []) => {
        if (sql.includes("FROM providers p")) return [[provider]];
        if (sql.startsWith("SELECT state,consecutive_failures")) return [[]];
        if (sql.includes("INSERT INTO collection_task_events"))
          completedEvents.push(JSON.parse(values[8]));
        return [{ affectedRows: 1 }];
      },
    },
    record = {
      externalId: "rss-existing-item",
      observedAt: "2026-08-22T01:00:00.000Z",
      evidenceRef: "syndication-feed:rss-existing-item",
      payload: {
        raw_content: "<item><title>Existing</title></item>",
        content_type: "application/rss+xml",
        canonical_url: "https://example.test/existing",
        fields: { title: "Existing" },
        source_paths: { title: "rss.item.title" },
      },
    },
    task = {
      id: "33333333-3333-4333-8333-333333333339",
      organizationId: "11111111-1111-4111-8111-111111111111",
      workspaceId: "22222222-2222-4222-8222-222222222222",
      attemptCount: 1,
      requestId: "rss-result-kind",
      traceId: "rss-result-kind",
      leaseToken: "unused",
      subqueries: [
        {
          id: "44444444-4444-4444-8444-444444444449",
          providerId: provider.id,
          ordinal: 0,
          required: false,
          target: {},
        },
      ],
    };
  let scenario = "empty";
  const registry = {
      collect: async () => {
        if (scenario === "empty") throw new ProviderAdapterFailure("empty_result", true);
        if (scenario === "parse") throw new ProviderAdapterFailure("invalid_payload", false);
        return { records: [record], nextCursor: null };
      },
      normalize: (_code, raw, context) => ({
        external_id: raw.externalId,
        observed_at: raw.observedAt,
        canonical_url: raw.payload.canonical_url,
        fields: raw.payload.fields,
        evidence_ref: raw.evidenceRef,
        provenance: {
          provider_id: context.provider.id,
          adapter_key: context.provider.code,
          adapter_version: "rss-result-kind-adapter-v1",
          parser_version: context.provider.parserVersion,
        },
      }),
    },
    evidence = {
      persist: async () => ({
        evidence_id: "existing-evidence",
        normalized_record_id: "existing-record",
        deduplicated: true,
      }),
    },
    executor = new ProviderSourceExecutor(
      withTransactionConnection(pool),
      registry,
      evidence,
      "rss-result-kind-test",
    );

  let [outcome] = await executor.execute(task, async () => {});
  assert.deepEqual(
    {
      status: outcome.status,
      errorCode: outcome.errorCode,
      resultKind: outcome.resultKind,
    },
    { status: "succeeded_empty", errorCode: null, resultKind: "empty_success" },
  );
  scenario = "parse";
  [outcome] = await executor.execute(task, async () => {});
  assert.deepEqual(
    {
      status: outcome.status,
      errorCode: outcome.errorCode,
      resultKind: outcome.resultKind,
    },
    { status: "failed", errorCode: "parse_failed", resultKind: "parse_failed" },
  );
  scenario = "duplicate";
  [outcome] = await executor.execute(task, async () => {});
  assert.deepEqual(
    {
      status: outcome.status,
      availableResultCount: outcome.availableResultCount,
      resultKind: outcome.resultKind,
      freshResultCount: outcome.freshResultCount,
      deduplicatedResultCount: outcome.deduplicatedResultCount,
    },
    {
      status: "succeeded_empty",
      availableResultCount: 0,
      resultKind: "no_new_content",
      freshResultCount: 0,
      deduplicatedResultCount: 1,
    },
  );
  assert.deepEqual(
    completedEvents.slice(-3).map((event) => event.result_kind),
    ["empty_success", "parse_failed", "no_new_content"],
  );
});

test("optional supplier failure keeps the second public crawler running", async () => {
  const [{ ProviderSourceExecutor }, { ProviderAdapterFailure }] = await Promise.all([
    import("../../apps/worker/dist/provider-source-executor.js"),
    import("../../packages/provider-adapters/dist/index.js"),
  ]);
  const providerRows = {
    mic: {
      id: "55555555-5555-4555-8555-555555555551",
      code: "made_in_china_search",
      access_mode: "public_page",
      target_url: "https://www.made-in-china.com/",
      parser_version: "mic-v1",
      timeout_ms: 20000,
      fields_json: ["title"],
      status: "enabled",
      terms_review_status: "approved",
      terms_reference_url: "https://example.test/terms",
      terms_version: "2026-08",
      terms_expires_at: "2099-08-31T00:00:00.000Z",
      created_by: "66666666-6666-4666-8666-666666666666",
    },
    ec21: {
      id: "55555555-5555-4555-8555-555555555552",
      code: "ec21_supplier_search",
      access_mode: "public_page",
      target_url: "https://www.ec21.com/",
      parser_version: "ec21-v1",
      timeout_ms: 20000,
      fields_json: ["title"],
      status: "enabled",
      terms_review_status: "approved",
      terms_reference_url: "https://example.test/terms",
      terms_version: "2026-08",
      terms_expires_at: "2099-08-31T00:00:00.000Z",
      created_by: "66666666-6666-4666-8666-666666666666",
    },
  };
  const replayUpdates = [];
  const pool = {
    query: async (sql, values) => {
      if (sql.includes("FROM providers p"))
        return [[values[1] === providerRows.mic.id ? providerRows.mic : providerRows.ec21]];
      if (sql.includes("UPDATE provider_source_replay_runs SET status=?"))
        replayUpdates.push(values);
      return [{ affectedRows: 1 }];
    },
  };
  const collected = [];
  const registry = {
    collect: async ({ provider }) => {
      collected.push(provider.code);
      if (provider.code === "made_in_china_search")
        throw new ProviderAdapterFailure("network_error", true);
      return {
        records: [
          {
            externalId: "ec21-item",
            observedAt: "2026-08-19T10:00:00.000Z",
            evidenceRef: "ec21:item",
            payload: {
              raw_content: "<li>item</li>",
              content_type: "text/html",
              canonical_url: "https://www.ec21.com/product-details/item.html",
              fields: { title: "Storage box" },
              source_paths: { title: "ec21.html.title" },
            },
          },
        ],
        nextCursor: null,
      };
    },
    normalize: (_code, raw, context) => ({
      external_id: raw.externalId,
      observed_at: raw.observedAt,
      canonical_url: raw.payload.canonical_url,
      fields: raw.payload.fields,
      evidence_ref: raw.evidenceRef,
      provenance: {
        provider_id: context.provider.id,
        adapter_key: context.provider.code,
        adapter_version: "test-v1",
        parser_version: context.provider.parserVersion,
      },
    }),
  };
  const evidence = {
    persist: async () => ({
      evidence_id: "evidence",
      normalized_record_id: "normalized",
      deduplicated: false,
    }),
  };
  const executor = new ProviderSourceExecutor(
    withTransactionConnection(pool),
    registry,
    evidence,
    "supplier-fallback-test",
  );
  const outcomes = await executor.execute(
    {
      id: "33333333-3333-4333-8333-333333333333",
      organizationId: "11111111-1111-4111-8111-111111111111",
      workspaceId: "22222222-2222-4222-8222-222222222222",
      attemptCount: 1,
      requestId: "supplier-fallback",
      traceId: "supplier-fallback",
      leaseToken: "unused",
      subqueries: [
        {
          id: "44444444-4444-4444-8444-444444444441",
          providerId: providerRows.mic.id,
          ordinal: 0,
          required: false,
          target: { query: "storage box" },
        },
        {
          id: "44444444-4444-4444-8444-444444444442",
          providerId: providerRows.ec21.id,
          ordinal: 1,
          required: false,
          target: { query: "storage box" },
        },
      ],
    },
    async () => {},
  );
  assert.deepEqual(collected, ["made_in_china_search", "ec21_supplier_search"]);
  assert.equal(outcomes[0].status, "failed");
  assert.equal(outcomes[1].status, "succeeded");
  assert.deepEqual(replayUpdates[0]?.slice(0, 3), ["completed_with_warnings", 1, "network_error"]);
});

test("required non-retryable login failure blocks the collection task", async () => {
  const [{ ProviderSourceExecutor }, { ProviderAdapterFailure }] = await Promise.all([
    import("../../apps/worker/dist/provider-source-executor.js"),
    import("../../packages/provider-adapters/dist/index.js"),
  ]);
  const provider = {
    id: "55555555-5555-4555-8555-555555555553",
    code: "authenticated-test",
    access_mode: "public_page",
    target_url: "https://example.com/",
    parser_version: "test-v1",
    timeout_ms: 20000,
    fields_json: ["title"],
    status: "enabled",
    terms_review_status: "approved",
    terms_reference_url: "https://example.com/terms",
    terms_version: "2026-08",
    terms_expires_at: "2099-08-31T00:00:00.000Z",
    created_by: "66666666-6666-4666-8666-666666666666",
  };
  const pool = {
    query: async (sql) => (sql.includes("FROM providers p") ? [[provider]] : [{ affectedRows: 1 }]),
  };
  const registry = {
    collect: async () => {
      throw new ProviderAdapterFailure("login_required", false);
    },
  };
  const executor = new ProviderSourceExecutor(
    withTransactionConnection(pool),
    registry,
    {},
    "required-login-test",
  );
  await assert.rejects(
    executor.execute(
      {
        id: "33333333-3333-4333-8333-333333333334",
        organizationId: "11111111-1111-4111-8111-111111111111",
        workspaceId: "22222222-2222-4222-8222-222222222222",
        attemptCount: 1,
        requestId: "required-login",
        traceId: "required-login",
        leaseToken: "unused",
        subqueries: [
          {
            id: "44444444-4444-4444-8444-444444444443",
            providerId: provider.id,
            ordinal: 0,
            required: true,
            target: { query: "storage box" },
          },
        ],
      },
      async () => {},
    ),
    (error) => error?.name === "CollectionExecutionError" && error.code === "login_required",
  );
});

test("required disabled source fails instead of being reported as an empty success", async () => {
  const { ProviderSourceExecutor } =
    await import("../../apps/worker/dist/provider-source-executor.js");
  const pool = {
    query: async (sql) =>
      sql.includes("FROM providers p")
        ? [[{ id: "source", status: "disabled" }]]
        : [{ affectedRows: 1 }],
  };
  const executor = new ProviderSourceExecutor(
    withTransactionConnection(pool),
    {},
    {},
    "required-disabled-test",
  );
  await assert.rejects(
    executor.execute(
      {
        id: "33333333-3333-4333-8333-333333333336",
        organizationId: "11111111-1111-4111-8111-111111111111",
        workspaceId: "22222222-2222-4222-8222-222222222222",
        attemptCount: 1,
        requestId: "required-disabled",
        traceId: "required-disabled",
        leaseToken: "unused",
        subqueries: [
          {
            id: "44444444-4444-4444-8444-444444444445",
            providerId: "source",
            ordinal: 0,
            required: true,
            target: {},
          },
        ],
      },
      async () => {},
    ),
    (error) => error?.name === "CollectionExecutionError" && error.code === "permission_denied",
  );
});

test("explicit 1688 acceptance target runs while disabled without widening automatic collection", async () => {
  const { ProviderSourceExecutor } =
    await import("../../apps/worker/dist/provider-source-executor.js");
  const provider = {
    id: "55555555-5555-4555-8555-555555555568",
    code: "1688_search",
    access_mode: "authenticated_browser",
    target_url: "https://s.1688.com/selloffer/offer_search.htm",
    parser_version: "1688-browser-contract-v3",
    timeout_ms: 20_000,
    fields_json: ["title"],
    status: "disabled",
    circuit_failure_threshold: 5,
    runtime_circuit_state: "closed",
    created_by: "66666666-6666-4666-8666-666666666666",
  };
  const pool = {
    query: async (sql) =>
      sql.includes("FROM providers p")
        ? [[provider]]
        : sql.includes("SELECT state,consecutive_failures")
          ? [[]]
          : [{ affectedRows: 1 }],
  };
  let browserInput;
  const executor = new ProviderSourceExecutor(
    withTransactionConnection(pool),
    {},
    {},
    "1688-acceptance-worker",
    {
      collect: async (input) => {
        browserInput = input;
        return {
          browserJobId: "browser-job",
          records: [],
          artifacts: [],
          parseError: null,
        };
      },
    },
  );
  const outcomes = await executor.execute(
    {
      id: "33333333-3333-4333-8333-333333333368",
      organizationId: "11111111-1111-4111-8111-111111111111",
      workspaceId: "22222222-2222-4222-8222-222222222222",
      attemptCount: 1,
      requestId: "1688-acceptance-worker",
      traceId: "1688-acceptance-worker",
      leaseToken: "unused",
      subqueries: [
        {
          id: "44444444-4444-4444-8444-444444444468",
          providerId: provider.id,
          ordinal: 0,
          required: true,
          target: { query: "桌面灯", acceptance_run: true },
        },
      ],
    },
    async () => {},
  );
  assert.equal(outcomes[0].status, "succeeded_empty");
  assert.deepEqual(browserInput.target, { query: "桌面灯", acceptance_run: true });
});

test("crawler lease limits disabled-provider jobs to the marked 1688 acceptance purpose", async () => {
  const source = await readFile(
    new URL("../../apps/api/src/mysql-crawler-runtime-repository.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /v\.status='enabled' OR \(v\.code='1688_search'[\s\S]*JSON_UNQUOTE\(JSON_EXTRACT\(j\.execution_request_json,'\$\.purpose'\)\)='acceptance'/,
  );
  assert.doesNotMatch(
    await readFile(
      new URL("../../apps/worker/src/automatic-source-scheduler.ts", import.meta.url),
      "utf8",
    ),
    /acceptance_run/,
  );
});

test("parser drift pauses the provider before failing the required source", async () => {
  const [{ ProviderSourceExecutor }, { ProviderAdapterFailure }] = await Promise.all([
    import("../../apps/worker/dist/provider-source-executor.js"),
    import("../../packages/provider-adapters/dist/index.js"),
  ]);
  const provider = {
    id: "55555555-5555-4555-8555-555555555554",
    code: "drift-test",
    access_mode: "public_page",
    target_url: "https://example.com/",
    parser_version: "test-v1",
    timeout_ms: 20000,
    fields_json: ["title"],
    status: "enabled",
    terms_review_status: "approved",
    terms_reference_url: "https://example.com/terms",
    terms_version: "2026-08",
    terms_expires_at: "2099-08-31T00:00:00.000Z",
    version: 4,
    created_by: "66666666-6666-4666-8666-666666666666",
  };
  const statements = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, values) => {
      statements.push([sql, values]);
      assert.equal([...sql.matchAll(/\?/g)].length, values.length, `placeholder mismatch: ${sql}`);
      if (sql.startsWith("SELECT * FROM providers")) return [[provider]];
      return [{ affectedRows: 1 }];
    },
  };
  const pool = {
    query: async (sql) => (sql.includes("FROM providers p") ? [[provider]] : [{ affectedRows: 1 }]),
    getConnection: async () => connection,
  };
  const registry = {
    collect: async () => {
      throw new ProviderAdapterFailure("source_changed", false);
    },
  };
  const executor = new ProviderSourceExecutor(pool, registry, {}, "parser-drift-test");
  await assert.rejects(
    executor.execute(
      {
        id: "33333333-3333-4333-8333-333333333335",
        organizationId: "11111111-1111-4111-8111-111111111111",
        workspaceId: "22222222-2222-4222-8222-222222222222",
        attemptCount: 1,
        requestId: "parser-drift",
        traceId: "parser-drift",
        leaseToken: "unused",
        subqueries: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            providerId: provider.id,
            ordinal: 0,
            required: true,
            target: { query: "storage box" },
          },
        ],
      },
      async () => {},
    ),
    (error) => error?.name === "CollectionExecutionError" && error.code === "source_changed",
  );
  assert.ok(statements.some(([sql]) => sql.includes("SET status='disabled'")));
  assert.ok(statements.some(([sql]) => sql.includes("INSERT INTO provider_versions")));
  assert.ok(statements.some(([sql]) => sql.includes("provider.parser_drift.auto_paused")));
});
