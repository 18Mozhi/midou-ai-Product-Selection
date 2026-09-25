import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";
import { buildJourneyDesignData } from "./lib/ui-phase2-journey-design-data.mjs";

// Test-only Vite entry: real Vue/KeepAlive/SelectionJourney; no production route or service.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = "/__p16_write_lifetime.js";
const harness = `
import {createApp,h,ref,KeepAlive} from 'vue';
import {createRouter,createMemoryHistory} from 'vue-router';
import SelectionJourney from '/src/components/SelectionJourney.vue';
const router=createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const Host={setup(){const mounted=ref(true),visible=ref(true);return()=>h('main',{id:'app'},[
 h('nav',{'aria-label':'Test lifecycle controls'},[
 h('button',{id:'destroy',onClick:()=>{mounted.value=false}},'Destroy instance'),
 h('button',{id:'mount',onClick:()=>{visible.value=true;mounted.value=true}},'Mount next'),
 h('button',{id:'hide',onClick:()=>{visible.value=false}},'Hide cached page'),
 h('button',{id:'show',onClick:()=>{visible.value=true}},'Show cached page')]),
 mounted.value?h(KeepAlive,null,{default:()=>visible.value?h(SelectionJourney,{apiBaseUrl:'/api/v1'}):h('p',{id:'away'},'Away')}):h('p',{id:'destroyed'},'Destroyed')]);}};
await router.push('/opportunities/start');await router.isReady();createApp(Host).use(router).mount('#host');
`;
const server = await createServer({
  configFile: path.join(repo, "apps/web/vite.config.ts"),
  server: { host: "127.0.0.1", port: 5175, strictPort: true, open: false },
  plugins: [
    {
      name: "isolated-journey-lifetime",
      resolveId(id) {
        if (id === entry) return id;
      },
      load(id) {
        if (id === entry) return harness;
      },
      configureServer(instance) {
        instance.middlewares.use((request, response, next) => {
          if (request.url !== "/__p16_write_lifetime/") return next();
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><div id="host"></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const data = await buildJourneyDesignData(repo),
  key = "scoutops.selection-journey.active-id";
const old = structuredClone(data.sample),
  newer = structuredClone(data.sample);
newer.id = "00000000-0000-4000-8000-000000008102";
newer.input_value = "新实例旅程";
const envelope = (data) => ({ data, request_id: "lifetime-check", trace_id: "lifetime-check" });
const settle = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
let browser;
const reports = [];
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  for (const action of ["create", "decide"]) {
    for (const mode of ["destroy-success", "destroy-failure", "cache-success", "storage-failure"]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
      });
      let release;
      const pending = new Promise((r) => {
        release = r;
      });
      try {
        const page = await context.newPage(),
          errors = [],
          unexpected = [],
          writes = [],
          reads = [];
        let current = structuredClone(old);
        page.on("pageerror", (e) => errors.push(e.message));
        await page.route("**/*", async (route) => {
          const request = route.request(),
            url = new URL(request.url());
          if (!url.pathname.startsWith("/api/")) {
            if (url.origin === "http://127.0.0.1:5175") return route.continue();
            unexpected.push(url.href);
            return route.abort();
          }
          if (
            request.method() === "GET" &&
            [old.id, newer.id].some((id) => url.pathname === `/api/v1/selection-journeys/${id}`)
          ) {
            reads.push(url.pathname);
            return route.fulfill({
              json: envelope(url.pathname.endsWith(newer.id) ? newer : current),
            });
          }
          const writePath =
            action === "create"
              ? "/api/v1/selection-journeys"
              : `/api/v1/selection-journeys/${old.id}/decisions`;
          if (request.method() === "POST" && url.pathname === writePath) {
            writes.push({ path: url.pathname, body: request.postDataJSON() });
            await pending;
            current =
              action === "create"
                ? { ...old, state: "running", task_status: "running" }
                : {
                    ...old,
                    state: "decided",
                    decision: {
                      action: "observe",
                      reason: "原请求原因",
                      created_at: "2026-09-10T00:00:00Z",
                    },
                  };
            return route.fulfill({
              status: mode === "destroy-failure" ? 500 : 200,
              headers: { "x-lifetime-result": mode },
              json:
                mode === "destroy-failure"
                  ? {
                      error: { code: "fixture_write_failed", action_hint: "旧实例失败" },
                      request_id: "old-error",
                    }
                  : envelope(current),
            });
          }
          unexpected.push(request.method() + " " + url.pathname);
          return route.abort();
        });
        await page.addInitScript(
          ({ key, id, action, mode }) => {
            if (id) localStorage.setItem(key, id);
            if (mode === "storage-failure") {
              const method = action === "create" ? "setItem" : "removeItem";
              Object.defineProperty(Storage.prototype, method, {
                configurable: true,
                value() {
                  throw new DOMException("Storage unavailable", "SecurityError");
                },
              });
            }
          },
          { key, id: action === "decide" ? old.id : null, action, mode },
        );
        await page.goto("http://127.0.0.1:5175/__p16_write_lifetime/");
        if (action === "create") {
          await page.getByLabel("商品关键词", { exact: true }).fill("原商品关键词");
          await page.getByRole("button", { name: "创建真实选品任务", exact: true }).click();
        } else {
          await page.getByLabel("决策原因").fill("原请求原因");
          await page.getByRole("button", { name: "保存审计决策", exact: true }).click();
        }
        await page.waitForFunction(() =>
          document.querySelector('.selection-journey[aria-busy="true"]'),
        );
        assert.equal(writes.length, 1);
        if (mode === "storage-failure") {
          const response = page.waitForResponse((r) => r.headers()["x-lifetime-result"] === mode);
          release();
          await (await response).finished();
          await settle(page);
          assert.equal(
            await page.locator(".selection-status").getAttribute("data-state"),
            action === "create" ? "running" : "decided",
          );
          assert.match(await page.getByRole("status").textContent(), /服务器状态不受影响/u);
          assert.equal(await page.locator(".ui-state-panel").count(), 0);
          assert.equal(
            writes.length,
            1,
            "storage failure must not replay a confirmed server write",
          );
        } else if (mode.startsWith("destroy")) {
          await page.locator("#destroy").click();
          await page.locator("#destroyed").waitFor();
          await page.evaluate(({ key, id }) => localStorage.setItem(key, id), {
            key,
            id: newer.id,
          });
          await page.locator("#mount").click();
          await page.getByText(newer.input_value, { exact: false }).waitFor();
          await page.getByLabel("决策原因").fill("新实例草稿不得清空");
          const response = page.waitForResponse((r) => r.headers()["x-lifetime-result"] === mode);
          release();
          await (await response).finished();
          await settle(page);
          assert.equal(await page.evaluate((key) => localStorage.getItem(key), key), newer.id);
          assert.equal(await page.getByLabel("决策原因").inputValue(), "新实例草稿不得清空");
          assert.ok(
            (await page.locator(".selection-status").textContent()).includes(newer.input_value),
          );
          assert.equal(await page.locator(".ui-state-panel").count(), 0);
          assert.equal(await page.locator(".selection-journey").getAttribute("aria-busy"), "false");
        } else {
          await page.locator("#hide").click();
          await page.locator("#away").waitFor();
          const response = page.waitForResponse((r) => r.headers()["x-lifetime-result"] === mode);
          release();
          await (await response).finished();
          await settle(page);
          assert.equal(
            await page.evaluate((key) => localStorage.getItem(key), key),
            action === "create" ? old.id : null,
          );
          const beforeReads = reads.length;
          await page.waitForTimeout(2200);
          assert.equal(reads.length, beforeReads, "hidden cached page must not poll");
          await page.locator("#show").click();
          await page.locator(".selection-status").waitFor();
          await page.waitForFunction(() =>
            document.querySelector('.selection-journey[aria-busy="false"]'),
          );
          assert.equal(reads.length, beforeReads + 1, "cache reactivation refreshes once");
          assert.equal(
            await page.locator(".selection-status").getAttribute("data-state"),
            action === "create" ? "running" : "decided",
          );
        }
        assert.deepEqual(writes, [
          {
            path:
              action === "create"
                ? "/api/v1/selection-journeys"
                : `/api/v1/selection-journeys/${old.id}/decisions`,
            body:
              action === "create"
                ? { input_kind: "keyword", input_value: "原商品关键词" }
                : { action: "observe", reason: "原请求原因", selected_raw_evidence_id: null },
          },
        ]);
        assert.deepEqual(errors, []);
        assert.deepEqual(unexpected, []);
        reports.push({ action, mode, writes: writes.length, currentStateProtected: true });
      } finally {
        release();
        await context.close();
      }
    }
  }
  console.log(
    JSON.stringify({
      boundary:
        "mounted real Vue in test lifecycle host, intercepted HTTP; not real scope switch or production",
      cases: reports,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
