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
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

const capture = process.argv.includes("--capture");
const baseline = process.argv.includes("--baseline");
assert.ok(process.argv.slice(2).every((arg) => ["--capture", "--baseline"].includes(arg)));
const output =
  "output/playwright/p44-mobile-controls-implementation/" + (baseline ? "baseline" : "current");
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const parent = "apps/web/src/components/PlatformAccountCenter.vue";
const detailFile = "apps/web/src/components/PlatformUserDetailDialog.vue";
const originals = { [parent]: await read(parent) };
const transformed = {
  [parent]: baseline
    ? execFileSync("git", ["show", "c489ebf0:" + parent], { encoding: "utf8" }).replaceAll(
        "\r\n",
        "\n",
      )
    : originals[parent],
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
  fixtureFile,
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "scripts/verify-ui-phase2-admin-mobile-controls-implementation.mjs",
]);
const entry = "/__p44_review.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import Parent from '/src/components/PlatformAccountCenter.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
document.documentElement.dataset.design='signal-ledger';
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
window.__go=(query)=>router.push({path:'/platform-admin/admins',query});
const app=createApp({render:()=>h('main',[h('p',{class:'preview-disclaimer'},'P44 / C方向审核 · 实际Vue + 测试数据 · 未上线'),h(Parent,{apiBaseUrl:'/api/v1',initialTab:'admins',routePath:location.pathname})])}).use(router);await router.isReady();app.mount('#app');`;
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
          if (
            !["/platform-admin/admins", "/platform-admin/permissions"].includes(
              req.url?.split("?")[0],
            )
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
  console.log("p44_mobile_implementation_host " + origin + " baseline=" + baseline);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440])
    for (const routeName of ["admins", "permissions"]) {
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
                : null;
          if (!target || req.method() !== "GET") {
            unexpected.push(req.method() + " " + url.pathname);
            return r.abort();
          }
          requests.push({ target, path: url.pathname, method: req.method() });
          await r.fulfill({
            json: {
              data: target === "roles" ? fixture.platformRoles : fixture.overview,
              request_id: "p44-implementation-fixture",
              trace_id: "p44-implementation-fixture",
            },
          });
        });
        await page.goto(origin + "/platform-admin/" + routeName + "?keep=p44");
        const comp = page.locator(".role-comparison"),
          matrix = comp.locator(".role-comparison__matrix article");
        await matrix.first().waitFor();
        const initialUrl = page.url(),
          active = !baseline && width <= 760 && routeName === "admins";
        const shot = async (state) => {
          await comp.evaluate((n) => scrollTo(0, n.getBoundingClientRect().top + scrollY - 24));
          await page.evaluate(() => document.fonts.ready);
          // Give Chromium's native focus ring time to settle. Its antialiased edge may
          // still vary between browser runs; compare actual focus geometry/styles too.
          if (state === "keyboard-focus") await page.waitForTimeout(300);
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
        check("six original differences", await matrix.count(), 6);
        const styles = await comp.evaluate((n) => {
          const style = (selector, keys) => {
            const s = getComputedStyle(n.querySelector(selector));
            return Object.fromEntries(keys.map((k) => [k, s[k]]));
          };
          return {
            header: style("header", [
              "backgroundColor",
              "color",
              "paddingTop",
              "paddingLeft",
              "borderRadius",
            ]),
            title: style("header h3", ["fontFamily", "fontSize", "fontWeight", "color"]),
            selectors: style(".role-comparison__selectors", [
              "gridTemplateColumns",
              "gap",
              "paddingTop",
              "marginLeft",
            ]),
            filter: style(".role-comparison__filters", [
              "gridTemplateColumns",
              "gap",
              "paddingBottom",
            ]),
            checkbox: style('input[type="checkbox"]', ["width", "height", "minHeight"]),
            summary: style(".role-comparison__summaries", [
              "gridTemplateColumns",
              "gap",
              "marginTop",
              "padding",
              "borderRadius",
              "backgroundColor",
            ]),
            summaryItem: style(".role-comparison__summaries article", [
              "padding",
              "borderRadius",
              "backgroundColor",
              "color",
            ]),
            result: style(".role-comparison__result", [
              "padding",
              "backgroundColor",
              "color",
              "fontSize",
            ]),
            matrix: style(".role-comparison__matrix article", [
              "gridTemplateColumns",
              "padding",
              "backgroundColor",
              "borderRadius",
              "color",
            ]),
          };
        });
        if (active) {
          check("approved blue header", styles.header.backgroundColor, "rgb(41, 76, 175)");
          check(
            "approved white header text",
            await comp.locator("h3").evaluate((n) => getComputedStyle(n).color),
            "rgb(255, 255, 255)",
          );
          check("checkbox20", styles.checkbox.width, "20px");
          check("approved title size", styles.title.fontSize, "22px");
          check("approved title weight", styles.title.fontWeight, "700");
          check("approved title family", styles.title.fontFamily.includes("Microsoft YaHei"));
          check(
            "checkbox target44",
            await comp
              .locator(".role-comparison__toggle")
              .evaluate((n) => n.getBoundingClientRect().height >= 44),
          );
          check("selectors stacked", styles.selectors.gridTemplateColumns.split(" ").length, 1);
          check("filters stacked", styles.filter.gridTemplateColumns.split(" ").length, 1);
        }
        await shot("default");
        await comp.getByRole("checkbox").focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        await page.keyboard.press("Tab");
        if (active)
          await page.waitForFunction(
            () =>
              getComputedStyle(document.querySelector(".role-comparison__selectors select"))
                .outlineColor === "rgb(66, 118, 223)",
          );
        check(
          "Tab reaches first role",
          await comp
            .locator(".role-comparison__selectors select")
            .first()
            .evaluate((n) => n === document.activeElement),
        );
        const focus = await comp
          .locator(".role-comparison__selectors select")
          .first()
          .evaluate((n) => {
            const s = getComputedStyle(n),
              box = n.getBoundingClientRect();
            return {
              width: box.width,
              height: box.height,
              outline: s.outline,
              outlineOffset: s.outlineOffset,
              border: s.border,
              background: s.backgroundColor,
              color: s.color,
              fontFamily: s.fontFamily,
              fontSize: s.fontSize,
            };
          });
        await shot("keyboard-focus");
        await comp
          .getByRole("combobox", { name: "右侧角色", exact: true })
          .selectOption("platform_operations_admin");
        check("same role zero differences", await matrix.count(), 0);
        await comp.getByRole("checkbox").uncheck();
        check("same role all three", await matrix.count(), 3);
        await comp.getByRole("textbox", { name: "搜索权限", exact: true }).fill("不存在的权限");
        check("search empty before reset", await matrix.count(), 0);
        await comp.getByRole("button", { name: "重置", exact: true }).click();
        check("reset six", await matrix.count(), 6);
        if (routeName === "admins") check("admin comparison URL stays", page.url(), initialUrl);
        check("GET count", requests.length, routeName === "admins" ? 2 : 5);
        check("unexpected", unexpected, []);
        check("errors", errors, []);
        observations.push({ width, routeName, styles, focus, requests, errors, unexpected });
      } finally {
        await context.close();
      }
    }
  const sources = new Set([
    parent,
    "apps/web/src/components/PlatformRoleComparison.vue",
    "apps/web/src/components/PlatformRoleComparison.css",
    "apps/web/src/main.ts",
    "apps/web/vite.config.ts",
    fixtureFile,
    "scripts/verify-ui-phase2-admin-mobile-controls-implementation.mjs",
    ...cssFiles,
  ]);
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const f = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
    if (f && !f.startsWith("..") && !f.includes("node_modules") && /\.(vue|ts|css)$/.test(f))
      sources.add(f);
  }
  sources.add("scripts/lib/ui-imported-style-sources.mjs");
  await includeImportedStyleSources(sources, async (f) => transformed[f] ?? (await read(f)));
  const sourceHashes = Object.fromEntries(
    await Promise.all(
      [...sources]
        .sort()
        .map(async (f) => [f, hash(f === parent ? transformed[parent] : await read(f))]),
    ),
  );
  if (capture) {
    await writeFile(
      output + "/evidence.json",
      JSON.stringify(
        {
          kind: "P44-MOBILE-CONTROLS-IMPLEMENTATION",
          baseline,
          scope:
            "Actual production parent and styles, no review CSS or template transforms; baseline parent from c489ebf0. Two routes/four widths, controls only, read-only HTTP fixtures. No full App/real permissions/deployment acceptance.",
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P44 手机控件生产源对照</title><style>body{font:16px/1.6 "Microsoft YaHei";background:#eef2f7;margin:24px}article{background:white;padding:20px;margin:24px 0}img{max-width:100%;height:auto}</style><h1>P44 手机控件 ' +
        (baseline ? "旧版" : "当前生产源码") +
        "</h1><p>本地实际Vue+HTTP测试样例；未部署。</p>" +
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
