import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

// Actual Vue/router/KeepAlive with in-memory request fixtures. No capture or business transport.
assert.equal(process.argv.length, 2, "No arguments or capture mode supported");
const root = "/__p57_lifecycle",
  entry = "/__p57_lifecycle.js";
const styles = [
  ...(await readFile("apps/web/src/main.ts", "utf8")).matchAll(/import "\.\/(.*?\.css)";/g),
];
const host = `import {createApp,h,KeepAlive} from 'vue';
import {createRouter,createWebHistory,RouterView,RouterLink} from 'vue-router';
import Center from '/src/components/PlatformNotificationCenter.vue';
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
const NotificationPage={render:()=>h(Center,{request,requestId:'local-fixture'})};
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
try {
  await server.listen();
  const port = server.httpServer.address().port;
  console.log(`p57_lifecycle_host=http://127.0.0.1:${port} pid=${process.pid}`);
  browser = await chromium.launch();
  for (const width of [390, 1440]) {
    for (const kind of ["editor", "action", "delivery-page", "message-page"]) {
      for (const outcome of kind.endsWith("-page") ? ["retry"] : ["success", "failure"]) {
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
          await page.getByRole("link", { name: "进入通知" }).click();
          await expect(page.locator(".message-directory button")).toHaveCount(1);
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
            await expect(pager).toContainText("第 1 / 3 页");
            await expect(next).toBeEnabled();
            await next.click();
            await expect(pager).toContainText("第 2 / 3 页");
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
            await expect(page.getByRole("dialog")).toHaveCount(0);
            await expect(page.getByRole("status")).toHaveCount(0);
            assert.equal(await page.evaluate(() => window.fixture.writes.length), 1);
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
  console.log("p57_lifecycle_cleanup=browser-and-server-closed; no artifacts written");
}
