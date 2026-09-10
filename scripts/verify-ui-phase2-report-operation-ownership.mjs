import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";
import { buildReportDesignData } from "./lib/ui-phase2-report-design-data.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = "/__p28_operation_ownership.js";
const host = `
import {createApp,h,ref,nextTick} from 'vue';
import {createRouter,createMemoryHistory} from 'vue-router';
import ReportCenter from '/src/components/ReportCenter.vue';
const router=createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const Host={setup(){const child=ref(),shown=ref(true);let retired;
const ui=()=>shown.value?child.value.$.setupState:retired;
window.reportOperationHost={navigate:query=>router.push({path:'/reports',query}),
duplicateCreate:()=>ui().createExport(),duplicateRefresh:()=>ui().refresh(),
flags:()=>({busy:ui().busy,refreshing:ui().refreshing,downloadingId:ui().downloadingId}),
snapshot:()=>JSON.stringify({report:ui().report,rows:ui().exports,selected:ui().selectedExport,state:ui().state,notice:ui().notice,requestId:ui().requestId}),
destroy:async()=>{retired=ui();shown.value=false;await nextTick();}};
return()=>h('main',[shown.value?h(ReportCenter,{ref:child,apiBaseUrl:'/api/v1'}):h('p',{id:'destroyed'},'Destroyed')]);}};
await router.push('/reports');await router.isReady();createApp(Host).use(router).mount('#host');`;
const data = await buildReportDesignData(repo),
  a = data.exports[0],
  b = data.exports[2];
