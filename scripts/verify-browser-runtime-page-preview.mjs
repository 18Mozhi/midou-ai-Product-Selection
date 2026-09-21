import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { browserRuntimePagePlugin } from "./lib/browser-runtime-page-preview.mjs";

const out =
  process.argv[2] === "--capture-review"
    ? path.resolve(`output/playwright/p53-page-composition-${process.argv[3]}`)
    : null;
if (out) await mkdir(out, { recursive: true });
const env = (data) => ({ data, request_id: "p53-review", trace_id: "p53-review" });
const profiles = [
  {
    id: "00000000-0000-4000-8000-000000000811",
    code: "market-us",
    name: "US Market Profile",
    provider_id: "00000000-0000-4000-8000-000000000812",
    provider_name: "Market Browser",
    status: "active",
    target_domain: "market.example.test",
    credential_expires_at: "2026-08-10T20:02:00.000Z",
    login_status: "valid",
    last_failure: null,
    lease: {
      run_id: "00000000-0000-4000-8000-000000000821",
      lease_owner: "crawler-s0-01",
      leased_at: "2026-08-07T20:00:00.000Z",
      heartbeat_at: "2026-08-07T20:01:00.000Z",
      expires_at: "2026-08-07T20:02:00.000Z",
    },
  },
  {
    id: "00000000-0000-4000-8000-000000000813",
    code: "supplier-cn",
    name: "Supplier Profile",
    provider_id: "00000000-0000-4000-8000-000000000814",
    provider_name: "Supplier Browser",
    status: "active",
    target_domain: "supplier.example.test",
    credential_expires_at: null,
    login_status: "unknown",
    last_failure: null,
    lease: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000815",
    code: "archive-only",
    name: "Disabled Profile",
    provider_id: "00000000-0000-4000-8000-000000000816",
    provider_name: "Archived Source",
    status: "disabled",
    target_domain: "archive.example.test",
    credential_expires_at: "2026-08-01T00:00:00.000Z",
    login_status: "expired",
    last_failure: null,
    lease: null,
  },
];
const runs = [
  {
    id: "00000000-0000-4000-8000-000000000821",
    organization_id: "00000000-0000-4000-8000-000000000831",
    workspace_id: "00000000-0000-4000-8000-000000000841",
    provider_id: profiles[0].provider_id,
    crawler_profile_id: profiles[0].id,
    status: "running",
    page_count: 2,
    item_count: 18,
    detail_count: 4,
    duration_ms: null,
    error_code: null,
    request_id: "request-running",
    trace_id: "trace-running",
    started_at: "2026-08-07T20:00:00.000Z",
    finished_at: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000822",
    organization_id: "00000000-0000-4000-8000-000000000832",
    workspace_id: "00000000-0000-4000-8000-000000000842",
    provider_id: profiles[1].provider_id,
    crawler_profile_id: profiles[1].id,
    status: "succeeded",
    page_count: 3,
    item_count: 42,
    detail_count: 12,
    duration_ms: 8432,
    error_code: null,
    request_id: "request-success",
    trace_id: "trace-success",
    started_at: "2026-08-07T19:45:00.000Z",
    finished_at: "2026-08-07T19:45:08.432Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000823",
    organization_id: "00000000-0000-4000-8000-000000000833",
    workspace_id: "00000000-0000-4000-8000-000000000843",
    provider_id: profiles[0].provider_id,
    crawler_profile_id: profiles[0].id,
    status: "blocked",
    page_count: 1,
    item_count: 0,
    detail_count: 0,
    duration_ms: 913,
    error_code: "blocked_captcha",
    request_id: "request-blocked",
    trace_id: "trace-blocked",
    started_at: "2026-08-07T19:30:00.000Z",
    finished_at: "2026-08-07T19:30:00.913Z",
  },
];
const runtime = {
  profiles,
  runs,
  run_metrics: { total: runs.length, abnormal: 1, duplicate_risk: 0 },
  pagination: { page: 1, page_size: 25, total: runs.length, total_pages: 1 },
  filters: { status: null, query: null },
  observed_at: "2026-08-07T20:02:00.000Z",
};
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [browserRuntimePagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
});
let browser;
const manifest = [];
try {
  await server.listen();
  browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const reads = [],
      errors = [],
      writes = [];
    const ctx = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      reducedMotion: "reduce",
    });
    try {
      await ctx.route("**/*", async (route) => {
        const request = route.request(),
          url = new URL(request.url()),
          key = `${request.method()} ${url.pathname}`;
        if (url.origin !== `http://127.0.0.1:${port}`) return route.abort();
        if (!url.pathname.startsWith("/api/")) return route.continue();
        if (request.method() !== "GET") {
          writes.push(key);
          return route.abort();
        }
        reads.push(key);
        if (key === "GET /api/v1/auth/session-status")
          return route.fulfill({ json: env({ authenticated: true }) });
        if (key === "GET /api/v1/me/navigation")
          return route.fulfill({
            json: env({
              shell: "platform_admin",
              organization_id: null,
              workspace_id: null,
              roles: [],
              capabilities: [],
              platform_roles: ["platform_operations_admin"],
              platform_capabilities: ["platform:operate", "collection:replay"],
            }),
          });
        if (key === "GET /api/v1/me/ui-preferences")
          return route.fulfill({ json: env({ theme: "deep-ocean", version: 1 }) });
        if (key === "GET /api/v1/platform/crawler-runtime")
          return route.fulfill({ json: env(runtime) });
        return route.abort();
      });
      const page = await ctx.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${port}/platform-admin/collection/browser-runtime`, {
        waitUntil: "domcontentloaded",
      });
      const root = page.locator(".crawler-center");
      await root.getByRole("heading", { name: "采集运行监控" }).waitFor({ timeout: 8000 });
      assert.equal((await root.getByText("US Market Profile", { exact: true }).count()) > 0, true);
      assert.equal((await root.getByText("过期占用", { exact: true }).count()) > 0, true);
      const refresh = root.getByRole("button", { name: "刷新数据" });
      await refresh.focus();
      assert.equal(await refresh.evaluate((node) => getComputedStyle(node).outlineWidth), "3px");
      assert.equal(await root.getByRole("button", { name: "回收过期运行" }).count(), 1);
      assert.equal(writes.length, 0);
      if (out)
        await page.screenshot({ path: path.join(out, `${width}-runtime.png`), fullPage: true });
      assert.deepEqual(errors, []);
      manifest.push({ width, checks: 6, interceptedReads: reads.length, writes: writes.length });
      console.log(JSON.stringify(manifest.at(-1)));
    } finally {
      await ctx.close();
    }
  }
  if (out)
    await writeFile(
      path.join(out, "manifest.json"),
      `${JSON.stringify({ groups: manifest, source: "actual CollectionRuntimeCenter Vue surface" }, null, 2)}\n`,
    );
} finally {
  await browser?.close();
  await server.close();
}
