import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import ts from "typescript";
import { buildOrgDataDesignData } from "./lib/ui-phase2-org-data-design-data.mjs";

const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(
  process.argv.slice(2).every((a) => ["--capture", "--smoke"].includes(a)) && !(capture && smoke),
);
const output = "output/playwright/p35-parent-read-states";
const fixtureFile = "tests/e2e/m06-01-organization-admin.spec.ts";
const ast = ts.createSourceFile(
  fixtureFile,
  await readFile(fixtureFile, "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const declarations = ast.statements.filter(
  (n) => ts.isVariableStatement(n) || (ts.isFunctionDeclaration(n) && n.name?.text === "setup"),
);
const { setup, env, summary } = new Function(
  ts.transpileModule(declarations.map((n) => n.getText(ast)).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText + "\nreturn {setup,env,summary};",
)();
const data = await buildOrgDataDesignData(process.cwd());
const failures = [
  { id: "server-error", status: 500, state: "error", attempts: 1 },
  { id: "service-blocked", status: 503, state: "blocked", attempts: 3 },
  { id: "version-conflict", status: 409, state: "conflict", attempts: 1 },
  { id: "rate-limited", status: 429, state: "rate_limited", attempts: 3 },
  { id: "session-expired", status: 401, state: "expired", attempts: 1 },
  { id: "permission-forbidden", status: 403, state: "forbidden", attempts: 1 },
  { id: "network-unavailable", status: 0, state: "blocked", attempts: 3 },
];
const sources = [
  "apps/web/vite.config.ts",
  ...[
    ...(await readFile("apps/web/src/main.ts", "utf8")).matchAll(/import "\.\/([^"]+\.css)";/g),
  ].map((m) => `apps/web/src/${m[1]}`),
  fixtureFile,
  "scripts/verify-ui-phase2-org-data-parent.mjs",
  "scripts/lib/ui-phase2-org-data-design-data.mjs",
  ...[
    "App.vue",
    "main.ts",
    "router.ts",
    "api-client.ts",
    "config.ts",
    "design/theme.ts",
    "navigation-shell-permissions.ts",
    "navigation-shell-route-state.ts",
    "navigation-memory.ts",
    "use-navigation-discovery.ts",
    "use-navigation-shell-theme.ts",
    "member-workspace-polish.css",
    "navigation-shell-scoped.css",
    "signal-ledger-workflows.css",
    "components/NavigationShell.vue",
    "components/OrganizationAdminCenter.vue",
    "components/OrganizationDataPanel.vue",
    "org-data-export-detail.css",
    "components/OrganizationApprovalFirstFailure.vue",
    "approval-read-failure.css",
    "design/approval-read-failure-tokens.css",
    "organization-admin.css",
    "styles.css",
    "design/tokens.css",
    "design/approval-filter-tokens.css",
    "signal-ledger.css",
    "responsive-baselines.css",
    "accessibility.css",
  ].map((f) => `apps/web/src/${f}`),
];
const hash = (v) => createHash("sha256").update(v).digest("hex");
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (f) => [f, hash((await readFile(f, "utf8")).replaceAll("\r\n", "\n"))]),
  ),
);
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(`${output}/evidence.json`, "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots)
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
});
let browser;
const checks = [],
  scenarios = [],
  screenshots = [];
