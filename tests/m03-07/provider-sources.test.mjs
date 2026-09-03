import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import {
  GoogleNewsRssAdapter,
  ManualProductSupplyCsvAdapter,
  BUILTIN_PROVIDER_SOURCES,
  createBuiltinSourceAdapters,
  createProviderSourceFetch,
  decodeProviderProxyResponseBody,
  parseGoogleNewsRss,
  parseProductSupplyCsv,
  parseSyndicationFeed,
  sourceEvidencePayload,
} from "../../packages/provider-sources/dist/index.js";
import { ProviderAdapterRegistry } from "../../packages/provider-adapters/dist/index.js";
const ids = {
    provider: "00000000-0000-4000-8000-000000000b71",
    org: "00000000-0000-4000-8000-000000000b72",
    ws: "00000000-0000-4000-8000-000000000b73",
  },
  rss = [
    '<?xml version="1.0"?><rss version="2.0"><channel><item>',
    "<title><![CDATA[Foldable desk lamp - Example News]]></title>",
    "<link>https://news.google.com/rss/articles/desk-lamp</link>",
    '<guid isPermaLink="false">desk-lamp-guid</guid>',
    "<pubDate>Fri, 07 Aug 2026 12:00:00 GMT</pubDate>",
    '<description><![CDATA[<a href="https://example.test">Compact lamp demand rises</a>]]></description>',
    '<source url="https://example.test">Example News</source></item></channel></rss>',
  ].join(""),
  csv = [
    "external_id,title,price,currency,supplier_name,moq,canonical_url,observed_at",
    [
      "SKU-100,Foldable Desk Lamp,12.50,USD,Example Supplier,100,",
      "https://example.test/products/sku-100,2026-08-07T12:00:00Z",
    ].join(""),
    "",
  ].join("\n");
