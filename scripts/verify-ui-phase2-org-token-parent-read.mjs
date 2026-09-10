import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import { buildOrgTokenDesignData } from "./lib/ui-phase2-org-token-design-data.mjs";

// Mounted parent/child characterization, not server authorization or design acceptance.
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((a) => a === "--capture"));
const output = "output/playwright/p36-parent-read-vue-r2";
const data = await buildOrgTokenDesignData(process.cwd());
const digest = (s) => createHash("sha256").update(s).digest("hex");
const entry = "/__p36_parent_read.js";
const host = `import {createApp,h,KeepAlive,ref} from 'vue';
import {createRouter,createWebHistory,RouterLink} from 'vue-router';
import Parent from '/src/components/OrganizationAdminCenter.vue';
import '/src/styles.css';import '/src/design/tokens.css';import '/src/accessibility.css';import '/src/responsive-baselines.css';import '/src/signal-ledger.css';
document.documentElement.dataset.design='signal-ledger';
const router=createRouter({history:createWebHistory(),routes:[{path:'/org-admin/tokens',name:'tokens',component:Parent},{path:'/__away',name:'away',component:{render:()=>h('p','隔离离页占位')}}]});
const org=ref('00000000-0000-4000-8000-000000000601');
window.__go=(q)=>router.push({path:'/org-admin/tokens',query:q});
const app=createApp({render(){const r=router.currentRoute.value;return h('main',[
h('nav',{'aria-label':'隔离生命周期测试导航'},[h(RouterLink,{to:'/__away'},()=> '离开测试页'),h(RouterLink,{to:'/org-admin/tokens'},()=> '返回测试页')]),
h(KeepAlive,{max:12},()=>r.name==='tokens'?h(Parent,{key:'tokens:'+org.value,apiBaseUrl:location.origin+'/api/v1',routePath:r.path,organizationId:org.value}):h(r.matched[0].components.default,{key:'away'}))]);}}).use(router);
await router.isReady();app.mount('#host');window.__hostReady=true;`;
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const freePort = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  server: {
    host: "127.0.0.1",
    port: freePort,
    strictPort: true,
    open: false,
    hmr: false,
    proxy: {},
  },
  plugins: [
    {
      name: "p36-parent-read-isolation",
      enforce: "pre",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          const pathname = req.url?.split("?")[0];
          // Fail closed even if browser routing is accidentally removed: no backend proxy.
          if (pathname?.startsWith("/api/")) {
            res.statusCode = 418;
            return res.end("unmocked test API forbidden");
          }
          if (!["/org-admin/tokens", "/__away"].includes(pathname)) return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P36 实际父子读取核对</title><div id="app"><div id="host" class="theme-main"></div></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const checks = [],
  screenshots = [],
  findings = [],
  requestEvidence = [];
let browser;
let loadedFiles = [];
const prior = capture ? null : JSON.parse(await readFile(`${output}/evidence.json`, "utf8"));
if (capture) await mkdir(output, { recursive: true });
try {
  await server.listen();
  const port = server.httpServer.address().port,
    origin = `http://127.0.0.1:${port}`;
  console.log(`p36_parent_read_host ${origin}`);
  browser = await chromium.launch({ headless: true });
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    await page.clock.setFixedTime(new Date(data.fixedTime));
    await context.addInitScript(() => {
      window.__clipboardCalls = 0;
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async () => {
            window.__clipboardCalls++;
            throw Error("clipboard prohibited");
          },
        },
      });
    });
    let mode = { status: 200, delayed: false, empty: false },
      held = [];
    const requests = [],
      forbidden = [],
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const check = (name, actual, expected = true) => {
      assert.deepEqual(actual, expected, `${width}: ${name}`);
      checks.push({ width, name });
    };
    const fulfill = async (r, snapshot) => {
      const isTokens = new URL(r.request().url()).pathname.endsWith("/tokens");
      const status = isTokens ? snapshot.status : 200;
      const body =
        status === 200
          ? {
              data: isTokens
                ? snapshot.empty
                  ? []
                  : data.tokens
                : { observed_at: "2026-08-08T12:00:00.000Z" },
              request_id: "p36-local-read-fixture",
              trace_id: "p36-local-read-fixture",
            }
          : {
              error: {
                code: `p36_local_${status}`,
                message: `隔离读取样例 ${status}`,
                action_hint: "此为本地验证样例。",
              },
              request_id: "p36-local-read-fixture",
              trace_id: "p36-local-read-fixture",
            };
      await r.fulfill({ status, json: body });
    };
    await page.route("**/*", async (r) => {
      const req = r.request(),
        u = new URL(req.url());
      if (u.origin !== origin) {
        forbidden.push({ method: req.method(), path: u.pathname });
        return r.abort();
      }
      if (!u.pathname.startsWith("/api/")) return r.continue();
      if (
        req.method() !== "GET" ||
        !["/api/v1/org/admin/summary", "/api/v1/org/admin/tokens"].includes(u.pathname)
      ) {
        forbidden.push({ method: req.method(), path: u.pathname });
        return r.abort();
      }
      requests.push({
        path: u.pathname,
        method: req.method(),
        status: u.pathname.endsWith("/tokens") ? mode.status : 200,
        hasRequestId: Boolean(req.headers()["x-request-id"]),
        hasTraceId: Boolean(req.headers()["x-trace-id"]),
      });
      const snapshot = { ...mode };
      if (snapshot.delayed) held.push(() => fulfill(r, snapshot));
      else await fulfill(r, snapshot);
    });
    const region = page.locator(".org-admin-center");
    const query = page.getByRole("searchbox", { name: "搜索令牌", exact: true });
    const countRows = () => page.locator(".org-token-list > article").count();
    const waitState = (state) =>
      page.waitForFunction(
        (v) => document.querySelector(".org-admin-center")?.dataset.state === v,
        state,
      );
    const visit = async (options = {}) => {
      assert.equal(held.length, 0, "release pending responses before a new document");
      mode = { status: 200, delayed: false, empty: false, ...options };
      await page.goto(`${origin}/org-admin/tokens`);
      await page.waitForFunction(() => window.__hostReady === true);
    };
    const release = async () => {
      mode.delayed = false;
      const work = held.splice(0);
      await Promise.all(work.map((fn) => fn()));
    };
    const shot = async (name, selector = ".org-admin-center") => {
      await page.evaluate(() => document.fonts.ready);
      check(
        `${name} no horizontal overflow`,
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      );
      if (!capture) return;
      const file = `${name}-${width}.png`,
        buffer = await page.locator(selector).screenshot({ animations: "disabled" });
      await writeFile(`${output}/${file}`, buffer);
      screenshots.push({
        name,
        width,
        file,
        sha256: digest(buffer),
        selector,
        approval: "pending; actual fixture observation only",
      });
    };
    try {
      await visit({ delayed: true });
      await waitState("loading");
      await page.waitForFunction(() =>
        document.querySelector(".org-admin-state")?.textContent.includes("正在读取"),
      );
      check(
        "initial refresh disabled",
        await page.getByRole("button", { name: "刷新数据", exact: true }).isDisabled(),
      );
      check("initial no token list", await countRows(), 0);
      await shot("initial-loading");
      // Both parallel GETs must have reached the interceptor before release.
      await assertEventually(() => held.length === 2);
      await release();
      await waitState("ready");
      check("initial six visible records", await countRows(), 6);

      for (const [status, state, attempts] of [
        [500, "error", 1],
        [403, "forbidden", 1],
        [401, "expired", 1],
        [409, "conflict", 1],
        [429, "rate_limited", 3],
        [503, "blocked", 3],
      ]) {
        const before = requests.length;
        await visit({ status });
        await waitState(state);
        check(
          `first ${status} hides token component`,
          await page.locator(".org-token-panel").count(),
          0,
        );
        check(
          `first ${status} request trace visible`,
          await page.locator(".org-admin-notice code").textContent(),
          "p36-local-read-fixture",
        );
        check(
          `first ${status} exact safe retry count`,
          requests.slice(before).filter((r) => r.path.endsWith("/tokens")).length,
          attempts,
        );
        check(
          `first ${status} no P34 failure override`,
          await region.getAttribute("data-approval-first-failure"),
          "false",
        );
        await shot(`first-${status}`);
        mode.status = 200;
        await page.getByRole("button", { name: "重新加载", exact: true }).click();
        await waitState("ready");
        check(`first ${status} retry returns six records`, await countRows(), 6);
        check(
          `first ${status} retry clears notice`,
          await page.locator(".org-admin-notice").count(),
          0,
        );
      }

      await visit({ empty: true });
      await waitState("empty");
      check(
        "empty response retains create form",
        await page.locator(".org-token-create").count(),
        1,
      );
      check("empty response has no records", await countRows(), 0);
      await shot("empty-response", ".org-token-ledger");

      await visit();
      await waitState("ready");
      await query.fill("月度经营");
      await page.getByRole("textbox", { name: /^令牌名称/ }).fill("尚未提交的本地草稿");
      await assertEventually(async () => (await countRows()) === 1);
      mode = { status: 500, delayed: true, empty: false };
      await page.getByRole("button", { name: "刷新数据", exact: true }).click();
      await assertEventually(() => held.length === 2);
      check("background is busy", await region.getAttribute("aria-busy"), "true");
      check("background retains filtered record", await countRows(), 1);
      check(
        "background disables create",
        await page.locator(".org-token-create button[type=submit]").isDisabled(),
      );
      check("background still permits local filter", await query.isEnabled());
      await shot("background-loading", ".org-admin-hero");
      await release();
      await page.locator(".org-admin-notice[role=alert]").waitFor();
      check("background500 keeps ready state", await region.getAttribute("data-state"), "ready");
      check(
        "background500 preserves draft",
        await page.getByRole("textbox", { name: /^令牌名称/ }).inputValue(),
        "尚未提交的本地草稿",
      );
      check("background500 preserves query", await query.inputValue(), "月度经营");
      check("background500 preserves results", await countRows(), 1);
      await shot("background500-notice", ".org-admin-notice");
      for (const [status, state] of [
        [403, "forbidden"],
        [401, "expired"],
      ]) {
        if (status === 401) {
          mode.status = 200;
          await page.getByRole("button", { name: "重新加载", exact: true }).click();
          await waitState("ready");
        }
        mode.status = status;
        await page.getByRole("button", { name: "刷新数据", exact: true }).click();
        await waitState(state);
        check(
          `background${status} hides old content`,
          await page.locator(".org-token-panel").count(),
          0,
        );
        await shot(`background-${status}`);
      }

      // True History API navigation on the same mounted component; not a reload.
      await visit();
      await waitState("ready");
      await query.fill("月度经营");
      await page.waitForURL(/org_token_query=/);
      await query.evaluate((n) => {
        window.__originalQueryNode = n;
      });
      await page.evaluate(() => window.__go({ org_token_query: "只读系统 2" }));
      const sameInstance = await query.evaluate((n) => n === window.__originalQueryNode);
      const pushed = {
        urlQuery: new URL(page.url()).searchParams.get("org_token_query"),
        field: await query.inputValue(),
        rows: await countRows(),
        sameInstance,
      };
      check("history probe preserves mounted field identity", sameInstance);
      check("history push reaches requested URL", pushed.urlQuery, "只读系统 2");
      check("history push restores filter", pushed.field, pushed.urlQuery);
      check(
        "history push restores actual result",
        await page.locator(".org-token-list article h5").allTextContents(),
        ["只读系统 2"],
      );
      await shot("history-query-restored", ".org-token-toolbar");
      await page.goBack();
      await page.waitForURL(/org_token_query=/);
      check(
        "history back URL returns original filter",
        new URL(page.url()).searchParams.get("org_token_query"),
        "月度经营",
      );
      check("history back restores field", await query.inputValue(), "月度经营");
      await page.goForward();
      check(
        "history forward URL restored",
        new URL(page.url()).searchParams.get("org_token_query"),
        "只读系统 2",
      );
      check("history forward restores field", await query.inputValue(), "只读系统 2");
      check(
        "history navigation did not remount field",
        await query.evaluate((n) => n === window.__originalQueryNode),
      );
      const readsBeforeAway = requests.length;
      await page.getByRole("link", { name: "离开测试页", exact: true }).click();
      await page.waitForURL(/\/__away$/);
      check("keepalive inactive parent absent from DOM", await region.count(), 0);
      await page.getByRole("link", { name: "返回测试页", exact: true }).click();
      await query.waitFor();
      const reactivated = {
        urlQuery: new URL(page.url()).searchParams.get("org_token_query"),
        field: await query.inputValue(),
        sameNode: await query.evaluate((n) => n === window.__originalQueryNode),
        additionalReads: requests.length - readsBeforeAway,
      };
      check("keepalive reuses actual parent-child nodes", reactivated.sameNode);
      check(
        "keepalive return restores URL defaults",
        reactivated.field,
        reactivated.urlQuery ?? "",
      );
      check("keepalive return restores six records", await countRows(), 6);
      check("query restoration adds no API reads", reactivated.additionalReads, 0);
      await page.evaluate(() =>
        window.__go({
          org_token_query: "只读系统",
          org_token_status: "all",
          org_token_scope: "all",
          org_token_sort: "name_asc",
          org_token_page: "2",
          keep: "retained",
        }),
      );
      check(
        "history batch restores four filter fields",
        await page
          .locator(".org-token-toolbar input, .org-token-toolbar select")
          .evaluateAll((nodes) => nodes.map((n) => n.value)),
        ["只读系统", "all", "all", "name_asc"],
      );
      check(
        "history batch retains explicit page two",
        (await page.getByLabel("令牌分页").innerText()).includes("第 2 / 2 页"),
      );
      check(
        "history batch restores page two result",
        await page.locator(".org-token-list article h5").allTextContents(),
        ["只读系统 8"],
      );
      await shot("history-page-two", ".org-token-ledger");
      await page.getByRole("button", { name: "重置筛选", exact: true }).click();
      await assertEventually(() => !new URL(page.url()).searchParams.has("org_token_query"));
      check(
        "history reset retains unrelated query",
        new URL(page.url()).searchParams.get("keep"),
        "retained",
      );
      check(
        "history reset returns default fields",
        await page
          .locator(".org-token-toolbar input, .org-token-toolbar select")
          .evaluateAll((nodes) => nodes.map((n) => n.value)),
        ["", "all", "all", "created_desc"],
      );
      check(
        "all API reads carry request and trace IDs",
        requests.every((r) => r.hasRequestId && r.hasTraceId),
      );
      check("no external or write requests", forbidden, []);
      check("no browser errors", errors, []);
      check("no cookies", await context.cookies(), []);
      check(
        "no storage or clipboard",
        await page.evaluate(() => [
          localStorage.length,
          sessionStorage.length,
          window.__clipboardCalls,
        ]),
        [0, 0, 0],
      );
      requestEvidence.push({ width, requests, forbidden, errors });
    } finally {
      await release();
      await context.close();
    }
  }
  loadedFiles = [...server.moduleGraph.idToModuleMap.keys()]
    .map((id) => id.split("?")[0])
    .filter(
      (id) => id.replaceAll("\\", "/").includes("/apps/web/src/") && /\.(?:vue|ts|css)$/.test(id),
    );
} finally {
  await browser?.close();
  await server.close();
}
const files = [
  ...new Set([
    ...loadedFiles.map((f) => path.relative(process.cwd(), f).replaceAll("\\", "/")),
    "scripts/verify-ui-phase2-org-token-parent-read.mjs",
    "scripts/lib/ui-phase2-org-token-design-data.mjs",
    "tests/e2e/m06-01-organization-admin.spec.ts",
    "apps/web/vite.config.ts",
    "apps/web/src/components/NavigationShell.vue",
  ]),
].sort();
const sourceHashes = Object.fromEntries(
  await Promise.all(
    files.map(async (f) => [f, digest((await readFile(f, "utf8")).replaceAll("\r\n", "\n"))]),
  ),
);
const result = {
  kind: "P36-PARENT-READ-VUE",
  scope:
    "Real parent, child and API client mounted in isolated router/KeepAlive host. GET fixtures only; shell guard, actual backend, scope switching, writes, RBAC and production excluded. P36-HISTORY-01/02 fixed and exercised; not whole-page acceptance.",
  resolvedFindings: ["P36-HISTORY-01", "P36-HISTORY-02"],
  previousEvidence: "output/playwright/p36-parent-read-vue/evidence.json",
  sourceHashes,
  checks,
  findings,
  requestEvidence,
  screenshots,
  acceptanceComplete: false,
  browserAndServerClosed: true,
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(result, null, 2) + "\n");
  await writeFile(`${output}/index.html`, gallery(result));
} else {
  for (const s of prior.screenshots)
    assert.equal(digest(await readFile(`${output}/${s.file}`)), s.sha256);
  assert.deepEqual(sourceHashes, prior.sourceHashes);
  assert.deepEqual(checks, prior.checks);
  assert.deepEqual(findings, prior.findings);
  assert.deepEqual(requestEvidence, prior.requestEvidence);
  assert.equal(await readFile(`${output}/index.html`, "utf8"), gallery(prior));
}
console.log(
  JSON.stringify({
    checks: checks.length,
    screenshots: screenshots.length,
    findings,
    acceptanceComplete: false,
    browserAndServerClosed: true,
  }),
);

