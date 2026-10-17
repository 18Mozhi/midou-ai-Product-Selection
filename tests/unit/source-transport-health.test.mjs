import test from "node:test";
import assert from "node:assert/strict";
import { ProviderAdapterRegistry } from "../../packages/provider-adapters/dist/index.js";
import {
  PUBLIC_CRAWLER_USER_AGENT,
  assertPublicCollectionPolicy,
  createBuiltinSourceAdapters,
  Lan1688ImageSearch,
  parseLan1688Result,
} from "../../packages/provider-sources/dist/index.js";
import * as workerLan from "../../apps/worker/dist/lan-1688-image-search.js";

const offer = {
  offerId: "123456789",
  title: "Sample offer",
  shop_name: "Sample supplier",
  price: "9.50",
};
const provider = {
  id: "10000000-0000-4000-8000-000000000001",
  code: "1688_search",
  accessMode: "authenticated_browser",
  targetUrl: "https://s.1688.com/selloffer/offer_search.htm",
  parserVersion: "1688-lan-image-v1",
  timeoutMs: 1000,
  fields: [],
};

test("Amazon page and robots use the same declared public crawler identity", async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url: String(url), agent: new Headers(options.headers).get("user-agent") });
    return new Response(
      String(url).endsWith("/robots.txt")
        ? "User-agent: ScoutOpsPublicCrawler\nAllow: /"
        : '<html><body><div data-component-type="s-search-result" data-asin="B0ABCDEF12"><h2><span>Storage Box</span></h2></div></body></html>',
    );
  };
  await assertPublicCollectionPolicy({
    providerTargetUrl: "https://www.amazon.com/s?k=storage+box",
    fetcher,
    timeoutMs: 1000,
  });
  const amazon = createBuiltinSourceAdapters(fetcher).find((a) => a.key === "amazon_product");
  const result = await amazon.collect(
    {
      provider: { parserVersion: "amazon-public-product-v5" },
      target: { query: "storage box" },
      limit: 1,
    },
    AbortSignal.timeout(1000),
  );
  assert.equal(result.records.length, 1);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.agent === PUBLIC_CRAWLER_USER_AGENT));
  assert.equal(PUBLIC_CRAWLER_USER_AGENT, "ScoutOpsPublicCrawler/1.0");
});

test("worker LAN imports reuse the canonical shared client without changing results", () => {
  assert.equal(workerLan.Lan1688ImageSearch, Lan1688ImageSearch);
  assert.deepEqual(
    workerLan.parseLan1688Result({ success: true, items: [offer] }, "2026-10-18T00:00:00Z"),
    parseLan1688Result({ success: true, items: [offer] }, "2026-10-18T00:00:00Z"),
  );
});

test("configured LAN health validates the real request and preserves normalize provenance without exposing offers or credentials", async () => {
  const requests = [];
  const adapters = createBuiltinSourceAdapters(fetch, {
    lan1688: {
      token: "synthetic-secret",
      timeoutMs: 1000,
      fetcher: async (url, options) => {
        requests.push({ url, options });
        return Response.json({ success: true, items: [offer] });
      },
    },
  });
  const registry = new ProviderAdapterRegistry({
    healthTimeoutMs: 1000,
    maxResponseBytes: 100000,
    maxItemsPerBatch: 100,
  });
  for (const a of adapters) registry.register(a);
  const health = await registry.healthCheck({ provider, requestId: "health", traceId: "health" });
  assert.equal(health.status, "ready");
  assert.equal(requests[0].url, "http://192.168.1.221:8880/1688/image-search");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.redirect, "error");
  assert.equal(
    new Headers(requests[0].options.headers).get("authorization"),
    "Bearer synthetic-secret",
  );
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.begin_page, 1);
  assert.equal(body.page_size, 60);
  assert.equal(body.result_limit, 60);
  assert.equal(new URL(body.image_url).hostname, "m.media-amazon.com");
  assert.ok(
    !JSON.stringify({ health, adapters: registry.describe() }).includes("synthetic-secret"),
  );
  assert.ok(!("records" in health));
  const record = parseLan1688Result({ success: true, items: [offer] }, "2026-10-18T00:00:00Z")[0];
  const normalized = registry.normalize("1688_search", record, {
    provider,
    requestId: "r",
    traceId: "r",
    organizationId: "org",
    workspaceId: "workspace",
  });
  assert.equal(normalized.provenance.adapter_version, "1688-lan-health-adapter-v1");
  assert.equal(normalized.fields.quoted_price, 9.5);
});

test("unconfigured LAN health keeps the existing browser verification gate", async () => {
  const adapter = createBuiltinSourceAdapters().find((a) => a.key === "1688_search");
  assert.equal((await adapter.healthCheck({}, AbortSignal.timeout(1000))).status, "blocked");
});

test("LAN authentication, malformed responses and cancellation never become healthy", async () => {
  for (const response of [
    () => new Response("denied", { status: 401 }),
    () => Response.json({ success: true, items: [{ ...offer, shop_name: "" }] }),
  ]) {
    const adapter = createBuiltinSourceAdapters(fetch, {
      lan1688: { token: "synthetic-secret", timeoutMs: 1000, fetcher: async () => response() },
    }).find((a) => a.key === "1688_search");
    const health = await adapter.healthCheck({}, AbortSignal.timeout(1000));
    assert.notEqual(health.status, "ready");
    assert.notEqual(health.errorCode, null);
  }
  let calls = 0;
  const adapter = createBuiltinSourceAdapters(fetch, {
    lan1688: {
      token: "synthetic-secret",
      timeoutMs: 1000,
      fetcher: async () => {
        calls++;
        return Response.json({ success: true, items: [] });
      },
    },
  }).find((a) => a.key === "1688_search");
  const controller = new AbortController();
  controller.abort(new Error("cancelled"));
  await assert.rejects(() => adapter.healthCheck({}, controller.signal), /cancelled/);
  assert.equal(calls, 0);
});

test("a per-adapter health deadline preserves other adapters and the provider's tighter limit", async () => {
  const registry = new ProviderAdapterRegistry({
    healthTimeoutMs: 100,
    healthTimeoutMsByAdapter: { lan: 250 },
    maxResponseBytes: 10000,
    maxItemsPerBatch: 20,
  });
  for (const key of ["lan", "ordinary"])
    registry.register({
      key,
      version: "health-test-v1",
      accessMode: "public_page",
      collect: async () => {
        throw new Error("not a collection test");
      },
      normalize: () => {
        throw new Error("not a facts test");
      },
      healthCheck: async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return { status: "ready", latencyMs: 150, errorCode: null, message: "synthetic test" };
      },
    });
  const context = (code, timeoutMs = 500) => ({
    provider: { ...provider, code, accessMode: "public_page", timeoutMs },
    requestId: "deadline",
    traceId: "deadline",
  });
  assert.equal((await registry.healthCheck(context("lan"))).status, "ready");
  await assert.rejects(() => registry.healthCheck(context("ordinary")), { name: "AbortError" });
  await assert.rejects(() => registry.healthCheck(context("lan", 100)), { name: "AbortError" });
});

test("invalid per-adapter deadline options fail closed", () => {
  for (const healthTimeoutMsByAdapter of [
    null,
    [],
    { lan: 0 },
    { lan: 120001 },
    { "invalid key": 1000 },
  ])
    assert.throws(
      () =>
        new ProviderAdapterRegistry({
          healthTimeoutMs: 1000,
          healthTimeoutMsByAdapter,
          maxResponseBytes: 10000,
          maxItemsPerBatch: 20,
        }),
      { code: "adapter_limit_invalid" },
    );
});
