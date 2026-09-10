import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import os from "node:os";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/technical-copy-feedback";
const component = "apps/web/src/components/TechnicalDetails.vue";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const baseline = execFileSync("git", ["show", `e704cd24:${component}`], {
  encoding: "utf8",
}).replaceAll("\r\n", "\n");
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((m) => m[1]);
const reviewStyle =
  "design-plans/ui-phase-2-2026-09-07/implementation/platform-overview-preview.css";
const entry = "/__technical_copy.js";
const priorId = path
  .resolve("apps/web/src/components/__TechnicalCopyBaseline.vue")
  .replaceAll("\\", "/");
const host = `import {createApp,h,ref,KeepAlive} from 'vue';
import Current from '/src/components/TechnicalDetails.vue';
import Baseline from '/@fs/${priorId}';
${cssFiles.map((file) => `import '/src/${file}';`).join("\n")}
import '/@fs/${path.resolve(reviewStyle).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p38-vue-preview');
const requestId=ref('fixture-request-001'),traceId=ref('fixture-trace-001'),show=ref(true),prior=ref(false);
window.__fixture={requestId,traceId,show,prior};
createApp({setup:()=>()=>h('main',[
 h('p',{class:'preview-disclaimer'},'P38 技术详情 · 实际共享 Vue · 测试样例 · 反馈组合待审 / 未上线'),
 h('div',{class:'platform-dashboard'},[h('section',{class:'platform-facts'},[
 h('h2','读取信息'),h('p','以下编号仅为测试样例。'),
 h(KeepAlive,()=>show.value?h(prior.value?Baseline:Current,{requestId:requestId.value,traceId:traceId.value,items:[{label:'导出行数',value:0}]}):null)
 ])])])}).mount('#app');`;
