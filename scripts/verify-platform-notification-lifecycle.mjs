import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

// Actual parent/client/Vue/router with in-memory HTTP fixtures; never business transport.
const capture = process.argv[2] === "--capture-review";
assert.ok(
  process.argv.length === 2 || (capture && process.argv.length === 3),
  "Only --capture-review is supported",
);
const reviewRoot = path.resolve(
  "design-plans/ui-phase-2-2026-09-07/design/platform-notifications-direction-c/trace-review-r1",
);
if (capture) await mkdir(reviewRoot); // Exclusive: never overwrite an existing review packet.
const images = [];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const root = "/__p57_lifecycle",
  entry = "/__p57_lifecycle.js";
const styles = [
  ...(await readFile("apps/web/src/main.ts", "utf8")).matchAll(/import "\.\/(.*?\.css)";/g),
];
const host = `import {createApp,h,KeepAlive} from 'vue';
import {createRouter,createWebHistory,RouterView,RouterLink} from 'vue-router';
import Center from '/src/components/PlatformManagementCenter.vue';
${styles.map((m) => `import '/src/${m[1]}';`).join("\n")}
document.documentElement.dataset.design='signal-ledger';
const fixture=window.fixture={reads:[],writes:[],failNext:false,release:null};
const item={id:'fixture-message',title:'测试草稿',body:'测试正文',kind:'notification',status:'draft',version:3,category:'system',severity:'info',audience_type:'all_users',in_app_enabled:true,email_enabled:false};
async function request(url,options={}) {
 if(options.method && options.method!=='GET') {
  fixture.writes.push({url,...options});
  return new Promise((resolve,reject)=>fixture.release=(failure)=>failure?reject(new Error('旧写入测试失败')):resolve({recipient_count:1,in_app_count:1,email_count:0}));
 }
 fixture.reads.push(url);
 if(fixture.failNext){fixture.failNext=false;throw new Error('分页读取测试失败');}
 const p=new URLSearchParams(url.split('?')[1]);
 return {domain:'notifications',summary:{total:1,unread:1,critical:0},messages:[item],items:[],templates:[],channels:[],subscriptions:{},alert_routes:[],audience_options:{organizations:[],users:[]},
 pagination:{page:Number(p.get('page')),total:41,total_pages:3},message_pagination:{page:Number(p.get('message_page')),total:21,total_pages:3},observed_at:'2026-09-14T00:00:00Z'};
}
const originalFetch=window.fetch;
window.fetch=async (url,options={})=>{
 if(!String(url).startsWith('/fixture-api/platform/management')) return originalFetch(url,options);
 const write=options.method && options.method!=='GET';
 const id=write?'write-'+(fixture.writes.length+1):'read-'+(fixture.reads.length+1);
 try { return new Response(JSON.stringify({data:await request(String(url).slice('/fixture-api'.length),options),request_id:id,trace_id:id}),{headers:{'content-type':'application/json'}}); }
 catch(error) { return new Response(JSON.stringify({error:{code:'fixture_failure',message:error.message,action_hint:error.message},request_id:id,trace_id:id}),{status:400,headers:{'content-type':'application/json'}}); }
};
const NotificationPage={render:()=>h(Center,{apiBaseUrl:'/fixture-api',domain:'notifications'})};
const Away={render:()=>h('main',[h('h1','其他页面'),h(RouterLink,{to:'${root}'},{default:()=> '进入通知'})])};
const router=createRouter({history:createWebHistory(),routes:[{path:'${root}',component:NotificationPage},{path:'${root}/away',component:Away}]});
createApp({render:()=>h(RouterView,null,{default:({Component})=>h(KeepAlive,null,{default:()=>Component?h(Component):null})})}).use(router).mount('#app');`;
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, open: false, proxy: {} },
  plugins: [
    {
      name: "p57-lifecycle-fixture",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (!req.url?.split("?")[0].startsWith(root) || req.url?.split("?")[0] === entry)
            return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P57 生命周期验证</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
let browser;
const results = [];
async function review(page, width, state) {
  const traces = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: /读取追踪/ }) });
  for (const trace of await traces.all()) {
    const summary = trace.locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(trace).toHaveAttribute("open", "");
    await expect(trace.locator("span")).toBeVisible();
    await expect(summary).toBeFocused();
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  if (!capture) return;
  const file = `P57-${width}-${state}.png`;
  const bytes = await page
    .locator(".platform-notifications__surface")
    .screenshot({ path: path.join(reviewRoot, file), animations: "disabled" });
  images.push({
    file,
    width,
    state,
    sha256: sha256(bytes),
    approval: "pending-user-review",
    fixture: true,
  });
}
try {
  await server.listen();
  const port = server.httpServer.address().port;
  console.log(`p57_lifecycle_host=http://127.0.0.1:${port} pid=${process.pid}`);
  browser = await chromium.launch();
  for (const width of [390, 1440]) {
    for (const kind of ["editor", "action", "delivery-page", "message-page", "first-error"]) {
      for (const outcome of kind === "first-error"
        ? ["recover"]
        : kind.endsWith("-page")
          ? ["retry"]
          : ["success", "failure", "current"]) {
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          reducedMotion: "reduce",
        });
        try {
          const page = await context.newPage(),
            errors = [],
            unexpected = [];
          page.on("pageerror", (e) => errors.push(e.message));
          await page.route("**/*", (route) => {
            const url = new URL(route.request().url());
            if (
              url.hostname === "127.0.0.1" &&
              url.port === String(port) &&
              !url.pathname.startsWith("/api/") &&
              route.request().method() === "GET"
            )
              return route.continue();
            unexpected.push(route.request().url());
            return route.abort();
          });
          await page.goto(`http://127.0.0.1:${port}${root}/away?keep=untouched`);
          if (kind === "first-error") await page.evaluate(() => (window.fixture.failNext = true));
          await page.getByRole("link", { name: "进入通知" }).click();
          if (kind === "first-error") {
            await expect(
              page.getByRole("heading", { name: "当前无法读取通知工作台" }),
            ).toBeVisible();
            await expect(page.getByText("快照读取追踪", { exact: true })).toHaveCount(0);
            await expect(page.locator("details")).toContainText("read-1");
            await review(page, width, "first-read-failed");
            await page.getByRole("button", { name: "重新加载", exact: true }).click();
            await expect(page.locator(".message-directory button")).toHaveCount(1);
            await expect(page.getByText("本次失败读取追踪", { exact: true })).toHaveCount(0);
            await expect(page.locator(".platform-notifications__footer details")).toContainText(
              "read-2",
            );
          } else {
            await expect(page.locator(".message-directory button")).toHaveCount(1);
            const snapshotTrace = page
              .locator("details")
              .filter({ has: page.getByText("快照读取追踪", { exact: true }) });
            await expect(snapshotTrace).toContainText("read-1");
            if (kind.endsWith("-page")) {
              if (kind === "delivery-page")
                await page.getByRole("button", { name: /投递观测/ }).click();
              const pager = page.getByRole("navigation", {
                name: kind === "delivery-page" ? "通知与投递记录分页" : "人工消息分页",
              });
              const next = pager.getByRole("button", { name: "下一页" });
              await page.evaluate(() => (window.fixture.failNext = true));
              await next.click();
              await expect(page.getByRole("status")).toContainText("分页读取测试失败");
              await expect(snapshotTrace).toContainText("read-1");
              await expect(
                page
                  .locator("details")
                  .filter({ has: page.getByText("本次失败读取追踪", { exact: true }) }),
              ).toContainText("read-2");
              await expect(pager).toContainText("第 1 / 3 页");
              await expect(next).toBeEnabled();
              if (kind === "message-page") await review(page, width, "snapshot-and-failed-read");
              await next.click();
              await expect(pager).toContainText("第 2 / 3 页");
              await expect(snapshotTrace).toContainText("read-3");
              await expect(page.getByText("本次失败读取追踪", { exact: true })).toHaveCount(0);
              const calls = await page.evaluate(() => window.fixture.reads);
              assert.equal(calls.length, 3);
              assert.equal(calls[1], calls[2]);
              assert.equal(await page.evaluate(() => window.fixture.writes.length), 0);
            } else {
              if (kind === "editor") {
                await page.getByRole("button", { name: "新建草稿" }).click();
                const dialog = page.getByRole("dialog", { name: "新建平台消息草稿" });
                await dialog.getByLabel("标题").fill("生命周期测试草稿");
                await dialog.getByLabel("正文").fill("只在内存中模拟，不发送。");
                await dialog.getByRole("button", { name: "保存草稿" }).click();
              } else {
                if (width <= 760) await page.locator(".message-directory button").click();
                await page.getByRole("button", { name: "发布草稿", exact: true }).click();
                await page
                  .getByRole("dialog", { name: "填写发布原因" })
                  .getByRole("button", { name: "确认发布" })
                  .click();
              }
              await expect.poll(() => page.evaluate(() => window.fixture.writes.length)).toBe(1);
              if (outcome === "current") {
                await page.evaluate(() => window.fixture.release(false));
                await expect(page.getByRole("status")).toContainText(
                  kind === "editor" ? "草稿已创建" : "发布完成",
                );
                await expect(snapshotTrace).toContainText("read-2");
                await expect(snapshotTrace).not.toContainText("write-");
                assert.equal(await page.evaluate(() => window.fixture.reads.length), 2);
              } else {
                await page.goBack();
                await expect(page.getByRole("heading", { name: "其他页面" })).toBeVisible();
                await expect(page.getByRole("dialog")).toHaveCount(0);
                await page.evaluate(async (failure) => {
                  window.fixture.release(failure);
                  await new Promise(requestAnimationFrame);
                  await new Promise(requestAnimationFrame);
                }, outcome === "failure");
                await expect(page).toHaveURL(new RegExp("/away\\?keep=untouched$"));
                assert.equal(await page.evaluate(() => window.fixture.reads.length), 1);
                await page.goForward();
                await expect(page.locator(".message-directory button")).toHaveCount(1);
                await expect.poll(() => page.evaluate(() => window.fixture.reads.length)).toBe(2);
                await expect(snapshotTrace).toContainText("read-2");
                await expect(snapshotTrace).not.toContainText("write-");
                await expect(page.getByRole("dialog")).toHaveCount(0);
                await expect(page.getByRole("status")).toHaveCount(0);
                assert.equal(await page.evaluate(() => window.fixture.writes.length), 1);
              }
            }
          }
          assert.deepEqual(errors, []);
          assert.deepEqual(unexpected, []);
          results.push({ width, kind, outcome, passed: true });
        } finally {
          await context.close();
        }
      }
    }
  }
  if (capture) {
    const files = new Set([
      "scripts/verify-platform-notification-lifecycle.mjs",
      "apps/web/vite.config.ts",
      "package-lock.json",
    ]);
    for (const mod of server.moduleGraph.idToModuleMap.values()) {
      if (
        mod.file?.replaceAll("\\", "/").includes("/apps/web/src/") &&
        /\.(vue|ts|css)$/.test(mod.file)
      )
        files.add(path.relative(process.cwd(), mod.file).replaceAll("\\", "/"));
    }
    const sources = Object.fromEntries(
      await Promise.all(
        [...files].sort().map(async (file) => [file, sha256(await readFile(file))]),
      ),
    );
    await writeFile(
      path.join(reviewRoot, "manifest.json"),
      JSON.stringify(
        {
          scope:
            "P57 read tracing only; local fixture through actual parent and API client; not real permissions/delivery or whole-page acceptance",
          images,
          sources,
          results,
        },
        null,
        2,
      ) + "\n",
    );
  }
  console.log(
    JSON.stringify({
      passed: true,
      results,
      scope:
        "actual Vue/router/KeepAlive with in-memory writes; not real publication or whole-page approval",
    }),
  );
} finally {
  await browser?.close();
  await server.close();
  console.log(
    `p57_lifecycle_cleanup=browser-and-server-closed; ${capture ? "review packet retained at " + reviewRoot : "no artifacts written"}`,
  );
}
