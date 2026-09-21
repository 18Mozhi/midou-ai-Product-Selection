import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { chromium } from "playwright";
import { createServer } from "vite";
import { buildNotificationDesignData } from "./lib/ui-phase2-notification-design-data.mjs";
import { notificationPagePlugin } from "./lib/notification-page-preview.mjs";
const capture = process.argv[2] === "--capture-review",
  out = capture ? path.resolve(`output/playwright/p26-page-composition-${process.argv[3]}`) : null;
if (out) await mkdir(out, { recursive: true });
const d = await buildNotificationDesignData(process.cwd()),
  list = d.list.data ?? d.list,
  id = list[0].id,
  env = (data, meta) => ({ data, request_id: "p26", trace_id: "p26", ...(meta ? { meta } : {}) }),
  probe = reservePort();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [notificationPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const writes = [],
      ctx = await browser.newContext({
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
              shell: "member",
              organization_id: "p26",
              workspace_id: "p26",
              roles: ["member"],
              capabilities: ["notification:read"],
              platform_roles: [],
              platform_capabilities: [],
            }),
          });
        if (k === "GET /api/v1/me/ui-preferences")
          return r.fulfill({ json: env({ theme: "deep-ocean", version: 1 }) });
        if (k === "GET /api/v1/notifications") return r.fulfill({ json: env(list, { total: 1 }) });
        if (k === "GET /api/v1/notifications/summary") return r.fulfill({ json: env(d.summary) });
        if (k === "GET /api/v1/me/notification-preferences")
          return r.fulfill({ json: env(d.preferences) });
        if (k === `GET /api/v1/notifications/${id}`) return r.fulfill({ json: env(list[0]) });
        if (k === `POST /api/v1/notifications/${id}/actions`) {
          writes.push(q.postDataJSON());
          return r.fulfill({
            json: env({ read_at: "2026-08-08T10:01:00.000Z", version: 2, workflow_status: "open" }),
          });
        }
        return r.fulfill({ status: 200, body: "" });
      });
      const p = await ctx.newPage();
      await p.goto(`http://127.0.0.1:${port}/notifications`, { waitUntil: "domcontentloaded" });
      const root = p.locator(".notification-center");
      await root.getByRole("heading", { name: "通知中心" }).waitFor();
      assert.equal(
        await root
          .getByText("只显示当前组织、工作区和当前用户的事务事件投影。", { exact: true })
          .count(),
        1,
      );
      const b = root.getByRole("button", { name: /审批状态更新/ });
      await b.focus();
      assert.equal(await b.evaluate((n) => getComputedStyle(n).outlineWidth), "3px");
      if (out) await p.screenshot({ path: path.join(out, `${width}-ready.png`), fullPage: true });
      await b.click();
      const dialog = p.getByRole("dialog", { name: "消息详情" });
      await dialog.getByRole("heading", { name: "审批状态更新" }).waitFor();
      assert.deepEqual(writes, []);
      if (out) await p.screenshot({ path: path.join(out, `${width}-detail.png`), fullPage: true });
      console.log(JSON.stringify({ width, checks: 4, writes: writes.length }));
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