const probe = reservePort();
await new Promise((done) => probe.listen(0, "127.0.0.1", done));
const port = probe.address().port;
await new Promise((done) => probe.close(done));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {} },
  plugins: [
    {
      name: "technical-copy-feedback-fixture",
      resolveId: (id) =>
        id === entry ? entry : id === priorId || id === `/@fs/${priorId}` ? priorId : undefined,
      load: (id) => (id === entry ? host : id === priorId ? baseline : undefined),
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url !== "/__technical_copy") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>技术详情复制反馈</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const checks = [],
  screenshots = [],
  comparisons = [];
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`technical_copy_host ${origin}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      await context.addInitScript(() => {
        window.__clipboard = { mode: "success", calls: [], pending: [] };
        window.__installClipboard = () =>
          Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
              writeText(value) {
                const c = window.__clipboard;
                c.calls.push(value);
                if (c.mode === "deny") return Promise.reject(new Error("synthetic denied"));
                if (c.mode === "hold")
                  return new Promise((resolve, reject) => c.pending.push({ resolve, reject }));
                return Promise.resolve();
              },
            },
          });
        window.__installClipboard();
      });
      const page = await context.newPage(),
        errors = [],
        unexpected = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === origin && !url.pathname.startsWith("/api/")) return route.continue();
        unexpected.push(url.href);
        return route.abort();
      });
      await page.goto(`${origin}/__technical_copy`);
      await page.evaluate(() => document.fonts.ready);
      const detail = page.locator(".technical-details"),
        area = page.locator(".platform-facts");
      await detail.locator("summary").click();
      const currentPng = await area.screenshot({ animations: "disabled" });
      await page.evaluate(() => (window.__fixture.prior.value = true));
      await detail.locator("summary").click();
      const priorPng = await area.screenshot({ animations: "disabled" });
      assert.equal(hash(currentPng), hash(priorPng), "unchanged normal rendering");
      comparisons.push({ width, current: hash(currentPng), baseline: hash(priorPng) });
      await page.evaluate(() => (window.__fixture.prior.value = false));
      await expect(detail).toHaveAttribute("open", "");
      const copy = detail.getByRole("button", { name: "复制请求编号", exact: true });
      const feedback = detail.getByRole("status");
      const snap = async (state) => {
        if (!capture || ![390, 1440].includes(width)) return;
        const file = `${width}-${state}.png`,
          bytes = await area.screenshot({ animations: "disabled" });
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          sha256: hash(bytes),
          kind: "vue-isolated",
          routeId: "P38",
          state,
          approval: "pending",
          viewport: { width, height: 1000 },
          imageDimensions: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
          concreteUrl: page.url(),
          capturedAt: new Date().toISOString(),
          buildSha: null,
          caseId: `technical-copy-${width}-${state}`,
          browser: browser.version(),
          os: os.platform(),
          font: await area.evaluate((el) => getComputedStyle(el).fontFamily),
        });
      };
      await page.evaluate(() => (window.__clipboard.mode = "deny"));
      await copy.focus();
      await page.keyboard.press("Enter");
      await expect(feedback).toHaveText("暂时无法复制请求编号，可以选中上方内容后手动复制。");
      await expect(copy).toBeFocused();
      await expect(copy).toHaveText("复制");
      await snap("denied");
      assert.equal(
        await page.evaluate(() => window.__clipboard.calls.at(-1)),
        "fixture-request-001",
      );
      await page.evaluate(() => {
        delete navigator.clipboard;
      });
      await copy.click();
      await expect(feedback).toBeVisible();
      await page.evaluate(() => {
        window.__installClipboard();
        window.__clipboard.mode = "success";
      });
      await copy.click();
      await expect(copy).toHaveText("已复制");
      await expect(feedback).toHaveCount(0);
      await snap("retry-success");
      await expect(copy).toHaveText("复制", { timeout: 4000 });
      checks.push({
        width,
        name: "denial and missing Clipboard API handled; exact text, retained focus, retry, 1500ms expiry",
      });
      await page.evaluate(() => (window.__clipboard.mode = "deny"));
      await detail.getByRole("button", { name: "复制链路编号", exact: true }).click();
      await expect(feedback).toHaveText("暂时无法复制链路编号，可以选中上方内容后手动复制。");
      await snap("trace-denied");
      await page.evaluate(() => {
        window.__fixture.requestId.value = "fixture-request-002";
      });
      await expect(feedback).toHaveCount(0);
      await snap("changed-content");
      checks.push({
        width,
        name: "failure names attempted row; new displayed content clears old feedback",
      });
      await page.evaluate(() => (window.__clipboard.mode = "hold"));
      await copy.click();
      await page.evaluate(() => {
        window.__fixture.requestId.value = "fixture-request-003";
        window.__clipboard.pending.shift().resolve();
      });
      await expect(copy).toHaveText("复制");
      await expect(feedback).toHaveCount(0);
      await copy.click();
      await detail.getByRole("button", { name: "复制链路编号", exact: true }).click();
      await page.evaluate(() => {
        const c = window.__clipboard;
        c.pending[1].resolve();
        c.pending[0].reject(Error("late"));
        c.pending = [];
      });
      await expect(detail.getByRole("button", { name: "复制链路编号", exact: true })).toHaveText(
        "已复制",
      );
      await expect(copy).toHaveText("复制");
      await expect(feedback).toHaveCount(0);
      checks.push({
        width,
        name: "old content and reordered copy receipts cannot claim latest feedback",
      });
      await copy.click();
      await page.evaluate(() => (window.__fixture.show.value = false));
      await expect(detail).toHaveCount(0);
      await page.evaluate(() => {
        window.__clipboard.pending.shift().reject(Error("deactivated"));
        window.__fixture.show.value = true;
      });
      await expect(copy).toHaveText("复制");
      await expect(feedback).toHaveCount(0);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(unexpected, []);
      checks.push({
        width,
        name: "real KeepAlive deactivation suppresses old failure; no overflow, page error, API or external requests",
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
const sourceFiles = [
  component,
  "scripts/verify-technical-copy-feedback.mjs",
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  reviewStyle,
  ...cssFiles.map((f) => `apps/web/src/${f}`),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(sourceFiles.map(async (f) => [f, hash(await read(f))])),
);
const evidence = {
  schemaVersion: 1,
  approval: "pending",
  scope:
    "Actual shared Vue in P38-styled isolated fixture; no OS clipboard, API, RBAC, full page or production acceptance.",
  baseline: { commit: "e704cd24", file: component, sha256: hash(baseline) },
  sourceHashes,
  comparisons,
  checks,
  screenshots,
  processesClosed: true,
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><h1>技术详情复制反馈 · 待审核</h1><p>实际共享 Vue / 测试样例 / 未部署</p>${screenshots.map((s) => `<h2>${s.file}</h2><img style="max-width:100%" src="${s.file}" alt="${s.state}">`).join("\n")}</html>`,
  );
}
console.log(
  JSON.stringify({ checks: checks.length, screenshots: screenshots.length, processesClosed: true }),
);
