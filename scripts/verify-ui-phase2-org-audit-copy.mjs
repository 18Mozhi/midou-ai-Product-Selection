import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import { buildOrgAuditDesignData } from "./lib/ui-phase2-org-audit-design-data.mjs";

const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(process.argv.slice(2).every((v) => ["--capture", "--smoke"].includes(v)));
assert.ok(!(capture && smoke));
const output = "output/playwright/p37-copy-ownership-vue";
const data = await buildOrgAuditDesignData(process.cwd());
const endpoint = `/api/v1/organizations/${data.events[0].organization_id}/audit-events`;
const hash = (v) => createHash("sha256").update(v).digest("hex");
const entry = "/__p37_copy.js";
const host = `import {createApp,h,ref,nextTick,KeepAlive} from 'vue';
import {createRouter,createWebHistory} from 'vue-router';
import Parent from '/src/components/OrganizationAdminCenter.vue';
import Child from '/src/components/OrganizationAuditPanel.vue';
import '/src/styles.css';import '/src/design/tokens.css';import '/src/accessibility.css';import '/src/responsive-baselines.css';import '/src/signal-ledger.css';
document.documentElement.dataset.design='signal-ledger';
const router=createRouter({history:createWebHistory(),routes:[{path:'/org-admin/audit',component:Parent},{path:'/__away',component:{render:()=>h('p','隔离离页占位')}}]});
const mode=ref('parent'),mounted=ref(true),events=ref(${JSON.stringify(data.events.slice(0, 3))});
const filters={action:'',outcome:'',resource_type:'',request_id:'',trace_id:'',occurred_from:'',occurred_to:''};
window.__tick=()=>nextTick();window.__go=(path)=>router.push(path);
window.__child=()=>{mode.value='child'};window.__mount=(value)=>{mounted.value=value};
window.__events=(value)=>{events.value=value};window.__patch=(value)=>Object.assign(events.value[0],value);
const app=createApp({render(){const r=router.currentRoute.value;return mounted.value?h(KeepAlive,()=>r.path==='/org-admin/audit'?(mode.value==='parent'?h(Parent,{key:'parent',apiBaseUrl:location.origin+'/api/v1',routePath:r.path,organizationId:${JSON.stringify(data.events[0].organization_id)}}):h(Child,{key:'child',events:events.value,nextCursor:null,filters,busy:false,formatTime:v=>v,applyFilters:async()=>{},loadMore:async()=>{}})):h(r.matched[0].components.default,{key:'away'})):h('p','隔离卸载占位')}}).use(router);
await router.isReady();app.mount('#host');window.__hostReady=true;`;
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  server: { host: "127.0.0.1", port, strictPort: true, open: false, hmr: false, proxy: {} },
  plugins: [
    {
      name: "p37-current-copy-isolation",
      enforce: "pre",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          const pathname = req.url?.split("?")[0];
          if (pathname?.startsWith("/api/")) {
            res.statusCode = 418;
            return res.end("unmocked API forbidden");
          }
          if (!["/org-admin/audit", "/__away"].includes(pathname)) return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P37 当前复制归属核对</title><div id="app"><div id="host" class="theme-main"></div></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const checks = [],
  screenshots = [],
  requests = [];
let browser,
  loaded = [];
if (capture) await mkdir(output, { recursive: true });
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`p37_current_copy_host ${origin}`);
  browser = await chromium.launch({ headless: true });
  for (const width of smoke ? [390] : [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
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
        const req = route.request(),
          url = new URL(req.url());
        if (
          url.origin !== origin ||
          (url.pathname.startsWith("/api/") &&
            (req.method() !== "GET" || url.pathname !== endpoint))
        ) {
          forbidden.push(req.method() + " " + url.pathname);
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        requests.push({
          width,
          method: req.method(),
          path: url.pathname,
          query: Object.fromEntries(url.searchParams),
        });
        return route.fulfill({
          json: {
            data: { items: data.events.slice(0, 50), nextCursor: null },
            request_id: "p37-copy-synthetic",
            trace_id: "p37-copy-synthetic",
          },
        });
      });
      const check = (name, value, expected) => {
        assert.deepEqual(value, expected, `${width}:${name}`);
        checks.push({ width, name });
      };
      const buttons = page.locator(".org-audit-correlation button"),
        rows = page.locator(".org-audit-row");
      const tick = () =>
        page.evaluate(async () => {
          await Promise.resolve();
          await window.__tick();
        });
      const feedback = async (name, expected = ["复制", "复制"]) => {
        await tick();
        check(name, await buttons.allTextContents().then((v) => v.map((s) => s.trim())), expected);
      };
      const copy = async (field = 0) => {
        await buttons.nth(field).click();
        return page.evaluate(() => window.__copies.length - 1);
      };
      const settle = (index, rejected = false) =>
        page.evaluate(
          async ({ index, rejected }) => {
            const p = window.__copies[index];
            rejected ? p.reject(new Error("synthetic clipboard denial")) : p.resolve();
            await Promise.resolve();
            await window.__tick();
          },
          { index, rejected },
        );
      const shot = async (name) => {
        await page.evaluate(() => document.fonts.ready);
        check(
          `${name}:no-overflow`,
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        );
        if (capture) {
          const file = `${name}-${width}.png`,
            bytes = await page.locator(".org-audit-detail").screenshot({ animations: "disabled" });
          await writeFile(`${output}/${file}`, bytes);
          screenshots.push({
            name,
            width,
            file,
            sha256: hash(bytes),
            approval: "runtime-observation-not-C-design-approval",
          });
        }
      };
      await page.goto(origin + "/org-admin/audit");
      await page.waitForFunction(
        () => window.__hostReady && document.querySelectorAll(".org-audit-row").length === 50,
      );
      check("actual-parent:50-rows", await rows.count(), 50);
      let pending = await copy();
      await rows.nth(1).click();
      await settle(pending);
      await feedback("actual-parent:old-copy-does-not-label-new-record");
      check(
        "actual-parent:exact-copied-value",
        await page.evaluate((i) => window.__copies[i].value, pending),
        data.events[0].request_id,
      );
      check(
        "actual-parent:new-record-value",
        await page.locator(".org-audit-correlation code").first().textContent(),
        data.events[1].request_id,
      );
      await shot("parent-old-copy-ignored");
      pending = await copy();
      await settle(pending);
      await feedback("current-request:success", ["已复制", "复制"]);
      await shot("current-request-copied");
      pending = await copy(1);
      await settle(pending, true);
      await feedback("current-trace:failure", ["复制", "复制失败"]);
      await shot("current-trace-failed");
      pending = await copy();
      const newer = await copy(1);
      await settle(newer);
      await settle(pending, true);
      await feedback("newer-trace-survives-older-request-failure", ["复制", "已复制"]);
      await shot("newest-copy-wins");
      pending = await copy();
      await rows.nth(0).click();
      await rows.nth(1).click();
      await settle(pending);
      await feedback("actual-parent:A-B-A-rejects-old-result");
      pending = await copy();
      await page.evaluate(() => window.__go("/__away"));
      await page.getByText("隔离离页占位", { exact: true }).waitFor();
      await page.evaluate(() => window.__go("/org-admin/audit"));
      await buttons.first().waitFor();
      await settle(pending);
      await feedback("actual-parent:cached-return-ignores-old-result");
      await shot("cached-return-old-copy-ignored");
      pending = await copy();
      await page.evaluate(() => window.__mount(false));
      await page.getByText("隔离卸载占位", { exact: true }).waitFor();
      await settle(pending, true);
      await page.evaluate(() => window.__mount(true));
      await buttons.first().waitFor();
      await feedback("actual-parent:remount-no-old-feedback");
      await shot("remount-old-copy-ignored");
      await page.evaluate(() => window.__child());
      await tick();
      check("actual-child:three-fixtures", await rows.count(), 3);
      await rows.first().click();
      pending = await copy();
      await page
        .getByRole("searchbox", { name: "页内搜索", exact: true })
        .fill(data.events[1].request_id);
      await settle(pending);
      await feedback("actual-child:search-fallback-ignores-old-result");
      await shot("search-fallback-old-copy-ignored");
      await page.getByRole("searchbox", { name: "页内搜索", exact: true }).fill("");
      await rows.first().click();
      for (const field of ["request_id", "trace_id", "organization_id"]) {
        pending = await copy();
        await page.evaluate(({ field }) => window.__patch({ [field]: `synthetic-new-${field}` }), {
          field,
        });
        await settle(pending);
        await feedback(`actual-child:same-ID-${field}-change-ignores-old-result`);
      }
      pending = await copy();
      await page.evaluate((events) => window.__events(events), data.events.slice(0, 3));
      await settle(pending);
      await feedback("actual-child:replacement-object-ignores-old-result");
      await shot("record-replacement-old-copy-ignored");
      pending = await copy();
      await page.evaluate(() => window.__events([]));
      await settle(pending);
      check("actual-child:empty-list-no-copy-feedback", await buttons.count(), 0);
      await page.evaluate((events) => window.__events(events), data.events.slice(0, 3));
      await buttons.first().waitFor();
      await feedback("actual-child:list-return-no-old-feedback");
      pending = await copy();
      await settle(pending);
      await feedback("actual-child:fresh-copy-still-works", ["已复制", "复制"]);
      check("no-page-errors", errors, []);
      check("no-forbidden-network", forbidden, []);
      check("no-cookies", await context.cookies(), []);
      check(
        "no-storage",
        await page.evaluate(() => localStorage.length + sessionStorage.length),
        0,
      );
    } finally {
      await context.close();
    }
  }
  loaded = [
    ...new Set(
      [...server.moduleGraph.idToModuleMap.keys()]
        .map((id) => id.split("?")[0])
        .filter(
          (id) => id.replaceAll("\\", "/").includes("/apps/web/src/") && /\.(vue|ts|css)$/.test(id),
        )
        .map((id) => path.relative(process.cwd(), id).replaceAll("\\", "/")),
    ),
  ];
} finally {
  await browser?.close();
  await server.close();
}
if (!smoke) {
  const files = [
    ...loaded,
    "scripts/verify-ui-phase2-org-audit-copy.mjs",
    "scripts/lib/ui-phase2-org-audit-design-data.mjs",
    "scripts/lib/ui-phase2-audit-copy-baseline.mjs",
    "tests/e2e/m06-01-organization-admin.spec.ts",
    "apps/web/vite.config.ts",
  ].sort();
  const sourceHashes = Object.fromEntries(
    await Promise.all(
      files.map(async (f) => [f, hash((await readFile(f, "utf8")).replaceAll("\r\n", "\n"))]),
    ),
  );
  const result = {
    kind: "P37-CURRENT-COPY-OWNERSHIP-VUE",
    scope:
      "Unmodified current SFCs mounted through actual Parent and Child in isolated Router/KeepAlive; synthetic audit GET and clipboard promises. Copy-feedback repair only, not full C implementation/backend/RBAC/OS clipboard/production acceptance.",
    sourceHashes,
    checks,
    requests,
    screenshots,
    browserAndServerClosed: true,
    acceptanceComplete: false,
  };
  if (capture) {
    await writeFile(`${output}/evidence.json`, JSON.stringify(result, null, 2) + "\n");
    await writeFile(
      `${output}/index.html`,
      `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P37 当前复制归属修复</title><style>body{font:16px/1.6 sans-serif;margin:24px}img{max-width:100%;height:auto}figure{margin:24px 0}</style><h1>P37 当前复制反馈 · 实际 Vue</h1><p>旧UI上的局部行为修复，不是C设计通过。历史问题图未覆盖；不证明真实剪贴板、权限或生产。</p><a href="evidence.json">证据</a>${screenshots.map((s) => `<figure><figcaption>${s.name} / ${s.width}</figcaption><img src="${s.file}" alt="${s.name}"></figure>`).join("")}</html>`,
    );
  } else {
    const old = JSON.parse(await readFile(`${output}/evidence.json`, "utf8"));
    for (const key of [
      "sourceHashes",
      "checks",
      "requests",
      "browserAndServerClosed",
      "acceptanceComplete",
    ])
      assert.deepEqual(result[key], old[key], key);
    for (const s of old.screenshots)
      assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
  }
}
console.log(
  JSON.stringify({
    mode: smoke ? "smoke" : capture ? "capture" : "verify",
    checks: checks.length,
    screenshots: screenshots.length,
    requests: requests.length,
    browserAndServerClosed: true,
    acceptanceComplete: false,
  }),
);
