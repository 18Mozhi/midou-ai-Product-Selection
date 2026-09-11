import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";
import { userPasswordPreview } from "./lib/ui-phase2-user-password-preview.mjs";
import { userPagePreview } from "./lib/ui-phase2-user-page-preview.mjs";

const capture = process.argv.includes("--capture");
const baseline = process.argv.includes("--baseline");
assert.ok(process.argv.slice(2).every((arg) => ["--capture", "--baseline"].includes(arg)));
const output = "output/playwright/p43-password-lifecycle/" + (baseline ? "baseline" : "current");
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const parent = "apps/web/src/components/PlatformAccountCenter.vue";
const detailFile = "apps/web/src/components/PlatformUserDetailDialog.vue";
const style = "design-plans/ui-phase-2-2026-09-07/implementation/user-page-preview.css";
const child = "apps/web/src/components/PlatformAccountDialogs.vue";
const passwordStyle = "design-plans/ui-phase-2-2026-09-07/implementation/user-password-preview.css";
const originals = {
  [parent]: baseline
    ? execFileSync("git", ["show", "b93caa7f:" + parent], { encoding: "utf8" }).replaceAll(
        "\r\n",
        "\n",
      )
    : await read(parent),
  [detailFile]: await read(detailFile),
  [child]: await read(child),
};
const transformed = {
  [parent]: userPagePreview(originals[parent], "parent"),
  [detailFile]: userPagePreview(originals[detailFile], "detail"),
  [child]: userPasswordPreview(originals[child]),
};
const fixtureFile = "tests/e2e/m06-01-platform-accounts.spec.ts";
const ast = ts.createSourceFile(fixtureFile, await read(fixtureFile), ts.ScriptTarget.Latest, true);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((n) => [...n.declarationList.declarations]);
const code = ["user", "org", "session", "overview"]
  .map((name) => {
    const nodes = declarations.filter((n) => n.name.getText(ast) === name);
    assert.equal(nodes.length, 1);
    return `const ${name}=${nodes[0].initializer.getText(ast)};`;
  })
  .join("\n");
