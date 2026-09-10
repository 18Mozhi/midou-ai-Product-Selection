import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p36-copy-ownership";
const component = "apps/web/src/components/OrganizationTokenPanel.vue";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const entry = "/__p36_copy.js";
// Real child, router and KeepAlive. Host controls model parent inputs only; no script transform.
const host = `import {createApp,h,ref,KeepAlive} from 'vue';import {createRouter,createWebHistory} from 'vue-router';
import Child from '/src/components/OrganizationTokenPanel.vue';
import '/src/styles.css';import '/src/design/tokens.css';import '/src/accessibility.css';import '/src/responsive-baselines.css';import '/src/signal-ledger.css';
document.documentElement.dataset.design='signal-ledger';
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const secret=ref('SYNTHETIC_A_NOT_A_TOKEN'),active=ref(true),mounted=ref(true);
const action=(label,fn)=>h('button',{onClick:fn},label);
const app=createApp({render:()=>h('div',[
h('nav',{'aria-label':'测试宿主控制'},[
action('替换测试值',()=>secret.value='SYNTHETIC_B_NOT_A_TOKEN'),
action('清除后同值',()=>{secret.value='';secret.value='SYNTHETIC_A_NOT_A_TOKEN'}),
action('缓存切换',()=>active.value=!active.value),action('卸载切换',()=>mounted.value=!mounted.value),
action('路径切换',()=>router.push(router.currentRoute.value.path==='/org-admin/tokens'?'/__away':'/org-admin/tokens'))]),
mounted.value?h(KeepAlive,()=>active.value?h(Child,{key:'child',tokens:[],secret:secret.value,busy:false,formatTime:v=>v,
createToken:async()=>{throw Error('write forbidden')},performTokenAction:async()=>{throw Error('write forbidden')},dismissSecret:()=>secret.value=''}):h('p',{key:'away'},'测试缓存占位')):h('p','测试卸载占位')])}).use(router);
await router.isReady();app.mount('#host');`;
const probe = reservePort();
await new Promise((done) => probe.listen(0, "127.0.0.1", done));
const port = probe.address().port;
await new Promise((done) => probe.close(done));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {}, hmr: false },
  plugins: [
    {
      name: "p36-current-copy-isolation",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          const pathname = req.url?.split("?")[0];
          if (pathname?.startsWith("/api/")) {
            res.statusCode = 418;
            return res.end("API forbidden");
          }
          if (!["/org-admin/tokens", "/__away"].includes(pathname)) return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P36 复制反馈回归</title><div id="app"><div id="host" class="theme-main"></div></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const checks = [],
  screenshots = [],
  scenarios = [];
const sourceFiles = new Set([
  component,
  "scripts/verify-ui-phase2-token-copy-ownership.mjs",
  "apps/web/vite.config.ts",
]);
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`p36_copy_host ${origin}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      reducedMotion: "reduce",
    });
    try {
      await context.addInitScript(() => {
        window.__copies = [];
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: (value) =>
              new Promise((resolve, reject) => window.__copies.push({ value, resolve, reject })),
          },
        });
      });
      const page = await context.newPage(),
        errors = [],
        forbidden = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin || url.pathname.startsWith("/api/")) {
          forbidden.push(route.request().url());
          return route.abort();
        }
        return route.continue();
      });
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ width, name });
      };
      const status = page.locator(".org-token-secret [role=status]"),
        copy = page.getByRole("button", { name: "复制明文", exact: true }),
        control = (name) =>
          page
            .getByRole("navigation", { name: "测试宿主控制" })
            .getByRole("button", { name, exact: true });
      const settle = async (index, outcome) => {
        await page.evaluate(
          ({ index, outcome }) => {
            const request = window.__copies[index];
            outcome === "success"
              ? request.resolve()
              : request.reject(Error("synthetic clipboard denial"));
          },
          { index, outcome },
        );
      };
      const shot = async (name) => {
        if (!capture) return;
        const bytes = await page
            .locator(".org-token-secret")
            .screenshot({ animations: "disabled" }),
          file = `${width}-${name}.png`;
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          width,
          scenario: name,
          sha256: hash(bytes),
          scope: "actual-child-original-style-synthetic-values-not-C-approval",
        });
      };
      for (const outcome of ["success", "failure"]) {
        for (const change of ["stay", "replace", "clear", "route", "deactivate", "unmount"]) {
          const name = `${change}-${outcome}`;
          await page.goto(origin + "/org-admin/tokens");
          await expect(copy).toBeVisible();
          await page
            .locator(".org-token-secret")
            .evaluate((node) => (window.__oldSecretNode = node));
          await copy.click();
          check(
            name + ":one original clipboard intent",
            await page.evaluate(() => window.__copies.map((r) => r.value)),
            ["SYNTHETIC_A_NOT_A_TOKEN"],
          );
          if (change === "replace") await control("替换测试值").click();
          if (change === "clear")
            await page.getByRole("button", { name: "我已安全保存", exact: true }).click();
          if (change === "route") await control("路径切换").click();
          if (change === "deactivate") await control("缓存切换").click();
          if (change === "unmount") await control("卸载切换").click();
          if (["clear", "deactivate", "unmount"].includes(change))
            await expect(status).toHaveCount(0);
          if (change === "route") await expect(page).toHaveURL(origin + "/__away");
          await settle(0, outcome);
          // Let the real Vue update queue finish before returning the cached child.
          await page.evaluate(
            () => new Promise((resolve) => requestAnimationFrame(() => resolve())),
          );
          if (change === "clear") await control("替换测试值").click();
          if (change === "route") await control("路径切换").click();
          if (change === "deactivate") await control("缓存切换").click();
          if (change === "unmount") await control("卸载切换").click();
          await expect(status).toHaveText(
            change === "stay"
              ? outcome === "success"
                ? "已复制到剪贴板，请立即保存到受限凭据位置。"
                : "浏览器拒绝复制，请手动选择并保存。"
              : "复制后请保存到受限凭据位置；系统无法再次找回。",
          );
          check(name + ":feedback owner checked", true);
          if (change === "deactivate")
            check(
              name + ":same cached DOM",
              await page
                .locator(".org-token-secret")
                .evaluate((node) => node === window.__oldSecretNode),
            );
          if (change === "unmount")
            check(
              name + ":new DOM",
              await page
                .locator(".org-token-secret")
                .evaluate((node) => node !== window.__oldSecretNode),
            );
          check(
            name + ":synthetic displayed value",
            await page.locator(".org-token-secret code").textContent(),
            ["replace", "clear"].includes(change)
              ? "SYNTHETIC_B_NOT_A_TOKEN"
              : "SYNTHETIC_A_NOT_A_TOKEN",
          );
          await shot(name);
          scenarios.push({ width, name });
        }
      }
      for (const latest of ["success", "failure"]) {
        await page.goto(origin + "/org-admin/tokens");
        await copy.click();
        await copy.click();
        await settle(1, latest);
        await settle(0, latest === "success" ? "failure" : "success");
        await expect(status).toContainText(
          latest === "success" ? "已复制到剪贴板" : "浏览器拒绝复制",
        );
        check(
          `latest-${latest}:reverse settlement`,
          await page.evaluate(() => window.__copies.length),
          2,
        );
        await shot(`latest-${latest}`);
        scenarios.push({ width, name: `latest-${latest}` });
      }
      check("zero external or API requests", forbidden, []);
      check("zero browser errors", errors, []);
      check(
        "zero storage",
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      console.log(`passed ${width}`);
    } finally {
      await context.close();
    }
  }
  for (const file of server.moduleGraph.fileToModulesMap.keys()) {
    const relative = path.relative(process.cwd(), file).replaceAll("\\", "/");
    if (
      /^(apps\/web\/src\/|packages\/)/.test(relative) &&
      !relative.includes("?") &&
      !relative.includes("node_modules")
    )
      sourceFiles.add(relative);
  }
} finally {
  await browser?.close();
  await server.close();
}
const sourceHashes = Object.fromEntries(
  await Promise.all([...sourceFiles].sort().map(async (file) => [file, hash(await read(file))])),
);
const evidence = {
  kind: "P36-COPY-OWNERSHIP-VUE-r1",
  scope:
    "Raw current child, actual router/KeepAlive and host-controlled synthetic inputs. No parent, App shell, API, valid credential, real OS clipboard, C visual approval or production acceptance. Sync same-value-reset is separately covered by the direct reactive test; batched host props are not claimed as that proof.",
  sourceHashes,
  checks,
  scenarios,
  screenshots,
  processesClosed: true,
  acceptanceComplete: false,
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P36 复制反馈回归</title><h1>P36 复制反馈 · 原样式功能验证</h1><p>实际子 Vue；测试数据及模拟剪贴板，不代表 C 设计批准或生产验收。</p>${screenshots.map((s) => `<h2>${s.file}</h2><img style="max-width:100%" src="${s.file}" alt="${s.scenario}">`).join("\n")}</html>`,
  );
}
console.log(
  JSON.stringify({
    checks: checks.length,
    scenarios: scenarios.length,
    screenshots: screenshots.length,
    processesClosed: true,
  }),
);
