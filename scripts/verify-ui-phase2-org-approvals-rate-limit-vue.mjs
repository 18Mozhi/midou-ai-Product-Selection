import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import ts from "typescript";

const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(
  process.argv.slice(2).every((a) => ["--capture", "--smoke"].includes(a)) && !(capture && smoke),
);
const output = "output/playwright/p34-rate-limit-vue";
const baselineCommit = "d2d566c2fceeef6ab1754f409475e2cf7582b8ef";
const parentFile = "apps/web/src/components/OrganizationAdminCenter.vue";
const baselineSource = execFileSync("git", ["show", `${baselineCommit}:${parentFile}`], {
  encoding: "utf8",
});
const failureFile = "apps/web/src/components/OrganizationApprovalFirstFailure.vue";
const baselineFailure = execFileSync("git", ["show", `${baselineCommit}:${failureFile}`], {
  encoding: "utf8",
});
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
const { setup, env } = new Function(
  ts.transpileModule(declarations.map((n) => n.getText(ast)).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText + "\nreturn {setup,env};",
)();
const hash = (v) => createHash("sha256").update(v).digest("hex");
const sourceFiles = [
  parentFile,
  fixtureFile,
  "scripts/verify-ui-phase2-org-approvals-rate-limit-vue.mjs",
  ...[
    "components/OrganizationApprovalFirstFailure.vue",
    "components/OrganizationApprovalPanel.vue",
    "components/NavigationShell.vue",
    "App.vue",
    "main.ts",
    "api-client.ts",
    "approval-read-failure.css",
    "design/approval-read-failure-tokens.css",
    "organization-admin.css",
    "styles.css",
    "design/tokens.css",
    "signal-ledger.css",
    "responsive-baselines.css",
    "accessibility.css",
  ].map((f) => `apps/web/src/${f}`),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sourceFiles.map(async (file) => [
      file,
      hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")),
    ]),
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
const checks = [],
  screenshots = [],
  pixelBaseline = new Map();
const browser = await chromium.launch({ headless: true });
try {
  for (const baseline of [true, false]) {
    const baselineTransformed = new Set();
    const probe = reservePort();
    await new Promise((r) => probe.listen(0, "127.0.0.1", r));
    const port = probe.address().port;
    await new Promise((r) => probe.close(r));
    const server = await createServer({
      configFile: path.resolve("apps/web/vite.config.ts"),
      server: { host: "127.0.0.1", port, strictPort: true, open: false },
      plugins: [
        {
          name: "p34-previous-parent-readonly",
          enforce: "pre",
          transform(source, id) {
            if (
              baseline &&
              id.replaceAll("\\", "/") === path.resolve(parentFile).replaceAll("\\", "/")
            ) {
              baselineTransformed.add(parentFile);
              return baselineSource;
            }
            if (
              baseline &&
              id.replaceAll("\\", "/") === path.resolve(failureFile).replaceAll("\\", "/")
            ) {
              baselineTransformed.add(failureFile);
              return baselineFailure;
            }
          },
        },
      ],
    });
    try {
      await server.listen();
      const base = `http://127.0.0.1:${port}`;
      console.log(`p34_rate_limit_${baseline ? "baseline" : "current"} ${base}`);
      for (const width of smoke ? [390] : [390, 760, 761, 1440]) {
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          reducedMotion: "reduce",
          locale: "zh-CN",
          timezoneId: "Asia/Shanghai",
        });
        let release;
        try {
          const page = await context.newPage(),
            errors = [],
            external = [],
            writes = [],
            reads = [];
          await page.clock.setFixedTime(new Date("2026-08-26T10:00:00.000Z"));
          page.on("pageerror", (e) => errors.push(e.message));
          page.on("request", (r) => {
            if (new URL(r.url()).pathname.startsWith("/api/") && r.method() !== "GET")
              writes.push(r.method());
          });
          await page.route("**/*", (route) => {
            const u = new URL(route.request().url());
            if (u.origin === base && !u.pathname.startsWith("/api/")) return route.continue();
            if (u.pathname === "/api/v1/me/ui-preferences")
              return route.fulfill({ json: env({ theme: "deep-ocean", version: 1 }) });
            external.push(u.pathname);
            return route.abort();
          });
          await setup(page);
          let plan = null;
          await page.route("**/api/v1/org/admin/**", async (route) => {
            const endpoint = new URL(route.request().url()).pathname.split("/").at(-1);
            reads.push(endpoint);
            const active = plan;
            if (active?.gate && ["summary", "approvals"].includes(endpoint)) await active.gate;
            if (active?.status && active.target === endpoint)
              return route.fulfill({
                status: active.status,
                json: {
                  error: {
                    code: "p34_failure_fixture",
                    message: "暂时无法完成本次读取。",
                    action_hint: "请稍后重试或提供请求编号排查。",
                  },
                  request_id: "p34-real-parent-fixture-request",
                  trace_id: "p34-local-trace",
                },
              });
            return route.fallback();
          });
          const center = page.locator(".org-admin-center"),
            card = page.locator(".org-approval-first-failure-c");
          const check = (name, value, expected = true) => {
            assert.deepEqual(value, expected, `${width}: ${name}`);
            if (!baseline) checks.push({ width, name });
          };
          const waitState = (s) =>
            page.waitForFunction(
              (state) =>
                document.querySelector(".org-admin-center")?.dataset.state === state &&
                document.querySelector(".org-admin-center")?.getAttribute("aria-busy") === "false",
              s,
            );
          const visit = (view = "approvals") =>
            page.goto(
              `${base}/org-admin/${view}?approval_view=templates&approval_template_query=采购&keep=external`,
            );
          const compare = async (name, locator = center) => {
            const bytes = await locator.screenshot({ animations: "disabled" }),
              key = `${width}-${name}`;
            if (baseline) pixelBaseline.set(key, bytes);
            else check(`${name}: pixels unchanged`, bytes.equals(pixelBaseline.get(key)));
          };
          const shot = async (scene, locator = card) => {
            if (!capture || baseline) return;
            const file = `${scene}-${width}.png`,
              bytes = await locator.screenshot({ animations: "disabled" });
            await writeFile(`${output}/${file}`, bytes);
            screenshots.push({
              file,
              scene,
              width,
              sha256: hash(bytes),
              scope: "actual-Vue-P34-first-429-mobile-only-fixture",
            });
          };
          for (const target of ["summary", "approvals"]) {
            const initialReads = reads.length;
            plan = { target, status: 429 };
            await visit();
            await waitState("rate_limited");
            check(
              `${target}: original three limited GET attempts`,
              reads.slice(initialReads).filter((e) => e === target).length,
              3,
            );
            check(
              `${target}: other read occurs once`,
              reads
                .slice(initialReads)
                .filter((e) => e === (target === "summary" ? "approvals" : "summary")).length,
              1,
            );
            await compare(`${target}-429-header`, center.locator(".org-admin-hero"));
            if (baseline || width > 760) {
              if (width > 760) await compare(`${target}-429-desktop`);
              continue;
            }
            check(`${target}: approved card visible`, await card.isVisible());
            check(
              `${target}: rate limit heading`,
              await card.locator("h3").textContent(),
              "请求过于频繁",
            );
            check(
              `${target}: legacy failure hidden`,
              await center.locator(".org-admin-state").isVisible(),
              false,
            );
            check(
              `${target}: one visible retry`,
              await center.getByRole("button", { name: "重新加载", exact: true }).count(),
              1,
            );
            check(
              `${target}: real actionable notice retained`,
              await card
                .locator(".org-approval-failure-copy")
                .textContent()
                .then((s) => s.trim()),
              "暂时无法完成本次读取。 请稍后重试或提供请求编号排查。",
            );
            check(
              `${target}: no overflow`,
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
            const style = await card.evaluate((n) => {
              const c = getComputedStyle(n),
                b = getComputedStyle(n.querySelector("button"));
              return [
                c.backgroundColor,
                c.borderRadius,
                c.padding,
                b.backgroundColor,
                b.fontSize,
                parseFloat(b.minHeight),
              ];
            });
            check(`${target}: approved palette and touch floor`, style, [
              "rgb(255, 255, 255)",
              "16px",
              "28px 22px",
              "rgb(37, 74, 156)",
              "16px",
              44,
            ]);
            await shot(`${target}-429`);
            check(
              `${target}: trace initially folded`,
              await card.locator("details").getAttribute("open"),
              null,
            );
            await card.locator("summary").click();
            check(
              `${target}: real request ID`,
              await card.locator("code").textContent(),
              "p34-real-parent-fixture-request",
            );
            await shot(`${target}-trace`);
            await page.keyboard.press("Tab");
            await card.getByRole("button").focus();
            check(
              `${target}: keyboard retry focus`,
              await card.getByRole("button").evaluate((n) => n.matches(":focus-visible")),
            );
            const start = reads.length;
            let gate = new Promise((r) => {
              release = r;
            });
            plan = { gate };
            await page.keyboard.press("Space");
            await page.waitForFunction(
              () => document.querySelector(".org-admin-center")?.dataset.state === "loading",
            );
            check(`${target}: retry hides stale failure`, await card.count(), 0);
            check(
              `${target}: loading refresh disabled`,
              await center.getByRole("button", { name: "刷新数据", exact: true }).isDisabled(),
            );
            release();
            await waitState("ready");
            check(`${target}: retry reads both once`, reads.slice(start).sort(), [
              "approvals",
              "summary",
            ]);
            check(
              `${target}: query preserved after recovery`,
              await page.getByRole("searchbox", { name: "搜索模板", exact: true }).inputValue(),
              "采购",
            );
            check(
              `${target}: unrelated URL preserved`,
              new URL(page.url()).searchParams.get("keep"),
              "external",
            );
          }
          for (const status of smoke ? [403, 404] : [401, 403, 404, 409, 500, 503]) {
            plan = { target: "approvals", status };
            await visit();
            await waitState(
              {
                401: "expired",
                403: "forbidden",
                404: "error",
                409: "conflict",
                500: "error",
                503: "blocked",
              }[status],
            );
            if (!baseline) {
              if (status === 500)
                check(
                  "500: existing card visibility retained",
                  await card.isVisible(),
                  width <= 760,
                );
              else check(`${status}: no unapproved card`, await card.count(), 0);
            }
            await compare(`initial-${status}`);
          }
          plan = null;
          await visit();
          await waitState("ready");
          await compare("ready");
          plan = { target: "approvals", status: 429 };
          await center.getByRole("button", { name: "刷新数据", exact: true }).click();
          await center.locator(".org-admin-notice").waitFor();
          await waitState("ready");
          if (!baseline) check("background 429 keeps original behavior", await card.count(), 0);
          await compare("background-429");
          for (const view of ["workspaces", "members"]) {
            plan = { target: "summary", status: 429 };
            await visit(view);
            await waitState("rate_limited");
            if (!baseline) check(`${view}: no P34 card`, await card.count(), 0);
            await compare(`${view}-429`);
          }
          check("zero page errors", errors, []);
          check("zero unmatched requests", external, []);
          check("zero business writes", writes, []);
        } finally {
          release?.();
          await context.close();
        }
      }
      if (baseline)
        assert.deepEqual([...baselineTransformed].sort(), [parentFile, failureFile].sort());
    } finally {
      await server.close();
    }
  }
} finally {
  await browser.close();
}
if (capture)
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        kind: "P34-RATE-LIMIT-VUE",
        baselineCommit,
        sourceHashes,
        checks,
        screenshots,
        boundary:
          "Actual App/parent/child with fixture HTTP. Only P34 initial 429 without data at width<=760 changed; existing first500, desktop, background and adjacent views pixel-compared. Original 429 three-attempt GET behavior verified. No production authorization/deployment claim;real API notice preserved rather than prototype filler.",
      },
      null,
      2,
    ) + "\n",
  );
else if (!smoke) assert.deepEqual(checks, previous.checks);
console.log(
  JSON.stringify({
    checks: checks.length,
    screenshots: screenshots.length,
    baselineImagesOnlyInMemory: pixelBaseline.size,
    browserAndServersClosed: true,
  }),
);
