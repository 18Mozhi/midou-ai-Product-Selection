import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import { buildOrgApprovalsDesignData } from "./lib/ui-phase2-org-approvals-design-data.mjs";

const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(
  process.argv.slice(2).every((a) => ["--capture", "--smoke"].includes(a)) && !(capture && smoke),
);
const output = "output/playwright/p34-query-restoration",
  entry = "/__p34_query_host.js";
const data = await buildOrgApprovalsDesignData(process.cwd());
// Existing two-template fixture plus six explicit synthetic rows for the second template page.
data.templates.push(
  ...Array.from({ length: 6 }, (_, i) => ({
    ...data.templates[i % 2],
    id: `p34-query-template-${i}`,
    name: `历史恢复模板${i}`,
    current_version: i + 4,
  })),
);
const keys =
  "section requestQuery requestStatus requestWorkspace requestResource requestSort requestPage templateQuery templateStatus templateWorkspace templateResource templateSort templatePage".split(
    " ",
  );
const host = `import {createApp,h,ref,nextTick} from 'vue';
import {createRouter,createWebHistory} from 'vue-router';
import Panel from '/src/components/OrganizationApprovalPanel.vue';
import '/src/styles.css';import '/src/organization-admin.css';import '/src/design/tokens.css';
import '/src/accessibility.css';import '/src/responsive-baselines.css';import '/src/signal-ledger.css';
document.documentElement.dataset.design='signal-ledger';
const data=${JSON.stringify(data)};
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const Host={setup(){const child=ref(),shown=ref(true);const flush=async()=>{await nextTick();await nextTick();};
window.p34QueryHost={navigate:async query=>{await router.push({path:'/org-admin/approvals',query});await flush();},
other:async()=>{await router.push('/org-admin/members?member_query=kept');await flush();},
state:()=>Object.fromEntries(${JSON.stringify(keys)}.map(k=>[k,child.value.$.setupState[k]])),
identity:()=>child.value.$.uid,destroy:async()=>{shown.value=false;await flush();}};
return()=>h('main',{class:'org-admin-center'},shown.value?h(Panel,{ref:child,templates:data.templates,approvals:data.items,summary:data.summary,statusText:v=>v,summaryText:v=>v,formatTime:v=>v}):h('p','已卸载'));}};
const app=createApp(Host).use(router);await router.isReady();app.mount('#host');`;
const files = [
  "apps/web/src/components/OrganizationApprovalPanel.vue",
  "apps/web/src/styles.css",
  "apps/web/src/organization-admin.css",
  "apps/web/src/design/tokens.css",
  "apps/web/src/design/roles-tokens.css",
  "apps/web/src/accessibility.css",
  "apps/web/src/responsive-baselines.css",
  "apps/web/src/signal-ledger.css",
  "scripts/verify-ui-phase2-org-approvals-query.mjs",
  "scripts/lib/ui-phase2-org-approvals-design-data.mjs",
  "tests/e2e/m06-01-organization-admin.spec.ts",
];
const hash = (v) => createHash("sha256").update(v).digest("hex");
const sourceHashes = Object.fromEntries(
  await Promise.all(
    files.map(async (f) => [f, hash((await readFile(f, "utf8")).replaceAll("\r\n", "\n"))]),
  ),
);
let old;
if (!capture && !smoke) {
  old = JSON.parse(await readFile(`${output}/evidence.json`, "utf8"));
  assert.deepEqual(old.sourceHashes, sourceHashes);
  for (const s of old.screenshots)
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
}
if (capture) await mkdir(output, { recursive: true });
const probe = reservePort();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  server: { host: "127.0.0.1", port, strictPort: true, open: false },
  plugins: [
    {
      name: "p34-query-isolated-host",
      resolveId: (id) => (id === entry ? id : undefined),
      load: (id) => (id === entry ? host : undefined),
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/org-admin/approvals") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P34 真实Vue查询恢复验证</title><div id="app"><div id="host" class="theme-main"></div></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
let browser;
const checks = [],
  screenshots = [];
try {
  await server.listen();
  console.log(`p34_query_host_started http://127.0.0.1:${port}`);
  browser = await chromium.launch({ headless: true });
  for (const width of smoke ? [390] : [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (route) => {
        const u = new URL(route.request().url());
        if (u.origin === `http://127.0.0.1:${port}` && !u.pathname.startsWith("/api/"))
          return route.continue();
        requests.push(u.pathname);
        return route.abort();
      });
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ width, name });
      };
      const state = () => page.evaluate(() => window.p34QueryHost.state());
      const waitState = (values) =>
        page.waitForFunction(
          (v) => Object.entries(v).every(([k, value]) => window.p34QueryHost?.state()[k] === value),
          values,
        );
      const shot = async (scene) => {
        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth > innerWidth + 1
            ? Array.from(document.querySelectorAll("body *"))
                .filter((n) => n.getBoundingClientRect().right > innerWidth + 1)
                .slice(0, 8)
                .map((n) => ({
                  tag: n.tagName,
                  class: n.className,
                  width: n.getBoundingClientRect().width,
                  right: n.getBoundingClientRect().right,
                }))
            : [],
        );
        if (overflow.length) console.log(JSON.stringify({ scene, width, overflow }));
        check(
          `${scene}: no horizontal overflow`,
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (!capture) return;
        const file = `${scene}-${width}.png`,
          bytes = await page.locator(".org-approval-governance").screenshot();
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          scene,
          width,
          pageId: "P34",
          scope: "mounted-original-Vue-child-isolated-data-not-C-approval-or-production",
          sha256: hash(bytes),
        });
      };
      await page.goto(
        `http://127.0.0.1:${port}/org-admin/approvals?keep=external&approval_request_page=2`,
      );
      await waitState({ requestPage: 2 });
      const identity = await page.evaluate(() => window.p34QueryHost.identity());
      check("initial URL page two", (await state()).requestPage, 2);
      await shot("initial-requests");
      const target = {
        keep: "external",
        approval_view: "templates",
        approval_template_page: "2",
        approval_template_sort: "updated_desc",
        approval_request_page: "2",
        approval_request_status: "all",
      };
      await page.evaluate((q) => window.p34QueryHost.navigate(q), target);
      await waitState({ section: "templates", templatePage: 2 });
      check(
        "same component instance",
        await page.evaluate(() => window.p34QueryHost.identity()),
        identity,
      );
      check("template sort restored", (await state()).templateSort, "updated_desc");
      check("inactive request page retained", (await state()).requestPage, 2);
      await shot("templates-restored");
      await page.goBack();
      await waitState({ section: "requests", requestPage: 2, templatePage: 1 });
      check(
        "back restores requests without remount",
        await page.evaluate(() => window.p34QueryHost.identity()),
        identity,
      );
      await shot("back-requests");
      await page.goForward();
      await waitState({ section: "templates", templatePage: 2 });
      check(
        "forward restores templates without remount",
        await page.evaluate(() => window.p34QueryHost.identity()),
        identity,
      );
      await shot("forward-templates");
      await page.getByLabel("搜索模板").fill("不存在的模板");
      await page.waitForFunction(
        () => new URL(location.href).searchParams.get("approval_template_query") === "不存在的模板",
      );
      check(
        "local filter resets only template page",
        [(await state()).templatePage, (await state()).requestPage],
        [1, 2],
      );
      check("unrelated query retained", new URL(page.url()).searchParams.get("keep"), "external");
      await page.reload();
      await waitState({ section: "templates", templateQuery: "不存在的模板" });
      check("reload still restores existing query", (await state()).templateQuery, "不存在的模板");
      await page.evaluate(() => window.p34QueryHost.other());
      check("different route not hydrated", (await state()).section, "templates");
      check(
        "different route query untouched",
        new URL(page.url()).searchParams.has("approval_view"),
        false,
      );
      await page.evaluate(() =>
        window.p34QueryHost.navigate({
          approval_request_query: "审批",
          approval_request_page: "2",
        }),
      );
      await waitState({ section: "requests", requestPage: 2 });
      check("query plus page restored together", (await state()).requestQuery, "审批");
      await page.evaluate(() => window.p34QueryHost.destroy());
      check("unmounted child removed", await page.locator(".org-approval-governance").count(), 0);
      check("zero API/external requests", requests, []);
      check("zero browser errors", errors, []);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
if (capture)
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        kind: "P34-QUERY-RESTORATION",
        boundary:
          "Mounted unchanged-template Vue child with real Vue Router and browser back/forward; fixture data, no parent/API/SQL/permissions/production or C visual approval proof.",
        sourceHashes,
        checks,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
else if (!smoke) assert.deepEqual(checks, old.checks);
console.log(
  JSON.stringify({
    checks: checks.length,
    screenshots: screenshots.length,
    browserAndServerClosed: true,
  }),
);
