import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";
import { adminPagePreview } from "./lib/ui-phase2-admin-page-preview.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p44-comparison-vue-preview";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const parent = "apps/web/src/components/PlatformAccountCenter.vue";
const detailFile = "apps/web/src/components/PlatformUserDetailDialog.vue";
const style = "design-plans/ui-phase-2-2026-09-07/implementation/admin-page-preview.css";
const sharedStyle = "design-plans/ui-phase-2-2026-09-07/implementation/user-page-preview.css";
const roleStyle = "design-plans/ui-phase-2-2026-09-07/implementation/admin-comparison-preview.css";
const originals = { [parent]: await read(parent), [detailFile]: await read(detailFile) };
const transformed = {
  [parent]: adminPagePreview(originals[parent], "parent"),
  [detailFile]: adminPagePreview(originals[detailFile], "detail"),
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
  "scripts/lib/ui-phase2-user-page-preview.mjs",
  fixtureFile,
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "scripts/lib/ui-phase2-admin-page-preview.mjs",
  "scripts/verify-ui-phase2-admin-comparison-preview.mjs",
]);
const entry = "/__p44_review.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import Parent from '/src/components/PlatformAccountCenter.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
import '/@fs/${path.resolve(sharedStyle).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(style).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(roleStyle).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p43-page-preview','p44-page-preview','p44-role-review');
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
  console.log("p44_comparison_host " + origin);
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
      unexpected = [],
      errors = [];
    const check = (name, actual, expected = true) => {
      assert.deepEqual(actual, expected, width + ":" + name);
      checks.push({ width, name, actual });
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
              : null;
        if (!target || req.method() !== "GET") {
          unexpected.push(req.method() + " " + url.pathname);
          return route.abort();
        }
        requests.push({ target, path: url.pathname, method: req.method() });
        const data = structuredClone(target === "roles" ? fixture.platformRoles : fixture.overview);
        if (target === "accounts") {
          const u = fixture.overview.users[0];
          data.admins.push({
            id: u.id,
            email: u.email,
            status: u.status,
            roles: [],
            granted_at: null,
          });
        }
        await route.fulfill({
          json: { data, request_id: "p44-comparison-fixture", trace_id: "p44-comparison-fixture" },
        });
      });
      await page.goto(origin + "/platform-admin/admins?keep=p44");
      const comp = page.locator(".role-comparison"),
        matrix = comp.locator(".role-comparison__matrix article");
      await matrix.first().waitFor();
      await page.waitForFunction(
        () => !document.querySelector(".account-hero .hero-actions button:last-child")?.disabled,
      );
      const baselineUrl = page.url();
      const shot = async (state, focus = ".role-comparison") => {
        await page
          .locator(focus)
          .evaluate((n) => window.scrollTo(0, n.getBoundingClientRect().top + window.scrollY - 24));
        await page.evaluate(() => document.fonts.ready);
        check(
          state + ":page fits",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        check(
          state + ":comparison fits",
          await comp.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
        );
        if (capture) {
          const file = width + "-" + state + ".png";
          await page.screenshot({ path: output + "/" + file, animations: "disabled" });
          screenshots.push({
            width,
            state,
            file,
            sha256: hash(await readFile(output + "/" + file)),
          });
        }
      };
      check("default six capabilities", await matrix.count(), 6);
      check(
        "blue header white heading",
        await comp.locator("h3").evaluate((n) => getComputedStyle(n).color),
        "rgb(255, 255, 255)",
      );
      check(
        "checkbox native size",
        await comp.getByRole("checkbox").evaluate((n) => ({
          width: n.getBoundingClientRect().width,
          height: n.getBoundingClientRect().height,
        })),
        { width: 20, height: 20 },
      );
      check(
        "checkbox target label at least44",
        await comp
          .locator(".role-comparison__toggle")
          .evaluate((n) => n.getBoundingClientRect().height >= 44),
      );
      await shot("controls-default");
      await comp.getByRole("checkbox").focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await shot("selected-focus");
      await page.keyboard.press("Tab");
      await page.waitForFunction(() => {
        const node = document.querySelector(".role-comparison__selectors select");
        return (
          node === document.activeElement &&
          node.matches(":focus-visible") &&
          getComputedStyle(node).outlineColor === "rgb(66, 118, 223)"
        );
      });
      check(
        "role focus blue",
        await comp
          .getByRole("combobox", { name: "左侧角色", exact: true })
          .evaluate((n) => getComputedStyle(n).outlineColor),
        "rgb(66, 118, 223)",
      );
      await shot("role-focus", ".role-comparison__selectors");
      await shot("permission-facts", ".role-comparison__summaries");
      await shot("matrix-first", ".role-comparison__matrix");
      check(
        "noncolor ownership text",
        await matrix.first().locator("dd[data-enabled]").allTextContents(),
        ["拥有", "无"],
      );
      await comp
        .getByRole("combobox", { name: "右侧角色", exact: true })
        .selectOption("platform_operations_admin");
      check("same role no differences", await matrix.count(), 0);
      await shot("same-role-empty", ".role-comparison__result");
      await comp.getByRole("checkbox").uncheck();
      check("show all includes three capabilities", await matrix.count(), 3);
      await shot("same-role-all", ".role-comparison__result");
      const search = comp.getByRole("textbox", { name: "搜索权限", exact: true });
      await search.fill("不存在的权限");
      check("search no results", await matrix.count(), 0);
      check("search maxlength80", await search.getAttribute("maxlength"), "80");
      await shot("search-empty", ".role-comparison__filters");
      const reset = comp.getByRole("button", { name: "重置", exact: true });
      await reset.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await shot("reset-focus", ".role-comparison__filters");
      await reset.click();
      check("reset restores six", await matrix.count(), 6);
      check("reset now disabled", await reset.isDisabled());
      // Capture settled state rather than an intermediate background transition frame.
      await page.waitForFunction(() => {
        const node = document.querySelector(".role-comparison__filters button");
        return node && getComputedStyle(node).backgroundColor === "rgb(232, 237, 244)";
      });
      check(
        "disabled neutral",
        await reset.evaluate((n) => getComputedStyle(n).backgroundColor),
        "rgb(232, 237, 244)",
      );
      await shot("reset-disabled", ".role-comparison__filters");
      await comp
        .getByRole("combobox", { name: "能力分组", exact: true })
        .selectOption({ label: "平台治理" });
      check("group two platform capabilities", await matrix.count(), 2);
      await shot("group-filter", ".role-comparison__result");
      check("comparison URL untouched", page.url(), baselineUrl);
      check("only two original GET requests", requests.length, 2);
      check("request targets", requests.map((r) => r.target).sort(), ["accounts", "roles"]);
      check("no unexpected traffic", unexpected, []);
      check("no page errors", errors, []);
      observations.push({ width, requests, errors, unexpected });
      console.log("passed " + width);
    } finally {
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
          kind: "P44-COMPARISON-VUE-r1",
          approval: "pending-user-review",
          scope:
            "Actual PlatformRoleComparison template/script unchanged; review-only CSS in actual P44 parent host. Original three-role fixture, no authority inference or real writes. Native focus/selected/disabled,6/0/3 capability states and platform group2, URL unchanged and two intercepted GETs per width. Approved directory package remains unmodified. No production import/full App/real RBAC/theme-density/full accessibility acceptance.",
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
    await writeFile(
      output + "/index.html",
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P44 角色比较 C审核</title><style>body{font:16px/1.6 "Microsoft YaHei",sans-serif;background:#eef2f7;color:#142a46;margin:24px}article{background:white;padding:20px;margin:24px 0}img{max-width:100%;height:auto}</style><h1>P44 角色比较 · 实际Vue C审核</h1><p>待用户审核，原Vue与测试样例，不代表真实权限验收。目录批准不扩展至此。</p>' +
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