try {
  await server.listen();
  const base = `http://127.0.0.1:${port}`;
  console.log(`p35_parent_started ${base}`);
  browser = await chromium.launch({ headless: true });
  for (const { width, view } of (smoke ? [390] : [1440, 390]).flatMap((width) =>
    ["workspaces", "exports"].map((view) => ({ width, view })),
  )) {
    const searchName = view === "workspaces" ? "搜索工作区" : "搜索导出";
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    const releases = [];
    try {
      const page = await context.newPage(),
        errors = [],
        unexpected = [],
        reads = [],
        writes = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (new URL(r.url()).pathname.startsWith("/api/") && !["GET", "HEAD"].includes(r.method()))
          writes.push({ path: new URL(r.url()).pathname, method: r.method() });
      });
      await page.clock.setFixedTime(new Date("2026-08-26T10:00:00.000Z"));
      await page.route("**/*", (route) => {
        const u = new URL(route.request().url());
        if (u.origin === base && !u.pathname.startsWith("/api/")) return route.continue();
        if (u.pathname === "/api/v1/me/ui-preferences")
          return route.fulfill({ json: env({ theme: "deep-ocean", version: 1 }) });
        unexpected.push(u.pathname);
        return route.abort();
      });
      await setup(page);
      let plan = { mode: "normal", marker: "original" };
      const wire = async (route) => {
        const endpoint = new URL(route.request().url()).pathname.split("/").at(-1),
          active = plan;
        const record = {
          endpoint,
          requestId: route.request().headers()["x-request-id"],
          traceId: route.request().headers()["x-trace-id"],
        };
        reads.push(record);
        if (active.gate) await active.gate;
        if (active.failure && active.target === endpoint) {
          if (active.failure.status === 0) return route.abort("internetdisconnected");
          return route.fulfill({
            status: active.failure.status,
            json: {
              error: {
                code: `p35_fixture_${active.failure.id}`,
                message: `隔离${active.failure.id}读取失败`,
                action_hint: "检查服务或权限后重新加载。",
              },
              request_id: `p35-${active.failure.id}-${endpoint}`,
              trace_id: "p35-isolated-trace",
            },
          });
        }
        const payload =
          endpoint === "summary"
            ? structuredClone(summary)
            : {
                comparisons: structuredClone(data.comparisons),
                exports: structuredClone(data.exports),
                observed_at: data.observed_at,
              };
        if (active.marker === "updated") {
          if (endpoint === "summary") payload.observed_at = "2026-08-27T10:00:00.000Z";
          else {
            payload.comparisons[0].name = "新品决策更新后工作区";
            for (const item of payload.exports)
              if (item.workspace_name === "新品决策工作区")
                item.workspace_name = "新品决策更新后工作区";
            payload.observed_at = "2026-08-27T10:00:00.000Z";
          }
        }
        return route.fulfill({ json: env(payload) });
      };
      await page.route("**/api/v1/org/admin/summary", wire);
      await page.route("**/api/v1/org/admin/data", wire);
      const center = page.locator(".org-admin-center"),
        child = page.locator(".org-data-panel");
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ width, view, name });
      };
      const ready = async () => {
        await page.waitForFunction(
          () =>
            document.querySelector(".org-admin-center")?.dataset.state === "ready" &&
            document.querySelector(".org-admin-center")?.getAttribute("aria-busy") === "false",
        );
      };
      const waitState = (state) =>
        page.waitForFunction(
          (s) =>
            document.querySelector(".org-admin-center")?.dataset.state === s &&
            document.querySelector(".org-admin-center")?.getAttribute("aria-busy") === "false",
          state,
        );
      const visit = () =>
        page.goto(
          `${base}/org-admin/data?org_data_view=${view}&org_data_${view === "workspaces" ? "workspace" : "export"}_query=新品决策&keep=external`,
        );
      const hold = () => {
        let release;
        const gate = new Promise((r) => (release = r));
        releases.push(release);
        return { gate, release };
      };
      const shot = async (scene) => {
        check(
          `${scene}: no overflow`,
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (!capture) return;
        // Element screenshots scroll a tall parent beneath the fixed navigation.
        // Capture the real full page from the top so the heading is not occluded by that scroll.
        await page.evaluate(() => window.scrollTo(0, 0));
        const file = `${view}-${scene}-${width}.png`,
          bytes = await page.screenshot({ fullPage: true, animations: "disabled" });
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          scene,
          width,
          view,
          pageId: "P35",
          scope: "actual-app-parent-fixture-HTTP-not-production-or-C-approval",
          sha256: hash(bytes),
        });
      };
      const first = hold();
      plan = { mode: "hold", marker: "original", gate: first.gate };
      await visit();
      await center.waitFor();
      check("initial loading hides child", await child.count(), 0);
      check(
        "initial loading disables refresh",
        await center.getByRole("button", { name: "刷新数据", exact: true }).isDisabled(),
      );
      await shot("initial-loading");
      first.release();
      await ready();
      check(
        "ready shows existing workspace query",
        await child.getByRole("searchbox", { name: searchName, exact: true }).inputValue(),
        "新品决策",
      );
      await shot("ready");
      const priorObserved = await center.locator(".org-admin-refresh small").textContent();
      const priorDataObserved = await child
        .locator('aside[aria-label="数据观测时间"] time')
        .getAttribute("datetime");
      const pending = hold();
      plan = { mode: "hold", marker: "updated", gate: pending.gate };
      await center.getByRole("button", { name: "刷新数据", exact: true }).click();
      check("background refresh retains child", await child.count(), 1);
      check(
        "background refresh disables only refresh",
        await center.getByRole("button", { name: "正在刷新…", exact: true }).isDisabled(),
      );
      check(
        "background filter remains editable",
        await child.getByRole("searchbox", { name: searchName, exact: true }).isEnabled(),
      );
      await child.getByRole("searchbox", { name: searchName, exact: true }).fill("新品决策");
      check(
        "pending refresh still shows old workspace",
        (await child.getByText("新品决策工作区", { exact: true }).count()) > 0,
      );
      await shot("background-refreshing");
      check(
        "pending refresh retains data observed time",
        await child.locator('aside[aria-label="数据观测时间"] time').getAttribute("datetime"),
        priorDataObserved,
      );
      pending.release();
      await ready();
      check(
        "successful refresh commits fresh workspace",
        (await child.getByText("新品决策更新后工作区", { exact: true }).count()) > 0,
      );
      check(
        "successful refresh keeps filter",
        await child.getByRole("searchbox", { name: searchName, exact: true }).inputValue(),
        "新品决策",
      );
      check(
        "successful refresh advances observed time",
        (await center.locator(".org-admin-refresh small").textContent()) !== priorObserved,
      );
      check(
        "successful refresh advances data observed time",
        await child.locator('aside[aria-label="数据观测时间"] time').getAttribute("datetime"),
        "2026-08-27T10:00:00.000Z",
      );
      await shot("refresh-success");
      for (const failure of smoke
        ? failures.filter((f) => [500, 403, 0].includes(f.status))
        : failures) {
        for (const target of ["summary", "data"]) {
          for (const phase of ["initial", "background"]) {
            plan = { mode: "normal", marker: "original" };
            let oldChildHTML = "",
              oldObserved = "",
              oldDataObserved = "";
            if (phase === "background") {
              await visit();
              await ready();
              oldChildHTML = await child.innerHTML();
              oldObserved = await center.locator(".org-admin-refresh small").textContent();
              oldDataObserved = await child
                .locator('aside[aria-label="数据观测时间"] time')
                .getAttribute("datetime");
            }
            const start = reads.length;
            plan = { mode: "failure", marker: "updated", failure, target };
            if (phase === "initial") await visit();
            else await center.getByRole("button", { name: "刷新数据", exact: true }).click();
            const replace = phase === "initial" || [401, 403].includes(failure.status),
              state = replace ? failure.state : "ready";
            await waitState(state);
            await center.locator(".org-admin-notice").waitFor();
            const name = `${phase}-${target}-${failure.id}`;
            check(`${name}: child visibility`, await child.count(), replace ? 0 : 1);
            check(
              `${name}: error notice is alert`,
              await center.locator(".org-admin-notice").getAttribute("role"),
              "alert",
            );
            check(`${name}: read completed`, await center.getAttribute("aria-busy"), "false");
            const failedReads = reads.slice(start).filter((r) => r.endpoint === target),
              otherReads = reads.slice(start).filter((r) => r.endpoint !== target);
            check(`${name}: bounded existing retry count`, failedReads.length, failure.attempts);
            check(`${name}: successful sibling reads once`, otherReads.length, 1);
            check(
              `${name}: retry correlation retained`,
              new Set(failedReads.map((r) => r.requestId)).size,
              1,
            );
            check(
              `${name}: request trace correlation`,
              failedReads.every((r) => !!r.requestId && r.traceId === r.requestId),
            );
            if (!replace) {
              check(
                `${name}: entire old child retained atomically`,
                await child.innerHTML(),
                oldChildHTML,
              );
              check(
                `${name}: old data timestamp retained atomically`,
                await child
                  .locator('aside[aria-label="数据观测时间"] time')
                  .getAttribute("datetime"),
                oldDataObserved,
              );
              check(
                `${name}: old workspace retained atomically`,
                (await child.getByText("新品决策工作区", { exact: true }).count()) > 0,
              );
              check(
                `${name}: old summary retained atomically`,
                await center.locator(".org-admin-refresh small").textContent(),
                oldObserved,
              );
              check(
                `${name}: workspace filter retained`,
                await child.getByRole("searchbox", { name: searchName, exact: true }).inputValue(),
                "新品决策",
              );
            }
            await shot(name);
            plan = { mode: "normal", marker: "original" };
            const recoveryStart = reads.length;
            await center
              .getByRole("button", { name: replace ? "重新加载" : "刷新数据", exact: true })
              .click();
            await ready();
            check(
              `${name}: recovery reads both endpoints once`,
              reads
                .slice(recoveryStart)
                .map((r) => r.endpoint)
                .sort(),
              ["data", "summary"],
            );
            check(
              `${name}: recovery removes notice`,
              await center.locator(".org-admin-notice").count(),
              0,
            );
            check(
              `${name}: recovery retains URL query`,
              await child.getByRole("searchbox", { name: searchName, exact: true }).inputValue(),
              "新品决策",
            );
            check(
              `${name}: unrelated query survives`,
              new URL(page.url()).searchParams.get("keep"),
              "external",
            );
            scenarios.push({
              width,
              view,
              phase,
              target,
              failure: failure.id,
              state,
              childVisible: !replace,
              attempts: failedReads.length,
              recovery: "passed",
            });
          }
        }
      }
      check("no business writes", writes, []);
      check("no unmatched or external requests", unexpected, []);
      check("no page errors", errors, []);
      check("no business dialogs fabricated", await page.locator("dialog[open]").count(), 0);
    } finally {
      for (const release of releases) release();
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
if (capture) {
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        kind: "P35-PARENT-READ-STATES",
        boundary:
          "Actual application, navigation shell, organization parent and child with intercepted fixture HTTP only. Server authorization/SQL/production,real outage/timeout,scope-switch lifecycle and C visual approval are not proven. 409 is a synthetic client classifier exercise,not a new data read API contract.",
        sourceHashes,
        failures,
        checks,
        scenarios,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>P35 实际父级读取证据</title>
<style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;margin:24px;color:#202c3d;background:#edf1f6}article{background:white;margin:24px 0;padding:20px}img{max-width:100%;height:auto}a{color:#254a9c}</style>
<h1>P35 实际 Vue 父级读取状态</h1><p>原始界面技术证据，不是新的 C 设计稿或批准。隔离响应，不代表真实后端、权限或生产。</p>
${screenshots.map((s) => `<article id="${s.view}-${s.scene}-${s.width}"><h2>${s.view === "exports" ? "导出履历" : "工作区比较"} / ${s.scene} / ${s.width}</h2><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.view} ${s.scene} ${s.width}"></a></article>`).join("")}</html>`,
  );
} else if (!smoke) {
  assert.deepEqual(checks, previous.checks);
  assert.deepEqual(scenarios, previous.scenarios);
}
console.log(
  JSON.stringify({
    checks: checks.length,
    scenarios: scenarios.length,
    screenshots: screenshots.length,
    browserAndServerClosed: true,
  }),
);
