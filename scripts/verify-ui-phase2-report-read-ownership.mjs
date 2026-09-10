import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";
import { buildReportDesignData } from "./lib/ui-phase2-report-design-data.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = "/__p28_read_ownership.js";
// Isolated host mounts the original Vue and router; no test hooks added to production.
const harness = `
import {createApp,h,ref,nextTick} from 'vue';
import {createRouter,createMemoryHistory} from 'vue-router';
import ReportCenter from '/src/components/ReportCenter.vue';
const router=createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const Host={setup(){const child=ref(),shown=ref(true);let retired;
const read=ui=>JSON.stringify({report:ui.report,rows:ui.exports,selected:ui.selectedExport,state:ui.state,notice:ui.notice,requestId:ui.requestId});
window.reportReadHost={navigate:query=>router.push({path:'/reports',query}),reload:()=>child.value.$.setupState.load(true),
snapshot:()=>read(shown.value?child.value.$.setupState:retired),query:()=>router.currentRoute.value.query,
destroy:async()=>{retired=child.value.$.setupState;shown.value=false;await nextTick();}};
return()=>h('main',[shown.value?h(ReportCenter,{ref:child,apiBaseUrl:'/api/v1'}):h('p',{id:'destroyed'},'Destroyed')]);}};
await router.push('/reports');await router.isReady();createApp(Host).use(router).mount('#host');`;
const data = await buildReportDesignData(repo),
  a = data.exports[0],
  b = data.exports[2];
