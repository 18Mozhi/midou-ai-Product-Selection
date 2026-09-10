import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";
import { auditPagePreview } from "./lib/ui-phase2-audit-page-preview.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p37-page-vue-preview",
  component = "apps/web/src/components/OrganizationAuditPanel.vue",
  fixtureFile = "tests/e2e/m06-01-organization-admin.spec.ts",
  css = "design-plans/ui-phase-2-2026-09-07/implementation/audit-page-preview.css";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex");
const original = await read(component),
  transformed = auditPagePreview(original);
const ast = ts.createSourceFile(fixtureFile, await read(fixtureFile), ts.ScriptTarget.Latest, true);
const expression = (name) => {
  const found = [];
  const walk = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found.push(node);
    ts.forEachChild(node, walk);
  };
  walk(ast);
  assert.equal(found.length, 1, name);
  return found[0].initializer.getText(ast);
};
const fixtureContext = {};
for (const key of ["org", "ws", "memberAdmin"])
  fixtureContext[key] = vm.runInNewContext(expression(key));
const events = JSON.parse(
  JSON.stringify(vm.runInNewContext(expression("organizationAuditEvents"), fixtureContext)),
);
const connections = JSON.parse(
  JSON.stringify(
    vm.runInNewContext(expression("realtimeEvents"), { organizationAuditEvents: events }),
  ),
);
assert.equal(events.length, 55);
assert.equal(connections.length, 40);
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((match) => "apps/web/src/" + match[1]);
const entry = "/__p37_page_preview.js",
  host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import Parent from '/src/components/OrganizationAdminCenter.vue';
