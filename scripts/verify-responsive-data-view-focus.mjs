import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/responsive-data-view-focus";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((m) => m[1]);
const host = `import {createApp,h,ref} from 'vue';
import View from '/src/components/ResponsiveDataView.vue';
import Confirm from '/src/components/ConfirmDialog.vue';
import Reason from '/src/components/AuditedReasonDialog.vue';
${cssFiles.map((file) => `import '/src/${file}';`).join("\n")}
document.documentElement.dataset.design='signal-ledger';
const rows=ref([{id:'sample',name:'测试记录'}]),mounted=ref(true),confirm=ref(false),reason=ref(false),rich=ref(true);
window.__fixture={rows,mounted,rich};
createApp({setup:()=>()=>h('main',[
 h('h1','手机详情窗 · 键盘状态验证'),
 h('p','真实共享 Vue；测试样例；不请求业务接口，不代表整页或生产验收。'),
 h('button',{id:'background'},'背景按钮'),
 mounted.value?h(View,{rows:rows.value,rowKey:r=>r.id,title:'测试列表',detailTitle:r=>r.name},{
  desktop:()=>h('table',[h('thead',[h('tr',[h('th','记录')])]),h('tbody',[h('tr',[h('td','测试记录')])])]),
  summary:({row})=>row.name,
  detail:({row,close})=>[h('p',{id:'record-name'},row.name),...(rich.value?[
   h('details',[h('summary','技术详情'),h('button',{id:'inside-details'},'展开后操作')]),
   h('button',{disabled:true},'禁用操作'),h('button',{style:{display:'none'}},'隐藏操作'),
   h('button',{style:{visibility:'hidden'}},'不可见操作'),
   h('input',{'aria-label':'示例字段'}),
   h('button',{id:'open-confirm',onClick:()=>confirm.value=true},'打开确认窗'),
   h('button',{id:'open-reason',onClick:()=>reason.value=true},'打开原因窗'),
   h('button',{id:'handoff',onClick:()=>{close();confirm.value=true}},'关闭详情并打开确认'),
   h('button',{id:'slot-close',onClick:close},'返回列表'),
   h('a',{href:'#local-only',id:'last-link'},'本地链接')]:[])]
 }):null,
 h(Confirm,{open:confirm.value,title:'测试确认',description:'仅验证焦点，不执行操作。',impact:'无业务写入',onCancel:()=>confirm.value=false,onConfirm:()=>{throw Error('must not submit')}}),
 h(Reason,{open:reason.value,title:'测试原因',description:'仅验证原生弹窗兼容。',onCancel:()=>reason.value=false,onSubmit:()=>{throw Error('must not submit')}})
])}).mount('#app');`;
const probe = reservePort();
await new Promise((done) => probe.listen(0, "127.0.0.1", done));
const port = probe.address().port;
await new Promise((done) => probe.close(done));
const entry = "/__responsive_focus.js";
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {} },
  plugins: [
    {
      name: "responsive-focus-fixture",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url !== "/__responsive_focus") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>详情窗焦点验证</title>
<div id="app"></div><div id="pre-inert" inert>已有隔离区域</div><script type="module" src="${entry}"></script></html>`);
        });
      },
    },
  ],
});
const checks = [],
  screenshots = [];
let browser;
try {
  await server.listen();
  console.log(`responsive_focus_host http://127.0.0.1:${port}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      locale: "zh-CN",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (
          url.hostname === "127.0.0.1" &&
          url.port === String(port) &&
          !url.pathname.startsWith("/api/")
        )
          return route.continue();
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(`http://127.0.0.1:${port}/__responsive_focus`);
      const snap = async (state) => {
        if (!capture || width !== 390) return;
        const file = `${width}-${state}.png`,
          bytes = await page.screenshot();
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({ file, width, state, kind: "vue-isolated", sha256: hash(bytes) });
      };
      const trigger = page.locator(".responsive-data-view__mobile article button"),
        drawer = page.getByRole("dialog", { name: "测试记录", exact: true }),
        close = drawer.getByRole("button", { name: "关闭详情", exact: true });
      const restored = async () => {
        await expect(page.locator("#app")).not.toHaveAttribute("inert");
        await expect(page.locator("#pre-inert")).toHaveAttribute("inert", "");
      };
      if (width > 760) {
        await expect(trigger).not.toBeVisible();
        await expect(page.getByRole("table")).toBeVisible();
        await restored();
        checks.push({
          width,
          name: "desktop table remains visible; no mobile modal or inert lock",
        });
        continue;
      }
      await trigger.click();
      await expect(close).toBeFocused();
      await expect(page.locator("#app")).toHaveAttribute("inert", "");
      await page.locator("#background").evaluate((node) => node.focus());
      await expect(close).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(drawer.locator("#last-link")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(close).toBeFocused();
      await snap("close-focus");
      await page.keyboard.press("Tab");
      await expect(drawer.locator("summary")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(drawer.getByRole("textbox")).toBeFocused();
      await drawer.locator("summary").click();
      await page.keyboard.press("Tab");
      await expect(drawer.locator("#inside-details")).toBeFocused();
      await snap("expanded-control-focus");
      checks.push({
        width,
        name: "initial focus; Tab/Shift+Tab loop; hidden, disabled and collapsed controls skipped; background focus blocked",
      });

      await drawer.locator("#open-confirm").click();
      const confirmation = page.getByRole("alertdialog"),
        cancel = confirmation.getByRole("button", { name: "取消", exact: true });
      await expect(cancel).toBeFocused();
      await expect(page.locator(".responsive-data-view__overlay")).toHaveAttribute("inert", "");
      await cancel.click({ trial: true });
      await page.keyboard.press("Shift+Tab");
      await expect(confirmation.getByRole("button", { name: "确认", exact: true })).toBeFocused();
      await snap("nested-confirm");
      await page.keyboard.press("Escape");
      await expect(confirmation).toHaveCount(0);
      await expect(drawer.locator("#open-confirm")).toBeFocused();
      await expect(page.locator(".responsive-data-view__overlay")).not.toHaveAttribute("inert");
      await expect(drawer).toBeVisible();
      await drawer.locator("#open-reason").click();
      const reason = page.getByRole("dialog", { name: "测试原因", exact: true });
      await expect(reason.getByRole("textbox")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(drawer.locator("#open-reason")).toBeFocused();
      checks.push({
        width,
        name: "actual ConfirmDialog and native AuditedReasonDialog remain operable; cancel/Escape returns to detail action; no submit",
      });

      await page.keyboard.press("Escape");
      await expect(drawer).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await restored();
      for (const kind of ["header", "scrim", "slot"]) {
        await trigger.click();
        if (kind === "header") await close.click();
        if (kind === "scrim")
          await page.locator(".responsive-data-view__scrim").click({ position: { x: 5, y: 100 } });
        if (kind === "slot") await drawer.locator("#slot-close").click();
        await expect(trigger).toBeFocused();
        await restored();
      }
      await snap("returned-to-list");
      await trigger.click();
      await drawer.locator("#handoff").click();
      await expect(drawer).toHaveCount(0);
      await expect(cancel).toBeFocused();
      await page.keyboard.press("Escape");
      await restored();
      checks.push({
        width,
        name: "Escape, header, scrim and slot close restore focus/inert; close-and-confirm handoff does not steal focus",
      });

      await trigger.click();
      await page.evaluate(
        () => (window.__fixture.rows.value = [{ id: "sample", name: "更新后的记录" }]),
      );
      const updated = page.getByRole("dialog", { name: "更新后的记录", exact: true });
      await expect(updated.locator("#record-name")).toHaveText("更新后的记录");
      await page.evaluate(() => (window.__fixture.rows.value = []));
      await expect(page.locator(".responsive-data-view__drawer")).toHaveCount(0);
      await expect(page.locator(".responsive-data-view__mobile")).toBeFocused();
      await restored();
      await page.evaluate(
        () => (window.__fixture.rows.value = [{ id: "sample", name: "测试记录" }]),
      );
      await expect(drawer).toHaveCount(0);
      await page.evaluate(() => (window.__fixture.rich.value = false));
      await trigger.click();
      for (const key of ["Tab", "Shift+Tab"]) {
        await page.keyboard.press(key);
        await expect(close).toBeFocused();
      }
      await page.evaluate(() => (window.__fixture.mounted.value = false));
      await expect(drawer).toHaveCount(0);
      await restored();
      await page.locator("#background").click();
      await expect(page.locator("#background")).toBeFocused();
      checks.push({
        width,
        name: "same-key refresh, removed-row fallback/no phantom reopen, single-button loop, unmount releases background",
      });
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
const files = [
  "scripts/verify-responsive-data-view-focus.mjs",
  "apps/web/src/components/ResponsiveDataView.vue",
  "apps/web/src/components/TableViewControls.vue",
  "apps/web/src/components/ConfirmDialog.vue",
  "apps/web/src/components/AuditedReasonDialog.vue",
  "apps/web/src/use-modal-dialog.ts",
  "apps/web/src/ui/state-contract.ts",
  "apps/web/src/main.ts",
  ...cssFiles.map((file) => `apps/web/src/${file}`),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(files.map(async (file) => [file, hash(await read(file))])),
);
if (capture)
  await writeFile(
    `${output}/evidence.json`,
    `${JSON.stringify({ schemaVersion: 1, scope: "actual shared Vue with synthetic slots; no business API, permission or production acceptance", approval: "pending", checks, sourceHashes, screenshots, processesClosed: true }, null, 2)}\n`,
  );
console.log(
  JSON.stringify({ checks: checks.length, screenshots: screenshots.length, processesClosed: true }),
);
