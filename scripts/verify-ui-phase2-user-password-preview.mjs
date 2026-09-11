import assert from "node:assert/strict";
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
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p43-password-vue-preview";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const parent = "apps/web/src/components/PlatformAccountCenter.vue";
const detailFile = "apps/web/src/components/PlatformUserDetailDialog.vue";
const style = "design-plans/ui-phase-2-2026-09-07/implementation/user-page-preview.css";
const child = "apps/web/src/components/PlatformAccountDialogs.vue";
const passwordStyle = "design-plans/ui-phase-2-2026-09-07/implementation/user-password-preview.css";
const originals = {
  [parent]: await read(parent),
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
  "scripts/verify-ui-phase2-user-password-preview.mjs",
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
const password = "PreviewOnly-123";
const why = "隔离审核样例：核对账号登录状态后重置临时密码。";
let browser;
try {
  await server.listen();
  const origin = "http://127.0.0.1:" + port;
  console.log("p43_password_host", origin);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440]) {
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
    let mode = "failure",
      gate,
      release;
    const unhold = () => {
      release?.();
      gate = undefined;
    };
    const check = (name, actual, expected = true) => {
      assert.deepEqual(actual, expected, width + ":" + name);
      checks.push({
        width,
        name,
        actual: actual === password ? "[known synthetic value matched]" : actual,
      });
    };
    try {
      await page.clock.install({ time: new Date("2026-09-11T02:00:00Z") });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== origin) {
          unexpected.push(url.origin);
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        const detailPath = "/api/v1/platform/accounts/users/" + fixture.detail.user.id;
        const env = (data) => ({
          data,
          request_id: "p43-password-fixture",
          trace_id: "p43-password-fixture",
        });
        if (
          req.method() === "GET" &&
          ["/api/v1/platform/accounts", detailPath].includes(url.pathname)
        ) {
          requests.push({
            method: "GET",
            path: url.pathname,
            query: Object.fromEntries(url.searchParams),
          });
          return route.fulfill({
            json: env(url.pathname === detailPath ? fixture.detail : fixture.overview),
          });
        }
        if (req.method() === "POST" && url.pathname === detailPath + "/password") {
          const body = req.postDataJSON();
          assert.deepEqual(body, { temporary_password: password, reason: why });
          assert.ok(req.headers()["idempotency-key"]);
          requests.push({
            method: "POST",
            path: url.pathname,
            body: { temporary_password: "[known synthetic value matched]", reason: body.reason },
            idempotencyKeyPresent: true,
            mode,
          });
          if (gate) await gate;
          return mode === "failure"
            ? route.fulfill({
                status: 500,
                json: {
                  error: {
                    code: "review_fixture_failure",
                    message: "测试改密失败",
                    action_hint: "本次重置未完成，请核对后重试。",
                  },
                  request_id: "p43-password-failure",
                  trace_id: "p43-password-failure",
                },
              })
            : route.fulfill({
                json: env({ id: fixture.detail.user.id, must_change_password: true, version: 2 }),
              });
        }
        unexpected.push(req.method() + " " + url.pathname);
        return route.abort();
      });
      await page.goto(origin + "/platform-admin/users?keep=password-review");
      const rows =
        width <= 760
          ? page.locator(".responsive-data-view__mobile article")
          : page.locator(".account-table-wrap tbody tr");
      await rows.first().waitFor();
      if (width <= 760) {
        await rows.first().getByRole("button").click();
        await page
          .locator(".responsive-data-view__drawer")
          .getByRole("button", { name: "打开账号详情", exact: true })
          .click();
      } else await rows.first().getByRole("button", { name: "账号详情", exact: true }).click();
      const detail = page.locator("dialog.p43-user-detail");
      await detail.locator(".detail-grid").waitFor();
      const trigger = detail.getByRole("button", { name: "强制改密", exact: true });
      const pw = page.locator("dialog.p43-security-sheet"),
        reason = page.locator("dialog.p43-reason-sheet");
      const input = pw.getByLabel("新临时密码", { exact: true }),
        field = reason.getByLabel("操作原因", { exact: true });
      const pwConfirm = pw.getByRole("button", { name: "确认重置", exact: true }),
        pwCancel = pw.getByRole("button", { name: "取消", exact: true });
      const reasonConfirm = reason.getByRole("button", { name: "确认执行", exact: true }),
        reasonCancel = reason.getByRole("button", { name: "取消", exact: true });
      const postCount = () => requests.filter((r) => r.method === "POST").length;
      const focusIs = (locator) => locator.evaluate((n) => n === document.activeElement);
      const shot = async (state, dialog = pw, bottom = false) => {
        if (!/(hover|pressed)/.test(state)) await page.mouse.move(0, 0);
        if (!/(focus|hover|pressed)/.test(state))
          await page.evaluate(() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          });
        await dialog.evaluate((n, b) => {
          n.scrollTop = b ? n.scrollHeight : 0;
        }, bottom);
        check(
          state + ":no horizontal overflow",
          await dialog.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
        );
        check(
          state + ":blue heading white fields",
          await dialog.evaluate((n) => [
            getComputedStyle(n.querySelector(".p43-security-heading")).backgroundColor,
            getComputedStyle(n.querySelector(".p43-security-content")).backgroundColor,
          ]),
          ["rgb(37, 74, 156)", "rgb(255, 255, 255)"],
        );
        check(
          state + ":native top-layer dialog",
          await dialog.evaluate((n) => n.matches(":modal")),
        );
        if (capture) {
          const file = width + "-" + state + ".png",
            bytes = await dialog.screenshot({ animations: "disabled" });
          await writeFile(output + "/" + file, bytes);
          screenshots.push({
            file,
            width,
            state,
            bottom,
            viewport: page.viewportSize(),
            sha256: hash(bytes),
            imageDimensions: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
          });
        }
      };
      const open = async () => {
        await trigger.click();
        await pw.waitFor();
      };
      await open();
      check("password initially focused", await focusIs(input));
      check(
        "password exact native contract",
        await input.evaluate((n) => ({
          type: n.type,
          required: n.required,
          min: n.minLength,
          max: n.maxLength,
          autocomplete: n.autocomplete,
        })),
        { type: "password", required: true, min: 12, max: 128, autocomplete: "new-password" },
      );
      check(
        "password controls 44px and16px",
        await pw.locator("input,button").evaluateAll((ns) =>
          ns.every((n) => {
            const r = n.getBoundingClientRect();
            return (
              r.width >= 44 && r.height >= 44 && parseFloat(getComputedStyle(n).fontSize) >= 16
            );
          }),
        ),
      );
      await shot("password-default");
      await input.focus();
      await shot("password-focus");
      await pwConfirm.click();
      check("empty password native invalid", await input.evaluate((n) => n.validity.valueMissing));
      check("invalid password cannot open reason", await reason.isVisible(), false);
      await shot("password-required");
      await input.fill("short");
      await pwConfirm.click();
      check("short password native invalid", await input.evaluate((n) => n.validity.tooShort));
      await shot("password-short");
      await input.fill(password);
      await shot("password-valid");
      await pwCancel.focus();
      await shot("password-cancel-focus");
      await page.keyboard.press("Escape");
      await pw.waitFor({ state: "hidden" });
      check("password Escape returns detail trigger", await focusIs(trigger));
      await open();
      check("password reopen clears field", await input.inputValue(), "");
      await input.fill(password);
      await pwCancel.focus();
      await page.keyboard.press("Tab");
      check("confirm follows cancel", await focusIs(pwConfirm));
      await shot("password-confirm-focus");
      await pwConfirm.hover();
      await shot("password-confirm-hover");
      await page.mouse.down();
      check("password native pressed", await pwConfirm.evaluate((n) => n.matches(":active")));
      await shot("password-confirm-pressed");
      await page.mouse.up();
      await reason.waitFor();
      check("first confirmation sends no write", postCount(), 0);
      check("password remains open beneath reason", await pw.evaluate((n) => n.open));
      check(
        "reason title preserves full impact",
        await reason.locator("h3").innerText(),
        "强制重置密码并撤销全部会话",
      );
      check(
        "reason native field contract",
        await field.evaluate((n) => ({ required: n.required, min: n.minLength, max: n.maxLength })),
        { required: true, min: 2, max: 300 },
      );
      check("reason original default", await field.inputValue(), "平台管理员人工操作");
      check(
        "reason controls 44px and16px",
        await reason.locator("textarea,button").evaluateAll((ns) =>
          ns.every((n) => {
            const r = n.getBoundingClientRect();
            return (
              r.width >= 44 && r.height >= 44 && parseFloat(getComputedStyle(n).fontSize) >= 16
            );
          }),
        ),
      );
      await shot("reason-default", reason);
      check(
        "final confirmation has distinct risk color",
        await reasonConfirm.evaluate((n) => getComputedStyle(n).backgroundColor),
        "rgb(163, 41, 52)",
      );
      await reasonCancel.click();
      await reason.waitFor({ state: "hidden" });
      check("reason cancel returns password confirm", await focusIs(pwConfirm));
      check("reason cancel retains password", await input.inputValue(), password);
      await shot("password-after-reason-cancel");
      await pwConfirm.click();
      await reason.waitFor();
      await field.focus();
      await shot("reason-focus", reason);
      await field.fill("");
      await reasonConfirm.click();
      check("reason empty invalid", await field.evaluate((n) => n.validity.valueMissing));
      await shot("reason-required", reason);
      await field.fill("短");
      await reasonConfirm.click();
      check("reason short invalid", await field.evaluate((n) => n.validity.tooShort));
      check("all invalid confirmation writes blocked", postCount(), 0);
      await shot("reason-short", reason);
      await field.fill(why);
      await shot("reason-valid", reason);
      await reasonCancel.focus();
      await shot("reason-cancel-focus", reason);
      await page.keyboard.press("Tab");
      check("reason confirm follows cancel", await focusIs(reasonConfirm));
      await shot("reason-confirm-focus", reason);
      await reasonConfirm.hover();
      await shot("reason-confirm-hover", reason);
      await page.mouse.down();
      check("reason native pressed", await reasonConfirm.evaluate((n) => n.matches(":active")));
      await shot("reason-confirm-pressed", reason);
      gate = new Promise((r) => (release = r));
      await page.mouse.up();
      await reason.waitFor({ state: "hidden" });
      await page.waitForFunction(
        () =>
          document.querySelector("dialog.p43-security-sheet footer button:last-child")?.disabled,
      );
      check("reason closes before original write", await reason.evaluate((n) => n.open), false);
      check("one precise pending write", postCount(), 1);
      check(
        "pending password cancel and field still usable",
        (await pwCancel.isEnabled()) && (await input.isEnabled()),
      );
      await shot("password-pending");
      unhold();
      await pw.locator('[role="alert"]').waitFor();
      check("failure password retained", await input.inputValue(), password);
      check("failure remains in password dialog", await pw.isVisible());
      check("failure allows original retry", await pwConfirm.isEnabled());
      await shot("password-failure");
      if (width === 390) {
        await page.setViewportSize({ width, height: 568 });
        await shot("short-password-top");
        await shot("short-password-bottom", pw, true);
        check(
          "short password footer reachable",
          await pwConfirm.evaluate((n) => {
            const r = n.getBoundingClientRect();
            return r.top >= 0 && r.bottom <= innerHeight;
          }),
        );
        await pwConfirm.click();
        await reason.waitFor();
        await field.fill("核对账号后的人工重置原因。".repeat(20));
        await shot("short-reason-top", reason);
        await shot("short-reason-bottom", reason, true);
        check(
          "short reason footer reachable",
          await reasonConfirm.evaluate((n) => {
            const r = n.getBoundingClientRect();
            return r.top >= 0 && r.bottom <= innerHeight;
          }),
        );
        await page.keyboard.press("Escape");
        await reason.waitFor({ state: "hidden" });
        check("reason Escape returns password", await focusIs(pwConfirm));
        await page.setViewportSize({ width, height: 900 });
      }
      mode = "success";
      await pwConfirm.click();
      await reason.waitFor();
      check("retry resets default reason", await field.inputValue(), "平台管理员人工操作");
      await field.fill(why);
      await reasonConfirm.click();
      await pw.waitFor({ state: "hidden" });
      await detail.waitFor({ state: "hidden" });
      check(
        "success original parent message",
        (await page.locator(".account-message").innerText()).includes(
          "临时密码已更新，全部活动会话已撤销",
        ),
      );
      check("success all three dialogs closed", await page.locator("dialog[open]").count(), 0);
      check(
        "unchanged URL context",
        new URL(page.url()).searchParams.get("keep"),
        "password-review",
      );
      check(
        "exact fixture totals",
        requests.map((r) => r.method),
        ["GET", "GET", "POST", "POST", "GET"],
      );
      check("unexpected network", unexpected, []);
      check("browser errors", errors, []);
      observations.push({ width, requests, errors, unexpected });
      console.log("passed", width);
    } finally {
      unhold();
      await context.close();
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
    await Promise.all([...sources].sort().map(async (f) => [f, hash(await read(f))])),
  );
  if (capture) {
    await writeFile(
      output + "/evidence.json",
      JSON.stringify(
        {
          kind: "P43-PASSWORD-VUE-r1",
          approval: "pending-user-review",
          scope:
            "Actual users-route parent/detail/native password and shared reason; scripts and native controls preserved, review-only template/CSS. Original GET fixture and explicit password POST failure/success intercepted locally. Not target ownership, password clearing, reactivation semantics, real RBAC/SQL/audit/MFA, full App/KeepAlive or complete accessibility/production acceptance.",
          sourceHashes,
          transformedHashes: Object.fromEntries(
            Object.entries(transformed).map(([f, v]) => [f, hash(v)]),
          ),
          checks,
          screenshots,
          observations,
          processesClosed: true,
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      output + "/index.html",
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P43 改密两步组合</title><style>body{font:16px/1.6 "Microsoft YaHei",sans-serif;background:#edf1f6;color:#202c3d;margin:24px}article{background:white;padding:20px;margin:24px 0}img{max-width:100%}</style><h1>P43 改密与操作原因 · 待审核</h1><p>实际Vue与拦截样例。未重置真实账号；不代表归属、权限、完整无障碍或生产验收。</p>' +
        screenshots
          .map(
            (s) =>
              "<article><h2>" +
              s.width +
              "px · " +
              s.state +
              '</h2><img loading="lazy" src="' +
              s.file +
              '" alt="' +
              s.state +
              '"></article>',
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({ checks: checks.length, images: screenshots.length, sources: sources.size }),
  );
} finally {
  await browser?.close();
  await server.close();
}
