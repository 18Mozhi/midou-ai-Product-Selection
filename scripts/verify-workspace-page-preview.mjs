import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { workspacePagePlugin } from "./lib/workspace-page-preview.mjs";

const out =
  process.argv[2] === "--capture-review"
    ? path.resolve(`output/playwright/p32-page-composition-${process.argv[3]}`)
    : null;
if (out) await mkdir(out, { recursive: true });
const org = "00000000-0000-4000-8000-000000000611";
const ws = "00000000-0000-4000-8000-000000000612";
const env = (data) => ({ data, request_id: "p32", trace_id: "p32" });
const summary = {
  organization: {
    id: org,
    name: "Global Goods Co.",
    default_workspace_id: ws,
    status: "active",
    version: 3,
  },
  members: { total: 128, active: 96 },
  workspaces: { total: 2, active: 1 },
  teams: { total: 24, active: 24 },
  pending_approvals: 7,
  active_tokens: 18,
  recent_audit_events: 1238,
  observed_at: "2026-08-08T12:00:00.000Z",
};
const workspaces = [
  {
    id: ws,
    name: "新品决策工作区",
    slug: "new-product-decision",
    status: "active",
    member_count: 18,
    version: 5,
    created_at: "2026-08-01T08:00:00.000Z",
    updated_at: "2026-08-08T10:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000613",
    name: "历史复盘工作区",
    slug: "history-review",
    status: "archived",
    member_count: 4,
    version: 2,
    created_at: "2026-07-01T08:00:00.000Z",
    updated_at: "2026-08-02T10:00:00.000Z",
  },
];
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [workspacePagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
});
let browser;
const manifests = [];
try {
  await server.listen();
  browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const errors = [],
      reads = [],
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
              shell: "organization_admin",
              organization_id: org,
              workspace_id: ws,
              roles: ["organization_admin"],
              capabilities: ["organization:manage", "workspace:manage"],
              platform_roles: [],
              platform_capabilities: [],
            }),
          });
        if (key === "GET /api/v1/me/ui-preferences")
          return route.fulfill({ json: env({ theme: "deep-ocean", version: 1 }) });
        if (key === "GET /api/v1/org/admin/summary") return route.fulfill({ json: env(summary) });
        if (key === "GET /api/v1/org/admin/workspaces")
          return route.fulfill({ json: env(workspaces) });
        return route.abort();
      });
      const page = await ctx.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${port}/org-admin/workspaces`, {
        waitUntil: "domcontentloaded",
      });
      const root = page.locator(".org-admin-center");
      await root.getByRole("heading", { name: "工作区管理" }).waitFor({ timeout: 8000 });
      assert.equal(await root.getByText("新品决策工作区", { exact: true }).count(), 3);
      const open = root.getByRole("button", { name: "新建工作区" });
      await open.focus();
      assert.equal(await open.evaluate((node) => getComputedStyle(node).outlineWidth), "3px");
      assert.equal(
        await root.getByRole("button", { name: "默认工作区不可归档" }).isDisabled(),
        true,
      );
      if (out)
        await page.screenshot({ path: path.join(out, `${width}-ready.png`), fullPage: true });
      await open.click();
      await root.getByRole("heading", { name: "新建工作区" }).waitFor();
      await root.getByLabel("工作区名称").fill("北美新品决策");
      await root.getByLabel("英文标识").fill("north-america-launch");
      await root.getByLabel("创建原因").fill("为北美新品评审建立独立数据边界。");
      assert.equal(writes.length, 0);
      if (out)
        await page.screenshot({ path: path.join(out, `${width}-create.png`), fullPage: true });
      assert.deepEqual(errors, []);
      manifests.push({ width, checks: 7, interceptedReads: reads.length, writes: writes.length });
      console.log(JSON.stringify(manifests.at(-1)));
    } finally {
      await ctx.close();
    }
  }
  if (out)
    await writeFile(
      path.join(out, "manifest.json"),
      `${JSON.stringify({ groups: manifests, source: "actual OrganizationWorkspacePanel Vue surface" }, null, 2)}\n`,
    );
} finally {
  await browser?.close();
  await server.close();
}
