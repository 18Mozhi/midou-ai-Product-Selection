import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import vm from "node:vm";
import ts from "typescript";
import { adminCreatePreview } from "./lib/ui-phase2-admin-create-preview.mjs";
import { adminPageAssemblyPreview } from "./lib/ui-phase2-admin-page-assembly-preview.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((a) => a === "--capture"));
const output = "output/playwright/p44-create-admin-preview";
const component = "apps/web/src/components/PlatformAccountCenter.vue";
const style = "design-plans/ui-phase-2-2026-09-07/implementation/user-create-preview.css";
const read = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const fixture = "tests/e2e/m06-01-platform-accounts.spec.ts";
const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((n) => [...n.declarationList.declarations]);
const fixtureCode = ["user", "org", "overview", "platformRoles"]
  .map((name) => {
    const nodes = declarations.filter((n) => n.name.getText(ast) === name);
    assert.equal(nodes.length, 1);
    return "const " + name + "=" + nodes[0].initializer.getText(ast) + ";";
  })
  .join("\n");
const data = JSON.parse(
  JSON.stringify(vm.runInNewContext(fixtureCode + "({overview,platformRoles})")),
);
const pageStyle = "design-plans/ui-phase-2-2026-09-07/implementation/user-page-preview.css";
const adminStyles = [
  "admin-page-preview.css",
  "admin-comparison-preview.css",
  "admin-page-assembly-preview.css",
].map((f) => "design-plans/ui-phase-2-2026-09-07/implementation/" + f);
const child = "apps/web/src/components/PlatformAccountDialogs.vue";
const originals = { [component]: await read(component), [child]: await read(child) };
const transformed = {
  [component]: adminPageAssemblyPreview(originals[component], "parent"),
  [child]: adminCreatePreview(originals[child]),
};
const transformedHashes = Object.fromEntries(
  Object.entries(transformed).map(([f, v]) => [f, hash(v)]),
);
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((m) => `apps/web/src/${m[1]}`);
const sources = new Set([
  component,
  ...adminStyles,
  "scripts/lib/ui-phase2-admin-page-assembly-preview.mjs",
  "scripts/lib/ui-phase2-admin-page-preview.mjs",
  "scripts/lib/ui-phase2-admin-create-preview.mjs",
  style,
  pageStyle,
  "scripts/lib/ui-phase2-user-create-preview.mjs",
  "scripts/lib/ui-phase2-user-page-preview.mjs",
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "scripts/verify-ui-phase2-admin-create-preview.mjs",
  "tests/e2e/m06-01-platform-accounts.spec.ts",
  "apps/api/src/platform-account-service.ts",
  "apps/api/src/mysql-platform-account-repository.ts",
]);
async function imports(file) {
  for (const m of (await read(file)).matchAll(/(?:from\s+|import\s*|src=)["'](\.[^"']+)["']/g)) {
    let candidate = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1]));
    if (!path.posix.extname(candidate)) candidate += ".ts";
    if (sources.has(candidate)) continue;
    sources.add(candidate);
    await imports(candidate);
  }
}
await imports(component);
const sourceHashes = Object.fromEntries(
  await Promise.all([...sources].sort().map(async (f) => [f, hash(await read(f))])),
);
const entry = "/__p44_create_preview.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';
import Current from '/src/components/PlatformAccountCenter.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
import '/@fs/${path.resolve(pageStyle).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(style).replaceAll("\\", "/")}';
${adminStyles.map((f) => `import '/@fs/${path.resolve(f).replaceAll("\\", "/")}';`).join("\n")}
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p43-user-form-review','p43-page-preview','p44-page-preview','p44-role-review','p44-assembled');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const app=createApp({render:()=>h('main',[h('p','P44 创建管理员 · 实际 Vue 逻辑 + C 创建分区 · 测试数据 · 待审'),h(Current,{apiBaseUrl:'/api/v1',initialTab:'admins',routePath:'/platform-admin/admins'})])}).use(router);await router.isReady();app.mount('#app');`;
const probe = reservePort();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {}, hmr: false },
  plugins: [
    {
      name: "p44-create-review-only",
      enforce: "pre",
      transform(source, id) {
        const file = Object.keys(originals).find(
          (f) => path.resolve(f).replaceAll("\\", "/") === id.replaceAll("\\", "/"),
        );
        if (!file) return null;
        assert.equal(source.replaceAll("\r\n", "\n"), originals[file]);
        return { code: transformed[file], map: null };
      },
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/platform-admin/admins") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P44 创建弹窗</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
          );
        });
      },
    },
  ],
});
const checks = [],
  screenshots = [],
  requestsByWidth = [];
