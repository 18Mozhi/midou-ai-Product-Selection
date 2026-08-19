import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AUTOMATIC_PROVIDER_SOURCE_HOSTS,
  BUILTIN_PROVIDER_SOURCES,
  parseStructuredCatalogPage,
} from "../../packages/provider-sources/dist/index.js";
import { ProviderSourceService } from "../../apps/api/dist/provider-source-service.js";

test("automatic source catalog is diversified across real source families and markets", () => {
  const automatic = BUILTIN_PROVIDER_SOURCES.filter((item) => item.availability === "automatic");
  const googleNews = automatic.filter((item) => item.parser_version === "google-news-fixed-rss-v1");
  const hosts = new Set(automatic.map((item) => new URL(item.target_url).hostname));
  const categories = new Set(automatic.map((item) => item.category));
  const markets = new Set(automatic.flatMap((item) => item.markets));

  assert.ok(automatic.length >= 100, "at least 100 automatic channels must remain available");
  assert.ok(hosts.size >= 8, "automatic channels must span at least eight real source hosts");
  assert.ok(
    googleNews.length / automatic.length < 0.75,
    "Google News must not dominate the automatic catalog",
  );
  assert.deepEqual([...categories].sort(), ["community", "data", "ecommerce", "news"]);
  assert.ok(markets.size >= 10, "major-country market coverage must be explicit");
  assert.ok(AUTOMATIC_PROVIDER_SOURCE_HOSTS.includes("www.reddit.com"));
  assert.ok(AUTOMATIC_PROVIDER_SOURCE_HOSTS.includes("b.hatena.ne.jp"));
});

test("fixed marketplace page parser extracts structured product evidence without an API key", () => {
  const catalog = {
      "@type": "ItemList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          item: {
            "@type": "Product",
            name: "Portable Desk Lamp",
            url: "/dp/B0ABCDEFGHI",
            image: "/images/lamp.jpg",
            offers: { price: "29.90", priceCurrency: "USD" },
          },
        },
      ],
    },
    html =
      '<html><head><script type="application/ld+json">' +
      `${JSON.stringify(catalog)}</script></head></html>`;
  const records = parseStructuredCatalogPage(
    html,
    "https://www.amazon.com/Best-Sellers/zgbs",
    "Amazon US Best Sellers",
    20,
  );
  assert.equal(records.length, 1);
  assert.equal(records[0].payload.fields.title, "Portable Desk Lamp");
  assert.equal(records[0].payload.fields.price, 29.9);
  assert.equal(records[0].payload.fields.currency, "USD");
  assert.equal(records[0].payload.fields.image_url, "https://www.amazon.com/images/lamp.jpg");
  assert.match(records[0].evidenceRef, /^structured-public-page:/);
});

test("Shopify and eBay announcement channels use current public pages and preserve HTML evidence", () => {
  const shopify = BUILTIN_PROVIDER_SOURCES.find((item) => item.code === "feed_shopify_blog");
  const ebay = BUILTIN_PROVIDER_SOURCES.find((item) => item.code === "feed_ebay_announcements");
  assert.deepEqual(
    {
      accessMode: shopify?.access_mode,
      parser: shopify?.parser_version,
      url: shopify?.target_url,
    },
    {
      accessMode: "public_page",
      parser: "structured-public-page-v1",
      url: "https://www.shopify.com/blog",
    },
  );
  assert.deepEqual(
    {
      accessMode: ebay?.access_mode,
      parser: ebay?.parser_version,
      url: ebay?.target_url,
    },
    {
      accessMode: "public_page",
      parser: "structured-public-page-v1",
      url: "https://community.ebay.com/forum/announcements-57928/",
    },
  );

  const shopifyRecords = parseStructuredCatalogPage(
    '<html><body><a href="/blog/topics/marketing">Marketing</a><a href="/blog/how-agentic-commerce-works">How agentic commerce works</a></body></html>',
    shopify.target_url,
    shopify.name,
    20,
  );
  assert.equal(shopifyRecords.length, 1);
  assert.equal(shopifyRecords[0].payload.content_type, "text/html");
  assert.equal(shopifyRecords[0].payload.source_paths.title, "html.anchor.text");
  assert.match(shopifyRecords[0].evidenceRef, /^public-page-link:/);

  const ebayRecords = parseStructuredCatalogPage(
    '<html><body><a href="/forum/announcements-57928/topic/seller-update-123/">Seller update</a></body></html>',
    ebay.target_url,
    ebay.name,
    20,
  );
  assert.equal(ebayRecords.length, 1);
  assert.equal(ebayRecords[0].payload.content_type, "text/html");
  assert.match(ebayRecords[0].evidenceRef, /^public-page-link:/);
});

