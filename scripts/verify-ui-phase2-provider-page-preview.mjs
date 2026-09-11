import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";
import { providerPagePreview } from "./lib/ui-phase2-provider-page-preview.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p46-provider-page-vue-preview";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");

const parent = "apps/web/src/components/ProviderRuntimeSurface.vue";
const child = "apps/web/src/components/ProviderRegistry.vue";
const style = "design-plans/ui-phase-2-2026-09-07/implementation/provider-page-preview.css";
const originals = { [child]: await read(child) };
const transformed = { [child]: providerPagePreview(originals[child]) };
const fixtureFile = "tests/e2e/m03-01-provider-registry.spec.ts";
const ast = ts.createSourceFile(fixtureFile, await read(fixtureFile), ts.ScriptTarget.Latest, true);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((n) => [...n.declarationList.declarations]);
const box = {};
vm.runInNewContext(
  ["definition", "blockedDefinition", "definitions"]
    .map((name) => {
      const matches = declarations.filter((n) => n.name.getText(ast) === name);
      assert.equal(matches.length, 1);
      return "const " + name + "=" + matches[0].initializer.getText(ast) + ";";
    })
    .join("\n") + "globalThis.result=definitions;",
  box,
);
const definitions = JSON.parse(JSON.stringify(box.result));
assert.equal(definitions.length, 25);
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((m) => "apps/web/src/" + m[1]);
const sources = new Set([
  parent,
  child,
  style,
  fixtureFile,
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "apps/web/src/navigation-shell-route-state.ts",
  "scripts/lib/ui-phase2-provider-page-preview.mjs",
  "scripts/verify-ui-phase2-provider-page-preview.mjs",
]);
const entry = "/__p46_review.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import Parent from '/src/components/ProviderRuntimeSurface.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
import '/@fs/${path.resolve(style).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p46-page-review');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
window.__go=(query)=>router.push({path:'/platform-admin/providers',query});
const app=createApp({render:()=>h('main',[h('p',{class:'preview-disclaimer'},'P46 / C方向审核 · 实际Vue + 测试数据 · 未上线'),h(Parent,{apiBaseUrl:'/api/v1',routePath:'/platform-admin/providers',capabilities:['platform:superadmin']})])}).use(router);await router.isReady();app.mount('#app');`;
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
      name: "p46-review",
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
          if (req.url?.split("?")[0] !== "/platform-admin/providers") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P46 来源设置审核</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
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
  console.log("p46_provider_host " + origin);
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
    let status = 200,
      variant = "normal",
      gate,
      release;
    const hold = () => {
      gate = new Promise((r) => (release = r));
    };
    const unhold = () => {
      release?.();
      gate = undefined;
    };
    const check = (name, actual, expected = true) => {
      assert.deepEqual(actual, expected, width + ":" + name);
      checks.push({ width, name, actual });
    };
    try {
      await page.clock.install({ time: new Date("2026-09-11T04:00:00Z") });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (url.origin !== origin) {
          unexpected.push(req.url());
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        if (req.method() !== "GET" || url.pathname !== "/api/v1/platform/providers") {
          unexpected.push(req.method() + " " + url.pathname);
          return route.abort();
        }
        const code = status;
        let data = structuredClone(definitions);
        if (variant === "empty") data = [];
        if (variant === "long")
          data = [
            {
              ...data[0],
              name: data[0].name.repeat(10),
              owner_label: data[0].owner_label.repeat(20),
            },
          ];
        requests.push({ method: req.method(), path: url.pathname, status: code, variant });
        if (gate) await gate;
        return route.fulfill(
          code === 200
            ? { json: { data, request_id: "p46-review", trace_id: "p46-review" } }
            : {
                status: code,
                json: {
                  error: {
                    code: "p46_read_error",
                    message: "测试读取失败",
                    action_hint: "当前目录暂时无法读取，请稍后重试。",
                  },
                  request_id: "p46-error",
                  trace_id: "p46-error",
                },
              },
        );
      });
      const mobile = width <= 760,
        list = page.locator(mobile ? ".responsive-data-view__mobile" : ".provider-table-wrap");
      const recordNames = () =>
        list
          .locator(mobile ? ".responsive-record-summary strong" : "tbody tr td:first-child strong")
          .allTextContents();
      const search = page.getByRole("searchbox", { name: "搜索", exact: true });
      const statusSelect = page.getByRole("combobox", { name: "定义状态", exact: true });
      const mode = page.getByRole("combobox", { name: "接入方式", exact: true });
      const admission = page.getByRole("combobox", { name: "执行门禁", exact: true });
      const sort = page.getByRole("combobox", { name: "排序", exact: true });
      const reset = page.getByRole("button", { name: "重置", exact: true });
      const refresh = page.locator(".provider-list-heading > button");
      const ready = () =>
        page.waitForFunction(
          () =>
            document.querySelector(".provider-list-tools") &&
            !document.querySelector(".provider-list-heading > button")?.disabled,
        );
      const shot = async (state, focus) => {
        if (focus)
          await page
            .locator(focus)
            .evaluate((n) => n.scrollIntoView({ block: "start", inline: "nearest" }));
        else await page.evaluate(() => scrollTo(0, 0));
        await page.evaluate(() => document.fonts.ready);
        check(
          state + ":no page horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (capture) {
          const bytes = await page.screenshot({ fullPage: !focus, animations: "disabled" }),
            file = width + "-" + state + ".png";
          await writeFile(output + "/" + file, bytes);
          screenshots.push({
            file,
            width,
            state,
            sha256: hash(bytes),
            viewport: page.viewportSize(),
            imageDimensions: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
          });
        }
      };
      const expectNames = async (expected, name) => {
        await page.waitForFunction(
          ({ mobile, expected }) => {
            const selector = mobile
              ? ".responsive-data-view__mobile .responsive-record-summary strong"
              : ".provider-table-wrap tbody tr td:first-child strong";
            return (
              JSON.stringify([...document.querySelectorAll(selector)].map((n) => n.textContent)) ===
              JSON.stringify(expected)
            );
          },
          { mobile, expected },
        );
        check(name, await recordNames(), expected);
      };
      const names = definitions.map((d) => d.name).sort((a, b) => a.localeCompare(b, "zh-CN"));
      hold();
      await page.goto(origin + "/platform-admin/providers?keep=p46");
      await page.locator('.ui-state-panel[data-kind="loading"]').waitFor();
      await shot("loading");
      unhold();
      await ready();
      check("global counts", await page.locator(".provider-overview strong").allTextContents(), [
        "25",
        "1",
        "1",
        "24",
      ]);
      check(
        "five source navigation destinations",
        await page
          .locator(".provider-runtime-tabs a")
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href"))),
        [
          "/platform-admin/providers",
          "/platform-admin/providers/adapters",
          "/platform-admin/providers/sources",
          "/platform-admin/providers/sources/1688-acceptance",
          "/platform-admin/credentials",
        ],
      );
      await expectNames(names.slice(0, 20), "first page exact name order");
      check(
        "previous initially disabled",
        await page.getByRole("button", { name: "上一页", exact: true }).isDisabled(),
      );
      await shot("default");
      await shot("default-top", ".provider-hero");
      const currentNav = page.locator('.provider-runtime-tabs a[aria-current="page"]');
      await currentNav.focus();
      await page.keyboard.press("Tab");
      await page.waitForFunction(() => {
        const n = document.querySelectorAll(".provider-runtime-tabs a")[1];
        return (
          n === document.activeElement &&
          n.matches(":focus-visible") &&
          getComputedStyle(n).outlineColor === "rgb(255, 255, 255)"
        );
      });
      check(
        "navigation native Tab focus",
        await page
          .locator(".provider-runtime-tabs a")
          .nth(1)
          .evaluate((n) => n === document.activeElement),
      );
      await shot("navigation-focus", ".provider-runtime-tabs");
      await page.locator(".provider-runtime-tabs a").last().focus();
      await page.keyboard.press("Tab");
      await page.waitForFunction(() => {
        const n = document.querySelector(".provider-hero > button");
        return (
          n === document.activeElement &&
          n.matches(":focus-visible") &&
          getComputedStyle(n).outlineColor === "rgb(66, 118, 223)"
        );
      });
      check(
        "create native Tab focus",
        await page.locator(".provider-hero > button").evaluate((n) => n === document.activeElement),
      );
      check(
        "create blue action",
        await page
          .locator(".provider-hero > button")
          .evaluate((n) => getComputedStyle(n).backgroundColor),
        "rgb(41, 76, 175)",
      );
      await shot("create-focus", ".provider-hero");
      await shot("filters", ".provider-filters");
      await shot(
        "records",
        mobile ? ".responsive-data-view__mobile article:first-child" : ".provider-table-wrap",
      );
      await page.getByRole("button", { name: "下一页", exact: true }).click();
      await expectNames(names.slice(20), "second page five names");
      check(
        "next last disabled",
        await page.getByRole("button", { name: "下一页", exact: true }).isDisabled(),
      );
      await shot("page-two");
      await search.fill("待复核公开来源");
      await expectNames(["待复核公开来源"], "search keeps blocked definition");
      check(
        "filter not global counts",
        await page.locator(".provider-overview strong").allTextContents(),
        ["25", "1", "1", "24"],
      );
      check(
        "filter resets page and hides pager",
        await page.locator(".provider-pagination").count(),
        0,
      );
      await shot("blocked-filter");
      await reset.click();
      await expectNames(names.slice(0, 20), "reset restores page one");
      await statusSelect.selectOption("enabled");
      await expectNames(["待复核公开来源"], "enabled filter");
      await admission.selectOption("inactive");
      await expectNames([], "combined filter empty");
      await page.getByText("没有匹配的来源", { exact: true }).waitFor();
      await shot("filter-empty");
      await page.getByRole("button", { name: "清除筛选条件", exact: true }).click();
      await mode.selectOption("manual");
      await expectNames([], "manual mode empty");
      await reset.click();
      await search.fill("  PUBLIC_SIGNAL_RSS  ");
      await expectNames(["公开趋势 RSS"], "case insensitive code search");
      await shot("code-search");
      await reset.click();
      await sort.selectOption("updated_desc");
      await expectNames(
        definitions.slice(0, 20).map((d) => d.name),
        "stable update order",
      );
      await shot("recent-order", " .provider-list-tools".trim());
      await sort.selectOption("status");
      const statusNames = [
        ...definitions.filter((_, i) => i !== 1).map((d) => d.name),
        definitions[1].name,
      ];
      await expectNames(statusNames.slice(0, 20), "admission order");
      await shot(
        "admission-order",
        mobile ? ".responsive-data-view__mobile article:first-child" : ".provider-table-wrap",
      );
      await reset.click();
      await expectNames(names.slice(0, 20), "filters reset before controls");
      await search.focus();
      await page.waitForFunction(() =>
        document.activeElement?.matches('input[type="search"]:focus-visible'),
      );
      check(
        "search focus visible",
        await search.evaluate((n) => n === document.activeElement && n.matches(":focus-visible")),
      );
      await shot("search-focus", ".provider-filters");
      if (!mobile) {
        check(
          "seven named columns",
          await page.locator(".provider-table-wrap thead th").allTextContents(),
          ["来源", "模式 / 市场", "频率 / 并发", "超时 / 重试", "解析器", "状态", "操作"],
        );
        await page.getByText("列设置", { exact: true }).click();
        await shot("columns", ".table-view-controls__toolbar");
        await page.getByRole("checkbox", { name: "切换第 1 列", exact: true }).uncheck();
        await page.waitForFunction(() => document.querySelector(".provider-table-wrap th")?.hidden);
        check(
          "freeze follows first visible column",
          await page
            .locator(".provider-table-wrap thead th")
            .nth(1)
            .evaluate((n) => n.classList.contains("table-view-controls__frozen")),
        );
        await shot("hidden-first-column", ".table-view-controls__toolbar");
        await page.getByRole("checkbox", { name: "切换第 1 列", exact: true }).check();
        await page.getByText("列设置", { exact: true }).click();
        await page.getByRole("button", { name: "首列已冻结", exact: true }).click();
        check(
          "unfreeze",
          await page.locator(".provider-table-wrap .table-view-controls__frozen").count(),
          0,
        );
        await page.getByRole("combobox", { name: "表格密度", exact: true }).selectOption("compact");
        await page.waitForFunction(
          () =>
            document.querySelector(".provider-table-wrap table")?.dataset.tableDensity ===
            "compact",
        );
        await shot("compact-unfrozen", ".provider-table-wrap");
        await page.locator(".provider-table-wrap").evaluate((n) => {
          n.scrollLeft = n.scrollWidth;
        });
        check(
          "table scroll reaches right columns",
          await page
            .locator(".provider-table-wrap")
            .evaluate((n) => n.scrollLeft + n.clientWidth >= n.scrollWidth - 1),
        );
        await shot("table-right", ".provider-table-wrap");
        await page.locator(".provider-table-wrap").evaluate((n) => {
          n.scrollLeft = 0;
        });
        await page
          .getByRole("combobox", { name: "表格密度", exact: true })
          .selectOption("standard");
        await page.getByRole("button", { name: "首列未冻结", exact: true }).click();
      } else {
        const trigger = page.getByRole("button", { name: /公开趋势 RSS.*未进入调度/ });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "公开趋势 RSS", exact: true });
        await dialog.waitFor();
        check("original mobile details handoff exists", await dialog.count(), 1);
        await dialog.getByRole("button", { name: "关闭详情", exact: true }).click();
        check(
          "detail close focus returns to original record",
          await trigger.evaluate((n) => n === document.activeElement),
        );
      }
      check("local filters and pagination require only initial GET", requests.length, 1);
      check("query unchanged by local filters", new URL(page.url()).search, "?keep=p46");
      hold();
      await refresh.click();
      await page.getByRole("button", { name: "刷新中…", exact: true }).waitFor();
      await shot("refresh-pending");
      unhold();
      await ready();
      for (const code of [500, 403, 401]) {
        status = code;
        await refresh.click();
        await page.locator('.provider-feedback[data-tone="warning"]').waitFor();
        await ready();
        check(
          "refresh " + code + " retains 25",
          await page.locator(".provider-overview strong").first().textContent(),
          "25",
        );
        check(
          "refresh " + code + " declares stale",
          (await page.locator(".provider-feedback").innerText()).includes("已保留上次成功数据"),
        );
        await shot("refresh-error-" + code);
      }
      status = 200;
      await page.getByRole("button", { name: "再次刷新", exact: true }).click();
      await ready();
      check("retry clears stale feedback", await page.locator(".provider-feedback").count(), 0);
      for (const [code, kind] of [
        [500, "error"],
        [403, "forbidden"],
        [401, "expired"],
        [429, "blocked"],
      ]) {
        status = code;
        await page.goto(origin + "/platform-admin/providers?keep=p46");
        const panel = page.locator('.ui-state-panel[data-kind="' + kind + '"]');
        await panel.waitFor();
        check(
          "initial " + code + " hides records",
          await page.locator(".responsive-data-view").count(),
          0,
        );
        check(
          "initial " + code + " only real reload action",
          await panel.locator("button:visible").allTextContents(),
          ["重新读取来源"],
        );
        await shot("initial-" + kind);
        status = 200;
        await panel.getByRole("button", { name: "重新读取来源", exact: true }).click();
        await ready();
      }
      variant = "empty";
      await refresh.click();
      await page.getByText("还没有来源定义", { exact: true }).waitFor();
      check("empty has no false metrics", await page.locator(".provider-overview").count(), 0);
      await shot("empty");
      variant = "long";
      await page.goto(origin + "/platform-admin/providers?keep=p46");
      await ready();
      await shot(
        "long-name",
        mobile ? ".responsive-data-view__mobile article:first-child" : ".provider-table-wrap",
      );
      check(
        "no writes or extra API",
        requests.every((r) => r.method === "GET" && r.path === "/api/v1/platform/providers"),
      );
      check("no unexpected requests", unexpected, []);
      check("no browser exceptions", errors, []);
      observations.push({ width, requests, errors, unexpected });
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
    await Promise.all([...sources].sort().map(async (f) => [f, hash(await read(f))])),
  );
  if (capture) {
    await writeFile(
      output + "/evidence.json",
      JSON.stringify(
        {
          kind: "P46-PROVIDER-PAGE-VUE-PREVIEW-r1",
          approval: "pending-user-review",
          scope:
            "Actual ProviderRuntimeSurface and ProviderRegistry, original scripts/bindings/data unchanged. Review-only list/navigation CSS, named action column and truthful existing reload label; unused secondary action hidden only in this review. Original25 fixtures and explicit empty/long variants. GET-only intercepted provider directory; no real RBAC/MySQL/collection or provider writes. Editor and mobile details unchanged, not redesigned/accepted; mobile open-close only. No full App/navigation destination or lifecycle acceptance; prior page approvals do not apply.",
          sourceHashes,
          transformedHashes: { [child]: hash(transformed[child]) },
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P46 来源设置实际Vue审核</title><style>body{font:16px/1.6 "Microsoft YaHei",sans-serif;background:#eef2f7;color:#142a46;margin:24px}article{margin:24px 0;padding:20px;background:white}img{max-width:100%;height:auto}</style><h1>P46 来源设置 · C方向目录审核</h1><p>实际Vue＋测试数据，未上线、待审核。目录/筛选/分页/错误，不含编辑长表单设计或真实授权。</p>' +
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
