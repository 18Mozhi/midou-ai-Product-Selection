import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";
import { adminPageAssemblyPreview } from "./lib/ui-phase2-admin-page-assembly-preview.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p44-page-assembly-vue-preview";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const parent = "apps/web/src/components/PlatformAccountCenter.vue";
const detailFile = "apps/web/src/components/PlatformUserDetailDialog.vue";
const style = "design-plans/ui-phase-2-2026-09-07/implementation/admin-page-preview.css";
const roleStyle = "design-plans/ui-phase-2-2026-09-07/implementation/admin-comparison-preview.css";
const assemblyStyle =
  "design-plans/ui-phase-2-2026-09-07/implementation/admin-page-assembly-preview.css";
const sharedStyle = "design-plans/ui-phase-2-2026-09-07/implementation/user-page-preview.css";
const originals = { [parent]: await read(parent), [detailFile]: await read(detailFile) };
const transformed = {
  [parent]: adminPageAssemblyPreview(originals[parent], "parent"),
  [detailFile]: adminPageAssemblyPreview(originals[detailFile], "detail"),
};
const fixtureFile = "tests/e2e/m06-01-platform-accounts.spec.ts";
const ast = ts.createSourceFile(fixtureFile, await read(fixtureFile), ts.ScriptTarget.Latest, true);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((n) => [...n.declarationList.declarations]);
const code = ["user", "org", "session", "overview", "platformRoles"]
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
  JSON.stringify(
    vm.runInNewContext(`${code}\n({overview,platformRoles,detail:${details[0].getText(ast)}})`),
  ),
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
  sharedStyle,
  roleStyle,
  assemblyStyle,
  "scripts/lib/ui-phase2-admin-page-assembly-preview.mjs",
  "scripts/lib/ui-phase2-user-page-preview.mjs",
  fixtureFile,
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "scripts/lib/ui-phase2-admin-page-preview.mjs",
  "scripts/verify-ui-phase2-admin-page-assembly-preview.mjs",
]);
const entry = "/__p44_review.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import Parent from '/src/components/PlatformAccountCenter.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
import '/@fs/${path.resolve(sharedStyle).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(style).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(roleStyle).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(assemblyStyle).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p43-page-preview','p44-page-preview','p44-role-review','p44-assembled');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
window.__go=(query)=>router.push({path:'/platform-admin/admins',query});
const app=createApp({render:()=>h('main',[h('p',{class:'preview-disclaimer'},'P44 / C方向审核 · 实际Vue + 测试数据 · 未上线'),h(Parent,{apiBaseUrl:'/api/v1',initialTab:'admins',routePath:'/platform-admin/admins'})])}).use(router);await router.isReady();app.mount('#app');`;
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
      name: "p44-review",
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
          if (req.url?.split("?")[0] !== "/platform-admin/admins") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P44 管理员管理审核</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
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
  const origin = "http://127.0.0.1:" + port;
  console.log("p44_review_host " + origin);
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
    let accountStatus = 200,
      roleStatus = 200,
      variant = "normal",
      release,
      gate;
    const check = (name, actual, expected = true) => {
      assert.deepEqual(actual, expected, width + ":" + name);
      checks.push({ width, name, actual });
    };
    const hold = () => {
      gate = new Promise((resolve) => (release = resolve));
    };
    const unhold = () => {
      release?.();
      gate = undefined;
    };
    try {
      await page.clock.install({ time: new Date("2026-09-11T04:00:00Z") });
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
            : url.pathname === "/api/v1/platform/roles"
              ? "roles"
              : url.pathname === "/api/v1/platform/accounts/users/" + fixture.detail.user.id
                ? "detail"
                : null;
        if (!target || req.method() !== "GET") {
          unexpected.push(req.method() + " " + url.pathname);
          return route.abort();
        }
        const status =
          target === "accounts" ? accountStatus : target === "roles" ? roleStatus : 200;
        requests.push({
          target,
          path: url.pathname,
          method: req.method(),
          query: Object.fromEntries(url.searchParams),
          status,
          variant,
        });
        let response = structuredClone(
          target === "accounts"
            ? fixture.overview
            : target === "roles"
              ? fixture.platformRoles
              : fixture.detail,
        );
        if (target === "accounts") {
          // Explicit no-role sample from the existing user fixture. Global counts are untouched.
          const u = fixture.overview.users[0];
          response.admins.push({
            id: u.id,
            email: u.email,
            status: u.status,
            roles: [],
            granted_at: null,
          });
          if (variant === "long") {
            response.admins[0].email =
              "platform.account.administration.".repeat(4) + "@example.test";
            response.admins[0].roles = fixture.platformRoles.map((r) => r.code);
          }
          if (variant === "empty") response.admins = [];
          const query = url.searchParams.get("query");
          if (query) response.admins = response.admins.filter((u) => u.email.includes(query));
          const filterStatus = url.searchParams.get("status");
          if (filterStatus)
            response.admins = response.admins.filter((u) => u.status === filterStatus);
          if (gate) await gate;
        }
        if (target === "roles" && variant === "roles-empty") response = [];
        await route.fulfill(
          status === 200
            ? { json: { data: response, request_id: "p44-fixture", trace_id: "p44-fixture" } }
            : {
                status,
                json: {
                  error: {
                    code: "p44_read_error",
                    message: "读取暂未完成",
                    action_hint: "请稍后重新读取。",
                  },
                  request_id: "p44-error",
                  trace_id: "p44-error",
                },
              },
        );
      });
      const rows = () =>
        width <= 760
          ? page.locator(".account-table-wrap .responsive-data-view__mobile article")
          : page.locator(".account-table-wrap tbody tr");
      const ready = () =>
        page.waitForFunction(
          () =>
            !document.querySelector(".account-hero .hero-actions button:last-child")?.disabled &&
            !!document.querySelector(".account-table-wrap,.account-empty"),
        );
      const shot = async (state, focus) => {
        if (focus) await page.locator(focus).scrollIntoViewIfNeeded();
        else await page.evaluate(() => scrollTo(0, 0));
        if (state === "directory")
          await page
            .locator(".p43-directory-heading")
            .evaluate((node) =>
              window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY - 24),
            );
        await page.evaluate(() => document.fonts.ready);
        check(
          state + ":page fits",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        check(
          state + ":dialogs fit",
          await page
            .locator('dialog[open],[role="dialog"]:visible')
            .evaluateAll((nodes) => nodes.every((n) => n.scrollWidth <= n.clientWidth + 1)),
        );
        if (capture) {
          const file = width + "-" + state + ".png";
          await page.screenshot({
            path: output + "/" + file,
            fullPage: !focus,
            animations: "disabled",
          });
          screenshots.push({
            file,
            width,
            state,
            sha256: hash(await readFile(output + "/" + file)),
          });
        }
      };
      const filter = page.locator("form.account-filter");
      const showFilters = async () => {
        if (width <= 760) await page.locator(".responsive-filter-drawer__trigger").click();
      };
      const refresh = async () => {
        await page
          .locator(".account-hero")
          .getByRole("button", { name: "刷新数据", exact: true })
          .click();
        await ready();
      };
      hold();
      await page.goto(origin + "/platform-admin/admins?keep=p44");
      await page.getByText("正在读取真实组织与用户…", { exact: true }).waitFor();
      await shot("loading");
      unhold();
      await ready();
      check("authorizable accounts include no-role user", await rows().count(), 2);
      check(
        "global administrators from summary",
        await page.locator(".account-metrics article").last().locator("strong").innerText(),
        "2",
      );
      check(
        "no-role text explicit",
        await rows()
          .filter({ hasText: "buyer@example.test" })
          .innerText()
          .then((s) => s.includes("尚未授予平台角色")),
      );
      check(
        "current navigation",
        await page.locator('.account-tabs a[aria-current="page"]').getAttribute("href"),
        "/platform-admin/admins",
      );
      const composition = await page.evaluate(() => {
        const context = document.querySelector(".p43-context").getBoundingClientRect();
        const directory = document.querySelector(".p43-directory").getBoundingClientRect();
        const style = getComputedStyle(document.querySelector(".role-comparison > header"));
        return {
          contextX: context.x,
          contextBottom: context.bottom,
          directoryX: directory.x,
          directoryTop: directory.top,
          headerBackground: style.backgroundColor,
          background: getComputedStyle(document.body).backgroundColor,
        };
      });
      check("assembly blue comparison header", composition.headerBackground, "rgb(41, 76, 175)");
      check("assembly neutral page background", composition.background, "rgb(238, 242, 247)");
      check(
        "assembly context placement",
        width <= 1200
          ? composition.contextBottom <= composition.directoryTop
          : composition.contextX < composition.directoryX,
      );
      await shot("default");
      await shot("default-top", ".account-hero");
      await shot("directory", ".p43-directory-heading");
      const comp = page.locator(".role-comparison"),
        matrix = comp.locator(".role-comparison__matrix article");
      check("initial comparison six differences", await matrix.count(), 6);
      const beforeCompare = requests.length,
        beforeUrl = page.url();
      await comp
        .getByRole("combobox", { name: "右侧角色", exact: true })
        .selectOption("platform_operations_admin");
      check("same role has zero differences", await matrix.count(), 0);
      await shot("comparison-zero", ".role-comparison");
      await comp.getByRole("checkbox", { name: "只看差异", exact: true }).uncheck();
      check("same role show-all has three capabilities", await matrix.count(), 3);
      await shot("comparison-all", ".role-comparison");
      await comp.getByRole("textbox", { name: "搜索权限", exact: true }).fill("不存在的权限");
      check("comparison search no result", await matrix.count(), 0);
      await shot("comparison-search-empty", ".role-comparison");
      await comp.getByRole("button", { name: "重置", exact: true }).click();
      check("comparison resets six differences", await matrix.count(), 6);
      check("comparison changes no URL", page.url(), beforeUrl);
      check("comparison changes no request", requests.length, beforeCompare);
      await showFilters();
      await filter.getByRole("textbox", { name: /^账号邮箱/ }).focus();
      await shot(
        "filters",
        width <= 760 ? ".responsive-filter-drawer__sheet" : "form.account-filter",
      );
      await filter.locator("input").fill("buyer");
      await filter.getByRole("button", { name: "搜索", exact: true }).click();
      await ready();
      check("email filter one no-role user", await rows().count(), 1);
      check("email query exact", requests.filter((r) => r.target === "accounts").at(-1).query, {
        query: "buyer",
      });
      check("unrelated query retained", new URL(page.url()).searchParams.get("keep"), "p44");
      check(
        "global count not filtered count",
        await page.locator(".account-metrics article").last().locator("strong").innerText(),
        "2",
      );
      await shot("filtered-no-role");
      await showFilters();
      await filter.locator("select").selectOption("disabled");
      await filter.getByRole("button", { name: "搜索", exact: true }).click();
      await ready();
      check(
        "status and email exact",
        requests.filter((r) => r.target === "accounts").at(-1).query,
        { query: "buyer", status: "disabled" },
      );
      check("filtered empty no records", await rows().count(), 0);
      await shot("filtered-empty");
      await page
        .locator(".account-empty")
        .getByRole("button", { name: "清除筛选", exact: true })
        .click();
      await ready();
      check(
        "empty reset both query fields",
        requests.filter((r) => r.target === "accounts").at(-1).query,
        {},
      );
      check("reset restores two accounts", await rows().count(), 2);
      const record = rows().filter({ hasText: "buyer@example.test" });
      if (width <= 760) {
        await record.getByRole("button").click();
        const drawer = page.locator(".responsive-data-view__drawer");
        await shot("mobile-preview", ".responsive-data-view__drawer");
        await drawer.locator("summary").click();
        check(
          "preview exact user ID",
          await drawer
            .locator("details")
            .innerText()
            .then((s) => s.includes(fixture.detail.user.id)),
        );
        await shot("mobile-technical", ".responsive-data-view__drawer details");
        await drawer.getByRole("button", { name: "打开账号详情", exact: true }).click();
      } else await record.getByRole("button", { name: "账号详情", exact: true }).click();
      const dialog = page.locator("dialog.p43-user-detail[open]");
      await dialog.locator(".detail-grid").waitFor();
      check(
        "detail actual user identity",
        await dialog.locator("h3").innerText(),
        fixture.detail.user.email,
      );
      check("detail remains native modal", await dialog.evaluate((n) => n.matches(":modal")));
      await shot("detail-entry", "dialog.p43-user-detail[open] > section > header");
      await page.keyboard.press("Escape");
      check(
        "detail closes without route change",
        new URL(page.url()).pathname,
        "/platform-admin/admins",
      );
      const beforeCreate = requests.length;
      await page
        .locator(".account-hero")
        .getByRole("button", { name: "新建管理员", exact: true })
        .click();
      const create = page.locator("dialog[open]");
      await create.waitFor();
      check(
        "admin creation defaults operations role",
        await create.locator("select").first().inputValue(),
        "platform_operations_admin",
      );
      await page.keyboard.press("Escape");
      check("creation cancel no request", requests.length, beforeCreate);
      variant = "long";
      await refresh();
      await shot("long-multiple-roles");
      roleStatus = 500;
      await refresh();
      check("role failure retains accounts", await rows().count(), 2);
      check("role failure retains old comparison", await matrix.count(), 6);
      check(
        "role failure notice visible",
        await page
          .locator(".account-message")
          .innerText()
          .then((s) => s.includes("账号记录仍可继续使用")),
      );
      check(
        "old matrix notice not separately exposed",
        await page.getByText("已保留上次成功读取的权限矩阵。", { exact: false }).count(),
        0,
      );
      await shot("roles-refresh-error", ".p44-comparison");
      accountStatus = 500;
      await refresh();
      check("account failure retains records", await rows().count(), 2);
      await shot("accounts-refresh-error");
      await page.goto(origin + "/platform-admin/admins");
      await page.getByText("暂时无法读取。", { exact: false }).waitFor();
      check(
        "first account failure hides directory",
        await page.locator(".account-table-wrap").count(),
        0,
      );
      await shot("accounts-first-error");
      accountStatus = 200;
      roleStatus = 200;
      variant = "empty";
      await page.getByRole("button", { name: "重新加载", exact: true }).click();
      await ready();
      check(
        "unfiltered empty title",
        await page.getByText("还没有可授权账号", { exact: true }).isVisible(),
      );
      await shot("no-accounts");
      variant = "roles-empty";
      await refresh();
      check("empty role directory keeps accounts", await rows().count(), 2);
      check("empty role directory hides comparison", await comp.count(), 0);
      await shot("no-role-directory");
      check("no unexpected traffic", unexpected, []);
      check("no browser errors", errors, []);
      check(
        "all requests GET",
        requests.every((r) => r.method === "GET"),
      );
      observations.push({ width, requests, unexpected, errors });
      console.log("passed " + width);
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
      output + "/evidence.json",
      JSON.stringify(
        {
          kind: "P44-PAGE-ASSEMBLY-VUE-PREVIEW-r2",
          approval: "pending-user-review",
          scope:
            "Current production Vue scripts with review-only parent/detail composition and assembled C CSS. Current mobile heading appears once in the review directory. " +
            "Original overview and roles plus explicit no-role row derived from the original user, and synthetic long/empty variants; global summary untouched. GET-only intercepted API, no real accounts or authorization. " +
            "Comparison visuals assembled, original old matrix after role failure remains without explicit stale-matrix notice. Creation default/cancel only; no full App/NavigationShell/KeepAlive, write, database, theme/density or whole-page acceptance. All new composition images pending review; earlier scoped approvals remain separate.",
          sourceHashes,
          transformedHashes: Object.fromEntries(
            Object.entries(transformed).map(([f, s]) => [f, hash(s)]),
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
    const gallery =
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P44 页面主体整页审核 r2</title><style>body{font:16px/1.6 "Microsoft YaHei",sans-serif;background:#eef2f7;color:#142a46;margin:24px}article{margin:24px 0;padding:20px;background:white}img{max-width:100%;height:auto}nav{display:flex;gap:12px;flex-wrap:wrap}</style><h1>P44 可授权账号目录 · 实际Vue C审核</h1><p>测试数据，未上线，待用户审核。详情及比较仅证明入口组合，不代表所有子区域C设计或权限通过。</p><nav>' +
      [390, 760, 761, 1440].map((w) => '<a href="#' + w + '-default">' + w + "px</a>").join("") +
      "</nav>" +
      screenshots
        .map(
          (s) =>
            '<article id="' +
            s.width +
            "-" +
            s.state +
            '"><h2>' +
            s.width +
            "px · " +
            s.state +
            '</h2><a href="' +
            s.file +
            '"><img loading="lazy" src="' +
            s.file +
            '" alt="P44 ' +
            s.state +
            '"></a></article>',
        )
        .join("\n");
    await writeFile(output + "/index.html", gallery);
  }
  console.log(
    JSON.stringify({ checks: checks.length, images: screenshots.length, sources: sources.size }),
  );
} finally {
  await browser?.close();
  await server.close();
}
