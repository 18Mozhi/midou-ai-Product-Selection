import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import { buildOrgAuditDesignData } from "./lib/ui-phase2-org-audit-design-data.mjs";
import { historicalAuditSource } from "./lib/ui-phase2-audit-copy-baseline.mjs";

const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(process.argv.slice(2).every((a) => ["--capture", "--smoke"].includes(a)));
assert.ok(!(capture && smoke));
const output = "output/playwright/p37-parent-read-vue";
console.log(
  "P37 historical baseline replay only; current copy repair is verified separately by verify-ui-phase2-org-audit-copy.mjs",
);
const data = await buildOrgAuditDesignData(process.cwd());
const digest = (v) => createHash("sha256").update(v).digest("hex");
const endpoint = `/api/v1/organizations/${data.events[0].organization_id}/audit-events`;
const entry = "/__p37_parent_read.js";
const host = `import {createApp,h,KeepAlive} from 'vue';
import {createRouter,createWebHistory,RouterLink} from 'vue-router';
import Parent from '/src/components/OrganizationAdminCenter.vue';
import '/src/styles.css';import '/src/design/tokens.css';import '/src/accessibility.css';import '/src/responsive-baselines.css';import '/src/signal-ledger.css';
document.documentElement.dataset.design='signal-ledger';
const router=createRouter({history:createWebHistory(),routes:[{path:'/org-admin/audit',name:'audit',component:Parent},{path:'/__away',name:'away',component:{render:()=>h('p','隔离离页占位')}}]});
window.__go=(query)=>router.push({path:'/org-admin/audit',query});
window.__away=()=>router.push('/__away');
const app=createApp({render(){const r=router.currentRoute.value;return h('main',[
h('nav',{'aria-label':'隔离生命周期测试导航'},[h(RouterLink,{to:'/__away'},()=> '离开测试页'),h(RouterLink,{to:'/org-admin/audit'},()=> '返回测试页')]),
h(KeepAlive,()=>r.name==='audit'?h(Parent,{key:'audit',apiBaseUrl:location.origin+'/api/v1',routePath:r.path,organizationId:${JSON.stringify(data.events[0].organization_id)}}):h(r.matched[0].components.default,{key:'away'}))]);}}).use(router);
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
      name: "p37-parent-read-isolation",
      enforce: "pre",
      transform(source, id) {
        if (id.replaceAll("\\", "/").endsWith("/src/components/OrganizationAdminCenter.vue"))
          return historicalAuditSource(
            "apps/web/src/components/OrganizationAdminCenter.vue",
            source,
          );
        if (id.replaceAll("\\", "/").endsWith("/src/components/OrganizationAuditPanel.vue"))
          return historicalAuditSource(
            "apps/web/src/components/OrganizationAuditPanel.vue",
            source,
          );
      },
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
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P37 实际父子读取</title><div id="app"><div id="host" class="theme-main"></div></div><script type="module" src="${entry}"></script></html>`,
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
let browser,
  loadedFiles = [];
