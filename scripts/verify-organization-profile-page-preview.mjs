import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { organizationProfilePagePlugin } from "./lib/organization-profile-page-preview.mjs";
const out =
  process.argv[2] === "--capture-review"
    ? path.resolve(`output/playwright/p29-page-composition-${process.argv[3]}`)
    : null;
if (out) await mkdir(out, { recursive: true });
const org = "00000000-0000-4000-8000-000000000581",
  ws = "00000000-0000-4000-8000-000000000582",
  env = (data) => ({ data, request_id: "p29", trace_id: "p29" }),
  profile = {
    id: org,
    name: "Global Goods Co.",
    logo_url: "https://example.test/logo.png",
    slug: "global-goods",
    status: "active",
    timezone: "Asia/Shanghai",
    data_retention_days: 365,
    default_workspace_id: ws,
    version: 3,
  },
  summary = {
    organization: { ...profile },
    members: { total: 128, active: 96 },
    workspaces: { total: 8, active: 8 },
    teams: { total: 24, active: 24 },
    pending_approvals: 7,
    active_tokens: 18,
    recent_audit_events: 1238,
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
  plugins: [organizationProfilePagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const writes = [],
      errors = [];
    const ctx = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      reducedMotion: "reduce",
    });
    try {
      await ctx.route("**/*", async (r) => {
        const q = r.request(),
          u = new URL(q.url()),
          k = `${q.method()} ${u.pathname}`;
        if (u.origin !== `http://127.0.0.1:${port}`) return r.abort();
        if (!u.pathname.startsWith("/api/")) return r.continue();
        if (k === "GET /api/v1/auth/session-status")
          return r.fulfill({ json: env({ authenticated: true }) });
        if (k === "GET /api/v1/me/navigation")
          return r.fulfill({
            json: env({
              shell: "organization_admin",
              organization_id: org,
              workspace_id: ws,
              roles: ["organization_admin"],
              capabilities: ["organization:manage", "workspace:manage"],
              platform_roles: [],
              platform_capabilities: [],
            }),
          });
        if (k === "GET /api/v1/me/ui-preferences")
          return r.fulfill({ json: env({ theme: "deep-ocean", version: 1 }) });
        if (k === "GET /api/v1/org/admin/summary") return r.fulfill({ json: env(summary) });
        if (k === "GET /api/v1/org/admin/profile") return r.fulfill({ json: env(profile) });
        if (k === "GET /api/v1/org/admin/workspaces")
          return r.fulfill({
            json: env([{ id: ws, name: "新品决策工作区", status: "active", version: 3 }]),
          });
        if (k === "PATCH /api/v1/org/admin/profile") {
          writes.push(q.postDataJSON());
          return r.fulfill({ json: env(profile) });
        }
        return r.abort();
      });
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(`http://127.0.0.1:${port}/org-admin`, { waitUntil: "domcontentloaded" });
      const root = p.locator(".org-admin-center");
      await root.getByRole("heading", { name: "治理概览" }).waitFor({ timeout: 8000 });
      assert.equal(await root.getByText("Global Goods Co.", { exact: true }).count(), 1);
      const save = root.getByRole("button", { name: "保存并审计" });
      await save.focus();
      assert.equal(await save.evaluate((n) => getComputedStyle(n).outlineWidth), "3px");
      if (out) await p.screenshot({ path: path.join(out, `${width}-ready.png`), fullPage: true });
      await root.getByLabel("变更原因").fill("核对保留策略后更新资料。");
      const sent = p.waitForRequest("**/api/v1/org/admin/profile");
      await save.click();
      await sent;
      assert.deepEqual(writes[0], {
        name: "Global Goods Co.",
        logo_url: "https://example.test/logo.png",
        timezone: "Asia/Shanghai",
        data_retention_days: 365,
        default_workspace_id: ws,
        reason: "核对保留策略后更新资料。",
        expected_version: 3,
      });
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, checks: 5, writes: writes.length }));
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
