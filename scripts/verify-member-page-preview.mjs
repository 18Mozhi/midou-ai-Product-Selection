import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { memberPagePlugin } from "./lib/member-page-preview.mjs";

const out =
  process.argv[2] === "--capture-review"
    ? path.resolve(`output/playwright/p30-page-composition-${process.argv[3]}`)
    : null;
if (out) await mkdir(out, { recursive: true });

const org = "00000000-0000-4000-8000-000000000591";
const ws = "00000000-0000-4000-8000-000000000592";
const env = (data) => ({ data, request_id: "p30", trace_id: "p30" });
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
const members = {
  items: [
    {
      id: "00000000-0000-4000-8000-000000000593",
      display_name: "林晓",
      email: "lin.xiao@example.test",
      status: "active",
      roles: ["organization_admin"],
      scopes: ["organization"],
      teams: ["治理组"],
      version: 7,
    },
    {
      id: "00000000-0000-4000-8000-000000000594",
      display_name: "陈一鸣",
      email: "chen.ym@example.test",
      status: "active",
      roles: ["selection_manager"],
      scopes: ["workspace"],
      teams: ["选品组"],
      version: 4,
    },
  ],
  invitations: [
    {
      id: "00000000-0000-4000-8000-000000000595",
      email: "reviewer@example.test",
      role_code: "member",
      status: "pending_delivery",
      expires_at: "2026-08-15T12:00:00.000Z",
      version: 2,
    },
  ],
};

const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [memberPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
});

let browser;
const manifests = [];
try {
  await server.listen();
  browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const writes = [];
    const errors = [];
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
        if (key === "GET /api/v1/auth/session-status")
          return route.fulfill({ json: env({ authenticated: true }) });
        if (key === "GET /api/v1/me/navigation")
          return route.fulfill({
            json: env({
              shell: "organization_admin",
              organization_id: org,
              workspace_id: ws,
              roles: ["organization_admin"],
              capabilities: ["organization:manage", "membership:read", "membership:manage"],
              platform_roles: [],
              platform_capabilities: [],
            }),
          });
        if (key === "GET /api/v1/me/ui-preferences")
          return route.fulfill({ json: env({ theme: "deep-ocean", version: 1 }) });
        if (key === "GET /api/v1/org/admin/summary") return route.fulfill({ json: env(summary) });
        if (key === "GET /api/v1/org/admin/members") return route.fulfill({ json: env(members) });
        if (key === "POST /api/v1/org/admin/invitations") {
          writes.push(request.postDataJSON());
          return route.fulfill({
            json: env({ id: "local-invitation", status: "pending_delivery" }),
          });
        }
        return route.abort();
      });
      const page = await ctx.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${port}/org-admin/members`, {
        waitUntil: "domcontentloaded",
      });
      const root = page.locator(".org-admin-center");
      await root.getByRole("heading", { name: "成员与邀请" }).waitFor({ timeout: 8000 });
      assert.equal(await root.getByText("林晓", { exact: true }).count(), 1);
      assert.equal(await root.getByText("等待邮件服务", { exact: false }).count(), 1);
      const invite = root.getByRole("button", { name: "创建邀请" });
      await invite.focus();
      assert.equal(await invite.evaluate((node) => getComputedStyle(node).outlineWidth), "3px");
      if (out)
        await page.screenshot({ path: path.join(out, `${width}-ready.png`), fullPage: true });
      await root.getByLabel("邮箱（每行一个）").fill("new@example.test");
      await root.getByLabel("原因", { exact: true }).fill("核对成员资料后邀请协作者。");
      const sent = page.waitForRequest("**/api/v1/org/admin/invitations");
      await invite.click();
      await sent;
      await root.getByText("已创建待投递邀请", { exact: true }).waitFor();
      assert.deepEqual(writes, [
        {
          email: "new@example.test",
          role_code: "member",
          reason: "核对成员资料后邀请协作者。",
        },
      ]);
      if (out)
        await page.screenshot({
          path: path.join(out, `${width}-invite-result.png`),
          fullPage: true,
        });
      assert.deepEqual(errors, []);
      manifests.push({ width, checks: 6, interceptedWrites: writes.length });
      console.log(JSON.stringify(manifests.at(-1)));
    } finally {
      await ctx.close();
    }
  }
  if (out)
    await writeFile(
      path.join(out, "manifest.json"),
      `${JSON.stringify({ groups: manifests, source: "actual OrganizationMemberPanel Vue surface" }, null, 2)}\n`,
    );
} finally {
  await browser?.close();
  await server.close();
}
