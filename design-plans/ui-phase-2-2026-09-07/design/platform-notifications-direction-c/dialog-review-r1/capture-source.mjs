import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

// Actual P57 components and router; synthetic in-memory envelopes, no business transport.
const capture = process.argv[2] === "--capture-review";
assert.ok(
  process.argv.length === 2 || (capture && process.argv.length === 3),
  "Only --capture-review is supported",
);
const reviewRoot = path.resolve(
  "design-plans/ui-phase-2-2026-09-07/design/platform-notifications-direction-c/dialog-review-r1",
);
if (capture) await mkdir(reviewRoot);
const images = [],
  sha256 = (data) => createHash("sha256").update(data).digest("hex");
const root = "/__p57_dialogs",
  entry = "/__p57_dialogs.js";
const styles = [
  ...(await readFile("apps/web/src/main.ts", "utf8")).matchAll(/import "\.\/(.*?\.css)";/g),
];
const host = `import {createApp,h,KeepAlive} from 'vue';
import {createRouter,createWebHistory,RouterView,RouterLink} from 'vue-router';
import Center from '/src/components/PlatformNotificationCenter.vue';
${styles.map((m) => `import '/src/${m[1]}';`).join("\n")}
document.documentElement.dataset.design='signal-ledger';
const fixture=window.fixture={writes:[],release:null,status:'draft',empty:false};
const item={id:'fixture',title:'通知阅读测试',body:'完整正文。\\n'.repeat(12),kind:'notification',status:'draft',version:3,category:'system',severity:'info',audience_type:'all_users',in_app_enabled:true,email_enabled:false};
async function request(url,options={}) {
 if(options.method && options.method!=='GET') {
  fixture.writes.push({url,...options});
  return new Promise((resolve,reject)=>fixture.release=failure=>failure?reject(new Error('样例失败')):resolve({data:{recipient_count:1,in_app_count:1,email_count:0},request_id:'write',trace_id:'write'}));
 }
 return {data:{domain:'notifications',summary:{total:0,unread:0,critical:0},messages:[{...item,status:fixture.status}],items:[],templates:[],channels:[],subscriptions:{},alert_routes:[],audience_options:{organizations:fixture.empty?[]:[{id:'org',name:'测试组织'}],users:fixture.empty?[]:[{id:'user',email:'test@example.test'}]},pagination:{page:1,total:0,total_pages:1},message_pagination:{page:1,total:1,total_pages:1},observed_at:'2026-09-14T00:00:00Z'},request_id:'read',trace_id:'read'};
}
const Notification={render:()=>h(Center,{request})};
const Away={render:()=>h('main',[h('h1','其他页面'),h(RouterLink,{to:'${root}'},{default:()=> '进入通知'})])};
const router=createRouter({history:createWebHistory(),routes:[{path:'${root}',component:Notification},{path:'${root}/away',component:Away}]});
createApp({render:()=>h(RouterView,null,{default:({Component})=>h(KeepAlive,null,{default:()=>Component?h(Component):null})})}).use(router).mount('#app');`;
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0, open: false, proxy: {} },
  plugins: [
    {
      name: "p57-dialog-fixture",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (!req.url?.split("?")[0].startsWith(root) || req.url?.split("?")[0] === entry)
            return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P57交互验证</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const failures = [],
  results = [];
let browser;
async function screenshot(dialog, width, state) {
  if (!capture) return;
  const file = `P57-${width}-${state}.png`;
  const bytes = await dialog.screenshot({
    path: path.join(reviewRoot, file),
    animations: "disabled",
  });
  images.push({
    file,
    width,
    state,
    sha256: sha256(bytes),
    fixture: true,
    approval: "pending-user-review",
  });
}
async function trap(page, dialog) {
  const controls = dialog.locator(
    "button:visible:enabled,input:visible:enabled,select:visible:enabled,textarea:visible:enabled",
  );
  await controls.last().focus();
  await page.keyboard.press("Tab");
  await expect(controls.first()).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(controls.last()).toBeFocused();
}
try {
  await server.listen();
  const port = server.httpServer.address().port;
  console.log(`p57_dialog_host=http://127.0.0.1:${port} pid=${process.pid}`);
  browser = await chromium.launch();
  for (const width of [390, 1440])
    for (const motion of ["reduce", "no-preference"]) {
      for (const scenario of [
        "editor",
        "editor-edit",
        "editor-empty",
        "action",
        "action-cancel",
        "reader-tab",
        "reader-published",
        "reader-cancelled",
        "reader-handoff",
        "reader-exit",
        "reader-resize",
      ]) {
        if (width > 760 && scenario.startsWith("reader")) continue;
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          reducedMotion: motion,
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
            unexpected.push(url.href);
            return route.abort();
          });
          await page.goto(`http://127.0.0.1:${port}${root}/away`);
          await page.evaluate((scenario) => {
            if (scenario === "reader-published") window.fixture.status = "published";
            if (scenario === "reader-cancelled") window.fixture.status = "cancelled";
            if (scenario === "editor-empty") window.fixture.empty = true;
          }, scenario);
          await page.getByRole("link", { name: "进入通知" }).click();
          const directory = page.locator(".message-directory button");
          await expect(directory).toHaveCount(1);
          if (scenario.startsWith("editor") || scenario.startsWith("action")) {
            const editing = scenario === "editor-edit",
              isEditor = scenario.startsWith("editor"),
              cancelling = scenario === "action-cancel";
            const sourceLabel = editing ? "编辑草稿" : cancelling ? "取消草稿" : "发布草稿";
            if (isEditor && !editing)
              await page.getByRole("button", { name: "新建草稿", exact: true }).click();
            else {
              if (width <= 760) await directory.click();
              await page.getByRole("button", { name: sourceLabel, exact: true }).click();
            }
            const dialog = page.getByRole("dialog", {
              name: isEditor
                ? editing
                  ? "编辑平台消息草稿"
                  : "新建平台消息草稿"
                : cancelling
                  ? "填写取消草稿原因"
                  : "填写发布原因",
            });
            await expect(dialog).toBeVisible();
            const field = dialog.getByLabel(isEditor ? "标题" : "操作原因");
            await expect(field).toBeFocused();
            await expect(field).toHaveAccessibleName(isEditor ? "标题" : "操作原因");
            await expect(field).toHaveAccessibleDescription(/至少 2 个字/);
            await trap(page, dialog);
            if (isEditor) {
              await field.fill("字");
              await dialog.getByRole("button", { name: "保存草稿", exact: true }).click();
              assert.equal(await page.evaluate(() => window.fixture.writes.length), 0);
              await field.fill("测试标题");
              await dialog.getByLabel("正文").fill("测试正文");
              await expect(dialog.getByLabel("正文")).toHaveAccessibleDescription(
                /纯文本并保留换行/,
              );
              await expect(dialog.getByLabel("接收范围")).toHaveAccessibleDescription(
                /不是实时受众预检/,
              );
              if (editing)
                await expect(dialog.getByLabel("修改原因")).toHaveAccessibleDescription(
                  /版本和操作者一起记录/,
                );
              await dialog.getByLabel("接收范围").selectOption("organization");
              if (scenario === "editor-empty") {
                await expect(dialog.getByLabel("选择组织")).toHaveAccessibleDescription(
                  "当前读取结果没有可选组织。",
                );
                await dialog.getByLabel("接收范围").selectOption("user");
                await expect(dialog.getByLabel("选择用户")).toHaveAccessibleDescription(
                  "当前读取结果没有可选用户。",
                );
                await dialog.getByLabel("接收范围").selectOption("all_users");
              } else await dialog.getByLabel("选择组织").selectOption("org");
            } else {
              await field.fill("字");
              await expect(
                dialog.getByRole("button", {
                  name: cancelling ? "确认取消草稿" : "确认发布",
                  exact: true,
                }),
              ).toBeDisabled();
              await field.fill("有效操作原因");
            }
            await dialog
              .getByRole("button", {
                name: isEditor ? "保存草稿" : cancelling ? "确认取消草稿" : "确认发布",
                exact: true,
              })
              .click();
            await expect.poll(() => page.evaluate(() => window.fixture.writes.length)).toBe(1);
            await expect(field).toBeDisabled();
            await expect(dialog.locator("form")).toHaveAttribute("aria-busy", "true");
            await trap(page, dialog);
            if (editing || cancelling) {
              await page.evaluate(() => window.fixture.release(true));
              await expect(dialog.getByRole("alert")).toContainText("未确认写入结果");
              await expect(dialog).toHaveAccessibleDescription(/未确认写入结果/);
              await expect(field).toBeEnabled();
              await expect(dialog.locator("form")).toHaveAttribute("aria-busy", "false");
              await trap(page, dialog);
              if (motion === "reduce" && cancelling)
                await screenshot(dialog, width, "cancel-error");
              await page.keyboard.press("Escape");
              await expect(dialog).not.toBeVisible();
              await expect(
                width <= 760
                  ? directory
                  : page.getByRole("button", { name: sourceLabel, exact: true }),
              ).toBeFocused();
            } else {
              if (motion === "reduce" && scenario === "editor")
                await screenshot(dialog, width, "editor-saving");
              await page.keyboard.press("Escape");
              await expect(dialog).not.toBeVisible();
              await expect(
                isEditor ? page.getByRole("button", { name: "新建草稿", exact: true }) : directory,
              ).toBeFocused();
              await page.evaluate(() => window.fixture.release(false));
              await expect(page.getByRole("status")).toContainText(
                isEditor ? "草稿已创建" : "发布完成",
              );
            }
          } else {
            await directory.click();
            const reader = page.getByRole("dialog", { name: "通知阅读测试" });
            await expect(reader).toBeVisible();
            if (["reader-tab", "reader-published", "reader-cancelled"].includes(scenario)) {
              if (scenario !== "reader-tab")
                await expect(reader.getByRole("button")).toHaveCount(1);
              await trap(page, reader);
              await page.keyboard.press("Escape");
              await expect(directory).toBeFocused();
            } else if (scenario === "reader-handoff") {
              await reader.getByRole("button", { name: "编辑草稿", exact: true }).click();
              const editor = page.getByRole("dialog", { name: "编辑平台消息草稿" });
              await expect(editor.getByLabel("标题")).toBeFocused();
              await page.keyboard.press("Escape");
              await expect(editor).not.toBeVisible();
              await expect(directory).toBeFocused();
            } else if (scenario === "reader-exit") {
              await page.goBack();
              await expect(page.getByRole("heading", { name: "其他页面" })).toBeVisible();
              await page.goForward();
              await expect(directory).toBeVisible();
              await expect(page.getByRole("dialog")).toHaveCount(0);
            } else {
              await page.setViewportSize({ width: 1440, height: 900 });
              await expect(reader).not.toBeVisible();
              await page.setViewportSize({ width: 390, height: 900 });
              await expect(reader).not.toBeVisible();
            }
          }
          assert.deepEqual(errors, []);
          assert.deepEqual(unexpected, []);
          results.push({ width, motion, scenario, passed: true });
        } catch (error) {
          failures.push({ width, motion, scenario, error: error.message });
        } finally {
          await context.close();
        }
      }
    }
  console.log(JSON.stringify({ results, failures }));
  assert.deepEqual(failures, []);
  if (capture) {
    const files = new Set([
      "scripts/verify-platform-notification-dialogs.mjs",
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
            "Actual P57 dialog regions, synthetic responses, not full App/real delivery/permissions/whole-page approval",
          images,
          sources,
          results,
        },
        null,
        2,
      ) + "\n",
    );
  }
} finally {
  await browser?.close();
  await server.close();
  console.log(
    `p57_dialog_cleanup=browser-and-server-closed; ${capture ? "review packet retained at " + reviewRoot : "no artifacts written"}`,
  );
}
