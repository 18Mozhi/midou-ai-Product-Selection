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
const output = "output/playwright/p46-provider-detail-vue-preview";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");

const parent = "apps/web/src/components/ProviderRuntimeSurface.vue";
const child = "apps/web/src/components/ProviderRegistry.vue";
const pageStyle = "design-plans/ui-phase-2-2026-09-07/implementation/provider-page-preview.css";
const editorStyle = "design-plans/ui-phase-2-2026-09-07/implementation/provider-editor-preview.css";
const style = "design-plans/ui-phase-2-2026-09-07/implementation/provider-detail-preview.css";
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
  pageStyle,
  editorStyle,
  fixtureFile,
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "apps/web/src/navigation-shell-route-state.ts",
  "scripts/lib/ui-phase2-provider-page-preview.mjs",
  "scripts/verify-ui-phase2-provider-detail-preview.mjs",
]);
const entry = "/__p46_review.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import Parent from '/src/components/ProviderRuntimeSurface.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
import '/@fs/${path.resolve(style).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(pageStyle).replaceAll("\\", "/")}';
import '/@fs/${path.resolve(editorStyle).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p46-page-review','p46-editor-review','p46-detail-review');
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
const variants = [
  { name: "normal", patch: {}, admission: "未进入调度 · 来源定义未启用" },
  { name: "blocked", base: 1, patch: {}, admission: "执行受阻 · 公开采集条款尚未批准" },
  {
    name: "compliant",
    patch: { status: "enabled" },
    admission: "合规门禁已满足 · 仅表示公开采集准入条件完整，不代表采集任务已成功",
  },
  {
    name: "login",
    patch: { status: "enabled", access_mode: "authenticated_browser" },
    admission: "需运行时登录门禁 · 定义已启用，执行仍取决于登录态、风控与采集程序状态",
  },
  {
    name: "import",
    patch: { status: "enabled", access_mode: "import" },
    admission: "等待导入 · 定义已启用，数据进入仍取决于对应导入或人工流程",
  },
  {
    name: "manual",
    patch: { status: "enabled", access_mode: "manual" },
    admission: "等待人工录入 · 定义已启用，数据进入仍取决于对应导入或人工流程",
  },
  {
    name: "expired",
    patch: { status: "enabled", terms_expires_at: "2020-01-01T00:00:00.000Z" },
    admission: "执行受阻 · 公开采集条款已过期或缺少有效期",
  },
  {
    name: "rejected",
    patch: { status: "enabled", terms_review_status: "rejected" },
    admission: "执行受阻 · 公开采集条款已拒绝",
  },
  { name: "draft", patch: { status: "draft" }, admission: "未进入调度 · 定义仍为草稿" },
  {
    name: "long",
    patch: {
      name: definitions[0].name.repeat(8),
      target_url: "https://example.test/" + "path/".repeat(70),
    },
    admission: "未进入调度 · 来源定义未启用",
  },
];
let browser;
try {
  await server.listen();
  const origin = "http://127.0.0.1:" + port;
  console.log("p46_detail_host " + origin);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760]) {
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
    let sample;
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
        requests.push({ method: "GET", path: url.pathname, id: sample.id });
        return route.fulfill({
          json: { data: [sample], request_id: "p46-detail", trace_id: "p46-detail" },
        });
      });
      const detail = page.locator(".responsive-data-view__drawer");
      const shot = async (state, bottom = false, editor = false) => {
        const target = editor ? page.locator(".provider-editor") : detail;
        await target.evaluate((n, bottom) => {
          n.scrollTop = bottom ? n.scrollHeight : 0;
        }, bottom);
        await page.evaluate(() => document.fonts.ready);
        check(
          state + ":no dialog horizontal overflow",
          await target.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
        );
        if (capture) {
          const bytes = await page.screenshot({ animations: "disabled" }),
            file = width + "-" + state + ".png";
          await writeFile(output + "/" + file, bytes);
          screenshots.push({
            file,
            width,
            state,
            sha256: hash(bytes),
            imageDimensions: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
          });
        }
      };
      for (const variant of variants) {
        sample = { ...structuredClone(definitions[variant.base ?? 0]), ...variant.patch };
        await page.goto(origin + "/platform-admin/providers?keep=p46");
        const trigger = page.locator(".responsive-data-view__mobile article > button");
        await trigger.waitFor();
        await trigger.click();
        await detail.waitFor();
        check(
          variant.name + ":title belongs to selected record",
          await detail.getAttribute("aria-label"),
          sample.name,
        );
        check(
          variant.name + ":background inert",
          await page.locator("#app").evaluate((n) => n.inert),
        );
        check(
          variant.name + ":initial close focus",
          await detail
            .getByRole("button", { name: "关闭详情", exact: true })
            .evaluate((n) => n === document.activeElement),
        );
        const facts = await detail
          .locator(".responsive-data-view__details > dl > div")
          .evaluateAll((nodes) =>
            nodes.map((n) => [
              n.querySelector("dt").textContent.trim(),
              n.querySelector("dd").textContent.trim(),
            ]),
          );
        check(variant.name + ":nine exact facts", facts, [
          [
            "接入方式",
            {
              public_rss: "公开订阅源",
              authenticated_browser: "登录浏览器",
              import: "文件导入",
              manual: "人工录入",
            }[sample.access_mode],
          ],
          ["市场 / 语言", sample.markets.join(" · ") + " / " + sample.languages.join(" · ")],
          ["调度", "每 " + sample.schedule_minutes + " 分钟 · 并发 " + sample.concurrency_limit],
          ["超时 / 重试", sample.timeout_ms + "ms · " + sample.retry_limit + " 次"],
          ["当前状态", { disabled: "未启用", enabled: "已启用", draft: "草稿" }[sample.status]],
          ["执行门禁", variant.admission],
          [
            "条款复核",
            { pending: "待复核", approved: "已批准", rejected: "已拒绝" }[
              sample.terms_review_status
            ],
          ],
          ["条款版本", sample.terms_version || "未登记"],
          [
            "条款到期",
            sample.terms_expires_at
              ? new Date(sample.terms_expires_at).toLocaleString("zh-CN", {
                  hour12: false,
                  timeZone: "Asia/Shanghai",
                })
              : "未登记",
          ],
        ]);
        await shot(variant.name + "-default");
        await shot(variant.name + "-facts-bottom", true);
        const summary = detail.locator("summary");
        await summary.click();
        const tech = await detail
          .locator("details dl > div")
          .evaluateAll((nodes) =>
            nodes.map((n) => [
              n.querySelector("dt").textContent.trim(),
              n.querySelector("dd").textContent.trim(),
            ]),
          );
        check(variant.name + ":five exact technical facts", tech, [
          ["来源 ID", sample.id],
          ["来源代码", sample.code],
          ["目标地址", sample.target_url],
          ["接入模式代码", sample.access_mode],
          ["解析器 / 定义版本", sample.parser_version + " / " + sample.version],
        ]);
        await shot(variant.name + "-technical", true);
        if (variant.name === "normal") {
          await detail.getByRole("button", { name: "关闭详情", exact: true }).focus();
          await page.keyboard.press("Shift+Tab");
          check(
            "Shift Tab wraps to technical summary",
            await summary.evaluate((n) => n === document.activeElement),
          );
          await shot("summary-focus", true);
          await page.keyboard.press("Tab");
          check(
            "Tab wraps to close",
            await detail
              .getByRole("button", { name: "关闭详情", exact: true })
              .evaluate((n) => n === document.activeElement),
          );
          await shot("close-focus");
          if (width === 390) {
            await page.setViewportSize({ width, height: 568 });
            await shot("short-screen");
            await shot("short-screen-bottom", true);
            await page.setViewportSize({ width, height: 900 });
          }
          await detail.getByRole("button", { name: "编辑来源", exact: true }).click();
          await page.locator(".provider-editor").waitFor();
          check(
            "one editor replaces detail",
            await page.locator('[role="dialog"]:visible').count(),
            1,
          );
          check("detail gone on editor handoff", await detail.count(), 0);
          check(
            "background released for editor",
            await page.locator("#app").evaluate((n) => n.inert),
            false,
          );
          check(
            "editor initial code matches selected",
            await page.locator(".provider-fields input").first().inputValue(),
            sample.code,
          );
          check(
            "editor owns focus after handoff",
            await page
              .locator(".provider-fields input")
              .first()
              .evaluate((n) => n === document.activeElement),
          );
          await shot("editor-handoff", false, true);
          await page.getByRole("button", { name: "关闭来源设置编辑", exact: true }).click();
          await page.locator(".provider-editor").waitFor({ state: "hidden" });
          const focus = await page.evaluate(() => ({
            tag: document.activeElement.tagName,
            connected: document.activeElement.isConnected,
            insideRecord: !!document.activeElement.closest(".responsive-data-view__mobile"),
          }));
          observations.push({ width, editorCloseFocus: focus });
          await trigger.waitFor();
          await trigger.click();
          await detail.waitFor();
        }
        await page.keyboard.press("Escape");
        await detail.waitFor({ state: "hidden" });
        check(
          variant.name + ":Escape returns record focus",
          await trigger.evaluate((n) => n === document.activeElement),
        );
        check(
          variant.name + ":inert released",
          await page.locator("#app").evaluate((n) => n.inert),
          false,
        );
      }
      check("one read per supplied variant", requests.length, variants.length);
      check(
        "all GET directory only",
        requests.every((r) => r.method === "GET" && r.path === "/api/v1/platform/providers"),
      );
      check("URL unchanged", new URL(page.url()).search, "?keep=p46");
      check("no unexpected network", unexpected, []);
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
          kind: "P46-PROVIDER-DETAIL-VUE-PREVIEW-r1",
          approval: "pending-user-review",
          scope:
            "Actual current ResponsiveDataView and ProviderRegistry detail slot unchanged; scoped body-teleported C CSS only. Existing page/editor preview CSS reused without edits. Original two fixture definitions plus explicit single-record variants. GET directory only, no writes or real RBAC/persistence/terms approval/collection. Detail nine facts and five technical facts, inert/Tab/Escape and handoff inspected; editor close focus separately observed, not claimed fixed. Not full App/KeepAlive/assistive technology or full-page acceptance; prior page/editor approvals do not apply.",
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P46 手机来源详情审核</title><style>body{font:16px/1.6 "Microsoft YaHei",sans-serif;background:#eef2f7;color:#142a46;margin:24px}article{background:white;padding:20px;margin:24px 0}img{max-width:100%;height:auto}</style><h1>P46 手机来源详情 · 实际Vue审核</h1><p>既有及合成测试数据，未上线、待审核。已启用/准入完整不等于采集成功。</p>' +
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
    JSON.stringify({
      checks: checks.length,
      images: screenshots.length,
      sources: sources.size,
      focus: observations.filter((o) => o.editorCloseFocus),
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
