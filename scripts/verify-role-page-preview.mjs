import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { rolePagePlugin } from "./lib/role-page-preview.mjs";

const out =
  process.argv[2] === "--capture-review"
    ? path.resolve(`output/playwright/p31-page-composition-${process.argv[3]}`)
    : null;
if (out) await mkdir(out, { recursive: true });

const org = "00000000-0000-4000-8000-000000000601";
const ws = "00000000-0000-4000-8000-000000000602";
const member = "00000000-0000-4000-8000-000000000603";
const env = (data, meta) => ({
  data,
  ...(meta ? { meta } : {}),
  request_id: "p31",
  trace_id: "p31",
});
const summary = {
  organization: { id: org, name: "Global Goods Co.", status: "active", version: 3 },
  members: { total: 128, active: 96 },
  workspaces: { total: 8, active: 8 },
  teams: { total: 24, active: 24 },
  pending_approvals: 7,
  active_tokens: 18,
  recent_audit_events: 1238,
  observed_at: "2026-08-08T12:00:00.000Z",
};
const roles = [
  {
    code: "organization_admin",
    name: "组织管理员",
    description: "管理组织治理设置。",
    capabilities: ["organization:manage", "membership:manage", "role:manage"],
  },
  {
    code: "selection_manager",
    name: "选品经理",
    description: "维护选品队列并提交人工决定。",
    capabilities: ["opportunity:read", "opportunity:decide", "task:read"],
  },
  {
    code: "auditor",
    name: "审计员",
    description: "只读核对组织审计记录。",
    capabilities: ["audit:read", "report:read"],
  },
];
const members = {
  items: [
    {
      id: member,
      display_name: "陈一鸣",
      email: "chen.ym@example.test",
      status: "active",
      roles: ["selection_manager"],
      scopes: ["workspace"],
      teams: ["选品组"],
      version: 4,
    },
  ],
  invitations: [],
};
const grant = {
  id: "00000000-0000-4000-8000-000000000604",
  workspace_id: ws,
  resource_type: "opportunity",
  resource_id: "00000000-0000-4000-8000-000000000605",
  grantee_membership_id: member,
  actions: ["opportunity:read"],
  reason: "复核候选的最小只读授权。",
  expires_at: "2026-08-15T12:00:00.000Z",
  effective_status: "active",
  version: 2,
};

const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [rolePagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
});

let browser;
const manifests = [];
try {
  await server.listen();
  browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const errors = [];
    const reads = [];
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
              capabilities: [
                "organization:manage",
                "role:read",
                "role:manage",
                "membership:read",
                "workspace:manage",
              ],
              platform_roles: [],
              platform_capabilities: [],
            }),
          });
        if (key === "GET /api/v1/me/ui-preferences")
          return route.fulfill({ json: env({ theme: "deep-ocean", version: 1 }) });
        if (key === "GET /api/v1/org/admin/summary") return route.fulfill({ json: env(summary) });
        if (key === "GET /api/v1/org/admin/roles") return route.fulfill({ json: env(roles) });
        if (key === "GET /api/v1/me/authorization")
          return route.fulfill({
            json: env({
              organization_id: org,
              workspace_id: ws,
              roles: ["organization_admin"],
              capabilities: ["role:read", "role:manage", "membership:read"],
              data_scopes: [{ scope: "organization" }],
            }),
          });
        if (key === "GET /api/v1/org/admin/members") return route.fulfill({ json: env(members) });
        if (key === "GET /api/v1/org/admin/workspaces")
          return route.fulfill({
            json: env([{ id: ws, name: "新品决策工作区", status: "active" }]),
          });
        if (key === `GET /api/v1/org/${org}/resource-grant-targets`)
          return route.fulfill({
            json: env([{ id: member, email: "chen.ym@example.test", status: "active" }]),
          });
        if (key === `GET /api/v1/org/${org}/resource-grants`) {
          const status = url.searchParams.get("status");
          const current = !status || status === "active" ? [grant] : [];
          return route.fulfill({
            json: env(current, { page: 1, limit: 20, total: current.length }),
          });
        }
        return route.abort();
      });
      const page = await ctx.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${port}/org-admin/roles`, {
        waitUntil: "domcontentloaded",
      });
      const root = page.locator(".org-admin-center");
      await root.getByRole("heading", { name: "角色与权限" }).waitFor({ timeout: 8000 });
      assert.equal(await root.getByText("组织管理员", { exact: true }).count(), 3);
      assert.equal(await root.getByRole("table", { name: "角色能力矩阵" }).count(), 1);
      const firstRole = root.getByRole("button", { name: /组织管理员.*3 项/ });
      await firstRole.focus();
      assert.equal(await firstRole.evaluate((node) => getComputedStyle(node).outlineWidth), "3px");
      if (out)
        await page.screenshot({ path: path.join(out, `${width}-roles.png`), fullPage: true });
      await root.getByRole("button", { name: "指定资源授权 1" }).click();
      await root.getByRole("heading", { name: "指定资源授权" }).waitFor();
      assert.equal(await root.getByText("复核候选的最小只读授权。", { exact: true }).count(), 1);
      assert.equal(await root.getByText("从资源详情页复制 UUID", { exact: false }).count(), 0);
      if (out)
        await page.screenshot({ path: path.join(out, `${width}-grants.png`), fullPage: true });
      assert.deepEqual(errors, []);
      manifests.push({ width, checks: 6, interceptedReads: reads.length });
      console.log(JSON.stringify(manifests.at(-1)));
    } finally {
      await ctx.close();
    }
  }
  if (out)
    await writeFile(
      path.join(out, "manifest.json"),
      `${JSON.stringify({ groups: manifests, source: "actual OrganizationRolePanel Vue surface" }, null, 2)}\n`,
    );
} finally {
  await browser?.close();
  await server.close();
}
