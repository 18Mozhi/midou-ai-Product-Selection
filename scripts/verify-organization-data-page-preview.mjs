import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { organizationDataPagePlugin } from "./lib/organization-data-page-preview.mjs";

const out =
  process.argv[2] === "--capture-review"
    ? path.resolve(`output/playwright/p35-page-composition-${process.argv[3]}`)
    : null;
if (out) await mkdir(out, { recursive: true });
const org = "00000000-0000-4000-8000-000000000621",
  ws = "00000000-0000-4000-8000-000000000622";
const env = (data) => ({ data, request_id: "p35", trace_id: "p35" });
const summary = {
  organization: { id: org, name: "Global Goods Co.", status: "active", version: 3 },
  members: { total: 128, active: 96 },
  workspaces: { total: 3, active: 2 },
  teams: { total: 24, active: 24 },
  pending_approvals: 7,
  active_tokens: 18,
  recent_audit_events: 1238,
  observed_at: "2026-08-08T12:00:00.000Z",
};
const data = {
  comparisons: [
    {
      id: ws,
      name: "新品决策工作区",
      status: "active",
      trends: 38,
      opportunities: 12,
      tasks: 7,
      exports: 3,
    },
    {
      id: "00000000-0000-4000-8000-000000000623",
      name: "采购协作工作区",
      status: "active",
      trends: 12,
      opportunities: 8,
      tasks: 14,
      exports: 1,
    },
    {
      id: "00000000-0000-4000-8000-000000000624",
      name: "历史复盘工作区",
      status: "archived",
      trends: 0,
      opportunities: 3,
      tasks: 0,
      exports: 0,
    },
  ],
  exports: [
    {
      id: "00000000-0000-4000-8000-000000000625",
      workspace_name: "新品决策工作区",
      report_type: "opportunity",
      status: "succeeded",
      row_count: 48,
      created_at: "2026-08-08T08:00:00.000Z",
      updated_at: "2026-08-08T08:02:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000626",
      workspace_name: "采购协作工作区",
      report_type: "team",
      status: "queued",
      row_count: null,
      created_at: "2026-08-07T08:00:00.000Z",
      updated_at: "2026-08-07T08:00:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000627",
      workspace_name: "历史复盘工作区",
      report_type: "trend",
      status: "succeeded",
      row_count: 0,
      created_at: "2026-08-06T08:00:00.000Z",
      updated_at: "2026-08-06T08:04:00.000Z",
    },
  ],
  observed_at: "2026-08-08T12:00:00.000Z",
};
const probe = reservePort();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [organizationDataPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
});
let browser;
const manifest = [];
try {
  await server.listen();
  browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const reads = [],
      errors = [];
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
        if (request.method() !== "GET") return route.abort();
        reads.push(key);
        if (key === "GET /api/v1/auth/session-status")
          return route.fulfill({ json: env({ authenticated: true }) });
        if (key === "GET /api/v1/me/navigation")
          return route.fulfill({
            json: env({
              shell: "organization_admin",
              organization_id: org,
              workspace_id: ws,
              roles: ["organization_admin"],
              capabilities: ["organization:manage", "report:read"],
              platform_roles: [],
              platform_capabilities: [],
            }),
          });
        if (key === "GET /api/v1/me/ui-preferences")
          return route.fulfill({ json: env({ theme: "deep-ocean", version: 1 }) });
        if (key === "GET /api/v1/org/admin/summary") return route.fulfill({ json: env(summary) });
        if (key === "GET /api/v1/org/admin/data") return route.fulfill({ json: env(data) });
        return route.abort();
      });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${port}/org-admin/data`, { waitUntil: "domcontentloaded" });
      const root = page.locator(".org-admin-center");
      await root.getByRole("heading", { name: "组织数据" }).waitFor({ timeout: 8000 });
      assert.equal(await root.getByRole("table", { name: "跨工作区数据比较" }).count(), 1);
      const tab = root.getByRole("button", { name: /工作区比较 3/ });
      await tab.focus();
      assert.equal(await tab.evaluate((n) => getComputedStyle(n).outlineWidth), "3px");
      if (out)
        await page.screenshot({ path: path.join(out, `${width}-workspaces.png`), fullPage: true });
      await root.getByRole("button", { name: /导出履历 3/ }).click();
      await root.getByText("尚未生成", { exact: true }).waitFor();
      assert.equal(await root.getByText("0 行", { exact: true }).count(), 1);
      if (out)
        await page.screenshot({ path: path.join(out, `${width}-exports.png`), fullPage: true });
      assert.deepEqual(errors, []);
      manifest.push({ width, checks: 6, interceptedReads: reads.length, writes: 0 });
      console.log(JSON.stringify(manifest.at(-1)));
    } finally {
      await ctx.close();
    }
  }
  if (out)
    await writeFile(
      path.join(out, "manifest.json"),
      `${JSON.stringify({ groups: manifest, source: "actual OrganizationDataPanel Vue surface" }, null, 2)}\n`,
    );
} finally {
  await browser?.close();
  await server.close();
}
