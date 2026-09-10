import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p36-write-lifecycle";
const fixtureFile = "tests/e2e/m06-01-organization-admin.spec.ts";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const ast = ts.createSourceFile(fixtureFile, await read(fixtureFile), ts.ScriptTarget.Latest, true);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((node) => node.declarationList.declarations)
  .filter((node) => node.name.getText(ast) === "organizationTokens");
assert.equal(declarations.length, 1);
const tokens = JSON.parse(
  JSON.stringify(vm.runInNewContext(declarations[0].initializer.getText(ast))),
);
const fixedTime = "2026-08-26T10:00:00.000Z";
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((match) => "apps/web/src/" + match[1]);
const entry = "/__p36_write_lifecycle.js";
const host = `import {createApp,h,ref,KeepAlive,nextTick} from 'vue';import {createRouter,createWebHistory} from 'vue-router';
import Parent from '/src/components/OrganizationAdminCenter.vue';
${cssFiles.map((file) => `import '/src/${file.slice("apps/web/src/".length)}';`).join("\n")}
document.documentElement.dataset.design='signal-ledger';
const active=ref(true);window.__setP36Active=async value=>{active.value=value;await nextTick();};
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const app=createApp({render:()=>h(KeepAlive,null,{default:()=>active.value?h(Parent,{key:'tokens',apiBaseUrl:location.origin+'/api/v1',routePath:'/org-admin/tokens',organizationId:'00000000-0000-4000-8000-000000000601'}):h('p','隔离宿主：已切换到其他内容')})}).use(router);await router.isReady();app.mount('#host');`;
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
      name: "p36-write-isolated-host",
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
          if (pathname !== "/org-admin/tokens") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P36 写入生命周期诊断</title><div id="app"><div id="host" class="theme-main"></div></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const sourceFiles = new Set([
  fixtureFile,
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "scripts/verify-ui-phase2-token-write-lifecycle.mjs",
]);
const checks = [],
  runs = [],
  screenshots = [];
