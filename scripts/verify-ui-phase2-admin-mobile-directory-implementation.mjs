import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";

const capture = process.argv.includes("--capture");
const baseline = process.argv.includes("--baseline");

assert.ok(process.argv.slice(2).every((arg) => ["--capture", "--baseline"].includes(arg)));
const baselineCommit = "d9a28316";
const output =
  "output/playwright/p44-mobile-directory-implementation/" + (baseline ? "baseline" : "current");
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const parent = "apps/web/src/components/PlatformAccountCenter.vue";
const detailFile = "apps/web/src/components/PlatformUserDetailDialog.vue";
const targetFiles = [parent];
const originals = Object.fromEntries(
  await Promise.all(targetFiles.map(async (f) => [f, await read(f)])),
);
const transformed = Object.fromEntries(
  targetFiles.map((file) => [
    file,
    baseline
      ? execFileSync("git", ["show", baselineCommit + ":" + file], { encoding: "utf8" }).replaceAll(
          "\r\n",
          "\n",
        )
      : originals[file],
  ]),
);
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
  fixtureFile,
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "scripts/verify-ui-phase2-admin-mobile-directory-implementation.mjs",
]);
const entry = "/__p44_review.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import Parent from '/src/components/PlatformAccountCenter.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
document.documentElement.dataset.design='signal-ledger';
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
window.__go=(query)=>router.push({path:'/platform-admin/admins',query});
const app=createApp({render:()=>h('main',[h('p',{class:'preview-disclaimer'},'P44 / C方向审核 · 实际Vue + 测试数据 · 未上线'),h(Parent,{apiBaseUrl:'/api/v1',initialTab:location.pathname.endsWith('/users')?'users':'admins',routePath:location.pathname})])}).use(router);await router.isReady();app.mount('#app');`;
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
      name: "p44-directory-implementation",
      enforce: "pre",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      transform(source, id) {
        const file = Object.keys(originals).find((f) => {
          const servedId = f.endsWith(".css") ? id.split("?")[0] : id;
          return path.resolve(f).replaceAll("\\", "/") === servedId.replaceAll("\\", "/");
        });
        if (!file) return null;
        assert.equal(source.replaceAll("\r\n", "\n"), originals[file]);
        return { code: transformed[file], map: null };
      },
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (
            ![
              "/platform-admin/admins",
              "/platform-admin/users",
              "/platform-admin/permissions",
            ].includes(req.url?.split("?")[0])
          )
            return next();
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
  console.log("p44_directory_host " + origin + " baseline=" + baseline);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440])
    for (const routeName of ["admins", "users", "permissions"]) {
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
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, width + ":" + routeName + ":" + name);
        checks.push({ width, routeName, name, actual });
      };
      let variant = "normal";
      try {
        await page.clock.install({ time: new Date("2026-09-11T04:00:00Z") });
        page.on("pageerror", (e) => errors.push(e.message));
        await page.route("**/*", async (r) => {
          const req = r.request(),
            url = new URL(req.url());
          if (url.origin !== origin) {
            unexpected.push(req.url());
            return r.abort();
          }
          if (!url.pathname.startsWith("/api/")) return r.continue();
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
            return r.abort();
          }
          requests.push({
            target,
            method: req.method(),
            path: url.pathname,
            query: Object.fromEntries(url.searchParams),
            variant,
          });
          const data = structuredClone(
            target === "accounts"
              ? fixture.overview
              : target === "roles"
                ? fixture.platformRoles
                : fixture.detail,
          );
          if (target === "accounts") {
            // Same explicit no-role row as the approved directory preview; global summary untouched.
            const u = fixture.overview.users[0];
            data.admins.push({
              id: u.id,
              email: u.email,
              status: u.status,
              roles: [],
              granted_at: null,
            });
            if (variant === "long") {
              data.admins[0].email = "platform.account.administration.".repeat(4) + "@example.test";
              data.admins[0].roles = fixture.platformRoles.map((r) => r.code);
            }
            if (url.searchParams.get("query"))
              data.admins = data.admins.filter((u) =>
                u.email.includes(url.searchParams.get("query")),
              );
          }
          await r.fulfill({
            json: { data, request_id: "p44-directory-fixture", trace_id: "p44-directory-fixture" },
          });
        });
        await page.goto(origin + "/platform-admin/" + routeName + "?keep=p44");
        await page
          .locator(routeName === "permissions" ? ".role-comparison" : ".account-table-wrap")
          .waitFor();
        const initialUrl = page.url();
        const active = !baseline && routeName === "admins" && width <= 760;
        const settle = async () => {
          await page.locator(".account-center").evaluate((n) => n.getBoundingClientRect().height);
          await page.waitForTimeout(50);
        };
        const snapshot = async () => {
          await settle();
          return page.evaluate(() => {
            const style = (selector) => {
              const el = document.querySelector(selector);
              if (!el) return null;
              const s = getComputedStyle(el);
              return Object.fromEntries(
                [
                  "display",
                  "color",
                  "backgroundColor",
                  "fontFamily",
                  "fontSize",
                  "fontWeight",
                  "padding",
                  "border",
                  "borderRadius",
                  "gap",
                  "gridTemplateColumns",
                  "outline",
                  "outlineOffset",
                ].map((k) => [k, s[k]]),
              );
            };
            return {
              hero: style(".account-hero"),
              metrics: style(".account-metrics"),
              tabs: style(".account-tabs"),
              filter: style(".responsive-filter-drawer__trigger"),
              updated: style(".account-updated"),
              comparison: style(".role-comparison"),
              comparisonHeader: style(".role-comparison > header"),
              heading: style(".admin-directory-heading"),
              title: style(".admin-directory-heading h3"),
              table: style(".account-table-wrap"),
              rows: style(".account-table-wrap .responsive-data-view__mobile"),
              row: style(".account-table-wrap .responsive-data-view__mobile article"),
              button: style(".account-table-wrap .responsive-data-view__mobile article > button"),
              name: style(".account-table-wrap .responsive-record-summary strong"),
              meta: style(".account-table-wrap .responsive-record-summary small"),
              action: style(".account-table-wrap .responsive-data-view__action"),
              preview: style(".responsive-data-view__drawer"),
              detail: style("dialog[open]"),
            };
          });
        };
        const shot = async (state) => {
          const target = page.locator(
            active
              ? ".admin-directory-heading"
              : routeName === "permissions"
                ? ".role-comparison"
                : ".account-table-wrap",
          );
          if (!["preview", "detail", "focus"].includes(state))
            await target.evaluate((n) => scrollTo(0, n.getBoundingClientRect().top + scrollY - 24));
          await page.evaluate(() => document.fonts.ready);
          check(
            state + ":no overflow",
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          );
          if (capture) {
            const file = width + "-" + routeName + "-" + state + ".png";
            await page.screenshot({ path: output + "/" + file, animations: "disabled" });
            screenshots.push({
              width,
              routeName,
              state,
              file,
              sha256: hash(await readFile(output + "/" + file)),
            });
          }
        };
        check(
          "new heading existence",
          await page.locator(".admin-directory-heading").count(),
          !baseline && routeName === "admins" ? 1 : 0,
        );
        if (!baseline && routeName === "admins")
          check(
            "heading mobile only",
            await page.locator(".admin-directory-heading").isVisible(),
            width <= 760,
          );
        const defaultStyles = await snapshot();
        if (active) {
          check(
            "approved title",
            await page.locator(".admin-directory-heading h3").innerText(),
            "可授权账号",
          );
          check(
            "approved explanation",
            await page.locator(".admin-directory-heading p").innerText(),
            "包含尚未授予平台角色的账号。进入详情后核对身份与当前授权。",
          );
          check("white directory", defaultStyles.table.backgroundColor, "rgb(255, 255, 255)");
          check("unboxed rows", defaultStyles.row.borderRadius, "0px");
          check("adjacent rows", defaultStyles.rows.gap, "0px");
          check("blue detail entry", defaultStyles.action.color, "rgb(83, 107, 134)");
          check("title size", defaultStyles.title.fontSize, "22px");
        }
        const contents = await page
          .locator(".account-table-wrap .responsive-record-summary")
          .allTextContents();
        const states = [];
        await shot("directory");
        if (routeName === "admins") {
          check("two authorizable accounts", contents.length, 2);
          check("unassigned row retained", contents[1].includes("尚未授予平台角色"));
          const first = page
            .locator(
              width <= 760
                ? ".account-table-wrap .responsive-data-view__mobile article > button"
                : ".account-table-wrap tbody button",
            )
            .first();
          await first.focus();
          await page.keyboard.press("Shift+Tab");
          await page.keyboard.press("Tab");
          check(
            "real Tab reaches first record",
            await first.evaluate((n) => n === document.activeElement),
          );
          states.push({ name: "focus", styles: await snapshot() });
          await shot("focus");
          // Only the buyer has an existing complete detail fixture. Do not return that
          // identity for the administrator row or fabricate a second detail contract.
          check(
            "detail fixture matches second row",
            contents[1].includes(fixture.detail.user.email),
          );
          await page
            .locator(
              width <= 760
                ? ".account-table-wrap .responsive-data-view__mobile article > button"
                : ".account-table-wrap tbody button",
            )
            .nth(1)
            .click();
          if (width <= 760) {
            const preview = page.getByRole("dialog", {
              name: fixture.detail.user.email,
              exact: true,
            });
            await preview.waitFor();
            check(
              "preview before API detail",
              requests.filter((r) => r.target === "detail").length,
              0,
            );
            states.push({
              name: "preview",
              styles: await snapshot(),
              text: await preview.innerText(),
            });
            await shot("preview");
            await preview.getByRole("button", { name: "打开账号详情", exact: true }).click();
          }
          await page.locator("dialog[open]").waitFor();
          check("one exact detail GET", requests.filter((r) => r.target === "detail").length, 1);
          states.push({
            name: "detail",
            styles: await snapshot(),
            text: await page.locator("dialog[open]").innerText(),
          });
          await shot("detail");
          await page
            .locator("dialog[open]")
            .getByRole("button", { name: "关闭", exact: true })
            .click();
          check("detail closed", await page.locator("dialog[open]").count(), 0);
          check("route stays after detail", page.url(), initialUrl);
          variant = "long";
          await page.evaluate(() => window.__go({ keep: "p44", query: "platform.account" }));
          await page.waitForFunction(() =>
            document
              .querySelector(".responsive-record-summary strong")
              ?.textContent.includes("platform.account.administration."),
          );
          states.push({
            name: "long",
            styles: await snapshot(),
            text: await page
              .locator(".account-table-wrap .responsive-record-summary")
              .allTextContents(),
          });
          check(
            "long filtered one row",
            await page.locator(".account-table-wrap .responsive-record-summary").count(),
            1,
          );
          await shot("long");
          variant = "normal";
          await page.evaluate(() => window.__go({ keep: "p44" }));
          await page.waitForFunction(
            () => document.querySelectorAll(".responsive-record-summary").length === 2,
          );
          states.push({ name: "restored", styles: await snapshot() });
          await shot("restored");
          check("restored URL", page.url(), initialUrl);
        }
        check(
          "no write",
          requests.every((r) => r.method === "GET"),
        );
        check("unexpected", unexpected, []);
        check("errors", errors, []);
        observations.push({
          width,
          routeName,
          defaultStyles,
          contents,
          states,
          requests,
          errors,
          unexpected,
        });
      } finally {
        await context.close();
      }
    }
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const f = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
    if (f && !f.startsWith("..") && !f.includes("node_modules") && /\.(vue|ts|css)$/.test(f))
      sources.add(f);
  }
  const sourceHashes = Object.fromEntries(
    await Promise.all(
      [...sources].sort().map(async (f) => [f, hash(transformed[f] ?? (await read(f)))]),
    ),
  );
  if (capture) {
    await writeFile(
      output + "/evidence.json",
      JSON.stringify(
        {
          kind: "P44-MOBILE-DIRECTORY-IMPLEMENTATION",
          baseline,
          scope:
            "Actual Vue and production CSS, baseline d9a28316; three routes/four widths. No review CSS, no real permissions or deployment acceptance. Explicit no-role and long-email fixtures. Dialogs unchanged.",
          sourceHashes,
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P44手机目录生产源码对照</title><style>body{font:16px/1.6 "Microsoft YaHei";background:#eef2f7;margin:24px}article{background:white;padding:20px;margin:24px 0}img{max-width:100%;height:auto}</style><h1>P44手机目录 ' +
        (baseline ? "修改前" : "当前生产源码") +
        "</h1><p>真实Vue与拦截HTTP样例，未部署。</p>" +
        screenshots
          .map(
            (s) =>
              "<article><h2>" +
              s.width +
              " " +
              s.routeName +
              " " +
              s.state +
              '</h2><img src="' +
              s.file +
              '" alt="' +
              s.state +
              '"></article>',
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      baseline,
      checks: checks.length,
      images: screenshots.length,
      sources: sources.size,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
