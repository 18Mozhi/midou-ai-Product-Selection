import assert from "node:assert/strict";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import { logPagePlugin } from "./lib/platform-log-page-preview.mjs";
import { logReviewFixtures, logEnvelope } from "./lib/log-review-fixtures.mjs";
import { statusReviewFixtures } from "./lib/status-review-fixtures.mjs";
assert.equal(process.argv.length, 2, "No arguments; actual App lifecycle checks write no files");
const { fixture, nav } = await logReviewFixtures(),
  status = (await statusReviewFixtures()).fixture;
const probe = reservePort();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [logPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
let browser;
const results = [];
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log("P62 actual App lifecycle " + origin);
  for (const width of [1440, 390])
    for (const motion of ["reduce", "no-preference"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        reducedMotion: motion,
      });
      const page = await context.newPage(),
        requests = [],
        failed = [],
        held = new Map(),
        unexpected = [],
        errors = [];
      let mode = "hold",
        checks = 0;
      const check = (a, b, label) => {
        assert.deepEqual(a, b, `${width}/${motion}: ${label}`);
        checks++;
      };
      const payload = (url, id) => {
        const q = url.searchParams.get("query"),
          source = url.searchParams.get("status");
        const items = fixture.items.filter(
          (i) => (!q || i.trace_id === q) && (!source || i.source === source),
        );
        return {
          ...logEnvelope({
            ...fixture,
            items,
            summary: {
              total: items.length,
              api: items.filter((i) => i.source === "api").length,
              worker: items.filter((i) => i.source === "worker").length,
              crawler: items.filter((i) => i.source === "crawler").length,
            },
          }),
          request_id: id,
        };
      };
      const navigate = async (target) => {
        await page.evaluate(async (target) => {
          const { router } = await import("/src/router.ts");
          await router.push(target);
        }, target);
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
      };
      const abortOld = async (id) => {
        const old = held.get(id);
        if (old) {
          held.delete(id);
          await old.route.abort().catch(() => {});
        }
      };
      try {
        await page.addInitScript(() => {
          // Observe real 15s timers without changing delay, callback timing or cancellation.
          const start = window.setTimeout.bind(window),
            stop = window.clearTimeout.bind(window),
            pending = new Set();
          window.__p62Timers = pending;
          window.setTimeout = (fn, ms, ...args) => {
            if (ms !== 15000 || typeof fn !== "function") return start(fn, ms, ...args);
            const id = start(() => {
              pending.delete(id);
              fn(...args);
            }, ms);
            pending.add(id);
            return id;
          };
          window.clearTimeout = (id) => {
            pending.delete(id);
            stop(id);
          };
        });
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("download", () => unexpected.push("download"));
        page.on("requestfailed", (req) => {
          if (req.url().includes("domain=logs")) failed.push(req.headers()["x-request-id"]);
        });
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
            return route.fulfill({
              status: 503,
              json: { error: { code: "local_preferences_unavailable" } },
            });
          if (
            key === "GET /api/v1/platform/management" &&
            url.searchParams.get("domain") === "status"
          )
            return route.fulfill({ json: logEnvelope(status) });
          if (
            key !== "GET /api/v1/platform/management" ||
            url.searchParams.get("domain") !== "logs"
          ) {
            unexpected.push(key + url.search);
            return route.abort();
          }
          const index = requests.length + 1,
            id = "p62-lifecycle-" + index;
          const entry = {
            index,
            id,
            search: url.search,
            requestId: req.headers()["x-request-id"],
            body: req.postData(),
          };
          requests.push(entry);
          if (mode === "failure")
            return route.fulfill({
              status: 400,
              json: {
                error: {
                  code: "local_read_failed",
                  message: "本地首次失败",
                  action_hint: "本地测试：请重新加载。",
                },
                request_id: id,
              },
            });
          if (mode === "hold") {
            held.set(index, { route, url, id });
            return;
          }
          return route.fulfill({ json: payload(url, id) });
        });
        await page.goto(origin + "/platform-admin/logs?query=trace-shared");
        const surface = page.locator(".platform-log-center--review"),
          workspace = surface.locator(".p62-workspace"),
          refresh = surface.getByRole("button", { name: "刷新日志", exact: true });
        // Counts are observed in the request handler; browser UI is the synchronization boundary.
        await surface.getByRole("heading", { name: "正在读取链路日志" }).waitFor();
        check(requests.length, 1, "initial read once");
        check(await page.evaluate(() => window.__p62Timers.size), 1, "one real pending timer");
        await surface.evaluate((el) => {
          window.__p62Root = el;
        });
        mode = "success";
        await navigate("/platform-admin/logs?query=trace-shared&source=crawler");
        await workspace.waitFor();
        await refresh.waitFor();
        check(requests.length, 2, "new filter replaces pending request");
        check(
          requests[1].search,
          "?domain=logs&query=trace-shared&status=crawler",
          "URL source maps to GET status",
        );
        await page.waitForFunction(() => window.__p62Timers.size === 0);
        check(failed.includes(requests[0].requestId), true, "browser aborted superseded GET");
        check(
          await surface.locator(".platform-log-summary strong").innerText(),
          "1",
          "only new crawler result",
        );
        check(
          await surface.locator(":scope > footer code").textContent(),
          "p62-lifecycle-2",
          "new read identity",
        );
        await abortOld(1);
        mode = "hold";
        await navigate("/platform-admin/logs?source=worker");
        await surface.getByRole("button", { name: "正在刷新…", exact: true }).waitFor();
        await navigate("/platform-admin/logs?source=api");
        check(requests.length, 4, "rapid second filter is not dropped");
        check(
          await page.evaluate(() => window.__p62Timers.size),
          1,
          "replacement has only one timer",
        );
        const current = held.get(4);
        held.delete(4);
        await current.route.fulfill({ json: payload(current.url, current.id) });
        await refresh.waitFor();
        check(failed.includes(requests[2].requestId), true, "intermediate GET aborted");
        check(
          await surface.locator(":scope > footer code").textContent(),
          "p62-lifecycle-4",
          "intermediate identity cannot win",
        );
        await abortOld(3);
        const editDraft = async (text) => {
          if (width === 390) await surface.locator(".responsive-filter-drawer__trigger").click();
          const input = page.getByRole("textbox", { name: "检索条件", exact: true });
          await input.fill(text);
          if (width === 390) await page.keyboard.press("Escape");
        };
        await editDraft("未提交草稿");
        check(requests.length, 4, "draft makes no GET");
        await navigate("/platform-admin/status?query=foreign&source=crawler");
        await page.getByRole("heading", { name: "系统状态", exact: true }).first().waitFor();
        await navigate("/platform-admin/status?query=other&source=worker");
        check(requests.length, 4, "other page query does not request logs");
        await navigate("/platform-admin/logs?source=api");
        await refresh.waitFor();
        check(requests.length, 4, "completed unchanged cache is not reread");
        check(
          await surface.evaluate((el) => el === window.__p62Root),
          true,
          "same KeepAlive root reused",
        );
        if (width === 390) await surface.locator(".responsive-filter-drawer__trigger").click();
        check(
          await page.getByRole("textbox", { name: "检索条件", exact: true }).inputValue(),
          "未提交草稿",
          "foreign query did not overwrite local draft",
        );
        if (width === 390) await page.keyboard.press("Escape");
        await refresh.focus();
        await page.keyboard.press("Enter");
        await surface.getByRole("button", { name: "正在刷新…", exact: true }).waitFor();
        check(requests.length, 5, "manual pending read uses current URL not draft");
        await navigate("/platform-admin/status");
        await page.getByRole("heading", { name: "系统状态", exact: true }).first().waitFor();
        check(failed.includes(requests[4].requestId), true, "leaving cancels pending log read");
        check(
          await page.evaluate(() => window.__p62Timers.size),
          0,
          "leave clears log timer immediately",
        );
        mode = "success";
        await navigate("/platform-admin/logs?source=api");
        await refresh.waitFor();
        check(requests.length, 6, "interrupted cached page resumes exactly once");
        check(
          await surface.locator(":scope > footer code").textContent(),
          "p62-lifecycle-6",
          "resumed result owns page",
        );
        await abortOld(5);
        await navigate("/platform-admin/status");
        await page.getByRole("heading", { name: "系统状态", exact: true }).first().waitFor();
        await navigate("/platform-admin/logs?source=crawler&query=trace-shared");
        await refresh.waitFor();
        check(requests.length, 7, "return with changed filters reads once");
        await navigate("/platform-admin/logs?source=crawler&query=%20trace-shared%20");
        await refresh.waitFor();
        check(requests.length, 7, "equivalent normalized filter not reread");
        check(
          await surface.locator(":scope > footer code").textContent(),
          "p62-lifecycle-7",
          "normalized navigation preserves completed identity",
        );
        mode = "failure";
        await page.reload();
        const initialState = surface.locator(".platform-log-state");
        await initialState
          .getByRole("heading", { name: "链路日志暂不可用", exact: true })
          .waitFor();
        check(requests.length, 8, "fresh first failure has no cached snapshot");
        mode = "hold";
        const retry = initialState.locator(".platform-log-reload"),
          retryNode = await retry.elementHandle();
        await retry.focus();
        await page.keyboard.press("Enter");
        await initialState.getByRole("heading", { name: "正在读取链路日志" }).waitFor();
        await navigate("/platform-admin/logs?source=api");
        check(requests.length, 10, "pending retry replaced for new URL");
        check(
          await retryNode.evaluate((el) => el.isConnected && el === document.activeElement),
          true,
          "same-page replacement retains focused retry node",
        );
        check(
          await page.evaluate(() => window.__p62Timers.size),
          1,
          "replacement retry owns one timer",
        );
        const replaced = held.get(10);
        held.delete(10);
        await replaced.route.fulfill({ json: payload(replaced.url, replaced.id) });
        await refresh.waitFor();
        check(
          await refresh.evaluate((el) => el === document.activeElement),
          true,
          "replacement success hands focus to refresh",
        );
        check(failed.includes(requests[8].requestId), true, "superseded retry aborted");
        await abortOld(9);
        check(await page.evaluate(() => window.__p62Timers.size), 0, "all read timers clear");
        check(held.size, 0, "all held intercepts released");
        check(
          requests.every((r) => r.body === null),
          true,
          "no write bodies",
        );
        check(unexpected, [], "no unknown,external,write,download requests");
        check(errors, [], "no browser errors");
        results.push({ width, motion, checks, requests: requests.length });
        console.log(JSON.stringify(results.at(-1)));
      } finally {
        await Promise.all([...held.values()].map((h) => h.route.abort().catch(() => {})));
        await context.close();
      }
    }
  console.log(
    JSON.stringify({
      groups: results.length,
      checks: results.reduce((n, r) => n + r.checks, 0),
      logGets: results.reduce((n, r) => n + r.requests, 0),
      port,
      filesWritten: 0,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
