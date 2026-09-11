import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";
import { userPagePreview } from "./lib/ui-phase2-user-page-preview.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p43-page-vue-preview";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const parent = "apps/web/src/components/PlatformAccountCenter.vue";
const detailFile = "apps/web/src/components/PlatformUserDetailDialog.vue";
const style = "design-plans/ui-phase-2-2026-09-07/implementation/user-page-preview.css";
const originals = { [parent]: await read(parent), [detailFile]: await read(detailFile) };
const transformed = {
  [parent]: userPagePreview(originals[parent], "parent"),
  [detailFile]: userPagePreview(originals[detailFile], "detail"),
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
  fixtureFile,
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "scripts/lib/ui-phase2-user-page-preview.mjs",
  "scripts/verify-ui-phase2-user-page-preview.mjs",
]);
const entry = "/__p43_review.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import Parent from '/src/components/PlatformAccountCenter.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
import '/@fs/${path.resolve(style).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p43-page-preview');
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
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`p43_review_host ${origin}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const requests = [],
      errors = [],
      unexpected = [];
    let variant = "original",
      accountStatus = 200,
      detailStatus = 200,
      release,
      gate,
      holdTarget;
    const hold = (target) => {
      holdTarget = target;
      gate = new Promise((resolve) => (release = resolve));
    };
    const unhold = () => {
      release?.();
      gate = undefined;
      holdTarget = undefined;
    };
    const check = (name, actual, expected = true) => {
      assert.deepEqual(actual, expected, `${width}:${name}`);
      checks.push({ width, name, actual });
    };
    try {
      // Vue capture/bubble listeners use Date.now() for event attachment ownership.
      // A frozen Date.now() drops the form listener after the drawer capture handler.
      await page.clock.install({ time: new Date("2026-09-11T02:00:00Z") });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== origin) {
          unexpected.push(req.url());
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        const target =
          url.pathname === "/api/v1/platform/accounts"
            ? "accounts"
            : url.pathname === `/api/v1/platform/accounts/users/${fixture.detail.user.id}`
              ? "detail"
              : null;
        if (!target || req.method() !== "GET") {
          unexpected.push(`${req.method()} ${url.pathname}`);
          return route.abort();
        }
        const status = target === "accounts" ? accountStatus : detailStatus;
        requests.push({
          target,
          path: url.pathname,
          method: req.method(),
          query: Object.fromEntries(url.searchParams),
          variant,
          status,
        });
        const response = structuredClone(target === "accounts" ? fixture.overview : fixture.detail);
        if (target === "accounts") {
          if (variant === "long") {
            response.users[0].email = "procurement.coordinate.team.".repeat(4) + "@example.test";
            response.users[0].organization_names = "跨境选品与采购研究组织".repeat(5);
            response.users[0].platform_roles = [
              "platform_operations_admin",
              "platform_security_admin",
            ];
          }
          if (variant === "disabled") response.users[0].status = "disabled";
          if (url.searchParams.get("query") === "missing@example.test") response.users = [];
          if (url.searchParams.get("status"))
            response.users = response.users.filter(
              (u) => u.status === url.searchParams.get("status"),
            );
        } else if (variant === "disabled") {
          response.user.status = "disabled";
          response.memberships = [];
          response.sessions = [];
        }
        if (holdTarget === target && gate) await gate;
        await route.fulfill(
          status === 200
            ? { json: { data: response, request_id: "p43-synthetic", trace_id: "p43-synthetic" } }
            : {
                status,
                json: {
                  error: {
                    code: "p43_fixture_read_error",
                    message: "读取暂未完成",
                    action_hint: "请稍后重新读取。",
                  },
                  request_id: "p43-fixture-error",
                  trace_id: "p43-fixture-error",
                },
              },
        );
      });
      const rows = () =>
        width <= 760
          ? page.locator(".responsive-data-view__mobile article")
          : page.locator(".account-table-wrap tbody tr");
      const waitReady = () =>
        page.waitForFunction(
          () =>
            !!document.querySelector(".account-table-wrap") &&
            !document.querySelector(".account-hero .hero-actions button:last-child")?.disabled,
        );
      const shot = async (state, focus) => {
        if (focus) await page.locator(focus).scrollIntoViewIfNeeded();
        else await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate(() => document.fonts.ready);
        check(
          `${state}:no horizontal overflow`,
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        check(
          `${state}:visible dialogs fit width`,
          await page
            .locator('dialog[open],[role="dialog"]:visible')
            .evaluateAll((nodes) => nodes.every((n) => n.scrollWidth <= n.clientWidth + 1)),
        );
        if (capture) {
          const file = `${width}-${state}.png`;
          await page.screenshot({
            path: `${output}/${file}`,
            fullPage: !focus,
            animations: "disabled",
          });
          screenshots.push({
            file,
            width,
            state,
            sha256: hash(await readFile(`${output}/${file}`)),
          });
        }
      };
      const showFilters = async () => {
        if (width <= 760) await page.locator(".responsive-filter-drawer__trigger").click();
      };
      const userDialog = () => page.locator("dialog.p43-user-detail[open]");
      const openDetail = async (previewShots = false) => {
        if (width <= 760) {
          await rows().first().getByRole("button").click();
          const drawer = page.locator(".responsive-data-view__drawer");
          if (previewShots) {
            await shot("mobile-preview", ".responsive-data-view__drawer");
            await drawer.locator("summary").click();
            check(
              "preview ID exact",
              await drawer
                .locator("details")
                .innerText()
                .then((s) => s.includes(fixture.detail.user.id)),
            );
            await shot("mobile-technical", ".responsive-data-view__drawer details");
          }
          await drawer.getByRole("button", { name: "打开账号详情", exact: true }).click();
        } else await rows().first().getByRole("button", { name: "账号详情", exact: true }).click();
      };
      hold("accounts");
      await page.goto(origin + "/platform-admin/users?keep=p43");
      await page.getByText("正在读取真实组织与用户…", { exact: true }).waitFor();
      await shot("loading");
      unhold();
      await waitReady();
      check("original fixture row count", await rows().count(), 1);
      check(
        "ready search enabled",
        await page.locator("form.account-filter button").first().isEnabled(),
      );
      check(
        "global summary not row total",
        await page
          .locator(".account-metrics")
          .innerText()
          .then((s) => s.includes("16 / 18")),
      );
      check(
        "users current navigation",
        await page.locator('.account-tabs a[aria-current="page"]').getAttribute("href"),
        "/platform-admin/users",
      );
      await shot("default");
      await showFilters();
      const filter = page.locator("form.account-filter");
      await filter.locator("input").focus();
      await shot(
        "filters",
        width <= 760 ? ".responsive-filter-drawer__sheet" : "form.account-filter",
      );
      await filter.locator("input").fill("missing@example.test");
      await filter.getByRole("button", { name: "搜索", exact: true }).click();
      await page.waitForFunction(
        () => new URL(location.href).searchParams.get("query") === "missing@example.test",
      );
      await waitReady();
      check("search parameters", requests.at(-1).query, { query: "missing@example.test" });
      check("unrelated URL retained", new URL(page.url()).searchParams.get("keep"), "p43");
      check("empty has zero records", await rows().count(), 0);
      await shot("empty");
      await showFilters();
      await filter.getByRole("button", { name: "重置", exact: true }).click();
      // Reset is type=button and does not submit/close the original drawer.
      // Its disabled state can lose keyboard focus; use the actual visible close entry.
      if (width <= 760)
        await page
          .locator(".responsive-filter-drawer__sheet > header")
          .getByRole("button", { name: "关闭筛选条件", exact: true })
          .click();
      await waitReady();
      check("reset query", requests.at(-1).query, {});
      check("reset record", await rows().count(), 1);
      hold("detail");
      await openDetail(true);
      await userDialog().getByText("正在读取账号详情…", { exact: true }).waitFor();
      await shot("detail-loading", "dialog.p43-user-detail[open]");
      unhold();
      await userDialog().locator(".detail-grid").waitFor();
      check(
        "detail is native modal",
        await userDialog().evaluate((node) => node.matches(":modal")),
      );
      check(
        "identity readable on blue",
        await userDialog()
          .locator("h3")
          .evaluate((node) => getComputedStyle(node).color),
        "rgb(255, 255, 255)",
      );
      check(
        "close readable on blue",
        await userDialog()
          .getByRole("button", { name: "关闭账号详情", exact: true })
          .evaluate((node) => ({
            color: getComputedStyle(node).color,
            background: getComputedStyle(node).backgroundColor,
          })),
        { color: "rgb(255, 255, 255)", background: "rgba(0, 0, 0, 0)" },
      );
      check(
        "detail exact email",
        await userDialog().locator("h3").innerText(),
        fixture.detail.user.email,
      );
      check(
        "detail organizations preserved",
        await userDialog().locator(".p43-memberships li").count(),
        fixture.detail.memberships.length,
      );
      check(
        "detail sessions preserved",
        await userDialog().locator(".p43-sessions li").count(),
        fixture.detail.sessions.length,
      );
      check(
        "three fixed role actions",
        await userDialog().locator(".role-actions button").count(),
        3,
      );
      await shot("detail-top", "dialog.p43-user-detail[open] > section > header");
      const membership = userDialog().locator(".p43-memberships form");
      check(
        "five organization roles",
        await membership
          .getByRole("combobox", { name: "组织角色", exact: true })
          .locator("option")
          .count(),
        5,
      );
      check(
        "original missing membership ID is not corrected",
        await membership
          .getByRole("combobox", { name: "加入组织", exact: true })
          .locator("option")
          .count(),
        1,
      );
      const why = membership.getByRole("textbox", { name: "授权原因", exact: true });
      await why.fill("核对账号组织关系");
      check(
        "membership native constraints",
        await why.evaluate((node) => ({
          min: node.minLength,
          max: node.maxLength,
          required: node.required,
        })),
        { min: 2, max: 300, required: true },
      );
      await shot("membership-fields", ".p43-memberships form");
      await shot("access-sections", ".p43-platform-roles");
      await shot("access-actions", "dialog.p43-user-detail[open] footer");
      const beforeReason = requests.length;
      await userDialog().getByRole("button", { name: "停用登录", exact: true }).click();
      await page.getByRole("dialog", { name: "停用用户并撤销会话", exact: true }).waitFor();
      await shot("status-reason-original", 'dialog[aria-label="停用用户并撤销会话"]');
      await page.keyboard.press("Escape");
      check("reason cancel retains detail", await userDialog().isVisible());
      check("reason cancel no HTTP", requests.length, beforeReason);
      await userDialog().getByRole("button", { name: "关闭账号详情", exact: true }).click();
      check("detail closed", await userDialog().count(), 0);
      detailStatus = 500;
      await openDetail();
      await userDialog().getByText("账号详情暂时无法读取", { exact: true }).waitFor();
      await shot("detail-error", "dialog.p43-user-detail[open]");
      detailStatus = 200;
      await userDialog().getByRole("button", { name: "重试", exact: true }).click();
      await userDialog().locator(".detail-grid").waitFor();
      check(
        "detail retry restores identity",
        await userDialog().locator("h3").innerText(),
        fixture.detail.user.email,
      );
      await page.keyboard.press("Escape");
      variant = "disabled";
      await page
        .locator(".account-hero")
        .getByRole("button", { name: "刷新数据", exact: true })
        .click();
      await waitReady();
      await openDetail();
      await userDialog().locator(".detail-grid").waitFor();
      check(
        "disabled membership action disabled",
        await userDialog().getByRole("button", { name: "加入组织", exact: true }).isDisabled(),
      );
      check(
        "disabled all role actions disabled",
        await userDialog().locator(".role-actions button:disabled").count(),
        3,
      );
      check(
        "disabled role neutral",
        await userDialog()
          .locator(".role-actions button")
          .first()
          .evaluate((node) => getComputedStyle(node).color),
        "rgb(102, 116, 138)",
      );
      check(
        "empty detail memberships",
        await userDialog().getByText("尚未加入组织。", { exact: true }).isVisible(),
      );
      check(
        "empty sessions",
        await userDialog().getByText("暂无会话。", { exact: true }).isVisible(),
      );
      await shot("disabled-detail", "dialog.p43-user-detail[open] > section > header");
      await shot("disabled-actions", "dialog.p43-user-detail[open] footer");
      await page.keyboard.press("Escape");
      variant = "long";
      await page
        .locator(".account-hero")
        .getByRole("button", { name: "刷新数据", exact: true })
        .click();
      await waitReady();
      await shot("long-record");
      accountStatus = 500;
      await page
        .locator(".account-hero")
        .getByRole("button", { name: "刷新数据", exact: true })
        .click();
      await page.getByText(/已保留上次成功读取的数据/).waitFor();
      check("refresh error keeps list", await rows().count(), 1);
      await shot("refresh-error");
      await page.goto(origin + "/platform-admin/users");
      await page.getByText("暂时无法读取。", { exact: false }).waitFor();
      check("first error has no list", await page.locator(".account-table-wrap").count(), 0);
      await shot("first-error");
      check("no unexpected API or external request", unexpected, []);
      check("zero page errors", errors, []);
      observations.push({ width, requests, unexpected, errors });
      console.log(`passed ${width}`);
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
    await Promise.all([...sources].sort().map(async (file) => [file, hash(await read(file))])),
  );
  if (capture) {
    await writeFile(
      `${output}/evidence.json`,
      JSON.stringify(
        {
          kind: "P43-PAGE-VUE-PREVIEW-r1",
          approval: "pending-user-review",
          scope:
            "Actual parent, user records, detail, membership and shared modal scripts. Review-only parent/detail template composition and scoped CSS. Original single-row fixture and explicit long/disabled clones; global summary untouched. Original detail fixture omits membership organization_id, so this is not join eligibility acceptance. GET-only fixture API; reason dialog remains original appearance, cancellation only. No full App/navigation, real accounts/permissions/writes, password clearing, role semantics or complete accessibility acceptance.",
          sourceHashes,
          transformedHashes: Object.fromEntries(
            Object.entries(transformed).map(([file, content]) => [file, hash(content)]),
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
      `${output}/index.html`,
      `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P43 实际Vue审核图</title>
<style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;background:#eef2f7;color:#142a46;margin:24px}article{margin:24px 0;padding:20px;background:white}img{max-width:100%;height:auto}nav{display:flex;gap:12px;flex-wrap:wrap}</style>
<h1>P43 用户目录与详情 · C审核</h1><p>测试数据、待用户审核。不是生产、真实权限或账号写入验收。原原因窗图仅证明取消接线，不算新C设计通过。</p>
<nav>${[390, 760, 761, 1440].map((width) => `<a href="#${width}-default">${width}px</a>`).join("")}</nav>
${screenshots.map((s) => `<article id="${s.width}-${s.state}"><h2>${s.width}px · ${s.state}</h2><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="P43 ${s.state}"></a></article>`).join("\n")}`,
    );
  }
  console.log(
    JSON.stringify({ checks: checks.length, images: screenshots.length, sources: sources.size }),
  );
} finally {
  await browser?.close();
  await server.close();
}