test("provider source configuration is editable through a validated audited service operation", async () => {
  let updateInput;
  const repository = {
    listProvisioned: async () => [],
    syncCatalog: async () => ({
      inserted: 0,
      updated: 0,
      automatic_enabled: 0,
      status: "synced",
    }),
    provision: async () => {
      throw new Error("not used");
    },
    replay: async () => {
      throw new Error("not used");
    },
    refresh: async () => {
      throw new Error("not used");
    },
    updateConfiguration: async (input) => {
      updateInput = input;
      return {
        id: input.providerId,
        code: "gnews_us_consumer_trends",
        status: input.status,
        version: 2,
        updated_at: input.now.toISOString(),
      };
    },
  };
  const service = new ProviderSourceService(repository, () => new Date("2026-08-18T00:00:00.000Z"));
  const result = await service.updateConfiguration(
    "00000000-0000-4000-8000-000000000111",
    {
      schedule_minutes: 30,
      timeout_ms: 15000,
      retry_limit: 2,
      status: "enabled",
      expected_version: 1,
      reason: "调整采集频率",
    },
    {
      actorId: "00000000-0000-4000-8000-000000000112",
      idempotencyKey: "source-edit-1",
      requestId: "request-source-edit",
      traceId: "trace-source-edit",
    },
  );

  assert.equal(result.version, 2);
  assert.equal(updateInput.scheduleMinutes, 30);
  assert.equal(updateInput.reason, "调整采集频率");
});

test("platform navigation exposes complete management domains and role switching", async () => {
  const shell = await readFile(
    new URL("../../apps/web/src/components/NavigationShell.vue", import.meta.url),
    "utf8",
  );
  for (const label of [
    "账号与组织",
    "人员与权限",
    "全量数据",
    "规则与自动化",
    "内容管理",
    "通知管理",
    "配额管理",
    "系统状态",
    "进入用户工作台",
  ]) {
    assert.match(shell, new RegExp(label));
  }
  assert.doesNotMatch(shell, /label: "邮箱管理"/);
  assert.doesNotMatch(shell, /path: "\/platform-admin\/email"/);
});

test("platform management and dashboard expose operational details instead of placeholder cards", async () => {
  const management = await readFile(
    new URL("../../apps/web/src/components/PlatformManagementCenter.vue", import.meta.url),
    "utf8",
  );
  const dashboard = await readFile(
    new URL("../../apps/web/src/components/PlatformDashboard.vue", import.meta.url),
    "utf8",
  );
  const main = await readFile(new URL("../../apps/web/src/main.ts", import.meta.url), "utf8");
  for (const label of ["审核热点内容", "投递", "接收邮箱", "采集任务状态"])
    assert.match(management, new RegExp(label));
  assert.match(dashboard, /采集任务成功和失败趋势折线图/);
  assert.match(main, /button\[aria-label\],a\[aria-label\]/);
  assert.match(main, /element\.title = label/);
});

test("collection task detail renders attempts events and dead-letter facts", async () => {
  const component = await readFile(
    new URL("../../apps/web/src/components/CollectionTaskCenter.vue", import.meta.url),
    "utf8",
  );
  for (const label of ["执行尝试", "状态事件", "死信记录"]) {
    assert.match(component, new RegExp(label));
  }
});

test("platform account overview query remains compatible with MySQL 5.7 aggregate ordering", async () => {
  const repository = await readFile(
    new URL("../../apps/api/src/mysql-platform-account-repository.ts", import.meta.url),
    "utf8",
  );
  assert.match(repository, /ORDER BY \(MIN\(pra\.created_at\) IS NULL\),MIN\(pra\.created_at\)/);
  assert.doesNotMatch(repository, /ORDER BY \(granted_at IS NULL\)/);
});

test("frontend primary headings and platform operations use Chinese labels", async () => {
  const files = [
    "NavigationShell.vue",
    "PlatformDashboard.vue",
    "PlatformManagementCenter.vue",
    "PlatformGovernanceCenter.vue",
    "CredentialAssetCenter.vue",
    "RuntimeTopologyCenter.vue",
    "RedisResilienceCenter.vue",
    "MySqlResilienceCenter.vue",
    "FileResilienceCenter.vue",
    "CrawlerSchedulerCenter.vue",
    "CapacityBoundaryCenter.vue",
  ];
  const sources = await Promise.all(
    files.map((name) =>
      readFile(new URL(`../../apps/web/src/components/${name}`, import.meta.url), "utf8"),
    ),
  );
  for (const source of sources) assert.doesNotMatch(source, />[A-Z][A-Z0-9 &/+._·:-]{3,}</);
  assert.ok(sources.join("\n").includes("智能选品"));
});