test("M03-07.A01/A02/A12 catalog contains 100+ truthful channels and parsers preserve provenance", () => {
  assert.ok(BUILTIN_PROVIDER_SOURCES.length >= 100);
  assert.equal(
    new Set(BUILTIN_PROVIDER_SOURCES.map((item) => item.code)).size,
    BUILTIN_PROVIDER_SOURCES.length,
  );
  assert.ok(
    ["news", "ecommerce", "data", "community", "product_supply"].every((category) =>
      BUILTIN_PROVIDER_SOURCES.some((item) => item.category === category),
    ),
  );
  assert.ok(
    BUILTIN_PROVIDER_SOURCES.filter((item) => item.availability === "automatic").length >= 80,
  );
  assert.ok(BUILTIN_PROVIDER_SOURCES.some((item) => item.availability === "setup_required"));
  assert.ok(BUILTIN_PROVIDER_SOURCES.some((item) => item.availability === "manual"));
  const news = parseGoogleNewsRss(rss, 20),
    products = parseProductSupplyCsv(csv, 20);
  assert.equal(news.length, 1);
  assert.equal(products.length, 1);
  assert.equal(sourceEvidencePayload(news[0]).source_paths.publisher, "rss.item.source");
  assert.equal(sourceEvidencePayload(products[0]).fields.moq, 100);
  assert.throws(
    () => parseProductSupplyCsv(csv.replace("currency", "money"), 20),
    /csv_header_invalid/,
  );
  assert.throws(() => parseGoogleNewsRss("<html></html>", 20), /invalid_payload/);
});
test("M03-07.A09/A10/A12 project proxy is scoped to the fixed automatic-source allowlist and never becomes a global proxy", async () => {
  const calls = [],
    before = { http: process.env.HTTP_PROXY, https: process.env.HTTPS_PROXY };
  const direct = async (input) => {
    calls.push({ transport: "direct", url: String(input) });
    return new Response("direct");
  };
  const tunnel = async (url, _init, proxy) => {
    calls.push({
      transport: "proxy",
      url: url.toString(),
      proxyUrl: proxy.url,
      username: proxy.username,
      password: proxy.password,
    });
    return new Response(rss, { status: 200, headers: { "content-type": "application/xml" } });
  };
  const fetcher = createProviderSourceFetch(
    {
      url: "http://192.0.2.10:7893/",
      username: "project-user",
      password: "project-secret",
      connectTimeoutMs: 5000,
    },
    { directFetch: direct, tunnelFetch: tunnel },
    ["news.google.com", "www.reddit.com"],
  );
  await fetcher("https://news.google.com/rss/search?q=product");
  await fetcher("https://www.reddit.com/r/france/.rss");
  await fetcher("https://example.test/not-a-provider");
  assert.deepEqual(
    calls.map((call) => call.transport),
    ["proxy", "proxy", "direct"],
  );
  assert.equal(calls[0].proxyUrl, "http://192.0.2.10:7893/");
  assert.equal(process.env.HTTP_PROXY, before.http);
  assert.equal(process.env.HTTPS_PROXY, before.https);
});
test("M03-07 proxy transport decodes bounded gzip and syndication parser accepts RDF feeds", () => {
  const html = Buffer.from("<html><body>Amazon</body></html>"),
    compressed = gzipSync(html);
  assert.deepEqual(decodeProviderProxyResponseBody(compressed, "gzip"), html);
  assert.equal(decodeProviderProxyResponseBody(Buffer.alloc(2_000_001), null).length, 2_000_001);
  assert.throws(
    () => decodeProviderProxyResponseBody(Buffer.alloc(5 * 1024 * 1024 + 1), null),
    /exceeds 5 MiB/,
  );
  const rdf = [
      '<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" ',
      'xmlns:dc="http://purl.org/dc/elements/1.1/"><item><title>Hatena trend</title>',
      "<link>https://b.hatena.ne.jp/entry/example</link><description>Trending topic</description>",
      "<dc:date>2026-08-18T10:00:00Z</dc:date></item></rdf:RDF>",
    ].join(""),
    records = parseSyndicationFeed(rdf, "Hatena", 5);
  assert.equal(records.length, 1);
  assert.equal(records[0].payload.content_type, "application/rdf+xml");
  assert.equal(records[0].payload.fields.published_at, "2026-08-18T10:00:00.000Z");
});
test("M03-07.A04/A05/A12 adapters cover every automatic channel and keep exact configured endpoints", async () => {
  const fetcher = async () =>
      new Response(rss, { status: 200, headers: { "content-type": "application/xml" } }),
    registry = new ProviderAdapterRegistry({
      healthTimeoutMs: 1000,
      maxResponseBytes: 2_000_000,
      maxItemsPerBatch: 100,
    });
  for (const adapter of createBuiltinSourceAdapters(fetcher)) registry.register(adapter);
  const automatic = BUILTIN_PROVIDER_SOURCES.filter((item) => item.availability === "automatic");
  assert.ok(
    automatic.every((item) => registry.describe().some((adapter) => adapter.key === item.code)),
  );
  const base = { id: ids.provider, parserVersion: "v1", timeoutMs: 1000, fields: ["title"] },
    context = {
      requestId: "request-1",
      traceId: "trace-1",
      organizationId: ids.org,
      workspaceId: ids.ws,
    },
    google = BUILTIN_PROVIDER_SOURCES.find((item) => item.code === "google_news_search");
  let batch = await registry.collect({
    ...context,
    provider: {
      ...base,
      code: "google_news_search",
      accessMode: "public_rss",
      targetUrl: google.target_url,
    },
    target: { query: "desk lamp" },
    limit: 20,
  });
  assert.equal(batch.records.length, 1);
  assert.equal(
    registry.normalize("google_news_search", batch.records[0], {
      ...context,
      provider: {
        ...base,
        code: "google_news_search",
        accessMode: "public_rss",
        targetUrl: google.target_url,
      },
    }).fields.publisher,
    "Example News",
  );
  const manual = BUILTIN_PROVIDER_SOURCES.find((item) => item.code === "manual_product_supply_csv");
  batch = await registry.collect({
    ...context,
    provider: {
      ...base,
      code: "manual_product_supply_csv",
      accessMode: "import",
      targetUrl: manual.target_url,
    },
    target: { csv_text: csv },
    limit: 20,
  });
  assert.equal(
    registry.normalize("manual_product_supply_csv", batch.records[0], {
      ...context,
      provider: {
        ...base,
        code: "manual_product_supply_csv",
        accessMode: "import",
        targetUrl: manual.target_url,
      },
    }).fields.price,
    12.5,
  );
  await assert.rejects(
    () =>
      registry.collect({
        ...context,
        provider: {
          ...base,
          code: "google_news_search",
          accessMode: "public_rss",
          targetUrl: "https://evil.test/rss",
        },
        target: { query: "desk lamp" },
        limit: 20,
      }),
    /source_configuration_invalid/,
  );
});
test("M03-07.A03/A06-A11/A13-A17 delivery evidence is complete", async () => {
  const paths = [
    "database/migrations/0016g_provider_sources_m03_07.up.sql",
    "database/migrations/0016g_provider_sources_m03_07.down.sql",
    "database/migrations/0036_automatic_hotspot_sources.up.sql",
    "database/migrations/0036_automatic_hotspot_sources.down.sql",
    "database/migrations/0064_governed_workflow_confirmations.up.sql",
    "apps/worker/src/provider-source-executor.ts",
    "apps/worker/src/automatic-source-scheduler.ts",
    "apps/api/src/provider-source-service.ts",
    "apps/api/src/provider-source-routes.ts",
    "apps/api/src/mysql-provider-source-sample-review-repository.ts",
    "apps/web/src/components/ProviderSourceCenter.vue",
    "apps/web/src/components/provider-source-types.ts",
    "apps/web/src/components/ProviderParserSampleDialog.vue",
    "apps/web/src/components/ProviderParserSampleReview.vue",
    "packages/provider-sources/src/proxy-fetch.ts",
    "config/env.example",
    "config/schema.json",
    "docs/openapi.yaml",
    "docs/feature-map.json",
    "docs/architecture/m03-07-provider-sources.md",
    "docs/runbooks/m03-07-provider-sources.md",
    "tests/e2e/m03-07-provider-sources.spec.ts",
    "scripts/verify-provider-sources-live.mjs",
    "scripts/verify-automatic-hotspots-live.mjs",
    "new-product-enterprise-blueprint.md",
  ];
  const values = await Promise.all(paths.map((path) => readFile(path, "utf8"))),
    [
      up,
      down,
      automaticUp,
      automaticDown,
      governanceUp,
      executor,
      scheduler,
      service,
      routes,
      sampleReviewRepository,
      web,
      webTypes,
      sampleDialog,
      sampleReview,
      proxy,
      env,
      schema,
      openapi,
      feature,
      architecture,
      runbook,
      e2e,
      live,
      automaticLive,
      blueprint,
    ] = values,
    configurationDialog = await readFile(
      "apps/web/src/components/ProviderSourceConfigurationDialog.vue",
      "utf8",
    ),
    webSurface = `${web}\n${configurationDialog}`;
  assert.match(up, /provider_source_replay_runs/);
  assert.match(down, /DROP TABLE IF EXISTS `provider_source_replay_runs`/);
  assert.match(automaticUp, /automatic_source_schedules[\s\S]*provider_refresh_operations/);
  assert.match(automaticDown, /DROP TABLE IF EXISTS `automatic_source_schedules`/);
  assert.match(governanceUp, /review_status[\s\S]*review_version/);
  assert.match(executor, /MySqlEvidencePersistence/);
  assert.match(scheduler, /batchSize\s*=\s*16/);
  assert.match(scheduler, /provider_offset/);
  assert.match(service, /syncCatalog[\s\S]*refresh/);
  assert.match(routes, /collection:replay[\s\S]*trend:read/);
  assert.match(routes, /parser-samples\/:sampleId\/reviews/);
  assert.match(
    sampleReviewRepository,
    /parser_sample_self_review_forbidden[\s\S]*provider\.parser_sample/,
  );
  assert.match(
    `${webTypes}\n${web}`,
    /loading[\s\S]*ready[\s\S]*empty[\s\S]*error[\s\S]*expired[\s\S]*forbidden[\s\S]*blocked/,
  );
  assert.match(web, /市场热点与消费者信号[\s\S]*商品与竞品观察[\s\S]*供应链找货/);
  assert.match(web, /groupedSources[\s\S]*按业务用途分组的热点来源/);
  assert.match(webSurface, /烟测并启用/);
  assert.match(webSurface, /真实页面烟测/);
  assert.match(webSurface, /解析兼容矩阵/);
  assert.match(webSurface, /ProviderCompatibilityMatrixDialog/);
  for (const text of ["审批通过", "驳回样本", "创建人不能审批自己的样本"])
    assert.match(`${web}\n${webTypes}\n${sampleDialog}\n${sampleReview}`, new RegExp(text));
  assert.match(webSurface, /configurationPreview[\s\S]*调度同频与当前并发占用/);
  assert.doesNotMatch(webSurface, /解析合同验收前|完成解析验收后/);
  assert.match(proxy, /news\.google\.com/);
  assert.match(proxy, /Proxy-Authorization/);
  assert.match(env, /AUTOMATIC_SOURCE_SCHEDULER_POLL_MS/);
  assert.match(schema, /automaticSources/);
  assert.match(openapi, /\/provider-sources\/refresh:/);
  assert.match(openapi, /provider_source_smoke_test_required/);
  assert.match(openapi, /parser-samples\/\{sampleId\}\/reviews/);
  assert.match(feature, /100\+ code-owned hotspot/);
  assert.match(feature, /publicEnablementSmokeGate/);
  assert.match(feature, /configurationSchedulingPreview/);
  assert.match(architecture, /100 个以上[\s\S]*自动采集/);
  assert.match(runbook, /宝塔.*统一后端“ai选品”/s);
  assert.doesNotMatch(runbook, /`product-scout-api` Node 项目|`product-scout-worker` Node 项目/);
  assert.match(e2e, /toBeVisible|toHaveAttribute|keyboard\\.press/);
  assert.match(live, /news\.google\.com/);
  assert.match(live, /DELETE FROM collection_task_evidence_links WHERE organization_id=\?/);
  assert.match(live, /provider_sources_live_cleanup_failed/);
  assert.match(automaticLive, /catalog\.length < 100/);
  assert.match(automaticLive, /automatic\.length < 80/);
  assert.match(automaticLive, /MySqlAutomaticSourceScheduler/);
  assert.match(automaticLive, /manual_refresh_idempotency/);
  assert.match(automaticLive, /assertCleanup/);
  assert.match(blueprint, /100\+ 来源纠偏基线/);
});

