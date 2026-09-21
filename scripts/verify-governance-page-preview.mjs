import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { governancePagePlugin } from "./lib/governance-page-preview.mjs";

const out =
  process.argv[2] === "--capture-review"
    ? path.resolve(`output/playwright/p55-page-composition-${process.argv[3]}`)
    : null;
if (out) await mkdir(out, { recursive: true });
const env = (data) => ({ data, request_id: "p55-review", trace_id: "p55-review" });
const data = {
  domain: "governance",
  section: "score_rules",
  summary: {
    score_rules: 3,
    cost_rules: 2,
    approval_templates: 4,
    automation_rules: 1,
    releases: 2,
    provider_versions: 7,
  },
  items: [
    {
      id: "score-c-55",
      name: "全渠道评分基线",
      version_code: "score-2026-09",
      organization_name: "平台全局",
      workspace_name: null,
      status: "active",
      revision: 6,
      updated_at: "2026-09-12T08:00:00.000Z",
    },
  ],
  pagination: { page: 1, page_size: 20, total: 1, total_pages: 1 },
  provider_versions_latest_at: "2026-09-12T07:30:00.000Z",
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
  plugins: [governancePagePlugin()],
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
      await page.goto(`http://127.0.0.1:${port}/platform-admin/governance`, {
        waitUntil: "domcontentloaded",
      });
      const root = page.locator(".platform-governance");
      await root.getByRole("heading", { name: "规则、工作流与自动化" }).waitFor({ timeout: 8000 });
      assert.equal((await root.getByText("全渠道评分基线", { exact: true }).count()) > 0, true);
      const primary = root.getByRole("link", { name: "进入评分规则" });
      await primary.focus();
      assert.equal(await primary.evaluate((node) => getComputedStyle(node).outlineWidth), "3px");
      assert.equal(
        await root.getByRole("navigation", { name: "治理数据类型" }).getByRole("button").count(),
        5,
      );
      assert.equal(writes.length, 0);
      if (out)
        await page.screenshot({ path: path.join(out, `${width}-governance.png`), fullPage: true });
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
      `${JSON.stringify({ groups: manifest, source: "actual PlatformGovernanceCenter Vue surface" }, null, 2)}\n`,
    );
} finally {
  await browser?.close();
  await server.close();
}