const scenarios = [
  "success",
  "write409",
  "write500",
  "read500",
  "read403",
  "reason-deactivate",
  "pending-deactivate",
];
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`p36_write_host ${origin}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 1440])
    for (const action of ["rotate", "revoke"])
      for (const scenario of scenarios) {
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
          const original = { ...tokens[0], name: "验收只读令牌", version: 5 };
          let rows = [original],
            posts = 0;
          const postGate = new Promise((done) => {
            release = done;
          });
          const check = (name, actual, expected = true) => {
            assert.deepEqual(actual, expected, `${width}:${action}:${scenario}:${name}`);
            checks.push({ width, action, scenario, name });
          };
          const envelope = (data) => ({
            data,
            request_id: "p36-write-fixture",
            trace_id: "p36-write-fixture",
          });
          const errorEnvelope = (code) => ({
            error: {
              code: "fixture_" + code,
              message: "隔离请求未完成",
              action_hint: "请核对后重试。",
            },
            request_id: "p36-failure-fixture",
            trace_id: "p36-failure-fixture",
          });
          await page.clock.install({ time: new Date(fixedTime) });
          await context.addInitScript(() => {
            Object.defineProperty(navigator, "clipboard", {
              value: {
                writeText: () => {
                  throw Error("clipboard outside scope");
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
              body: req.postDataJSON(),
              idempotency: Boolean(req.headers()["idempotency-key"]),
            });
            if (
              req.method() === "GET" &&
              ["/api/v1/org/admin/summary", "/api/v1/org/admin/tokens"].includes(url.pathname)
            ) {
              if (posts && scenario.startsWith("read") && url.pathname.endsWith("/tokens")) {
                const code = Number(scenario.slice(4));
                return route.fulfill({ status: code, json: errorEnvelope(code) });
              }
              return route.fulfill({
                json: envelope(
                  url.pathname.endsWith("/tokens") ? rows : { observed_at: fixedTime },
                ),
              });
            }
            if (
              req.method() === "POST" &&
              url.pathname === `/api/v1/org/admin/tokens/${original.id}/actions`
            ) {
              posts++;
              await postGate;
              if (scenario.startsWith("write"))
                return route.fulfill({
                  status: Number(scenario.slice(5)),
                  json: errorEnvelope(scenario),
                });
              if (action === "rotate") {
                const fresh = {
                  ...original,
                  id: "00000000-0000-4000-8000-000000000999",
                  version: 1,
                  created_at: "2026-08-26T10:00:00.000Z",
                  updated_at: "2026-08-26T10:00:00.000Z",
                };
                rows = [{ ...original, status: "rotated", version: 6 }, fresh];
                return route.fulfill({
                  json: envelope({
                    ...fresh,
                    secret: "synthetic-p36-rotation-only",
                    rotated_from_id: original.id,
                  }),
                });
              }
              rows = [{ ...original, status: "revoked", version: 6 }];
              return route.fulfill({
                json: envelope({ id: original.id, status: "revoked", version: 6 }),
              });
            }
            forbidden.push(`${req.method()} ${url.pathname}`);
            return route.abort();
          });
          const panel = page.locator(".org-token-panel"),
            dialog = page.getByRole("dialog"),
            notice = page.locator(".org-admin-notice");
          const button = () =>
            page
              .getByRole("button", {
                name: action === "rotate" ? "轮换密钥" : "撤销访问",
                exact: true,
              })
              .first();
          const shot = async (name, target) => {
            if (!capture) return;
            const bytes = await target.screenshot({ animations: "disabled" }),
              file = `${width}-${action}-${scenario}-${name}.png`;
            await writeFile(`${output}/${file}`, bytes);
            screenshots.push({
              file,
              width,
              action,
              scenario,
              state: name,
              sha256: hash(bytes),
              scope: "actual-production-UI-fixture-diagnostic-not-C-approval",
            });
          };
          await page.goto(origin + "/org-admin/tokens");
          await panel.waitFor();
          await button().click();
          await dialog.waitFor();
          await dialog.locator("textarea").fill("  定期维护隔离测试  ");
          if (scenario === "reason-deactivate") {
            await page.evaluate(() => window.__setP36Active(false));
            check("deactivated parent detached", await panel.count(), 0);
            await page.evaluate(() => window.__setP36Active(true));
            await panel.waitFor();
            const restored = await page.locator("dialog").evaluate((node) => ({
              open: node.open,
              modal: node.matches(":modal"),
              connected: node.isConnected,
              value: node.querySelector("textarea").value,
            }));
            check("cache roundtrip has no write", posts, 0);
            if (await dialog.isVisible()) await shot("restored-reason", dialog);
            runs.push({ width, action, scenario, requests, observation: restored });
            check("zero external requests", forbidden, []);
            check("zero browser errors", errors, []);
            check(
              "zero storage",
              await page.evaluate(() => [localStorage.length, sessionStorage.length]),
              [0, 0],
            );
            console.log(`passed ${width} ${action} ${scenario}`);
            continue;
          }
          await dialog.getByRole("button", { name: "确认提交", exact: true }).click();
          await page.waitForFunction(() => !document.querySelector("dialog")?.open);
          await page.waitForFunction(
            () => document.querySelector(".org-token-list article button")?.disabled === true,
          );
          check("one POST while waiting", posts, 1);
          const write = requests.find((req) => req.method === "POST");
          check("exact payload", write.body, {
            action,
            expected_version: 5,
            reason: "定期维护隔离测试",
          });
          check("idempotency present", write.idempotency);
          check("reason closes before write settles", await dialog.isVisible(), false);
          check(
            "all row actions disabled",
            await page
              .locator(".org-token-list button")
              .evaluateAll((nodes) => nodes.length === 2 && nodes.every((node) => node.disabled)),
          );
          await shot("pending", page.locator(".org-token-list"));
          if (scenario === "pending-deactivate") {
            await page.evaluate(() => window.__setP36Active(false));
            check("pending parent detached", await panel.count(), 0);
          }
          const postFinished = page.waitForResponse(
            (response) => response.request().method() === "POST",
          );
          const rereadFinished =
            scenario === "pending-deactivate"
              ? page.waitForResponse((response) =>
                  response.url().endsWith("/api/v1/org/admin/tokens"),
                )
              : null;
          release();
          // Register both observers before releasing the response to avoid an observation race.
          await postFinished;
          if (scenario === "pending-deactivate") {
            await rereadFinished;
            await page.evaluate(
              () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
            );
            await page.evaluate(() => window.__setP36Active(true));
            await panel.waitFor();
          }
          await page.waitForFunction(() => {
            const n = document.querySelector(".org-admin-notice");
            return (
              n &&
              document.querySelector(".org-admin-refresh button")?.disabled === false &&
              [...document.querySelectorAll(".org-token-list button")].every(
                (node) => !node.disabled,
              )
            );
          });
          const observation = {
            notice: await notice.textContent(),
            kind: await notice.getAttribute("data-kind"),
            role: await notice.getAttribute("role"),
            rowStates: await page
              .locator(".org-token-list article")
              .evaluateAll((nodes) => nodes.map((node) => node.dataset.status)),
            secret: await page.locator(".org-token-secret").count(),
            pageFailure: await page.locator(".org-admin-state h3").allTextContents(),
          };
          if (scenario.startsWith("write")) {
            check("failed write retains record", observation.rowStates, ["active"]);
            check("failed write feedback error", observation.kind, "error");
            check("failed write has no secret", observation.secret, 0);
            await button().click();
            await dialog.waitFor();
            check(
              "manual retry reason is blank",
              await dialog.locator("textarea").inputValue(),
              "",
            );
            await dialog.getByRole("button", { name: "取消", exact: true }).click();
          } else if (scenario === "success" || scenario === "pending-deactivate") {
            check(
              "successful record states",
              [...observation.rowStates].sort(),
              action === "rotate" ? ["active", "rotated"] : ["revoked"],
            );
            check(
              "secret owned by active origin",
              observation.secret,
              action === "rotate" && scenario === "success" ? 1 : 0,
            );
          }
          check("no automatic write replay", posts, 1);
          check("zero external requests", forbidden, []);
          check("zero browser errors", errors, []);
          check(
            "zero storage",
            await page.evaluate(() => [localStorage.length, sessionStorage.length]),
            [0, 0],
          );
          await shot("notice", notice);
          if (observation.pageFailure.length)
            await shot("page-failure", page.locator(".org-admin-state"));
          else await shot("records", page.locator(".org-token-list"));
          runs.push({ width, action, scenario, requests, observation });
          console.log(`passed ${width} ${action} ${scenario}`);
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
const findings = runs.filter(
  (run) =>
    (run.scenario.startsWith("read") && run.observation.kind === "success") ||
    (run.scenario === "reason-deactivate" && run.observation.open),
);
const sourceHashes = Object.fromEntries(
  await Promise.all([...sourceFiles].sort().map(async (file) => [file, hash(await read(file))])),
);
const evidence = {
  kind: "P36-WRITE-LIFECYCLE-r1",
  scope:
    "Unmodified actual parent/child/dialog/hooks and production CSS. HTTP fixtures, synthetic token, two-width mounted KeepAlive host; not full App routing, real permissions, OS clipboard, SQL, audit or C-design approval. Diagnostic findings are not acceptance passes.",
  fixedTime,
  checks,
  runs,
  findings,
  screenshots,
  sourceHashes,
  processesClosed: true,
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P36 写入生命周期诊断</title><style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;margin:24px;background:#edf1f6}article{padding:20px;background:white;margin:24px 0}img{max-width:100%}</style><h1>P36 实际 Vue 写入诊断</h1><p>生产样式原貌，非C审图。全部请求为隔离夹具；错误组合仅证明复现，不表示验收通过。发现${findings.length}个宽度/动作组合需要处理。</p>${screenshots.map((shot) => `<article><h2>${shot.file}</h2><img src="${shot.file}" alt="${shot.state}" loading="lazy"></article>`).join("\n")}</html>`,
  );
}
console.log(
  JSON.stringify({
    runs: runs.length,
    checks: checks.length,
    images: screenshots.length,
    findings: findings.length,
    sources: sourceFiles.size,
    processesClosed: true,
  }),
);