test("1688 enablement check is a superadmin-only secondary route", async () => {
  const [routeCatalog, routes, surface] = await Promise.all(
    [
      "config/route-catalog.json",
      "apps/api/src/provider-source-routes.ts",
      "apps/web/src/components/ProviderRuntimeSurface.vue",
    ].map((path) => readFile(path, "utf8")),
  );
  const route = JSON.parse(routeCatalog).routes.find(
    (item) => item.path === "/platform-admin/providers/sources/1688-acceptance",
  );
  assert.deepEqual(route.capabilities, ["platform:superadmin"]);
  assert.equal(route.navigation, undefined);
  assert.match(
    routes,
    /1688-acceptance", async \(r, reply\) => \{[\s\S]*actor\(r, "platform:superadmin"\)/,
  );
  assert.match(surface, /v-if="capabilities\.includes\('platform:superadmin'\)"/);
  assert.match(surface, />检查启用条件</);
});
test("M03-07 fixed source adapters reject redirects or validate the final host", async () => {
  const source = await readFile("packages/provider-sources/src/adapters/index.ts", "utf8");
  assert.match(source, /redirect: "error"/);
  assert.match(source, /response\.url \|\| url/);
  assert.match(source, /response\.url\s*\|\|\s*url/);
});

test("provider source package keeps catalog parsers and adapters in separate modules", async () => {
  const [facade, catalog, parsers, adapters] = await Promise.all(
    [
      "packages/provider-sources/src/index.ts",
      "packages/provider-sources/src/catalog/index.ts",
      "packages/provider-sources/src/parsers/index.ts",
      "packages/provider-sources/src/adapters/index.ts",
    ].map((file) => readFile(file, "utf8")),
  );
  assert.match(facade, /\.\/catalog\/index\.js/);
  assert.match(facade, /\.\/parsers\/index\.js/);
  assert.match(facade, /\.\/adapters\/index\.js/);
  assert.match(catalog, /BUILTIN_PROVIDER_SOURCES/);
  assert.match(parsers, /parseAmazonProductPage/);
  assert.match(adapters, /createBuiltinSourceAdapters/);
  assert.ok(facade.split(/\r?\n/).length < 20);
});