const server = await createServer({
  configFile: path.join(repo, "apps/web/vite.config.ts"),
  server: { host: "127.0.0.1", port: 5175, strictPort: true, open: false },
  plugins: [
    {
      name: "isolated-report-read-ownership",
      resolveId: (id) => (id === entry ? id : undefined),
      load: (id) => (id === entry ? harness : undefined),
      configureServer(instance) {
        instance.middlewares.use((request, response, next) => {
          if (request.url !== "/__p28_read_ownership/") return next();
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="host"></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const envelope = (data, id = "current") => ({ data, request_id: id, trace_id: id });
const settle = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const results = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 390]) {
    for (const scenario of [
      "newer-type",
      "newer-type-error",
      "failed-sibling",
      "detail-B",
      "detail-B-error",
      "detail-clear",
      "detail-reopen",
      "close-refresh",
      "destroy-list",
      "destroy-detail",
      "initial-deep-link",
    ]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
      });
      let release, startHeld;
      const pending = new Promise((r) => {
          release = r;
        }),
        heldStarted = new Promise((r) => {
          startHeld = r;
        });
      try {
        const page = await context.newPage(),
          errors = [],
          unexpected = [],
          reads = [];
        let reportCount = 0,
          detailCount = 0;
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/*", async (route) => {
          const request = route.request(),
            url = new URL(request.url());
          if (!url.pathname.startsWith("/api/")) {
            if (url.origin === "http://127.0.0.1:5175") return route.continue();
            unexpected.push(url.href);
            return route.abort();
          }
          if (request.method() !== "GET") {
            unexpected.push(request.method() + " " + url.pathname);
            return route.abort();
          }
          reads.push(url.pathname);
          const isReport = url.pathname.startsWith("/api/v1/reports/"),
            isList = url.pathname === "/api/v1/report-exports",
            isA = url.pathname === `/api/v1/report-exports/${a.id}`,
            isB = url.pathname === `/api/v1/report-exports/${b.id}`;
          if (isReport) reportCount++;
          if (isA) detailCount++;
          const hold =
            (isReport &&
              reportCount === 1 &&
              ["newer-type", "newer-type-error", "destroy-list", "initial-deep-link"].includes(
                scenario,
              )) ||
            (isList && scenario === "failed-sibling") ||
            (isA &&
              detailCount === (scenario === "close-refresh" ? 2 : 1) &&
              [
                "detail-B",
                "detail-B-error",
                "detail-clear",
                "detail-reopen",
                "close-refresh",
                "destroy-detail",
              ].includes(scenario));
          if (hold) {
            startHeld();
            await pending;
          }
          if (
            (hold && ["newer-type-error", "detail-B-error"].includes(scenario)) ||
            (isReport && scenario === "failed-sibling")
          )
            return route.fulfill({
              status: 403,
              headers: hold ? { "x-held-read": "yes" } : {},
              json: {
                error: { code: "forbidden", action_hint: "合成读取失败" },
                request_id: "failed-read",
                trace_id: "failed-read",
              },
            });
          const result = isReport
            ? data.reports[url.pathname.split("/").at(-1)]
            : isList
              ? [a, b]
              : isA
                ? { ...a, version: hold ? 1 : 88 }
                : isB
                  ? b
                  : undefined;
          if (!result) {
            unexpected.push(url.pathname);
            return route.abort();
          }
          return route.fulfill({
            headers: hold ? { "x-held-read": "yes" } : {},
            json: envelope(
              result,
              hold ? "old-read" : isA || isB ? "current-detail" : "current-list",
            ),
          });
        });
        await page.goto("http://127.0.0.1:5175/__p28_read_ownership/");
        await page.getByRole("button", { name: "导出当前报表 CSV", exact: true }).waitFor();
        if (["newer-type", "newer-type-error"].includes(scenario)) {
          await heldStarted;
          await page.getByRole("button", { name: "趋势分析", exact: true }).click();
          await page.waitForFunction(
            () => JSON.parse(window.reportReadHost.snapshot()).report?.type === "trend",
          );
        } else if (scenario === "failed-sibling") {
          await page.getByRole("heading", { name: "无权读取报表", exact: true }).waitFor();
        } else if (scenario === "destroy-list") {
          await heldStarted;
          await page.evaluate(() => window.reportReadHost.destroy());
        } else if (scenario === "initial-deep-link") {
          await heldStarted;
          await page.evaluate((id) => window.reportReadHost.navigate({ export: id }), b.id);
          await page.getByRole("dialog", { name: "团队绩效导出详情", exact: true }).waitFor();
        } else {
          await page.waitForFunction(
            () => JSON.parse(window.reportReadHost.snapshot()).state === "ready",
          );
          await page
            .locator(".report-export-list article")
            .first()
            .getByRole("button", { name: "查看详情", exact: true })
            .click();
          if (scenario === "close-refresh") {
            await page.getByRole("dialog", { name: "机会分析导出详情", exact: true }).waitFor();
            await page.evaluate(() => {
              window.reportReadHost.reload();
            });
            await heldStarted;
            await page.getByRole("button", { name: "关闭导出详情", exact: true }).click();
          } else {
            await heldStarted;
            if (scenario.startsWith("detail-B")) {
              await page.evaluate((id) => window.reportReadHost.navigate({ export: id }), b.id);
              await page.getByRole("dialog", { name: "团队绩效导出详情", exact: true }).waitFor();
            } else if (scenario === "destroy-detail")
              await page.evaluate(() => window.reportReadHost.destroy());
            else {
              await page.evaluate(() => window.reportReadHost.navigate({}));
              if (scenario === "detail-reopen") {
                await page.evaluate((id) => window.reportReadHost.navigate({ export: id }), a.id);
                await page.getByRole("dialog", { name: "机会分析导出详情", exact: true }).waitFor();
              }
            }
          }
        }
        await heldStarted;
        await settle(page);
        const before = await page.evaluate(() => window.reportReadHost.snapshot());
        const response = page.waitForResponse((r) => r.headers()["x-held-read"] === "yes");
        release();
        await (await response).finished();
        await settle(page);
        const after = await page.evaluate(() => window.reportReadHost.snapshot());
        if (scenario === "initial-deep-link") {
          assert.equal(JSON.parse(after).selected.id, b.id);
          assert.equal(JSON.parse(after).state, "ready");
          assert.equal(
            reads.filter((p) => p === `/api/v1/report-exports/${b.id}`).length,
            1,
            "old list must not replay newer detail",
          );
        } else assert.equal(after, before, scenario);
        if (["detail-clear", "close-refresh"].includes(scenario)) {
          assert.equal(await page.getByRole("dialog").count(), 0);
          assert.equal(await page.evaluate(() => window.reportReadHost.query().export), undefined);
        }
        if (scenario === "detail-reopen") assert.equal(JSON.parse(after).selected.version, 88);
        assert.deepEqual(errors, []);
        assert.deepEqual(unexpected, []);
        assert.deepEqual(await context.cookies(), []);
        assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
        results.push({ width, scenario, reads: reads.length, ownership: "passed" });
      } finally {
        release();
        await context.close();
      }
    }
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
console.log(
  JSON.stringify({ cases: results, browserClosed: true, serverClosed: true, businessWrites: 0 }),
);
