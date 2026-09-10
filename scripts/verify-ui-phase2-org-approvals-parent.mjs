import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import ts from "typescript";
import { buildOrgApprovalsDesignData } from "./lib/ui-phase2-org-approvals-design-data.mjs";

const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(
  process.argv.slice(2).every((a) => ["--capture", "--smoke"].includes(a)) && !(capture && smoke),
);
const output = "output/playwright/p34-parent-read-states";
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
const data = await buildOrgApprovalsDesignData(process.cwd());
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
  fixtureFile,
  "scripts/verify-ui-phase2-org-approvals-parent.mjs",
  "scripts/lib/ui-phase2-org-approvals-design-data.mjs",
  ...[
    "App.vue",
    "main.ts",
    "router.ts",
    "api-client.ts",
    "components/NavigationShell.vue",
    "components/OrganizationAdminCenter.vue",
    "components/OrganizationApprovalPanel.vue",
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
  console.log(`p34_parent_started ${base}`);
  browser = await chromium.launch({ headless: true });
  for (const width of smoke ? [390] : [1440, 390]) {
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
                code: `p34_fixture_${active.failure.id}`,
                message: `隔离${active.failure.id}读取失败`,
                action_hint: "检查服务或权限后重新加载。",
              },
              request_id: `p34-${active.failure.id}-${endpoint}`,
              trace_id: "p34-isolated-trace",
            },
          });
        }
        const payload =
          endpoint === "summary"
            ? structuredClone(summary)
            : {
                summary: structuredClone(data.summary),
                templates: structuredClone(data.templates),
                items: structuredClone(data.items),
              };
        if (active.marker === "updated") {
          if (endpoint === "summary") payload.observed_at = "2026-08-27T10:00:00.000Z";
          else payload.templates[1].name = "采购更新后审批模板";
        }
        return route.fulfill({ json: env(payload) });
      };
      await page.route("**/api/v1/org/admin/summary", wire);
      await page.route("**/api/v1/org/admin/approvals", wire);
      const center = page.locator(".org-admin-center"),
        child = page.locator(".org-approval-governance");
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ width, name });
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
          `${base}/org-admin/approvals?approval_view=templates&approval_template_query=采购&keep=external`,
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
        const file = `${scene}-${width}.png`,
          bytes = await center.screenshot({ animations: "disabled" });
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          scene,
          width,
          pageId: "P34",
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
        "ready shows existing template query",
        await child.getByRole("searchbox", { name: "搜索模板", exact: true }).inputValue(),
        "采购",
      );
      await shot("ready");
      const priorObserved = await center.locator(".org-admin-refresh small").textContent();
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
        await child.getByRole("searchbox", { name: "搜索模板", exact: true }).isEnabled(),
      );
      await child.getByRole("searchbox", { name: "搜索模板", exact: true }).fill("采购");
      check(
        "pending refresh still shows old template",
        await child.getByRole("button", { name: /采购首次审批模板/ }).count(),
        1,
      );
      await shot("background-refreshing");
      pending.release();
      await ready();
      check(
        "successful refresh commits fresh template",
        await child.getByRole("button", { name: /采购更新后审批模板/ }).count(),
        1,
      );
      check(
        "successful refresh keeps filter",
        await child.getByRole("searchbox", { name: "搜索模板", exact: true }).inputValue(),
        "采购",
      );
      check(
        "successful refresh advances observed time",
        (await center.locator(".org-admin-refresh small").textContent()) !== priorObserved,
      );
      await shot("refresh-success");
      for (const failure of smoke
        ? failures.filter((f) => [500, 403, 0].includes(f.status))
        : failures) {
        for (const target of ["summary", "approvals"]) {
          for (const phase of ["initial", "background"]) {
            plan = { mode: "normal", marker: "original" };
            let oldObserved = "";
            if (phase === "background") {
              await visit();
              await ready();
              oldObserved = await center.locator(".org-admin-refresh small").textContent();
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
                `${name}: old template retained atomically`,
                await child.getByRole("button", { name: /采购首次审批模板/ }).count(),
                1,
              );
              check(
                `${name}: old summary retained atomically`,
                await center.locator(".org-admin-refresh small").textContent(),
                oldObserved,
              );
              check(
                `${name}: template filter retained`,
                await child.getByRole("searchbox", { name: "搜索模板", exact: true }).inputValue(),
                "采购",
              );
            }
            await shot(name);
            plan = { mode: "normal", marker: "original" };
            await center
              .getByRole("button", { name: replace ? "重新加载" : "刷新数据", exact: true })
              .click();
            await ready();
            check(
              `${name}: recovery removes notice`,
              await center.locator(".org-admin-notice").count(),
              0,
            );
            check(
              `${name}: recovery retains URL query`,
              await child.getByRole("searchbox", { name: "搜索模板", exact: true }).inputValue(),
              "采购",
            );
            check(
              `${name}: unrelated query survives`,
              new URL(page.url()).searchParams.get("keep"),
              "external",
            );
            scenarios.push({
              width,
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
if (capture)
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        kind: "P34-PARENT-READ-STATES",
        boundary:
          "Actual application, navigation shell, organization parent and child with intercepted fixture HTTP only. Server authorization/SQL/production,real outage/timeout,scope-switch lifecycle and C visual approval are not proven. 409 is a synthetic client classifier exercise,not a new approvals read API contract.",
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
else if (!smoke) {
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