test("API provider source repository separates catalog samples reviews and configuration versions", async () => {
  const [facade, catalog, samples, sampleReviews, versions, shared] = await Promise.all(
    [
      "apps/api/src/mysql-provider-source-repository.ts",
      "apps/api/src/mysql-provider-source-catalog-repository.ts",
      "apps/api/src/mysql-provider-source-sample-repository.ts",
      "apps/api/src/mysql-provider-source-sample-review-repository.ts",
      "apps/api/src/mysql-provider-source-version-repository.ts",
      "apps/api/src/mysql-provider-source-repository-shared.ts",
    ].map((file) => readFile(file, "utf8")),
  );
  assert.match(facade, /MySqlProviderSourceCatalogRepository/);
  assert.match(facade, /MySqlProviderSourceSampleRepository/);
  assert.match(facade, /MySqlProviderSourceSampleReviewRepository/);
  assert.match(facade, /MySqlProviderSourceVersionRepository/);
  assert.match(facade, /implements ProviderSourceRepository/);
  assert.match(catalog, /syncCatalog[\s\S]*provision/);
  assert.doesNotMatch(catalog, /provider_parser_samples|configuration_rolled_back/);
  assert.match(samples, /provider_parser_samples[\s\S]*recordParserReplay/);
  assert.doesNotMatch(samples, /configuration_rolled_back/);
  assert.match(
    sampleReviews,
    /parser_sample_self_review_forbidden[\s\S]*review_version=review_version\+1/,
  );
  assert.match(versions, /configurationVersions[\s\S]*configuration_rolled_back/);
  assert.match(shared, /providerSourceByOperation/);
  assert.ok(facade.split(/\r?\n/).length < 500);
  assert.ok(catalog.split(/\r?\n/).length < 320);
  assert.ok(samples.split(/\r?\n/).length < 700);
  assert.ok(sampleReviews.split(/\r?\n/).length < 180);
  assert.ok(versions.split(/\r?\n/).length < 520);
});

