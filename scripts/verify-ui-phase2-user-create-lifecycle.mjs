import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { userCreatePreview } from "./lib/ui-phase2-user-create-preview.mjs";
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
const output = "output/playwright/p43-create-lifecycle/" + (baseline ? "baseline" : "current");
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const parent = "apps/web/src/components/PlatformAccountCenter.vue";
const detailFile = "apps/web/src/components/PlatformUserDetailDialog.vue";
const style = "design-plans/ui-phase-2-2026-09-07/implementation/user-page-preview.css";
const child = "apps/web/src/components/PlatformAccountDialogs.vue";
const passwordStyle = "design-plans/ui-phase-2-2026-09-07/implementation/user-create-preview.css";
const originals = {
  [parent]: baseline
    ? execFileSync("git", ["show", "01af0262:" + parent], { encoding: "utf8" }).replaceAll(
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
  [child]: userCreatePreview(userPasswordPreview(originals[child])),
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
  "scripts/verify-ui-phase2-user-create-lifecycle.mjs",
  "scripts/lib/ui-phase2-user-create-preview.mjs",
]);
const entry = "/__p43_review.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import Parent from '/src/components/PlatformAccountCenter.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
import '/@fs/${path.resolve(style).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(passwordStyle).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p43-page-preview','p43-user-form-review');
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
const samplePassword = "CreationFixtureOnly-123";
const failureHint = "隔离样例：本次创建未完成。";
let browser;
try {
  await server.listen();
  const origin = "http://127.0.0.1:" + port;
  console.log("p43_create_lifecycle_host", origin);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 1440]) {
    for (const scenario of ["normal", "close", "reopen", "reopen-twice"]) {
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
        const gate = new Promise((resolve) => {
          release = resolve;
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
            const env = (data) => ({
              data,
              request_id: "creation-lifecycle-fixture",
              trace_id: "creation-lifecycle-fixture",
            });
            if (req.method() === "GET" && url.pathname === "/api/v1/platform/accounts") {
              requests.push({ method: "GET", path: url.pathname });
              return route.fulfill({ json: env(fixture.overview) });
            }
            if (req.method() === "POST" && url.pathname === "/api/v1/platform/accounts/users") {
              assert.deepEqual(req.postDataJSON(), {
                email: "submitted@example.test",
                temporary_password: samplePassword,
                platform_role_code: null,
                organization_id: null,
                organization_role_code: "member",
              });
              assert.ok(req.headers()["idempotency-key"]);
              requests.push({
                method: "POST",
                path: url.pathname,
                body: "exact five-field synthetic body matched; password omitted",
              });
              await gate;
              return outcome === "success"
                ? route.fulfill({ json: env({ id: fixture.detail.user.id }) })
                : route.fulfill({
                    status: 400,
                    json: {
                      error: {
                        code: "review_fixture_failure",
                        message: "测试失败",
                        action_hint: failureHint,
                      },
                      request_id: "creation-lifecycle-fixture",
                      trace_id: "creation-lifecycle-fixture",
                    },
                  });
            }
            unexpected.push(req.method() + " " + url.pathname);
            return route.abort();
          });
          await page.goto(origin + "/platform-admin/users?keep=create-lifecycle");
          const trigger = page
            .locator(".hero-actions")
            .getByRole("button", { name: "新建用户", exact: true });
          await trigger.waitFor();
          const dialog = page.locator("dialog.p43-user-onboarding");
          const email = dialog.getByLabel("邮箱", { exact: true });
          const password = dialog.getByLabel("临时密码", { exact: true });
          const confirm = dialog.getByRole("button", { name: "确认创建", exact: true });
          const cancel = dialog.getByRole("button", { name: "取消", exact: true });
          await trigger.click();
          await email.fill("submitted@example.test");
          await password.fill(samplePassword);
          await confirm.click();
          await page.waitForFunction(
            () =>
              document.querySelector("dialog.p43-user-onboarding footer button:last-child")
                ?.disabled,
          );
          check("one request pending", requests.filter((r) => r.method === "POST").length, 1);
          await shot("pending");
          if (scenario !== "normal") {
            await cancel.click();
            await dialog.waitFor({ state: "hidden" });
            if (scenario.startsWith("reopen")) {
              await trigger.click();
              await email.fill("new-draft@example.test");
              await password.fill("NewDraftFixtureOnly-456");
              if (scenario === "reopen-twice") {
                await page.keyboard.press("Escape");
                await dialog.waitFor({ state: "hidden" });
                await trigger.click();
                await email.fill("new-draft@example.test");
                await password.fill("NewDraftFixtureOnly-456");
              }
              check(
                "reopened native dialog before old response",
                await dialog.evaluate((n) => n.matches(":modal")),
              );
              check(
                "new draft present before old response",
                (await email.inputValue()) === "new-draft@example.test",
              );
            }
          }
          const response = page.waitForResponse(
            (r) => r.request().method() === "POST" && r.url().endsWith("/platform/accounts/users"),
          );
          release();
          await response;
          if (outcome === "success") {
            await page.locator(".account-message").filter({ hasText: "账号已创建" }).waitFor();
          } else {
            await page.waitForFunction(
              () =>
                !document.querySelector("dialog.p43-user-onboarding footer button:last-child")
                  ?.disabled,
            );
          }
          const reopened = scenario.startsWith("reopen");
          const expectedOpen =
            scenario === "normal"
              ? outcome === "failure"
              : reopened && !(baseline && outcome === "success");
          check("open state after response", await dialog.evaluate((n) => n.open), expectedOpen);
          check(
            "error belongs to original still-open form",
            await dialog.locator('[role="alert"]').count(),
            outcome === "failure" && (baseline || scenario === "normal") ? 1 : 0,
          );
          if (reopened) {
            check(
              "new email is unchanged",
              (await email.inputValue()) === "new-draft@example.test",
            );
            check(
              "new password is unchanged",
              (await password.inputValue()) === "NewDraftFixtureOnly-456",
            );
          }
          check(
            "original success notification preserved",
            await page.locator(".account-message").filter({ hasText: "账号已创建" }).count(),
            outcome === "success" ? 1 : 0,
          );
          check(
            "original reread behavior preserved",
            requests.filter((r) => r.method === "GET").length,
            outcome === "success" ? 2 : 1,
          );
          check("no second create", requests.filter((r) => r.method === "POST").length, 1);
          check("no browser errors", errors, []);
          check("no unexpected traffic", unexpected, []);
          await shot("after-response");
          observations.push({
            width,
            scenario,
            outcome,
            requests,
            errors,
            unexpected,
            behavior: baseline
              ? "baseline diagnosis, not desired behavior"
              : "current regression, not visual approval",
          });
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
          kind: "P43-CREATE-LIFECYCLE",
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
            "Actual Vue parent/native dialog; review-only C composition. Intercepted synthetic requests only. Cancel/reopen during POST; no real accounts, full App/KeepAlive, permission or production acceptance.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      output + "/index.html",
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P43 创建回执归属</title><style>body{font:16px/1.6 sans-serif;background:#edf1f6;margin:24px}article{background:white;margin:24px 0;padding:16px}img{max-width:100%}</style><h1>P43 创建在途回执 / ' +
        (baseline ? "旧版问题诊断" : "当前回归") +
        "</h1><p>真实Vue、测试数据、请求均被拦截。不是视觉批准或生产验收。</p>" +
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
