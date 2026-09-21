import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { collectionOverviewPagePlugin } from "./lib/collection-overview-page-preview.mjs";

const out =
  process.argv[2] === "--capture-review"
    ? path.resolve(`output/playwright/p52-page-composition-${process.argv[3]}`)
    : null;
if (out) await mkdir(out, { recursive: true });
const providerId = "00000000-0000-4000-8000-000000000630";
const env = (data) => ({ data, request_id: "p52-review", trace_id: "p52-review" });
const data = {
  filters: {
    organization_id: null,
    workspace_id: null,
    provider_id: null,
    window: "24h",
    error_code: null,
  },
  source_options: [{ id: providerId, code: "news", name: "公开趋势 RSS" }],
  sources: [
    {
      id: providerId,
      code: "news",
      name: "公开趋势 RSS",
      status: "enabled",
      owner_label: "运营组",
      schedule_minutes: 60,
      concurrency_limit: 1,
      parser_version: "v1",
      health_status: "ready",
      last_checked_at: "2026-08-08T12:00:00Z",
      last_latency_ms: 80,
      last_error_code: null,
      consecutive_failures: 0,
    },
  ],
  task_states: [
    { status: "running", total: 2 },
    { status: "dead_letter", total: 1 },
  ],
  dead_letters: [
    {
      id: "d1",
      task_id: "00000000-0000-4000-8000-000000000631",
      organization_id: "00000000-0000-4000-8000-000000000632",
      workspace_id: "00000000-0000-4000-8000-000000000633",
      error_code: "parser_failed",
      status: "open",
      created_at: "2026-08-08T11:00:00Z",
    },
  ],
  quality: [{ severity: "warning", status: "open", total: 3 }],
  attempts: [
    {
      id: "a1",
      task_id: "00000000-0000-4000-8000-000000000631",
      organization_id: "00000000-0000-4000-8000-000000000632",
      workspace_id: "00000000-0000-4000-8000-000000000633",
      attempt_number: 2,
      worker_id: "worker-1",
      status: "failed_terminal",
      error_code: "parser_failed",
      started_at: "2026-08-08T10:00:00Z",
      finished_at: "2026-08-08T10:01:00Z",
      trace_id: "trace-p52",
    },
  ],
  root_causes: [{ error_code: "parser_failed", total: 1, latest_at: "2026-08-08T11:00:00Z" }],
  pagination: {
    attempts: { page: 1, page_size: 50, total: 1, total_pages: 1 },
    dead_letters: { page: 1, page_size: 50, total: 1, total_pages: 1 },
  },
  links: {
    provider_registry: "/platform-admin/providers",
    adapter_health: "/platform-admin/providers/adapters",
    source_catalog: "/platform-admin/providers/sources",
    task_monitor: "/platform-admin/collection",
    browser_runtime: "/platform-admin/collection/browser-runtime",
    data_quality: "/platform-admin/data",
  },
  observed_at: "2026-08-08T12:00:00Z",
};
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [collectionOverviewPagePlugin()],
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
        const request = route.request();
        const url = new URL(request.url());
        const key = `${request.method()} ${url.pathname}`;
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
              platform_capabilities: ["platform:operate"],
            }),
          });
        if (key === "GET /api/v1/me/ui-preferences")
          return route.fulfill({ json: env({ theme: "deep-ocean", version: 1 }) });
        if (key === "GET /api/v1/platform/collection/console")
          return route.fulfill({ json: env(data) });
        return route.abort();
      });
      const page = await ctx.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${port}/platform-admin/collection/overview`, {
        waitUntil: "domcontentloaded",
      });
      const root = page.locator(".collection-ops");
      await root.getByRole("heading", { name: "来源与采集控制台" }).waitFor({ timeout: 8000 });
      assert.equal((await root.getByText("公开趋势 RSS", { exact: true }).count()) > 0, true);
      const refresh = root.getByRole("button", { name: "刷新数据" });
      await refresh.focus();
      assert.equal(await refresh.evaluate((node) => getComputedStyle(node).outlineWidth), "3px");
      if (out)
        await page.screenshot({ path: path.join(out, `${width}-overview.png`), fullPage: true });
      assert.equal(await root.getByText("批量安全重放", { exact: true }).count(), 1);
      assert.equal(writes.length, 0);
      assert.deepEqual(errors, []);
      manifest.push({ width, checks: 5, interceptedReads: reads.length, writes: writes.length });
      console.log(JSON.stringify(manifest.at(-1)));
    } finally {
      await ctx.close();
    }
  }
  if (out)
    await writeFile(
      path.join(out, "manifest.json"),
      `${JSON.stringify({ groups: manifest, source: "actual CollectionOperationsConsole Vue surface" }, null, 2)}\n`,
    );
} finally {
  await browser?.close();
  await server.close();
}
