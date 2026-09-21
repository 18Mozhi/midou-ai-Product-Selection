import assert from "node:assert/strict";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import { logPagePlugin } from "./lib/platform-log-page-preview.mjs";
import { logReviewFixtures, logEnvelope } from "./lib/log-review-fixtures.mjs";
import { statusReviewFixtures } from "./lib/status-review-fixtures.mjs";

// Diagnostic observations, not an acceptance gate for the observed behavior.
// All API responses are local fixtures. Blob anchor activation is observed but suppressed.
assert.equal(process.argv.length, 2, "No arguments; no files or real downloads");
const { fixture, nav } = await logReviewFixtures(),
  status = (await statusReviewFixtures()).fixture,
  probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [logPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const results = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P62 export lifecycle diagnostic ${origin}`);
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        reducedMotion: "reduce",
        acceptDownloads: false,
      }),
      page = await context.newPage(),
      writes = [],
      unexpected = [],
      errors = [],
      observations = { width };
    let held;
    const navigate = async (target) => {
      await page.evaluate(async (target) => {
        const { router } = await import("/src/router.ts");
        await router.push(target);
      }, target);
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
    };
    const awaitWrite = async (count) => {
      const deadline = Date.now() + 5000;
      while (writes.length < count && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(writes.length, count, "Expected one explicit local POST");
      assert.ok(held);
    };
    const fail = async () => {
      const pending = held;
      held = null;
      await pending.fulfill({
        status: 400,
        json: {
          error: {
            code: "local_export_failure",
            message: "本地导出失败",
            action_hint: "本地导出失败，未生成真实文件。",
          },
          request_id: "p62-local-late-export",
        },
      });
    };
    try {
      await page.addInitScript(() => {
        window.__p62DownloadIntent = [];
        const original = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
          if (this.href.startsWith("blob:") && this.download.startsWith("platform-logs-")) {
            window.__p62DownloadIntent.push({ path: location.pathname, file: this.download });
            return;
          }
          return original.call(this);
        };
      });
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("download", () => unexpected.push("real-download"));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url()),
          key = req.method() + " " + url.pathname;
        if (url.origin !== origin) {
          unexpected.push("external");
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        if (key === "GET /api/v1/me/navigation") return route.fulfill({ json: logEnvelope(nav) });
        if (key === "GET /api/v1/auth/session-status")
          return route.fulfill({ json: logEnvelope({ authenticated: true }) });
        if (key === "GET /api/v1/me/ui-preferences")
          return route.fulfill({ status: 503, json: { error: { code: "local_preferences" } } });
        if (key === "GET /api/v1/platform/management") {
          if (url.searchParams.get("domain") === "status")
            return route.fulfill({ json: logEnvelope(status) });
          if (url.searchParams.get("domain") === "logs") {
            const query = url.searchParams.get("query"),
              source = url.searchParams.get("status"),
              items = fixture.items.filter(
                (item) =>
                  (!query || item.trace_id === query) && (!source || item.source === source),
              );
            return route.fulfill({
              json: logEnvelope({ ...fixture, items, summary: { total: items.length } }),
            });
          }
        }
        if (key === "POST /api/v1/platform/management/logs/exports") {
          assert.equal(held == null, true, "No overlapping mocked export");
          writes.push({ body: req.postDataJSON(), accept: req.headers().accept });
          held = route;
          return;
        }
        unexpected.push(key);
        return route.abort();
      });
      const originalTarget = "/platform-admin/logs?query=trace-shared&source=crawler";
      await page.goto(origin + originalTarget);
      const surface = page.locator(".platform-log-center--review"),
        trigger = surface.getByRole("button", { name: "导出当前筛选", exact: true }),
        dialog = page.getByRole("dialog", { name: "填写日志导出原因", exact: true });
      await surface.locator(".p62-workspace").waitFor();
      await trigger.click();
      await dialog.locator("textarea").fill("本地原因范围核对");
      await navigate("/platform-admin/logs?query=trace-worker&source=worker");
      await trigger.waitFor();
      observations.reasonAfterSamePageChange = {
        visible: await dialog.isVisible(),
        text: await dialog.locator("textarea").inputValue(),
      };
      await dialog.getByRole("button", { name: "确认提交", exact: true }).click();
      await awaitWrite(1);
      observations.submittedScope = writes[0];
      await fail();
      await surface.getByRole("status", { name: "最近导出反馈", exact: true }).waitFor();

      await trigger.click();
      await dialog.locator("textarea").fill("离页前尚未提交原因");
      await navigate("/platform-admin/status?query=foreign&source=api");
      observations.reasonAway = await page.evaluate(() => ({
        path: location.pathname,
        openDialogs: [...document.querySelectorAll("dialog[open]")].map((el) => ({
          label: el.getAttribute("aria-label"),
          visible: el.getClientRects().length > 0,
        })),
        activeTag: document.activeElement?.tagName,
      }));
      observations.writesWhileReasonAway = writes.length;
      await navigate(originalTarget);
      observations.reasonAfterReturn = {
        visible: await dialog.isVisible(),
        text: await dialog.locator("textarea").inputValue(),
      };
      if (await dialog.isVisible())
        await dialog.getByRole("button", { name: "取消", exact: true }).click();

      await trigger.click();
      await dialog.getByRole("button", { name: "确认提交", exact: true }).click();
      await awaitWrite(2);
      await navigate("/platform-admin/status");
      await fail();
      await navigate(originalTarget);
      await trigger.waitFor();
      observations.lateFailureAfterReturn = await surface
        .getByRole("status", { name: "最近导出反馈", exact: true })
        .innerText();

      await trigger.click();
      await dialog.getByRole("button", { name: "确认提交", exact: true }).click();
      await awaitWrite(3);
      await navigate("/platform-admin/status");
      const pending = held;
      held = null;
      await pending.fulfill({
        status: 200,
        headers: { "content-type": "text/csv", "x-request-id": "p62-local-success" },
        body: "local-test-only\r\n",
      });
      await page.waitForFunction(() => window.__p62DownloadIntent.length > 0);
      observations.lateDownloadIntent = await page.evaluate(() => window.__p62DownloadIntent);
      assert.deepEqual(unexpected, [], "All network local, no actual file download");
      assert.deepEqual(errors, [], "No page errors during diagnostic");
      results.push(observations);
      console.log(JSON.stringify(observations));
    } finally {
      if (held) await held.abort().catch(() => {});
      await context.close();
    }
  }
  console.log(
    JSON.stringify({ diagnosticOnly: true, groups: results.length, filesWritten: 0, port }),
  );
} finally {
  await browser?.close();
  await server.close();
}
