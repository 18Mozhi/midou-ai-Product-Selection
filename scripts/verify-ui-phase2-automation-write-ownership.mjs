import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";
import { buildAutomationDesignData } from "./lib/ui-phase2-automation-design-data.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = "/__p27_write_ownership.js";
// Isolated verifier host, not a production route. Native actions use the original Vue component.
const host = `
import {createApp,h,ref,nextTick} from 'vue';
import {createRouter,createMemoryHistory} from 'vue-router';
import AutomationRuleCenter from '/src/components/AutomationRuleCenter.vue';
const router=createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const Host={setup(){const child=ref(),shown=ref(true);let retired;
const ui=()=>shown.value?child.value.$.setupState:retired;
window.writeHost={navigate:query=>router.push({path:'/automations',query}),
duplicate:()=>{void ui().create();void ui().status(ui().rules[0]);},
busy:()=>ui().busy,route:()=>router.currentRoute.value.fullPath,
snapshot:()=>JSON.stringify({form:ui().form,editing:ui().editing,reason:ui().editReason,open:ui().showCreate,
selected:ui().selected,rows:ui().rules,state:ui().state,notice:ui().notice,requestId:ui().requestId}),
destroy:async()=>{retired=ui();shown.value=false;await nextTick();}};
return()=>h('main',[shown.value?h(AutomationRuleCenter,{ref:child,apiBaseUrl:'/api/v1'}):h('p',{id:'destroyed'},'Destroyed')]);}};
await router.push('/automations');await router.isReady();createApp(Host).use(router).mount('#host');`;
const server = await createServer({
  configFile: path.join(repo, "apps/web/vite.config.ts"),
  server: { host: "127.0.0.1", port: 5175, strictPort: true, open: false },
  plugins: [
    {
      name: "p27-isolated-write-ownership",
      resolveId: (id) => (id === entry ? id : undefined),
      load: (id) => (id === entry ? host : undefined),
      configureServer(instance) {
        instance.middlewares.use((request, response, next) => {
          if (request.url !== "/__p27_write_ownership/") return next();
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="host"></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const data = await buildAutomationDesignData(repo),
  a = data.list[0];
const b = { ...a, id: "00000000-0000-4000-8000-000000000902", name: "合成规则B" };
const env = (data, request_id = "current") => ({ data, request_id, trace_id: request_id });
const settle = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const reports = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 390])
    for (const operation of ["create", "edit", "status"]) {
      for (const transition of [
        "new-editor-success",
        "new-editor-error",
        "destroy-success",
        "destroy-error",
        "current-success",
      ]) {
        console.log(JSON.stringify({ checking: { width, operation, transition } }));
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
          locale: "zh-CN",
        });
        let release;
        const pending = new Promise((r) => {
          release = r;
        });
        try {
          const page = await context.newPage(),
            errors = [],
            unexpected = [],
            writes = [];
          let rows = [a, b],
            reads = 0;
          page.on("pageerror", (e) => errors.push(e.message));
          await page.route("**/*", async (route) => {
            const request = route.request(),
              url = new URL(request.url());
            if (!url.pathname.startsWith("/api/")) {
              if (url.origin === "http://127.0.0.1:5175") return route.continue();
              unexpected.push(url.href);
              return route.abort();
            }
            if (request.method() !== "GET") {
              const expectedPath =
                operation === "create"
                  ? "/api/v1/automations"
                  : `/api/v1/automations/${a.id}${operation === "status" ? "/actions" : ""}`;
              assert.equal(url.pathname, expectedPath);
              assert.equal(request.method(), operation === "edit" ? "PATCH" : "POST");
              writes.push({
                method: request.method(),
                body: request.postDataJSON(),
                key: request.headers()["idempotency-key"],
              });
              await pending;
              if (transition.endsWith("error"))
                return route.fulfill({
                  status: 409,
                  json: {
                    error: { code: "version_conflict", action_hint: "合成旧写入冲突" },
                    request_id: "old-write-error",
                    trace_id: "old-write-error",
                  },
                });
              rows = [
                { ...a, version: 2, ...(operation === "status" ? { status: "paused" } : {}) },
                b,
              ];
              return route.fulfill({
                status: operation === "create" ? 201 : 200,
                json: env(rows[0], "write-result"),
              });
            }
            reads++;
            if (url.pathname === "/api/v1/automations")
              return route.fulfill({ json: env(rows, "list") });
            if (url.pathname === "/api/v1/tasks/member-options")
              return route.fulfill({ json: env(data.members, "members") });
            const row = rows.find((r) => url.pathname === `/api/v1/automations/${r.id}`);
            if (row) return route.fulfill({ json: env({ ...row, executions: [] }, "detail") });
            unexpected.push(url.pathname);
            return route.abort();
          });
          await page.goto("http://127.0.0.1:5175/__p27_write_ownership/");
          await page.getByRole("heading", { name: a.name, exact: true }).waitFor();
          const requested = page
            .waitForRequest((r) => r.method() !== "GET" && r.url().includes("/api/v1/automations"))
            .catch((error) => error);
          if (operation === "create") {
            await page.getByRole("button", { name: "创建规则", exact: true }).click();
            await page.getByRole("button", { name: /审批超时提醒/ }).click();
            await page.getByLabel("规则负责人").selectOption(data.members[0].id);
            await page.getByRole("button", { name: "创建并启用", exact: true }).click();
          } else if (operation === "edit") {
            await page
              .locator(".automation-grid article")
              .first()
              .getByRole("button", { name: "编辑", exact: true })
              .click();
            await page.getByLabel("修改原因", { exact: true }).fill("提交时原因");
            await page.getByRole("button", { name: "保存修改", exact: true }).click();
          } else
            await page
              .locator(".automation-grid article")
              .first()
              .getByRole("button", { name: "暂停", exact: true })
              .click();
          const requestResult = await requested;
          if (requestResult instanceof Error) {
            throw new Error(
              JSON.stringify({
                width,
                operation,
                transition,
                errors,
                body: (await page.locator("body").innerText()).slice(-3000),
              }),
              { cause: requestResult },
            );
          }
          await page.evaluate(() => window.writeHost.duplicate());
          assert.equal(writes.length, 1, "function guards prevent repeated or mixed writes");
          assert.ok(writes[0].key, "real API client idempotency header");
          if (operation === "status")
            assert.deepEqual(writes[0].body, {
              action: "pause",
              expected_version: a.version,
              reason: "由规则管理页人工暂停",
            });
          else {
            assert.equal(writes[0].body.action_assignee_id, null);
            assert.equal(writes[0].body.owner_id, data.members[0].id);
            if (operation === "edit") {
              assert.equal(writes[0].body.expected_version, a.version);
              assert.equal(writes[0].body.reason, "提交时原因");
            }
          }
          if (transition.startsWith("new-editor")) {
            if (operation !== "status")
              await page.getByRole("button", { name: "取消", exact: true }).click();
            await page.evaluate(
              (id) => window.writeHost.navigate({ rule: id, action: "edit" }),
              b.id,
            );
            await page.getByLabel("规则名称", { exact: true }).fill("后来窗口草稿");
            await page.getByLabel("修改原因", { exact: true }).fill("后来窗口原因");
          } else if (transition.startsWith("destroy"))
            await page.evaluate(() => window.writeHost.destroy());
          await settle(page);
          const before = await page.evaluate(() => window.writeHost.snapshot()),
            readCount = reads;
          const response = page.waitForResponse(
            (r) => r.request().method() !== "GET" && r.url().includes("/api/v1/automations"),
          );
          release();
          await response;
          await settle(page);
          if (!transition.startsWith("destroy"))
            await page.waitForFunction(() => !window.writeHost.busy());
          if (transition !== "current-success") {
            assert.equal(await page.evaluate(() => window.writeHost.snapshot()), before);
            assert.equal(reads, readCount, "obsolete write does not start refresh");
          } else {
            assert.equal(await page.locator("dialog[open]").count(), 0);
            assert.match(
              await page.locator(".automation-notice").innerText(),
              operation === "create" ? /已启用/ : operation === "edit" ? /已更新/ : /已人工暂停/,
            );
            assert.equal(await page.evaluate(() => window.writeHost.route()), "/automations");
            assert.ok(reads > readCount, "current result refreshes facts");
          }
          assert.equal(writes.length, 1);
          assert.deepEqual(errors, []);
          assert.deepEqual(unexpected, []);
          assert.deepEqual(await context.cookies(), []);
          assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
          reports.push({ width, operation, transition, mockWrites: writes.length, passed: true });
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
  JSON.stringify({ reports, browserClosed: true, serverClosed: true, realBusinessWrites: 0 }),
);