if (capture) await mkdir(output, { recursive: true });
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  console.log(`p37_parent_read_host ${origin}`);
  browser = await chromium.launch({ headless: true });
  for (const width of smoke ? [390] : [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    await context.addInitScript(() => {
      window.__copies = [];
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: (value) =>
            new Promise((resolve) => {
              window.__copies.push(value);
              window.__resolveCopy = resolve;
            }),
        },
      });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    let mode = { status: 200, hold: false, fresh: false, empty: false },
      held = [];
    const requests = [],
      errors = [],
      forbidden = [];
    const check = (name, actual, expected = true) => {
      assert.deepEqual(actual, expected, `${width}:${name}`);
      checks.push({ width, name });
    };
    page.on("pageerror", (e) => errors.push(e.message));
    async function respond(route, snapshot, query) {
      const status = snapshot.status;
      let rows = snapshot.empty
        ? []
        : snapshot.fresh
          ? data.events.slice(0, 10)
          : query.cursor
            ? data.events.slice(50)
            : data.events.slice(0, 50);
      for (const key of ["action", "outcome", "resource_type", "request_id", "trace_id"])
        if (query[key]) rows = rows.filter((e) => e[key] === query[key]);
      const body =
        status === 200
          ? {
              data: {
                items: rows,
                nextCursor:
                  snapshot.empty || snapshot.fresh || query.cursor ? null : data.events[49].id,
              },
              request_id: "p37-local-read-fixture",
              trace_id: "p37-local-read-fixture",
            }
          : {
              error: {
                code: `p37_local_${status}`,
                message: `隔离读取样例 ${status}`,
                action_hint: "本地验证样例",
              },
              request_id: "p37-local-read-fixture",
              trace_id: "p37-local-read-fixture",
            };
      await route.fulfill({ status, json: body });
    }
    await page.route("**/*", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (url.origin !== origin) {
        forbidden.push(req.url());
        return route.abort();
      }
      if (!url.pathname.startsWith("/api/")) return route.continue();
      if (req.method() !== "GET" || url.pathname !== endpoint) {
        forbidden.push(req.method() + " " + url.pathname);
        return route.abort();
      }
      const query = Object.fromEntries(url.searchParams),
        snapshot = { ...mode };
      requests.push({
        method: req.method(),
        path: url.pathname,
        query,
        status: snapshot.status,
        requestId: Boolean(req.headers()["x-request-id"]),
        traceId: Boolean(req.headers()["x-trace-id"]),
      });
      if (snapshot.hold) held.push(() => respond(route, snapshot, query));
      else await respond(route, snapshot, query);
    });
    const panel = page.locator(".org-audit-panel"),
      rows = page.locator(".org-audit-row");
    const search = page.getByRole("searchbox", { name: "页内搜索", exact: true });
    const action = page.getByLabel("操作代码（精确）", { exact: true });
    const waitState = (v) =>
      page.waitForFunction(
        (s) => document.querySelector(".org-admin-center")?.dataset.state === s,
        v,
      );
    const visit = async (options = {}, query = "") => {
      assert.equal(held.length, 0);
      mode = { status: 200, hold: false, fresh: false, empty: false, ...options };
      await page.goto(origin + "/org-admin/audit" + query);
      await page.waitForFunction(() => window.__hostReady);
    };
    const release = async () => {
      mode.hold = false;
      await Promise.all(held.splice(0).map((fn) => fn()));
    };
    const shot = async (name, selector = ".org-admin-center") => {
      await page.evaluate(() => document.fonts.ready);
      check(
        name + ":no-overflow",
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      );
      if (capture) {
        const file = `${name}-${width}.png`,
          bytes = await page.locator(selector).screenshot({ animations: "disabled" });
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          name,
          width,
          file,
          selector,
          sha256: digest(bytes),
          approval: "observation-only-not-design-approval",
        });
      }
    };
    try {
      await visit({ hold: true });
      await waitState("loading");
      check("initial:hides-child", await panel.count(), 0);
      await shot("initial-loading");
      await eventually(() => held.length === 1);
      await release();
      await waitState("ready");
      check("initial:50", await rows.count(), 50);
      check("initial:one-audit-only", requests.length, 1);
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
        check(`first:${status}:hides-child`, await panel.count(), 0);
        check(`first:${status}:attempts`, requests.length - before, attempts);
        await shot(`first-${status}`);
        mode.status = 200;
        await page.getByRole("button", { name: "重新加载", exact: true }).click();
        await waitState("ready");
        check(`first:${status}:recovers`, await rows.count(), 50);
      }
      await visit({ empty: true });
      await waitState("ready");
      check("empty:child-visible", await panel.count(), 1);
      check("empty:no-rows", await rows.count(), 0);
      await shot("empty-response", ".org-audit-ledger");
      for (const status of [500, 403, 401]) {
        await visit();
        await waitState("ready");
        mode.status = status;
        await page.getByRole("button", { name: "刷新数据", exact: true }).click();
        await page.waitForFunction(
          () =>
            document.querySelector(".org-admin-notice") &&
            document.querySelector(".org-admin-center")?.getAttribute("aria-busy") === "false",
        );
        check(`background:${status}:visible-rows`, await rows.count(), status === 500 ? 50 : 0);
        await shot(
          `background-${status}`,
          status === 500 ? ".org-admin-notice" : ".org-admin-center",
        );
      }
      await visit();
      await waitState("ready");
      await action.fill(" organization.member.invited ");
      await page.getByRole("button", { name: "应用筛选", exact: true }).click();
      await page.waitForFunction(
        () => document.querySelector(".org-admin-center")?.getAttribute("aria-busy") === "false",
      );
      check("filter:trimmed-param", requests.at(-1).query.action, "organization.member.invited");
      check(
        "filter:real-response-row-count",
        await rows.count(),
        data.events.slice(0, 50).filter((e) => e.action === "organization.member.invited").length,
      );
      await page.getByRole("button", { name: "重置筛选", exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll(".org-audit-row").length === 50);
      check("reset:first-page-query", requests.at(-1).query, { limit: "50" });
      const beforeLocal = requests.length;
      await search.fill("失败");
      check("local:no-request", requests.length, beforeLocal);
      check("local:failed-count", await rows.count(), 17);
      await search.fill("");
      const beforeHistory = requests.length;
      await page.evaluate(() =>
        window.__go({
          org_audit_query: "失败",
          org_audit_action: "synthetic.history-filter",
          keep: "retained",
        }),
      );
      await page.waitForFunction(() => location.search.includes("synthetic.history-filter"));
      check("history:source-still-empty-query", await search.inputValue(), "");
      check("history:source-still-empty-action", await action.inputValue(), "");
      check("history:no-read", requests.length, beforeHistory);
      findings.push({
        width,
        id: "P37-HISTORY-01",
        urlQuery: "失败",
        visibleQuery: "",
        urlAction: "synthetic.history-filter",
        visibleAction: "",
        requestsAdded: requests.length - beforeHistory,
      });
      await shot("history-url-fields-mismatch", ".org-audit-filters");
      await page.evaluate(() => window.__away());
      await page.getByText("隔离离页占位", { exact: true }).waitFor();
      await page.evaluate(() => window.__go({ org_audit_query: "成功" }));
      await panel.waitFor();
      check("cached-return:stale-search", await search.inputValue(), "");
      findings.push({ width, id: "P37-HISTORY-02", urlQuery: "成功", visibleQuery: "" });
      await visit();
      await waitState("ready");
      mode.hold = true;
      await page.getByRole("button", { name: "加载更多记录", exact: true }).click();
      await eventually(() => held.length === 1);
      check("more:cursor", requests.at(-1).query.cursor, data.events[49].id);
      mode.hold = false;
      mode.fresh = true;
      await page.getByRole("button", { name: "刷新数据", exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll(".org-audit-row").length === 10);
      await release();
      await page.waitForFunction(() => document.querySelectorAll(".org-audit-row").length === 15);
      findings.push({
        width,
        id: "P37-LATE-PAGE",
        freshRows: 10,
        observedRows: 15,
        oldAppendRows: 5,
      });
      await shot("late-page-appended", ".org-audit-ledger");
      await visit();
      await waitState("ready");
      await page.locator(".org-audit-correlation button").first().click();
      await rows.nth(1).click();
      await page.evaluate(() => window.__resolveCopy());
      await page.waitForFunction(() =>
        document.querySelector(".org-audit-correlation button")?.textContent.includes("已复制"),
      );
      check("copy:old-value", await page.evaluate(() => window.__copies), [
        data.events[0].request_id,
      ]);
      check(
        "copy:new-record-displays",
        await page.locator(".org-audit-correlation code").first().textContent(),
        data.events[1].request_id,
      );
      findings.push({
        width,
        id: "P37-LATE-COPY",
        copiedValue: data.events[0].request_id,
        displayedValue: data.events[1].request_id,
        feedback: "已复制",
      });
      await shot("late-copy-wrong-record", ".org-audit-detail");
      check(
        "requests:read-only-audit",
        requests.every((r) => r.method === "GET" && r.path === endpoint),
      );
      check(
        "requests:correlation",
        requests.every((r) => r.requestId && r.traceId),
      );
      check("no-forbidden-network", forbidden, []);
      check("no-page-errors", errors, []);
      check("no-cookies", await context.cookies(), []);
      check(
        "no-storage",
        await page.evaluate(() => localStorage.length + sessionStorage.length),
        0,
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
      (id) => id.replaceAll("\\", "/").includes("/apps/web/src/") && /\.(vue|ts|css)$/.test(id),
    );
} finally {
  await browser?.close();
  await server.close();
}
if (!smoke) {
  const files = [
    ...new Set([
      ...loadedFiles.map((f) => path.relative(process.cwd(), f).replaceAll("\\", "/")),
      "scripts/verify-ui-phase2-org-audit-parent-read.mjs",
      "scripts/lib/ui-phase2-org-audit-design-data.mjs",
      "tests/e2e/m06-01-organization-admin.spec.ts",
      "apps/web/vite.config.ts",
    ]),
  ].sort();
  const sourceHashes = Object.fromEntries(
    await Promise.all(
      files.map(async (f) => [
        f,
        digest(historicalAuditSource(f, (await readFile(f, "utf8")).replaceAll("\r\n", "\n"))),
      ]),
    ),
  );
  const result = {
    kind: "P37-PARENT-READ-VUE",
    scope:
      "Actual parent/child/API client in isolated Router/KeepAlive host; synthetic GET fixtures only. Not real backend/RBAC/shell/production or C design acceptance. Four unfixed problem classes characterized, not passing acceptance.",
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
    const prior = JSON.parse(await readFile(`${output}/evidence.json`, "utf8"));
    assert.deepEqual(sourceHashes, prior.sourceHashes);
    assert.deepEqual(checks, prior.checks);
    assert.deepEqual(findings, prior.findings);
    assert.deepEqual(requestEvidence, prior.requestEvidence);
    for (const s of prior.screenshots)
      assert.equal(digest(await readFile(`${output}/${s.file}`)), s.sha256);
    assert.equal(await readFile(`${output}/index.html`, "utf8"), gallery(prior));
  }
}
console.log(
  JSON.stringify({
    mode: smoke ? "smoke" : capture ? "capture" : "verify",
    checks: checks.length,
    screenshots: screenshots.length,
    findings,
    acceptanceComplete: false,
    browserAndServerClosed: true,
  }),
);
async function eventually(predicate) {
  const end = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > end) throw Error("predicate timeout");
    await new Promise((r) => setTimeout(r, 25));
  }
}
function gallery(e) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P37 实际Vue核对</title>
<style>body{font:16px/1.6 'Microsoft YaHei';margin:24px;background:#f5f6f8;color:#202c3d}figure{padding:16px;background:white;margin:24px 0}img{max-width:100%;height:auto}</style><h1>P37 实际父子组件 · 问题核对</h1><p>旧UI实际运行样例，不是新C稿；四类问题尚未修复，整页验收不通过。截图不含地址栏，URL与字段差异见证据。</p><a href="evidence.json">完整证据</a>
${e.screenshots.map((s) => `<figure><figcaption>${s.name} · ${s.width}px</figcaption><img loading="lazy" src="${s.file}" alt="${s.name}"></figure>`).join("\n")}</html>`;
}