${cssFiles.map((file) => `import '/src/${file.slice("apps/web/src/".length)}';`).join("\n")}
import '/@fs/${path.resolve(css).replaceAll("\\", "/")}';document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p37-page-preview');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});const app=createApp({render:()=>h(Parent,{apiBaseUrl:location.origin+'/api/v1',routePath:'/org-admin/audit',organizationId:'${fixtureContext.org}'})}).use(router);await router.isReady();app.mount('#host');`;
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
      name: "p37-review-only",
      enforce: "pre",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      transform(source, id) {
        if (id.replaceAll("\\", "/") === path.resolve(component).replaceAll("\\", "/")) {
          assert.equal(source.replaceAll("\r\n", "\n"), original);
          return transformed;
        }
      },
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          const pathname = req.url?.split("?")[0];
          if (pathname?.startsWith("/api/")) {
            res.statusCode = 418;
            return res.end("unmocked API forbidden");
          }
          if (pathname !== "/org-admin/audit") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P37 组织审计C审核</title><div id="app"><div id="host" class="theme-main"></div></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const checks = [],
  runs = [],
  screenshots = [],
  sourceFiles = new Set([
    component,
    fixtureFile,
    css,
    ...cssFiles,
    "apps/web/src/main.ts",
    "apps/web/vite.config.ts",
    "scripts/lib/ui-phase2-audit-page-preview.mjs",
    "scripts/verify-ui-phase2-audit-page-preview.mjs",
  ]);
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`p37_page_host ${origin}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    let release = () => {};
    try {
      const page = await context.newPage(),
        requests = [],
        errors = [],
        forbidden = [];
      let mode = "primary",
        status = 200,
        hold = true,
        gate = new Promise((done) => (release = done));
      await page.clock.install({ time: new Date("2026-08-27T12:00:00.000Z") });
      await context.addInitScript(() => {
        window.__copies = [];
        window.__copyFail = false;
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: async (value) => {
              window.__copies.push(value);
              if (window.__copyFail) throw Error("synthetic clipboard refusal");
            },
          },
        });
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== origin) {
          forbidden.push(req.url());
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        requests.push({
          method: req.method(),
          path: url.pathname,
          query: Object.fromEntries(url.searchParams),
        });
        if (
          req.method() !== "GET" ||
          url.pathname !== `/api/v1/organizations/${fixtureContext.org}/audit-events`
        ) {
          forbidden.push(`${req.method()} ${url.pathname}`);
          return route.abort();
        }
        if (hold) await gate;
        if (status !== 200)
          return route.fulfill({
            status,
            json: {
              error: {
                code: "fixture_audit_failure",
                message: "隔离测试：暂时无法读取审计记录。",
                action_hint: "请核对访问条件后重新加载。",
              },
              request_id: "p37-fixture-error",
              trace_id: "p37-fixture-error",
            },
          });
        const data =
            mode === "empty"
              ? []
              : mode === "system"
                ? [...connections, ...events.slice(0, 10)]
                : events,
          q = url.searchParams;
        const filtered = data.filter((event) =>
          ["action", "outcome", "resource_type", "request_id", "trace_id"].every(
            (key) => !q.get(key) || event[key] === q.get(key),
          ),
        );
        const start = q.get("cursor")
            ? filtered.findIndex((event) => event.id === q.get("cursor")) + 1
            : 0,
          limit = Number(q.get("limit") ?? 50),
          items = filtered.slice(start, start + limit),
          nextCursor = start + limit < filtered.length ? items.at(-1).id : null;
        return route.fulfill({
          json: {
            data: { items, nextCursor },
            request_id: "p37-fixture-read",
            trace_id: "p37-fixture-read",
          },
        });
      });
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}:${name}`);
        checks.push({ width, name });
      };
      const panel = page.locator(".org-audit-panel"),
        rows = page.locator(".org-audit-row"),
        form = page.locator(".org-audit-filters"),
        detail = page.locator(".org-audit-detail[aria-label]"),
        query = page.getByLabel("页内搜索", { exact: true });
      const count = (number) =>
        page.waitForFunction(
          (value) => document.querySelectorAll(".org-audit-row").length === value,
          number,
        );
      const shot = async (state, fullPage = true) => {
        check(
          state + ":no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (fullPage) await page.evaluate(() => scrollTo(0, 0));
        if (!capture) return;
        const bytes = await page.screenshot({ fullPage, animations: "disabled" }),
          file = `${width}-${state}.png`;
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({ file, width, state, fullPage, sha256: hash(bytes) });
      };
      await page.goto(origin + "/org-admin/audit");
      await page.locator(".org-admin-state").waitFor();
      await shot("loading");
      hold = false;
      release();
      await panel.waitFor();
      await count(50);
      check("no unrelated organization summary request", requests.length, 1);
      check("first exact limit", requests[0].query, { limit: "50" });
      check(
        "first metadata redacted",
        (await detail.locator("pre").textContent()).includes("[已脱敏]"),
      );
      check(
        "raw probe absent from rendered page",
        (await panel.textContent()).includes("synthetic-redaction-probe"),
        false,
      );
      check(
        "blue query region",
        await form.evaluate((node) => getComputedStyle(node).backgroundColor),
        "rgb(37, 74, 156)",
      );
      check("all eight native inputs present", await form.locator("input,select").count(), 8);
      check("no visible business dialog", await page.getByRole("dialog").count(), 0);
      for (const selector of [
        ".org-audit-overview",
        ".org-audit-filters",
        ".org-audit-metrics",
        ".org-audit-list",
        ".org-audit-detail",
      ]) {
        const target = page.locator(selector);
        await target.scrollIntoViewIfNeeded();
        check(
          selector + ":unobscured",
          await target.evaluate((node) => {
            const b = node.getBoundingClientRect(),
              top = Math.max(0, b.top),
              bottom = Math.min(innerHeight, b.bottom);
            return (
              bottom > top &&
              [0.15, 0.5, 0.85].every((r) =>
                node.contains(
                  document.elementFromPoint(b.left + b.width / 2, top + (bottom - top) * r),
                ),
              )
            );
          }),
        );
      }
      await shot("default");
      await shot("default-viewport", false);
      await rows.nth(1).click();
      check("failed detail selected", await detail.locator("header em").textContent(), "失败");
      await shot("selected-failed");
      await rows.nth(2).click();
      check("blocked detail selected", await detail.locator("header em").textContent(), "已阻止");
      await shot("selected-blocked");
      await rows.first().click();
      await detail.locator("summary").click();
      check(
        "technical ID exact",
        (await detail.locator(".org-admin-technical").textContent()).includes(events[0].id),
      );
      await shot("technical-open");
      await detail.getByRole("button", { name: "复制请求 ID", exact: true }).click();
      check(
        "request copy exact",
        await page.evaluate(() => window.__copies.at(-1)),
        events[0].request_id,
      );
      await shot("request-copied");
      await page.evaluate(() => (window.__copyFail = true));
      await detail.getByRole("button", { name: "复制追踪 ID", exact: true }).click();
      check(
        "trace copy exact",
        await page.evaluate(() => window.__copies.at(-1)),
        events[0].trace_id,
      );
      check(
        "trace failure shown",
        await detail.getByRole("button", { name: "复制失败", exact: true }).count(),
        1,
      );
      await shot("trace-copy-failed");
      hold = true;
      gate = new Promise((done) => (release = done));
      await page.getByRole("button", { name: "加载更多记录", exact: true }).click();
      await page.waitForFunction(
        () => document.querySelector(".org-audit-load-more")?.disabled === true,
      );
      check(
        "pending disables query buttons",
        await form.locator("button").evaluateAll((nodes) => nodes.every((node) => node.disabled)),
      );
      await shot("more-pending");
      hold = false;
      release();
      await count(55);
      check("cursor exact fixture marker", requests.at(-1).query.cursor, events[49].id);
      check("end hides more", await page.locator(".org-audit-load-more").count(), 0);
      await shot("cursor-end");
      await query.fill("fixture-no-match");
      await count(0);
      check("local search has no GET", requests.length, 2);
      await shot("no-local-results");
      await query.fill("");
      await count(55);
      await form.locator(".org-audit-advanced summary").click();
      await page.getByLabel("开始时间", { exact: true }).fill("2026-08-28T12:00");
      await page.getByLabel("结束时间", { exact: true }).fill("2026-08-27T12:00");
      await page.getByRole("button", { name: "应用筛选", exact: true }).click();
      await page.locator(".org-audit-validation").waitFor();
      check("invalid dates no GET", requests.length, 2);
      await shot("date-invalid");
      await page.getByLabel("开始时间", { exact: true }).fill("2026-08-27T00:00");
      await page.getByLabel("结束时间", { exact: true }).fill("2026-08-28T00:00");
      await page
        .getByLabel("操作代码（精确）", { exact: true })
        .fill("  organization.member.invited  ");
      await form.locator("select").selectOption("succeeded");
      await page.getByLabel("对象类型（精确）", { exact: true }).fill("membership");
      await page.getByLabel("请求 ID（精确）", { exact: true }).fill(events[0].request_id);
      await page.getByLabel("追踪 ID（精确）", { exact: true }).fill(events[0].trace_id);
      await page.getByRole("button", { name: "应用筛选", exact: true }).click();
      await count(1);
      check("exact seven filter query", requests.at(-1).query, {
        limit: "50",
        action: "organization.member.invited",
        outcome: "succeeded",
        resource_type: "membership",
        request_id: events[0].request_id,
        trace_id: events[0].trace_id,
        occurred_from: "2026-08-26T16:00:00.000Z",
        occurred_to: "2026-08-27T16:00:00.000Z",
      });
      await shot("server-filtered");
      await page.getByRole("button", { name: "重置筛选", exact: true }).click();
      await count(50);
      check("reset removes exact query", requests.at(-1).query, { limit: "50" });
      mode = "system";
      await page.reload();
      await count(10);
      const system = page.locator(".org-audit-system-events");
      check("system count40", (await system.textContent()).includes("40"));
      await shot("system-collapsed");
      await system.click();
      await count(50);
      check("system expanded", await system.getAttribute("aria-expanded"), "true");
      await shot("system-expanded");
      await system.click();
      await count(10);
      await query.fill("实时连接");
      await count(40);
      check("system search no GET", requests.length, 5);
      await shot("system-search");
      await query.fill("");
      mode = "empty";
      await page.reload();
      await panel.waitFor();
      await count(0);
      check("empty has no detail", await detail.count(), 0);
      await shot("empty");
      for (const code of [403, 500]) {
        status = code;
        await page.reload();
        await page.locator(".org-admin-state h3").waitFor();
        check(code + ":content hidden", await panel.count(), 0);
        await shot("first-" + code);
      }
      check(
        "all requests GET audit only",
        requests.every(
          (req) =>
            req.method === "GET" &&
            req.path === `/api/v1/organizations/${fixtureContext.org}/audit-events`,
        ),
      );
      check("no external or writes", forbidden, []);
      check("zero browser errors", errors, []);
      check(
        "zero storage",
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      runs.push({ width, requests });
      console.log(`passed ${width}`);
    } finally {
      release();
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
  kind: "P37-PAGE-VUE-PREVIEW-r1",
  approval: "pending-user-review",
  scope:
    "Actual parent/child scripts and original directives with review-only layout/CSS and field-specific initial copy labels.55-row original fixture and separate40-connection+10-business fixture,never concatenated. GET-only and synthetic clipboard; fixture cursor IDs are not production cursor encoding. Exact seven request fields checked; fixture handler does not implement server date semantics. Not full App/navigation,real authorization/SQL/metadata end-to-end/OS clipboard/production approval; original listitem button semantics and full keyboard accessibility remain to audit.",
  sourceHashes,
  transformedHashes: { [component]: hash(transformed) },
  checks,
  runs,
  screenshots,
  processesClosed: true,
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P37 整页C审核</title><style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;margin:24px;background:#edf1f6}article{padding:20px;background:white;margin:24px 0}img{max-width:100%}</style><h1>P37 组织审计 · 实际Vue C审核稿</h1><p>隔离请求和模拟剪贴板，非真实审计/权限验收。页面完整图不含全局导航；列表保留局部滚动，不把所有已加载记录平铺在图中。</p>${screenshots.map((shot) => `<article><h2>${shot.file}</h2><img src="${shot.file}" alt="${shot.state}" loading="lazy"></article>`).join("\n")}</html>`,
  );
}
console.log(
  JSON.stringify({
    checks: checks.length,
    images: screenshots.length,
    sources: sourceFiles.size,
    processesClosed: true,
  }),
);