const password = "PreviewOnly-123";
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`p44_create_host ${origin}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        requests = [],
        errors = [],
        unexpected = [];
      let mode = "error",
        held,
        release,
        extraOrg = false;
      await page.clock.install({ time: new Date("2026-09-11T02:00:00Z") });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (
          url.origin === origin &&
          url.pathname === "/api/v1/platform/accounts" &&
          req.method() === "GET"
        ) {
          requests.push({
            method: "GET",
            path: url.pathname,
            query: Object.fromEntries(url.searchParams),
          });
          const overview = structuredClone(data.overview);
          if (extraOrg)
            overview.organizations.push({
              ...overview.organizations[0],
              id: "00000000-0000-4000-8000-000000000039",
              name: "已停用的示例组织（合成）",
              status: "archived",
            });
          return route.fulfill({
            json: {
              data: overview,
              request_id: "p44-create-fixture",
              trace_id: "p44-create-fixture",
            },
          });
        }
        if (
          url.origin === origin &&
          url.pathname === "/api/v1/platform/roles" &&
          req.method() === "GET"
        ) {
          requests.push({
            method: "GET",
            path: url.pathname,
            query: Object.fromEntries(url.searchParams),
          });
          return route.fulfill({
            json: {
              data: data.platformRoles,
              request_id: "p44-roles-fixture",
              trace_id: "p44-roles-fixture",
            },
          });
        }
        if (
          url.origin === origin &&
          url.pathname === "/api/v1/platform/accounts/users" &&
          req.method() === "POST"
        ) {
          const body = req.postDataJSON();
          assert.equal(body.temporary_password, password);
          assert.deepEqual(
            Object.keys(body).sort(),
            [
              "email",
              "temporary_password",
              "platform_role_code",
              "organization_id",
              "organization_role_code",
            ].sort(),
          );
          assert.ok(req.headers()["idempotency-key"]);
          requests.push({
            method: "POST",
            path: url.pathname,
            body: { ...body, temporary_password: "[known synthetic value matched]" },
            idempotencyKeyPresent: true,
          });
          if (held) await held;
          return mode === "success"
            ? route.fulfill({
                json: {
                  data: { id: "00000000-0000-4000-8000-000000000043" },
                  request_id: "p44-create-success",
                  trace_id: "p44-create-success",
                },
              })
            : route.fulfill({
                status: 400,
                json: {
                  error: {
                    code: "review_fixture_failure",
                    message: "测试创建失败",
                    action_hint: "创建暂未完成，请稍后重试。",
                  },
                  request_id: "p44-create-error",
                  trace_id: "p44-create-error",
                },
              });
        }
        if (url.origin === origin && !url.pathname.startsWith("/api/")) return route.continue();
        unexpected.push(`${req.method()} ${url.pathname}`);
        return route.abort();
      });
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ width, name });
      };
      const visit = async () => {
        await page.goto(`${origin}/platform-admin/admins?keep=creation`);
        await page.waitForFunction(() => document.querySelector(".account-metrics"));
      };
      await visit();
      const trigger = page
        .locator(".hero-actions")
        .getByRole("button", { name: "新建管理员", exact: true });
      const dialog = page.getByRole("dialog", { name: "新建用户或平台管理员", exact: true });
      const email = dialog.getByLabel("邮箱", { exact: true }),
        secret = dialog.getByLabel("临时密码", { exact: true }),
        platform = dialog.locator("select").nth(0),
        organization = dialog.locator("select").nth(1),
        orgRole = dialog.locator("select").nth(2),
        cancel = dialog.getByRole("button", { name: "取消", exact: true }),
        confirm = dialog.getByRole("button", { name: "确认创建", exact: true });
      const open = async () => {
        await trigger.click();
        await dialog.waitFor();
        await page.evaluate(() => document.fonts.ready);
      };
      const snap = async (state, label, bottom = false) => {
        if (!/(focus|hover|pressed)/.test(state))
          await page.evaluate(() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          });
        await dialog.evaluate((n, bottom) => (n.scrollTop = bottom ? n.scrollHeight : 0), bottom);
        check(
          state + ":no horizontal overflow",
          await dialog.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
        );
        check(
          state + ":white content and blue context",
          await dialog.evaluate((n) => [
            getComputedStyle(n.querySelector(".p43-user-fields-body")).backgroundColor,
            getComputedStyle(n.querySelector(".p43-user-intro")).backgroundColor,
          ]),
          ["rgb(255, 255, 255)", "rgb(37, 74, 156)"],
        );
        if (state.endsWith("-focus")) {
          check(
            state + ":visible C keyboard outline",
            await dialog.evaluate((n) => {
              const active = document.activeElement,
                css = getComputedStyle(active);
              return (
                n.contains(active) &&
                active.matches(":focus-visible") &&
                css.outlineWidth === "3px" &&
                css.outlineStyle === "solid" &&
                css.outlineColor === "rgb(37, 74, 156)"
              );
            }),
          );
        }
        if (!capture) return;
        const bytes = await dialog.screenshot({ animations: "disabled" }),
          file = `${width}-${state}.png`;
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          label,
          state,
          bottom,
          sha256: hash(bytes),
          viewport: page.viewportSize(),
          imageDimensions: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
          kind: "vue-isolated-css",
          routeId: "P44",
          concreteUrl: page.url(),
          role: "fixture only; no real authentication",
          theme: "review-only C blue/white creation dialog",
          browser: `Chromium ${browser.version()}`,
          os: `${os.platform()} ${os.release()}`,
          capturedAt: new Date().toISOString(),
          sourceSha: hash(JSON.stringify(sourceHashes)),
        });
      };
      const postCount = () => requests.filter((r) => r.method === "POST").length;
      await open();
      check("administrator entry title", await dialog.locator("h3").innerText(), "新建平台管理员");
      check(
        "administrator entry default operations role",
        await platform.inputValue(),
        "platform_operations_admin",
      );
      check("creation remains native modal", await dialog.evaluate((n) => n.matches(":modal")));
      check(
        "native dialog initially focuses email",
        await email.evaluate((n) => n === document.activeElement),
      );
      check(
        "four fields until organization chosen",
        await dialog.locator("input,select").count(),
        4,
      );
      check(
        "original native limits and password type",
        await dialog.locator("input").evaluateAll((ns) =>
          ns.map((n) => ({
            type: n.type,
            required: n.required,
            min: n.getAttribute("minlength"),
            max: n.getAttribute("maxlength"),
          })),
        ),
        [
          { type: "email", required: true, min: null, max: "254" },
          { type: "password", required: true, min: "12", max: "128" },
        ],
      );
      check(
        "all original platform choices",
        await platform.locator("option").evaluateAll((ns) => ns.map((n) => n.value)),
        ["", "platform_operations_admin", "platform_security_admin", "platform_super_admin"],
      );
      const metrics = await dialog.locator("input,select,button").evaluateAll((ns) =>
        ns.map((n) => {
          const r = n.getBoundingClientRect(),
            s = getComputedStyle(n);
          return {
            width: r.width,
            height: r.height,
            font: parseFloat(s.fontSize),
            family: s.fontFamily,
          };
        }),
      );
      check(
        "44px controls 16px sans serif",
        metrics.every(
          (m) =>
            m.width >= 44 && m.height >= 44 && m.font >= 16 && m.family.includes("Microsoft YaHei"),
        ),
      );
      check(
        "dialog no horizontal overflow",
        await dialog.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
      );
      await email.evaluate((n) => n.blur());
      await snap("default", "运营管理员 · 默认四字段");
      await snap("default-bottom", "运营管理员 · 底部完整操作", true);
      await email.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await snap("email-focus", "邮箱 · 键盘焦点");
      await page.keyboard.press("Tab");
      check("password follows email", await secret.evaluate((n) => n === document.activeElement));
      await snap("password-focus", "临时密码 · 键盘焦点");
      await page.keyboard.press("Tab");
      check(
        "platform role follows password",
        await platform.evaluate((n) => n === document.activeElement),
      );
      await snap("platform-focus", "平台角色 · 键盘焦点", true);
      await page.keyboard.press("Tab");
      check(
        "organization follows platform role",
        await organization.evaluate((n) => n === document.activeElement),
      );
      await snap("organization-focus", "加入组织 · 键盘焦点", true);
      for (const [role, key, title] of [
        ["platform_operations_admin", "operations", "运营管理员"],
        ["platform_security_admin", "security", "安全管理员"],
        ["platform_super_admin", "super", "超级管理员"],
      ]) {
        await platform.selectOption(role);
        await platform.evaluate((n) => n.blur());
        await snap(`role-${key}`, `平台角色 · ${title}`);
      }
      check("role selection does not submit", postCount(), 0);
      await platform.selectOption("");
      await snap("role-none", "保留原选项 · 普通用户不授予平台角色");
      await platform.selectOption("platform_operations_admin");
      await organization.selectOption(data.overview.organizations[0].id);
      check(
        "conditional organization role and exact options",
        await orgRole.locator("option").evaluateAll((ns) => ns.map((n) => n.value)),
        ["member", "organization_admin"],
      );
      check("organization role defaults to member", await orgRole.inputValue(), "member");
      await snap("member", "加入组织 · 普通成员");
      await snap("member-bottom", "运营管理员与普通成员 · 完整底部操作", true);
      await organization.focus();
      await page.keyboard.press("Tab");
      check(
        "organization role follows organization",
        await orgRole.evaluate((n) => n === document.activeElement),
      );
      await snap("org-role-focus", "组织角色 · 键盘焦点", true);
      await orgRole.selectOption("organization_admin");
      await snap("org-admin", "加入组织 · 组织管理员");
      await snap("org-admin-bottom", "五字段组合 · 底部操作", true);
      await confirm.click();
      check("required empty fields block write", postCount(), 0);
      check("required validity is native", await email.evaluate((n) => n.validity.valueMissing));
      await email.blur();
      await snap("required", "原生必填无效态 · 不含系统气泡");
      await email.fill("invalid-email");
      await secret.fill(password);
      await confirm.click();
      check("invalid email blocks write", postCount(), 0);
      check("native email type mismatch", await email.evaluate((n) => n.validity.typeMismatch));
      await email.blur();
      await snap("invalid-email", "原生邮箱格式无效态 · 不含系统气泡");
      await email.fill("preview@example.test");
      await secret.fill("short");
      await confirm.click();
      check("short password blocks write", postCount(), 0);
      check("native password too short", await secret.evaluate((n) => n.validity.tooShort));
      await secret.blur();
      await snap("short-password", "原生密码不足12字符 · 不含系统气泡");
      await secret.fill(password);
      await orgRole.focus();
      await page.keyboard.press("Tab");
      check(
        "cancel follows organization role",
        await cancel.evaluate((n) => n === document.activeElement),
      );
      await snap("cancel-focus", "取消 · 键盘焦点", true);
      await page.keyboard.press("Tab");
      check("confirm follows cancel", await confirm.evaluate((n) => n === document.activeElement));
      await snap("confirm-focus", "确认创建 · 键盘焦点", true);
      await confirm.hover();
      await snap("confirm-hover", "确认创建 · 悬停", true);
      await confirm.hover();
      const box = await confirm.boundingBox();
      await page.mouse.down();
      check(
        "native pressed state and stable control",
        (await confirm.evaluate((n) => n.matches(":active"))) &&
          JSON.stringify(await confirm.boundingBox()) === JSON.stringify(box),
      );
      await snap("confirm-pressed", "确认创建 · 原生按下", true);
      held = new Promise((r) => (release = r));
      await page.mouse.up();
      await page.waitForFunction(
        () => document.querySelector("dialog[open] footer button:last-child")?.disabled,
      );
      check(
        "pending disables confirm only",
        (await confirm.isDisabled()) &&
          !(await cancel.isDisabled()) &&
          (await dialog.locator("input:disabled,select:disabled").count()) === 0,
      );
      check("pending keeps original button text", await confirm.innerText(), "确认创建");
      check(
        "exact original organization creation body",
        requests.filter((r) => r.method === "POST").at(-1).body,
        {
          email: "preview@example.test",
          temporary_password: "[known synthetic value matched]",
          platform_role_code: "platform_operations_admin",
          organization_id: data.overview.organizations[0].id,
          organization_role_code: "organization_admin",
        },
      );
      await snap("pending", "提交等待 · 确认禁用，字段和取消仍可用", true);
      release();
      held = null;
      await dialog.locator('[role="alert"]').waitFor();
      check(
        "failure keeps all five values",
        await dialog.locator("input,select").evaluateAll((ns) => ns.map((n) => n.value)),
        [
          "preview@example.test",
          password,
          "platform_operations_admin",
          data.overview.organizations[0].id,
          "organization_admin",
        ],
      );
      await snap("failure", "创建失败 · 保留字段");
      await snap("failure-bottom", "创建失败 · 重试操作", true);
      await cancel.click();
      await dialog.waitFor({ state: "hidden" });
      check(
        "cancel restores real trigger focus",
        await trigger.evaluate((n) => n === document.activeElement),
      );
      await open();
      check(
        "reopen clears identity and restores operations role",
        await dialog.locator("input,select").evaluateAll((ns) => ns.map((n) => n.value)),
        ["", "", "platform_operations_admin", ""],
      );
      await snap("reopened", "重新打开 · 清空身份并恢复运营管理员");
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      check(
        "Escape restores real trigger focus",
        await trigger.evaluate((n) => n === document.activeElement),
      );
      extraOrg = true;
      await visit();
      await open();
      check(
        "inactive synthetic org option disabled",
        await organization.locator("option:disabled").count(),
        1,
      );
      check("inactive option not selected", await organization.inputValue(), "");
      await page.keyboard.press("Escape");
      extraOrg = false;
      await visit();
      await open();
      await email.fill("preview@example.test");
      await secret.fill(password);
      mode = "success";
      await confirm.click();
      await dialog.waitFor({ state: "hidden" });
      check(
        "successful fixture closes and shows existing parent message",
        (await page.locator(".account-message").innerText()).includes("账号已创建"),
      );
      check(
        "default admin payload preserves operations and null organization without reason",
        requests.filter((r) => r.method === "POST").at(-1).body,
        {
          email: "preview@example.test",
          temporary_password: "[known synthetic value matched]",
          platform_role_code: "platform_operations_admin",
          organization_id: null,
          organization_role_code: "member",
        },
      );
      await open();
      await email.fill("preview@example.test");
      await secret.fill(password);
      await platform.selectOption("");
      await confirm.click();
      await dialog.waitFor({ state: "hidden" });
      check(
        "ordinary option preserves null platform role",
        requests.filter((r) => r.method === "POST").at(-1).body,
        {
          email: "preview@example.test",
          temporary_password: "[known synthetic value matched]",
          platform_role_code: null,
          organization_id: null,
          organization_role_code: "member",
        },
      );
      if (width === 390) {
        await page.setViewportSize({ width, height: 568 });
        await open();
        await organization.selectOption(data.overview.organizations[0].id);
        await snap("short-screen-top", "568px短屏 · 上部字段");
        await snap("short-screen-bottom", "568px短屏 · 底部可达", true);
        check(
          "short screen footer within viewport",
          await confirm.evaluate((n) => {
            const r = n.getBoundingClientRect();
            return r.top >= 0 && r.bottom <= innerHeight;
          }),
        );
        await page.keyboard.press("Escape");
      }
      check(
        "only isolated GET/POST fixture; no external requests or browser errors",
        { unexpected, errors },
        { unexpected: [], errors: [] },
      );
      requestsByWidth.push({
        width,
        requests,
        limitations:
          "No backend/RBAC/database or real account creation. Current template/CSS creation review; full app shell/history and late write ownership not re-proven by this visual replay.",
      });
    } finally {
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
        schemaVersion: 1,
        kind: "P44-CREATE-ADMIN-VUE-r1",
        approval: "pending",
        scope:
          "Actual current P44 admins-route Vue parent and child scripts with review-only template composition and CSS. Original operations default and ordinary-user option preserved, current creation ownership source included. All GET/POST intercepted with test samples. Not production C, full shell, backend validation, native popup capture, real MFA/RBAC or account creation.",
        sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        sourceHashes,
        transformedHashes,
        checks,
        requestsByWidth,
        screenshots,
        processesClosed: true,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P44 创建管理员弹窗</title><style>body{max-width:1000px;margin:24px auto;padding:20px;font-family:'Microsoft YaHei',sans-serif;background:#edf1f6;color:#202c3d}img{max-width:100%}section{margin:32px 0}p{line-height:1.6}</style><h1>P44 新建管理员 · 待审核</h1><p>原Vue逻辑与字段，仅审核模板分区和CSS；请求均拦截为测试样例，未创建真实账号。不含原生校验气泡、真实权限、整页或生产验收。</p>${screenshots.map((s) => `<section><h2>${s.viewport.width}×${s.viewport.height} · ${s.label}</h2><img src="${s.file}" alt="${s.label}"></section>`).join("\n")}`,
  );
}
console.log(
  JSON.stringify({
    checks: checks.length,
    screenshots: screenshots.length,
    output,
    processesClosed: true,
  }),
);
