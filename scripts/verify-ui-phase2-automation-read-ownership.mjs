import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";
import { buildAutomationDesignData } from "./lib/ui-phase2-automation-design-data.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = "/__p27_read_ownership.js";
// Test-only host: original component, real Vue/router/DOM; no production route or component edits.
const harness = `
import {createApp,h,ref,nextTick} from 'vue';
import {createRouter,createMemoryHistory} from 'vue-router';
import AutomationRuleCenter from '/src/components/AutomationRuleCenter.vue';
const router=createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const Host={setup(){const child=ref(),shown=ref(true);let retired;
const read=ui=>JSON.stringify({rules:ui.rules,members:ui.memberOptions,selected:ui.selected,state:ui.state,notice:ui.notice,requestId:ui.requestId,preview:ui.preview,previewing:ui.previewing});
window.automationReadHost={navigate:query=>router.push({path:'/automations',query}),reload:()=>child.value.$.setupState.load(),
snapshot:()=>read(child.value.$.setupState),retired:()=>read(retired),
destroy:async()=>{retired=child.value.$.setupState;shown.value=false;await nextTick();}};
return()=>h('main',[shown.value?h(AutomationRuleCenter,{ref:child,apiBaseUrl:'/api/v1'}):h('p',{id:'destroyed'},'Destroyed')]);}};
await router.push('/automations');await router.isReady();createApp(Host).use(router).mount('#host');
`;
const server = await createServer({
  configFile: path.join(repo, "apps/web/vite.config.ts"),
  server: { host: "127.0.0.1", port: 5175, strictPort: true, open: false },
  plugins: [
    {
      name: "isolated-automation-read-ownership",
      resolveId: (id) => (id === entry ? id : undefined),
      load: (id) => (id === entry ? harness : undefined),
      configureServer(instance) {
        instance.middlewares.use((request, response, next) => {
          if (request.url !== "/__p27_read_ownership/") return next();
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
const b = { ...a, id: "00000000-0000-4000-8000-000000000902", name: "合成较新规则B" };
const envelope = (data, id = "current") => ({ data, request_id: id, trace_id: id });
const settle = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const reports = [];
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 390]) {
    for (const scenario of [
      "newer-list",
      "creator-during-load",
      "detail-B",
      "detail-B-error",
      "detail-clear",
      "detail-creator",
      "edit-draft",
      "destroy-list",
      "initial-deep-link",
    ]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
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
          reads = [];
        let listCount = 0;
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
            unexpected.push(request.method() + " " + url.pathname);
            return route.abort();
          }
          reads.push(url.pathname);
          if (url.pathname === "/api/v1/tasks/member-options")
            return route.fulfill({ json: envelope(data.members, "members") });
          if (url.pathname === "/api/v1/automations") {
            listCount++;
            const hold =
              scenario === "edit-draft"
                ? listCount === 2
                : [
                    "newer-list",
                    "creator-during-load",
                    "destroy-list",
                    "initial-deep-link",
                  ].includes(scenario) && listCount === 1;
            if (hold) await pending;
            return route.fulfill({
              json: envelope(
                scenario === "newer-list" ? (hold ? [a] : [b]) : [a, b],
                hold ? "old-list" : "current-list",
              ),
              ...(hold ? { headers: { "x-read-held": "yes" } } : {}),
            });
          }
          if (url.pathname === `/api/v1/automations/${a.id}` && scenario.startsWith("detail-")) {
            await pending;
            return route.fulfill(
              scenario === "detail-B-error"
                ? {
                    status: 403,
                    headers: { "x-read-held": "yes" },
                    json: {
                      error: { code: "forbidden", action_hint: "合成旧详情失败" },
                      request_id: "old-error",
                      trace_id: "old-error",
                    },
                  }
                : {
                    headers: { "x-read-held": "yes" },
                    json: envelope({ ...a, executions: [] }, "old-detail"),
                  },
            );
          }
          if ([a.id, b.id].some((id) => url.pathname === `/api/v1/automations/${id}`))
            return route.fulfill({
              json: envelope(
                { ...(url.pathname.endsWith(b.id) ? b : a), executions: [] },
                "new-detail",
              ),
            });
          unexpected.push(url.pathname);
          return route.abort();
        });
        await page.goto("http://127.0.0.1:5175/__p27_read_ownership/");
        await page.getByRole("button", { name: "创建规则", exact: true }).waitFor();
        if (scenario === "initial-deep-link") {
          await page.evaluate((id) => window.automationReadHost.navigate({ rule: id }), b.id);
        } else if (scenario === "newer-list") {
          await page.evaluate(() => window.automationReadHost.reload());
          await page.getByRole("heading", { name: b.name, exact: true }).waitFor();
        } else if (scenario === "creator-during-load") {
          await page.getByRole("button", { name: "创建规则", exact: true }).click();
          await page.getByLabel("规则名称", { exact: true }).fill("读取期间的新草稿");
        } else if (scenario === "destroy-list") {
          await page.evaluate(() => window.automationReadHost.destroy());
          await page.locator("#destroyed").waitFor();
        } else {
          await page.getByRole("heading", { name: a.name, exact: true }).waitFor();
          if (scenario === "edit-draft") {
            await page
              .locator(".automation-grid article")
              .first()
              .getByRole("button", { name: "编辑", exact: true })
              .click();
            await page.getByLabel("修改原因", { exact: true }).waitFor();
            await page.evaluate(() => {
              window.automationReadHost.reload();
            });
            await page.getByLabel("规则名称", { exact: true }).fill("刷新期间保留名称");
            await page.getByLabel("修改原因", { exact: true }).fill("刷新期间保留原因");
          } else {
            const request = page.waitForRequest((r) => r.url().endsWith(`/automations/${a.id}`));
            await page
              .locator(".automation-grid article")
              .first()
              .getByRole("button", { name: "查看详情", exact: true })
              .click();
            await request;
            if (scenario.startsWith("detail-B")) {
              await page.evaluate((id) => window.automationReadHost.navigate({ rule: id }), b.id);
              await page.getByRole("dialog", { name: `${b.name}执行记录`, exact: true }).waitFor();
            } else if (scenario === "detail-clear")
              await page.evaluate(() => window.automationReadHost.navigate({}));
            else {
              await page.getByRole("button", { name: "创建规则", exact: true }).click();
              await page.getByLabel("规则名称", { exact: true }).fill("详情之后的新草稿");
            }
          }
        }
        await settle(page);
        const before = await page.evaluate(
          (destroyed) =>
            destroyed ? window.automationReadHost.retired() : window.automationReadHost.snapshot(),
          scenario === "destroy-list",
        );
        const response = page.waitForResponse((r) => r.headers()["x-read-held"] === "yes");
        release();
        await (await response).finished();
        await settle(page);
        if (
          [
            "newer-list",
            "detail-B",
            "detail-B-error",
            "detail-clear",
            "detail-creator",
            "destroy-list",
          ].includes(scenario)
        )
          assert.equal(
            await page.evaluate(
              (destroyed) =>
                destroyed
                  ? window.automationReadHost.retired()
                  : window.automationReadHost.snapshot(),
              scenario === "destroy-list",
            ),
            before,
            scenario,
          );
        if (scenario === "initial-deep-link") {
          await page.getByRole("dialog", { name: `${b.name}执行记录`, exact: true }).waitFor();
          assert.equal(
            JSON.parse(await page.evaluate(() => window.automationReadHost.snapshot())).selected.id,
            b.id,
          );
        }
        if (scenario === "creator-during-load") {
          assert.equal(
            await page.getByRole("dialog", { name: "创建自动化规则", exact: true }).isVisible(),
            true,
          );
          assert.equal(
            await page.getByLabel("规则名称", { exact: true }).inputValue(),
            "读取期间的新草稿",
          );
        }
        if (scenario === "edit-draft") {
          assert.equal(
            await page.getByLabel("规则名称", { exact: true }).inputValue(),
            "刷新期间保留名称",
          );
          assert.equal(
            await page.getByLabel("修改原因", { exact: true }).inputValue(),
            "刷新期间保留原因",
          );
        }
        assert.deepEqual(errors, []);
        assert.deepEqual(unexpected, []);
        assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
        assert.deepEqual(await context.cookies(), []);
        reports.push({
          width,
          scenario,
          readRequests: reads.length,
          ownershipAndCurrentFlow: "passed",
        });
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
  JSON.stringify({ cases: reports, browserClosed: true, serverClosed: true, businessWrites: 0 }),
);