const csv = "value\r\nsynthetic\r\n";
const server = await createServer({
  configFile: path.join(repo, "apps/web/vite.config.ts"),
  server: { host: "127.0.0.1", port: 5175, strictPort: true, open: false },
  plugins: [
    {
      name: "isolated-report-operation-ownership",
      resolveId: (id) => (id === entry ? id : undefined),
      load: (id) => (id === entry ? host : undefined),
      configureServer(instance) {
        instance.middlewares.use((request, response, next) => {
          if (request.url !== "/__p28_operation_ownership/") return next();
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="host"></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const env = (data, id = "current") => ({ data, request_id: id, trace_id: id });
const settle = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const results = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 390]) {
    for (const scenario of [
      "create-current-success",
      "create-current-error",
      "create-view-success",
      "create-view-error",
      "create-destroy-success",
      "create-destroy-error",
      "create-followup",
      "download-current",
      "download-view",
      "download-view-error",
      "download-destroy-error",
      "refresh-duplicate",
    ]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        acceptDownloads: true,
      });
      let release, markHeld, download;
      const pending = new Promise((r) => {
          release = r;
        }),
        held = new Promise((r) => {
          markHeld = r;
        });
      try {
        const page = await context.newPage(),
          errors = [],
          unexpected = [],
          writes = [],
          rawReads = [];
        let reports = 0;
        await page.clock.install({ time: new Date(data.now) });
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/*", async (route) => {
          const request = route.request(),
            url = new URL(request.url());
          if (!url.pathname.startsWith("/api/")) {
            if (url.origin === "http://127.0.0.1:5175") return route.continue();
            unexpected.push(url.href);
            return route.abort();
          }
          const isCreate = url.pathname === "/api/v1/report-exports" && request.method() === "POST";
          const isDownload = url.pathname === `/api/v1/report-exports/${a.id}/download`;
          const isReport = url.pathname.startsWith("/api/v1/reports/");
          if (request.method() !== "GET" && !isCreate) {
            unexpected.push(request.method() + " " + url.pathname);
            return route.abort();
          }
          if (isCreate)
            writes.push({
              url: url.pathname,
              body: request.postDataJSON(),
              headers: request.headers(),
            });
          if (isReport) reports++;
          if (isDownload) rawReads.push(request.headers());
          const hold =
            (isCreate && scenario !== "create-followup") ||
            isDownload ||
            (isReport &&
              reports === 2 &&
              ["create-followup", "refresh-duplicate"].includes(scenario));
          if (hold) {
            markHeld();
            await pending;
          }
          if (hold && scenario.endsWith("error"))
            return route.fulfill({
              status: 403,
              headers: { "x-operation-held": "yes" },
              json: {
                error: { code: "forbidden", action_hint: "合成操作失败" },
                request_id: "operation-error",
                trace_id: "operation-error",
              },
            });
          if (isDownload)
            return route.fulfill({
              headers: { "x-operation-held": "yes", "content-type": "text/csv; charset=utf-8" },
              body: csv,
            });
          const result = isCreate
            ? data.replacement
            : isReport
              ? data.reports[url.pathname.split("/").at(-1)]
              : url.pathname === "/api/v1/report-exports"
                ? [a, b]
                : url.pathname === `/api/v1/report-exports/${b.id}`
                  ? b
                  : url.pathname === `/api/v1/report-exports/${a.id}`
                    ? a
                    : undefined;
          if (!result) {
            unexpected.push(url.pathname);
            return route.abort();
          }
          return route.fulfill({
            status: isCreate ? 202 : 200,
            headers: hold ? { "x-operation-held": "yes" } : {},
            json: env(result, hold ? "operation-held" : "current-read"),
          });
        });
        await page.goto("http://127.0.0.1:5175/__p28_operation_ownership/");
        await page.waitForFunction(
          () =>
            window.reportOperationHost &&
            JSON.parse(window.reportOperationHost.snapshot()).state === "ready",
        );
        let downloadEvent;
        if (scenario.startsWith("create")) {
          await page.getByRole("button", { name: "导出当前报表 CSV", exact: true }).click();
          await held;
          await page.evaluate(() => window.reportOperationHost.duplicateCreate());
          assert.equal(
            writes.length,
            1,
            "source handler duplicate must not dispatch a second POST",
          );
          assert.deepEqual(writes[0].body, { report_type: "opportunity", format: "csv" });
          assert.match(writes[0].headers["idempotency-key"], /^[0-9a-f-]{36}$/);
        } else if (scenario.startsWith("download")) {
          if (!scenario.endsWith("error")) downloadEvent = page.waitForEvent("download");
          await page
            .locator(".report-export-list article")
            .first()
            .getByRole("button", { name: "下载", exact: true })
            .click();
          await held;
        } else {
          await page.getByRole("button", { name: "刷新状态", exact: true }).click();
          await held;
          await page.evaluate(() => window.reportOperationHost.duplicateRefresh());
          assert.equal(reports, 2);
        }
        if (scenario.includes("view") || scenario === "create-followup") {
          await page.evaluate((id) => window.reportOperationHost.navigate({ export: id }), b.id);
          await page.getByRole("dialog", { name: "团队绩效导出详情", exact: true }).waitFor();
        } else if (scenario.includes("destroy"))
          await page.evaluate(() => window.reportOperationHost.destroy());
        await settle(page);
        const before = await page.evaluate(() => window.reportOperationHost.snapshot());
        const response = page.waitForResponse((r) => r.headers()["x-operation-held"] === "yes");
        release();
        await (await response).finished();
        await settle(page);
        if (downloadEvent) {
          download = await downloadEvent;
          const file = await download.path();
          console.log("temporary_csv_download " + file);
          assert.equal(download.suggestedFilename(), a.filename);
          assert.equal(await readFile(file, "utf8"), csv);
          assert.equal(rawReads.length, 1);
          assert.equal(rawReads[0].accept, "application/octet-stream");
          assert.equal(rawReads[0]["x-trace-id"], rawReads[0]["x-request-id"]);
        }
        if (scenario === "create-current-success" || scenario === "create-followup")
          await page.waitForFunction(
            () =>
              !window.reportOperationHost.flags().busy &&
              JSON.parse(window.reportOperationHost.snapshot()).state === "ready",
          );
        const after = await page.evaluate(() => window.reportOperationHost.snapshot());
        if (scenario === "create-current-success")
          assert.match(JSON.parse(after).notice, /导出任务已提交/);
        else if (scenario === "create-current-error")
          assert.equal(JSON.parse(after).requestId, "operation-error");
        else if (scenario === "create-followup") assert.equal(JSON.parse(after).selected.id, b.id);
        else if (scenario === "refresh-duplicate")
          assert.equal(
            await page.evaluate(() => window.reportOperationHost.flags().refreshing),
            false,
          );
        else assert.equal(after, before, scenario);
        assert.deepEqual(errors, []);
        assert.deepEqual(unexpected, []);
        assert.deepEqual(await context.cookies(), []);
        assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
        results.push({
          width,
          scenario,
          isolatedPosts: writes.length,
          fileBytesChecked: Boolean(download),
          ownership: "passed",
        });
      } finally {
        release();
        if (download) {
          const file = await download.path();
          await download.delete();
          console.log("temporary_csv_download_deleted " + file);
        }
        await context.close();
      }
    }
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
console.log(
  JSON.stringify({
    cases: results,
    browserClosed: true,
    serverClosed: true,
    realBusinessWrites: 0,
  }),
);