test("1688 acceptance reports login captcha and parser evidence without exposing credentials", async () => {
  const { MySqlProviderSourceRepository } =
      await import("../../apps/api/dist/mysql-provider-source-repository.js"),
    now = new Date("2026-08-21T08:00:00.000Z"),
    queries = [];
  const offer = {
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
    },
    snapshots = {
      search: {
        schema_version: "1688.search.v1",
        source_url: "https://s.1688.com/selloffer/offer_search.htm?keywords=lamp",
        observed_at: "2026-08-21T07:10:00.000Z",
        items: [offer],
      },
      offer_details: [
        {
          schema_version: "1688.offer-detail.v1",
          source_url: offer.canonical_url,
          observed_at: "2026-08-21T07:11:00.000Z",
          offer: {
            ...offer,
            specification: "白色 / USB-C",
            lead_time_days: 7,
            source_paths: {
              ...offer.source_paths,
              supplier_id: "#company[data-id]",
              specification: "#specifications",
              lead_time_days: "#delivery-time",
            },
          },
        },
      ],
    };
  const pool = {
    query: async (sql) => {
      queries.push(sql);
      if (sql.includes("FROM providers WHERE code='1688_search'"))
        return [
          [
            {
              id: "00000000-0000-4000-8000-000000001688",
              status: "disabled",
              owner_label: "平台来源中心",
              parser_version: "1688-browser-contract-v3",
            },
          ],
        ];
      if (sql.includes("FROM crawler_profiles"))
        return [[{ active_count: 1, evidence_at: new Date("2026-08-21T07:00:00.000Z") }]];
      if (sql.includes("FROM crawler_browser_runs"))
        return [
          [
            {
              status: "succeeded",
              error_code: null,
              started_at: new Date("2026-08-21T07:10:00.000Z"),
              finished_at: new Date("2026-08-21T07:12:00.000Z"),
            },
          ],
        ];
      if (sql.includes("FROM provider_parser_samples"))
        return [
          [
            {
              last_replay_status: "passed",
              review_status: "approved",
              last_replay_at: new Date("2026-08-21T07:20:00.000Z"),
              baseline_parser_version: "1688-browser-contract-v3",
              replay_parser_version: "1688-browser-contract-v3",
              replay_status: "passed",
              current_parser_passed: 1,
            },
          ],
        ];
      if (sql.includes("FROM browser_collection_jobs j LEFT JOIN crawler_browser_runs"))
        return [
          [
            {
              execution_request_json: JSON.stringify({ plan: { max_pages: 2 } }),
              result_json: JSON.stringify({ snapshots }),
              finished_at: new Date("2026-08-21T07:12:00.000Z"),
              page_count: 2,
            },
          ],
        ];
      throw new Error(`unexpected query ${sql}`);
    },
  };
  const result = await new MySqlProviderSourceRepository(pool).read1688Acceptance(now);
  assert.equal(result.overall, "ready_for_enable");
  assert.deepEqual(
    result.gates.map((gate) => gate.state),
    ["passed", "passed", "passed"],
  );
  assert.equal(result.owner_label, "平台来源中心");
  assert.deepEqual(
    result.coverage_matrix.rows.map((row) => [row.key, row.state, row.observed_count]),
    [
      ["search", "covered", 1],
      ["detail", "covered", 1],
      ["pagination", "covered", 2],
    ],
  );
  assert.equal(result.coverage_matrix.parser_version, "1688-browser-contract-v3");
  assert.deepEqual(result.pending_reasons, []);
  assert.doesNotMatch(JSON.stringify(result), /cookie|credential_asset_id|lease_token|payload/i);
  assert.match(
    queries.find((sql) => sql.includes("FROM crawler_profiles")),
    /ca\.expires_at/,
  );
  assert.match(
    queries.find((sql) => sql.includes("FROM provider_parser_samples")),
    /provider_parser_sample_replay_runs/,
  );
});