const details = [];
function find(node) {
  if (
    ts.isObjectLiteralExpression(node) &&
    ["user", "memberships", "sessions"].every((key) =>
      node.properties.some((p) => p.name?.getText(ast) === key),
    ) &&
    node.getText(ast).includes('device_label: "Chrome"')
  )
    details.push(node);
  ts.forEachChild(node, find);
}
find(ast);
assert.equal(details.length, 1);
const fixture = JSON.parse(
  JSON.stringify(vm.runInNewContext(`${code}\n({overview,detail:${details[0].getText(ast)}})`)),
);
// Original detail fixture lacks organization_id. Preserve and disclose it, never silently repair.
assert.equal(fixture.detail.memberships[0].organization_id, undefined);
// Explicit second-account fixture; not a real identity or authorization result.
const secondUser = {
  ...fixture.detail.user,
  id: "00000000-0000-4000-8000-000000000629",
  email: "second-fixture@example.test",
};
const secondDetail = {
  ...structuredClone(fixture.detail),
  user: secondUser,
  memberships: [],
  sessions: [],
};
fixture.overview.users.push({ ...structuredClone(fixture.overview.users[0]), ...secondUser });
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((m) => "apps/web/src/" + m[1]);
const sources = new Set([
  parent,
  detailFile,
  style,
  passwordStyle,
  "scripts/lib/ui-phase2-user-password-preview.mjs",
  "apps/api/src/platform-account-service.ts",
  "apps/api/src/mysql-platform-account-repository.ts",
  fixtureFile,
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "scripts/lib/ui-phase2-user-page-preview.mjs",
  "scripts/verify-ui-phase2-user-password-lifecycle.mjs",
]);
const entry = "/__p43_review.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import Parent from '/src/components/PlatformAccountCenter.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
import '/@fs/${path.resolve(style).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(passwordStyle).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p43-page-preview','p43-password-review');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
window.__go=(query)=>router.push({path:'/platform-admin/users',query});
const app=createApp({render:()=>h('main',[h('p',{class:'preview-disclaimer'},'P43 / C方向审核 · 实际Vue + 测试数据 · 未上线'),h(Parent,{apiBaseUrl:'/api/v1',initialTab:'users',routePath:'/platform-admin/users'})])}).use(router);await router.isReady();app.mount('#app');`;
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {}, hmr: false },
  plugins: [
    {
      name: "p43-review",
      enforce: "pre",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      transform(source, id) {
        const file = Object.keys(originals).find(
          (f) => path.resolve(f).replaceAll("\\", "/") === id.replaceAll("\\", "/"),
        );
        if (!file) return null;
        if (!(baseline && file === parent))
          assert.equal(source.replaceAll("\r\n", "\n"), originals[file]);
        return { code: transformed[file], map: null };
      },
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/platform-admin/users") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P43 用户管理审核</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});

const checks = [],
  screenshots = [],
  observations = [];
const password = "PasswordLifecycleFixture-123";
const why = "隔离回归：核对原账号后人工重置";
const errorHint = "隔离样例：原账号改密失败";
let browser;
try {
  await server.listen();
  const origin = "http://127.0.0.1:" + port;
  console.log("p43_password_lifecycle_host", origin);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 1440]) {
    for (const scenario of [
      "normal",
      "close-password",
      "close-detail",
      "reopen-account",
      "switch-account",
    ]) {
      for (const outcome of ["success", "failure"]) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          locale: "zh-CN",
          timezoneId: "Asia/Shanghai",
          reducedMotion: "reduce",
        });
        const page = await context.newPage(),
          requests = [],
          errors = [],
          unexpected = [];
        let release;
        const gate = new Promise((r) => {
          release = r;
        });
        const check = (name, actual, expected = true) => {
          assert.deepEqual(actual, expected, [width, scenario, outcome, name].join(":"));
          checks.push({ width, scenario, outcome, name, actual });
        };
        const shot = async (state) => {
          if (!capture) return;
          await page.mouse.move(0, 0);
          const file = [width, scenario, outcome, state].join("-") + ".png";
          const bytes = await page.screenshot({ animations: "disabled" });
          await writeFile(output + "/" + file, bytes);
          screenshots.push({ file, width, scenario, outcome, state, sha256: hash(bytes) });
        };
        try {
          page.on("pageerror", (e) => errors.push(e.message));
          await page.route("**/*", async (route) => {
            const req = route.request(),
              url = new URL(req.url());
            if (url.origin !== origin) {
              unexpected.push(url.origin);
              return route.abort();
            }
            if (!url.pathname.startsWith("/api/")) return route.continue();
            const root = "/api/v1/platform/accounts",
              a = root + "/users/" + fixture.detail.user.id,
              b = root + "/users/" + secondUser.id;
            const env = (data) => ({
              data,
              request_id: "password-lifecycle-fixture",
              trace_id: "password-lifecycle-fixture",
            });
            if (req.method() === "GET" && [root, a, b].includes(url.pathname)) {
              requests.push({ method: "GET", path: url.pathname });
              return route.fulfill({
                json: env(
                  url.pathname === root
                    ? fixture.overview
                    : url.pathname === a
                      ? fixture.detail
                      : secondDetail,
                ),
              });
            }
            if (req.method() === "POST" && url.pathname === a + "/password") {
              assert.deepEqual(req.postDataJSON(), { temporary_password: password, reason: why });
              assert.ok(req.headers()["idempotency-key"]);
              requests.push({
                method: "POST",
                path: url.pathname,
                body: "exact original synthetic password/reason matched; password omitted",
              });
              await gate;
              return outcome === "success"
                ? route.fulfill({ json: env({ version: 2 }) })
                : route.fulfill({
                    status: 400,
                    json: {
                      error: {
                        code: "review_fixture_failure",
                        message: "原账号失败",
                        action_hint: errorHint,
                      },
                      request_id: "password-lifecycle-fixture",
                      trace_id: "password-lifecycle-fixture",
                    },
                  });
            }
            unexpected.push(req.method() + " " + url.pathname);
            return route.abort();
          });
          await page.goto(origin + "/platform-admin/users?keep=password-lifecycle");
          const rows =
            width <= 760
              ? page.locator(".responsive-data-view__mobile article")
              : page.locator(".account-table-wrap tbody tr");
          await rows.nth(1).waitFor();
          const detail = page.locator("dialog.p43-user-detail");
          const pw = page.locator("dialog.p43-security-sheet");
          const reason = page.locator("dialog.p43-reason-sheet");
          const openDetail = async (index) => {
            if (width <= 760) {
              const preview = page.locator(".responsive-data-view__drawer");
              if (await preview.isVisible())
                await preview.getByRole("button", { name: "关闭详情", exact: true }).click();
              await rows.nth(index).getByRole("button").click();
              await page
                .locator(".responsive-data-view__drawer")
                .getByRole("button", { name: "打开账号详情", exact: true })
                .click();
            } else
              await rows.nth(index).getByRole("button", { name: "账号详情", exact: true }).click();
            await detail.locator(".detail-grid").waitFor();
          };
          await openDetail(0);
          await detail.getByRole("button", { name: "强制改密", exact: true }).click();
          await pw.getByLabel("新临时密码", { exact: true }).fill(password);
          await pw.getByRole("button", { name: "确认重置", exact: true }).click();
          await reason.getByLabel("操作原因", { exact: true }).fill(why);
          await reason.getByRole("button", { name: "确认执行", exact: true }).click();
          await reason.waitFor({ state: "hidden" });
          await page.waitForFunction(
            () =>
              document.querySelector("dialog.p43-security-sheet footer button:last-child")
                ?.disabled,
          );
          check(
            "one original-account POST held",
            requests.filter((r) => r.method === "POST").length,
            1,
          );
          await shot("pending");
          if (scenario !== "normal") {
            await pw.getByRole("button", { name: "取消", exact: true }).click();
            await pw.waitFor({ state: "hidden" });
            check(
              "detail reset trigger is disabled during write",
              await detail.getByRole("button", { name: "强制改密", exact: true }).isDisabled(),
            );
            if (scenario !== "close-password") {
              await detail.getByRole("button", { name: "关闭账号详情", exact: true }).click();
              await detail.waitFor({ state: "hidden" });
              if (["reopen-account", "switch-account"].includes(scenario)) {
                await openDetail(scenario === "switch-account" ? 1 : 0);
                check(
                  "replacement detail is open before old response",
                  await detail.evaluate((n) => n.open),
                );
                check(
                  "replacement detail account verified",
                  (await detail.innerText()).includes(
                    scenario === "switch-account" ? secondUser.email : fixture.detail.user.email,
                  ),
                );
                check(
                  "replacement reset is still disabled",
                  await detail.getByRole("button", { name: "强制改密", exact: true }).isDisabled(),
                );
              }
            }
          }
          const response = page.waitForResponse(
            (r) => r.request().method() === "POST" && r.url().endsWith("/password"),
          );
          release();
          await response;
          if (outcome === "success")
            await page.locator(".account-message").filter({ hasText: "临时密码已更新" }).waitFor();
          else
            await page.waitForFunction(
              () =>
                !document.querySelector("dialog.p43-security-sheet footer button:last-child")
                  ?.disabled,
            );
          const replacement = ["reopen-account", "switch-account"].includes(scenario);
          const detailExpected =
            outcome === "success" ? replacement && !baseline : scenario !== "close-detail";
          check(
            "detail after original response",
            await detail.evaluate((n) => n.open),
            detailExpected,
          );
          check(
            "password after original response",
            await pw.evaluate((n) => n.open),
            scenario === "normal" && outcome === "failure",
          );
          check(
            "error feedback stays in valid original detail scope",
            await pw.locator('[role="alert"]').count(),
            outcome === "failure" && (baseline || ["normal", "close-password"].includes(scenario))
              ? 1
              : 0,
          );
          check(
            "original success notification preserved",
            await page.locator(".account-message").filter({ hasText: "临时密码已更新" }).count(),
            outcome === "success" ? 1 : 0,
          );
          check(
            "original reread count",
            requests.filter((r) => r.method === "GET").length,
            2 + (replacement ? 1 : 0) + (outcome === "success" ? 1 : 0),
          );
          check(
            "never writes second account",
            requests.filter((r) => r.method === "POST").length,
            1,
          );
          check("no unexpected traffic", unexpected, []);
          check("no browser errors", errors, []);
          await shot("after-response");
          observations.push({ width, scenario, outcome, requests, errors, unexpected });
        } finally {
          release();
          await context.close();
        }
      }
    }
  }
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const file = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
    if (
      file &&
      !file.startsWith("..") &&
      !file.includes("node_modules") &&
      /\.(vue|ts|css)$/.test(file)
    )
      sources.add(file);
  }
  const sourceHashes = Object.fromEntries(
    await Promise.all(
      [...sources]
        .sort()
        .map(async (f) => [f, hash(baseline && f === parent ? originals[parent] : await read(f))]),
    ),
  );
  if (capture) {
    await writeFile(
      output + "/evidence.json",
      JSON.stringify(
        {
          kind: "P43-PASSWORD-LIFECYCLE",
          mode: baseline ? "baseline-diagnosis" : "current-regression",
          approval: "not-user-approved",
          sourceHashes,
          transformedHashes: Object.fromEntries(
            Object.entries(transformed).map(([f, v]) => [f, hash(v)]),
          ),
          checks,
          screenshots,
          observations,
          processesClosed: true,
          scope:
            "Actual Vue parent/detail/password/reason with C review composition. A is original E2E fixture; B is explicit synthetic second account with empty memberships/sessions. Intercepted requests only. No forced disabled button, internal Vue mutation or real user/permission/SQL/full App acceptance.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      output + "/index.html",
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P43 改密回执归属</title><style>body{font:16px/1.6 sans-serif;background:#edf1f6;margin:24px}article{background:white;padding:16px;margin:24px 0}img{max-width:100%}</style><h1>P43 改密回执 / ' +
        (baseline ? "旧版诊断" : "当前回归") +
        "</h1><p>实际Vue及明确测试账号；原生按钮实际点击，请求全部拦截。不是视觉批准或真实改密/权限验收。</p>" +
        screenshots
          .map(
            (s) =>
              "<article><h2>" +
              s.file +
              '</h2><img loading="lazy" src="' +
              s.file +
              '" alt="' +
              s.file +
              '"></article>',
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      baseline,
      scenarios: observations.length,
      checks: checks.length,
      images: screenshots.length,
      sources: sources.size,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
