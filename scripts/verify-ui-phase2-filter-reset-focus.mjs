import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { chromium } from "playwright";
import { createServer } from "vite";

const baseline = process.argv.includes("--baseline"),
  capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => ["--baseline", "--capture"].includes(v)));
const revision = "07c492963f56e266864143cfadaa1e6f6ef5627d";
const file = "apps/web/src/components/ResponsiveFilterDrawer.vue";
const output = `output/playwright/filter-reset-focus/${baseline ? "baseline" : "current"}`;
const read = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const source = baseline
  ? execFileSync("git", ["show", `${revision}:${file}`], { encoding: "utf8" }).replaceAll(
      "\r\n",
      "\n",
    )
  : await read(file);
const fixtureFile = "tests/e2e/m06-01-platform-accounts.spec.ts";
const ast = ts.createSourceFile(fixtureFile, await read(fixtureFile), ts.ScriptTarget.Latest, true);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((n) => [...n.declarationList.declarations]);
const fixture = JSON.parse(
  JSON.stringify(
    vm.runInNewContext(
      ["user", "org", "overview"]
        .map((name) => {
          const selected = declarations.filter((n) => n.name.getText(ast) === name);
          assert.equal(selected.length, 1);
          return `const ${name}=${selected[0].initializer.getText(ast)};`;
        })
        .join("\n") + "\noverview",
    ),
  ),
);
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((m) => "apps/web/src/" + m[1]);
const sources = new Set([
  file,
  fixtureFile,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "scripts/verify-ui-phase2-filter-reset-focus.mjs",
  ...cssFiles,
]);
const entry = "/__filter_focus.js";
const host = `import {createApp,h,ref,computed} from 'vue';import {createRouter,createWebHistory} from 'vue-router';
import Parent from '/src/components/PlatformAccountCenter.vue';import Drawer from '/src/components/ResponsiveFilterDrawer.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
document.documentElement.dataset.design='signal-ledger';
const mode=new URL(location.href).searchParams.get('mode');
const value=ref('buyer'),live=ref(true);window.__fixture={value,live};
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const app=createApp({setup:()=>()=>h('main', {style:'padding:20px'},[
mode==='account'?h(Parent,{apiBaseUrl:'/api/v1',initialTab:'users',routePath:'/platform-admin/users'}):[
h('h1','共享筛选焦点验证'),h('button',{id:'outside'},'外部控件'),
live.value?h(Drawer,{activeCount:value.value?1:0},{default:()=>h('form',{onSubmit:e=>e.preventDefault()},[
h('label',['关键词',h('input',{id:'field',value:value.value,onInput:e=>value.value=e.target.value})]),
h('button',{id:'reset',type:'button',disabled:!value.value,onClick:()=>value.value=''},'重置'),
h('button',{id:'nested-open',type:'button',onClick:()=>{value.value='';document.querySelector('#nested').showModal();document.querySelector('#nested input').focus()}},'另一个弹窗')])}):null,
h('dialog',{id:'nested'},[h('input',{'aria-label':'另一个弹窗字段'}),h('button',{onClick:()=>document.querySelector('#nested').close()},'关闭')])]
])}).use(router);await router.isReady();app.mount('#app');`;
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
      name: "filter-focus-regression",
      enforce: "pre",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      transform(original, id) {
        if (baseline && id.replaceAll("\\", "/") === path.resolve(file).replaceAll("\\", "/"))
          return { code: source, map: null };
        return null;
      },
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/__filter-focus") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>筛选焦点回归</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
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
  console.log(`filter_focus_${baseline ? "baseline" : "current"} ${origin}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      locale: "zh-CN",
      reducedMotion: "reduce",
    });
    const page = await context.newPage(),
      requests = [],
      errors = [],
      unexpected = [];
    const check = (name, actual, expected = true) => {
      assert.deepEqual(actual, expected, `${width}:${name}`);
      checks.push({ width, name, actual });
    };
    try {
      await page.clock.install({ time: new Date("2026-09-11T02:00:00Z") });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== origin) {
          unexpected.push(req.url());
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        if (req.method() !== "GET" || url.pathname !== "/api/v1/platform/accounts") {
          unexpected.push(req.method() + " " + url.pathname);
          return route.abort();
        }
        requests.push({
          method: req.method(),
          path: url.pathname,
          query: Object.fromEntries(url.searchParams),
        });
        return route.fulfill({
          json: {
            data: fixture,
            request_id: "filter-focus-fixture",
            trace_id: "filter-focus-fixture",
          },
        });
      });
      const active = () =>
        page.evaluate(() => ({
          tag: document.activeElement?.tagName,
          close: !!document.activeElement?.matches(
            ".responsive-filter-drawer__sheet > header button",
          ),
          trigger: !!document.activeElement?.matches(".responsive-filter-drawer__trigger"),
        }));
      const open = async () => {
        if (width <= 760) {
          await page.locator(".responsive-filter-drawer__trigger").click();
          await page
            .locator(".responsive-filter-drawer__surface.is-open")
            .waitFor({ state: "visible" });
        }
      };
      const shot = async (state) => {
        if (!capture) return;
        const name = `${width}-${state}.png`;
        await page.screenshot({ path: `${output}/${name}`, animations: "disabled" });
        screenshots.push({
          file: name,
          width,
          state,
          sha256: hash(await readFile(`${output}/${name}`)),
        });
      };
      for (const input of ["click", "keyboard"]) {
        await page.goto(origin + "/__filter-focus?mode=account&query=buyer&keep=yes");
        await page.locator(".account-table-wrap").waitFor();
        await open();
        const reset = page.locator('form.account-filter button[type="button"]');
        await page.waitForFunction(() => {
          const button = document.querySelector('form.account-filter button[type="button"]');
          return button && !button.disabled;
        });
        await reset.focus();
        check(
          `${input}:reset focused before action`,
          await reset.evaluate((node) => node === document.activeElement),
        );
        if (input === "keyboard") await page.keyboard.press("Enter");
        else await reset.click();
        await page.waitForFunction(
          () => document.querySelector('form.account-filter button[type="button"]')?.disabled,
        );
        const focus = await active();
        check(
          `${input}:reset has zero filters`,
          await page.locator("form.account-filter input").inputValue(),
          "",
        );
        if (width <= 760) {
          check(`${input}:focus repaired`, focus.close, !baseline);
          await shot(`${input}-after-reset`);
          await page.keyboard.press("Escape");
          check(
            `${input}:Escape closes`,
            await page.locator(".responsive-filter-drawer__trigger").getAttribute("aria-expanded"),
            baseline ? "true" : "false",
          );
          if (!baseline) check(`${input}:returns to trigger`, (await active()).trigger);
          await shot(`${input}-after-escape`);
        } else check(`${input}:desktop not focused hidden close`, focus.close, false);
        await page.waitForFunction(
          () => !document.querySelector(".hero-actions button:last-child")?.disabled,
        );
        check(`${input}:URL retained`, new URL(page.url()).searchParams.get("keep"), "yes");
        check(`${input}:query removed`, new URL(page.url()).searchParams.get("query"), null);
      }
      check(
        "exact account requests",
        requests,
        [1, 2].flatMap(() => [
          { method: "GET", path: "/api/v1/platform/accounts", query: { query: "buyer" } },
          { method: "GET", path: "/api/v1/platform/accounts", query: {} },
        ]),
      );
      await page.goto(origin + "/__filter-focus?mode=slot");
      await open();
      await page.locator("#field").focus();
      check(
        "text input focused before clear",
        await page.locator("#field").evaluate((n) => n === document.activeElement),
      );
      await page.evaluate(() => (window.__fixture.value.value = ""));
      await page.waitForFunction(() => document.querySelector("#reset")?.disabled);
      check(
        "text input keeps focus",
        await page.locator("#field").evaluate((n) => n === document.activeElement),
      );
      await page.evaluate(() => (window.__fixture.value.value = "buyer"));
      await page.locator("#outside").focus();
      await page.evaluate(() => (window.__fixture.value.value = ""));
      await page.waitForFunction(() => document.querySelector("#reset")?.disabled);
      check(
        "outside focus not stolen",
        await page.locator("#outside").evaluate((n) => n === document.activeElement),
      );
      await page.evaluate(() => (window.__fixture.value.value = "buyer"));
      await page.locator("#nested-open").click();
      check(
        "new native dialog retains focus",
        await page.locator("#nested input").evaluate((n) => n === document.activeElement),
      );
      await page.locator("#nested button").click();
      await page.evaluate(() => {
        window.__fixture.value.value = "buyer";
      });
      await page.locator("#reset").focus();
      await page.evaluate(() => {
        window.__fixture.value.value = "";
        window.__fixture.live.value = false;
      });
      await page.waitForFunction(() => !document.querySelector("#reset"));
      check(
        "unmount leaves no drawer",
        await page.locator(".responsive-filter-drawer__sheet").count(),
        0,
      );
      check("zero errors", errors, []);
      check("only permitted GET", unexpected, []);
      observations.push({ width, requests, errors, unexpected });
      console.log(`passed ${width}`);
    } finally {
      await context.close();
    }
  }
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const rel = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
    if (
      rel &&
      !rel.startsWith("..") &&
      !rel.includes("node_modules") &&
      /\.(vue|css|ts)$/.test(rel)
    )
      sources.add(rel);
  }
  const sourceHashes = Object.fromEntries(
    await Promise.all(
      [...sources].sort().map(async (f) => [f, hash(f === file ? source : await read(f))]),
    ),
  );
  if (capture) {
    await writeFile(
      `${output}/evidence.json`,
      JSON.stringify(
        {
          kind: "FILTER-RESET-FOCUS",
          mode: baseline ? "baseline-diagnosis" : "current-regression",
          baseline: revision,
          scope:
            "Actual shared drawer and unchanged P43 parent with production CSS; intercepted account GET fixtures, synthetic slot boundary checks. Not new C approval/full App/all consumers/complete accessibility/real RBAC or production deployment.",
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
      `${output}/index.html`,
      `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><h1>筛选重置焦点 · ${baseline ? "旧版问题" : "当前回归"}</h1><p>实际组件，测试数据；不是新布局或生产验收。</p>${screenshots.map((s) => `<h2>${s.file}</h2><img style="max-width:100%" src="${s.file}" alt="${s.state}">`).join("\n")}`,
    );
  }
  console.log(
    JSON.stringify({ checks: checks.length, images: screenshots.length, sources: sources.size }),
  );
} finally {
  await browser?.close();
  await server.close();
}