test("1688 acceptance does not misreport a stale parser replay as waiting only for approval", async () => {
  const { MySqlProviderSourceRepository } =
      await import("../../apps/api/dist/mysql-provider-source-repository.js"),
    now = new Date("2026-08-21T08:00:00.000Z");
  const pool = {
    query: async (sql) => {
      if (sql.includes("FROM providers WHERE code='1688_search'"))
        return [
          [
            {
              id: "00000000-0000-4000-8000-000000001688",
              status: "disabled",
              owner_label: "平台来源中心",
              parser_version: "1688-browser-contract-v3",
            },
          ],
        ];
      if (sql.includes("FROM crawler_profiles"))
        return [[{ active_count: 1, evidence_at: new Date("2026-08-21T07:00:00.000Z") }]];
      if (sql.includes("FROM crawler_browser_runs"))
        return [
          [
            {
              status: "succeeded",
              error_code: null,
              started_at: new Date("2026-08-21T07:10:00.000Z"),
              finished_at: new Date("2026-08-21T07:12:00.000Z"),
            },
          ],
        ];
      if (sql.includes("FROM provider_parser_samples"))
        return [
          [
            {
              last_replay_status: "passed",
              review_status: "pending",
              last_replay_at: new Date("2026-08-21T07:20:00.000Z"),
              baseline_parser_version: "1688-browser-contract-v1",
              replay_parser_version: "1688-browser-contract-v1",
              replay_status: "passed",
              current_parser_passed: 0,
            },
          ],
        ];
      if (sql.includes("FROM browser_collection_jobs j LEFT JOIN crawler_browser_runs"))
        return [[]];
      throw new Error(`unexpected query ${sql}`);
    },
  };
  const result = await new MySqlProviderSourceRepository(pool).read1688Acceptance(now);
  const parserGate = result.gates.find((gate) => gate.key === "parser");
  assert.equal(result.overall, "setup_required");
  assert.equal(parserGate.state, "pending");
  assert.match(parserGate.reason, /1688-browser-contract-v1/);
  assert.match(parserGate.reason, /1688-browser-contract-v3/);
  assert.doesNotMatch(parserGate.reason, /仍需另一名来源管理员/);
});
