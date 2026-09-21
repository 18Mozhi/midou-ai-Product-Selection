import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { contentPagePlugin } from "./lib/content-page-preview.mjs";

const out =
  process.argv[2] === "--capture-review"
    ? path.resolve(`output/playwright/p56-page-composition-${process.argv[3]}`)
    : null;
if (out) await mkdir(out, { recursive: true });
const env = (data) => ({ data, request_id: "p56-review", trace_id: "p56-review" });
const data = {
  domain: "content",
  summary: { total: 135, active: 90, irrelevant: 25, stale: 19, archived: 1 },
  items: [
    {
      id: "00000000-0000-4000-8000-000000000756",
      title: "便携式照明热度上升",
      category: "家居照明",
      market: "US",
      language: "en-US",
      status: "active",
      signal_count: 18,
      source_count: 5,
      heat_value: 82,
      confidence_status: "measured",
      version: 4,
      last_seen_at: "2026-09-12T08:00:00.000Z",
      organization_name: "米豆选品",
      workspace_name: "北美工作区",
    },
  ],
  pagination: { page: 1, page_size: 20, total: 135, total_pages: 7 },
  observed_at: "2026-09-12T08:00:00.000Z",
};
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [contentPagePlugin()],
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
              platform_capabilities: ["platform:operate"],
            }),
          });
        if (key === "GET /api/v1/me/ui-preferences")
          return route.fulfill({ json: env({ theme: "deep-ocean", version: 1 }) });
        if (key === "GET /api/v1/platform/management") return route.fulfill({ json: env(data) });
        return route.abort();
      });
      const page = await ctx.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${port}/platform-admin/content`, {
        waitUntil: "domcontentloaded",
      });
      const root = page.locator(".platform-content");
      await root.getByRole("heading", { name: "内容管理" }).waitFor({ timeout: 8000 });
      assert.equal((await root.getByText("便携式照明热度上升", { exact: true }).count()) > 0, true);
      const refresh = root.getByRole("button", { name: "刷新内容" });
      await refresh.focus();
      assert.equal(await refresh.evaluate((node) => getComputedStyle(node).outlineWidth), "3px");
      assert.equal(await root.getByText("热点内容", { exact: true }).count(), 1);
      assert.equal(writes.length, 0);
      if (out)
        await page.screenshot({ path: path.join(out, `${width}-content.png`), fullPage: true });
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
      `${JSON.stringify({ groups: manifest, source: "actual PlatformContentCenter Vue surface" }, null, 2)}\n`,
    );
} finally {
  await browser?.close();
  await server.close();
}