async function assertEventually(predicate) {
  const until = Date.now() + 10_000;
  while (!(await predicate())) {
    if (Date.now() > until) throw Error("condition did not become true");
    await new Promise((r) => setTimeout(r, 25));
  }
}

function gallery(evidence) {
  const labels = {
    "initial-loading": "首次读取等待",
    "first-500": "首次读取失败",
    "first-403": "首次权限拒绝",
    "first-401": "首次登录失效",
    "first-409": "首次版本冲突",
    "first-429": "首次请求频繁",
    "first-503": "首次服务不可用",
    "empty-response": "读取成功但没有令牌",
    "background-loading": "后台刷新等待 · 页头区域",
    "background500-notice": "后台刷新失败 · 提示区域",
    "background-403": "后台刷新权限拒绝",
    "background-401": "后台刷新登录失效",
    "history-query-restored": "历史查询已恢复 · 筛选区域",
    "history-page-two": "历史批量恢复筛选与第二页",
  };
  const cards = evidence.screenshots
    .map((s) => {
      assert.match(s.file, /^[a-z0-9-]+\.png$/);
      assert.ok(labels[s.name]);
      return `<figure><figcaption>${labels[s.name]} · ${s.width}px</figcaption><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${labels[s.name]}，宽度${s.width}像素"></a></figure>`;
    })
    .join("\n");
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P36 父子读取实际状态核对</title>
<style>body{margin:0;background:#f5f6f8;color:#202c3d;font:16px/1.6 system-ui,sans-serif}main{max-width:1280px;margin:auto;padding:24px}h1{font-size:26px}a{color:#254a9c}a:focus-visible{outline:3px solid #254a9c;outline-offset:3px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,350px),1fr));gap:20px}figure{margin:0;background:white;border:1px solid #dbe1e9;padding:16px;min-width:0}figcaption{margin-bottom:12px}img{max-width:100%;height:auto}.note{padding:16px;background:#fff;border-left:4px solid #254a9c}</style>
<main><h1>P36 · 真实父子组件读取状态</h1><p class="note">这是当前实际 Vue 的核对图，不是新 C 设计稿或批准记录。使用本地 GET 样例；未访问生产、未签发令牌。旧页头和错误区域仍保留原样。</p>
<p>${evidence.checks.length} 项检查，${evidence.screenshots.length} 张局部或组件截图。历史查询与缓存返回的 2 类问题已修复并回归；整页验收未通过。截图不包含浏览器地址栏，URL 与字段对应见证据。</p><p><a href="evidence.json">读取完整验证记录</a> · <a href="../p36-parent-read-vue/index.html">保留的修复前问题图</a></p><div class="grid">${cards}</div></main></html>\n`;
}
