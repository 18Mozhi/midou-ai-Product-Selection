import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { accountPagePreview } from "./lib/ui-phase2-account-page-preview.mjs";
import { buildAccountOverviewDesignData } from "./lib/ui-phase2-account-overview-design-data.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((a) => a === "--capture"));
const output = "output/playwright/p39-page-composed";
const component = "apps/web/src/components/PlatformAccountCenter.vue";
const styles = [
  "account-filter-preview.css",
  "account-create-preview.css",
  "account-page-preview.css",
].map((f) => "design-plans/ui-phase-2-2026-09-07/implementation/" + f);
const read = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const original = await read(component),
  transformed = accountPagePreview(original);
const data = await buildAccountOverviewDesignData(process.cwd());
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((m) => "apps/web/src/" + m[1]);
const sources = new Set([
  component,
  ...styles,
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "scripts/verify-ui-phase2-account-page-preview.mjs",
  "scripts/lib/ui-phase2-account-page-preview.mjs",
  "scripts/lib/ui-phase2-account-filter-preview.mjs",
  "scripts/lib/ui-phase2-account-overview-design-data.mjs",
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
const entry = "/__p39_page_composed.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import Current from '/src/components/PlatformAccountCenter.vue';
${cssFiles.map((f) => `import '/src/${f.slice("apps/web/src/".length)}';`).join("\n")}
${styles.map((f) => `import '/@fs/${path.resolve(f).replaceAll("\\", "/")}';`).join("\n")}
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p39-filter-preview','p39-create-preview','p39-page-preview');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});const app=createApp({render:()=>h('main',[h('p',{class:'preview-disclaimer'},'P39 / C方向整页组合 · 实际Vue逻辑 + 审核模板与样式 · 测试数据，未上线'),h(Current,{apiBaseUrl:'/api/v1',routePath:'/platform-admin/accounts'})])}).use(router);await router.isReady();app.mount('#app');`;
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
      name: "p39-composed-review",
      enforce: "pre",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      transform(source, id) {
        if (id.replaceAll("\\", "/") !== path.resolve(component).replaceAll("\\", "/")) return null;
        assert.equal(source.replaceAll("\r\n", "\n"), original);
        return { code: transformed, map: null };
      },
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/platform-admin/accounts") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P39 整页组合</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
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
  console.log(`p39_composed_host ${origin}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 759, 760, 761, 1024, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        requests = [],
        errors = [],
        unexpected = [];
      let variant = "normal",
        status = 200,
        held,
        release;
      await page.clock.setFixedTime(new Date("2026-09-11T02:00:00Z"));
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
            query: Object.fromEntries(url.searchParams),
            variant,
            status,
          });
          if (held) await held;
          const overview = structuredClone(data.overview);
          if (variant === "long")
            overview.organizations[0].name = "跨境供应链协同与选品研究组织".repeat(6);
          if (variant === "empty") overview.organizations = [];
          if (variant === "multi")
            overview.organizations = [
              ...overview.organizations,
              ...[1, 2].map((n) => ({
                ...overview.organizations[0],
                id: `00000000-0000-4000-8000-00000000003${n}`,
                name: `合成组织样例 ${n}`,
                slug: `fixture-org-${n}`,
                status: n === 1 ? "archived" : "active",
              })),
            ];
          return status === 200
            ? route.fulfill({
                json: {
                  data: overview,
                  request_id: "p39-composed-fixture",
                  trace_id: "p39-composed-fixture",
                },
              })
            : route.fulfill({
                status,
                json: {
                  error: {
                    code: "preview_read_error",
                    message: "测试读取失败",
                    action_hint: "当前读取暂未完成，请稍后重试。",
                  },
                  request_id: "p39-composed-error",
                  trace_id: "p39-composed-error",
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
      const refresh = page.locator(".p39-results-head button");
      const ready = () =>
        page.waitForFunction(
          () =>
            !!document.querySelector(".p39-results-head button") &&
            !document.querySelector(".p39-results-head button").disabled,
        );
      const visit = async (query = "keep=composed") => {
        await page.goto(`${origin}/platform-admin/accounts?${query}`);
        await ready();
        await page.evaluate(() => document.fonts.ready);
      };
      const snap = async (state, label, overlay = false) => {
        if (!capture || (![390, 1440].includes(width) && state !== "normal")) return;
        await page.mouse.move(0, 0);
        await page.evaluate(() => window.scrollTo(0, 0));
        const bytes = await page.screenshot({ fullPage: !overlay, animations: "disabled" }),
          file = `${width}-${state}.png`;
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          label,
          state,
          sha256: hash(bytes),
          kind: "vue-review-template-composed",
          routeId: "P39",
          viewport: page.viewportSize(),
          imageDimensions: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
          concreteUrl: page.url(),
          role: "fixture data without authentication",
          theme: "review-only C blue-white",
          browser: `Chromium ${browser.version()}`,
          os: `${os.platform()} ${os.release()}`,
          capturedAt: new Date().toISOString(),
          sourceSha: hash(JSON.stringify(sourceHashes)),
        });
      };
      await visit();
      check(
        "actual original global summary remains independent of one organization row",
        await page.locator(".account-metrics strong").allTextContents(),
        ["2 / 3", "16 / 18", "2"],
      );
      check(
        "exact three original management links",
        await page
          .locator(".account-tabs a")
          .evaluateAll((ns) => ns.map((n) => n.getAttribute("href"))),
        ["/platform-admin/organizations", "/platform-admin/users", "/platform-admin/admins"],
      );
      check(
        "refresh moved without duplicating action",
        await page.getByRole("button", { name: "刷新数据", exact: true }).count(),
        1,
      );
      const a = await page.locator(".p39-directory").boundingBox(),
        b = await page.locator(".p39-results").boundingBox();
      check(
        "C directory/result responsive separation",
        width <= 1024 ? b.y >= a.y + a.height : b.x >= a.x + a.width,
      );
      check(
        "normal no page horizontal overflow",
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      );
      check(
        "blue scope title has explicit white text",
        await page.locator(".p39-directory h3").evaluate((n) => getComputedStyle(n).color),
        "rgb(255, 255, 255)",
      );
      check(
        "normal visible interactive targets at least44px and16px text",
        await page
          .locator(".account-center :is(button,a,input,select,summary)")
          .evaluateAll((nodes) =>
            nodes
              .filter((n) => n.checkVisibility({ visibilityProperty: true }))
              .every((n) => {
                const r = n.getBoundingClientRect();
                return (
                  r.width >= 44 && r.height >= 44 && parseFloat(getComputedStyle(n).fontSize) >= 16
                );
              }),
          ),
      );
      if (width === 390)
        check(
          "first real organization starts inside mobile first viewport",
          await page
            .locator(".responsive-data-view__mobile article")
            .first()
            .evaluate((n) => n.getBoundingClientRect().top < innerHeight),
        );
      await snap("normal", "原始单条组织 · 全局汇总独立");
      if (![390, 1440].includes(width)) continue;
      variant = "long";
      await visit();
      check(
        "long organization does not overflow page",
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      );
      await snap("long", "长组织名称 · 合成数据");
      variant = "multi";
      await visit();
      await snap("multiple", "三条组织 · 明确合成变体");
      variant = "normal";
      await visit();
      if (width <= 760) {
        await page.locator(".responsive-filter-drawer__trigger").click();
        await page.getByRole("dialog", { name: "账号筛选", exact: true }).waitFor();
        await snap("filters", "原生移动筛选层与新组合", true);
        await page.keyboard.press("Escape");
        const record = page.locator(".responsive-data-view__mobile article button").first();
        await record.click();
        await page.locator(".responsive-data-view__drawer").waitFor();
        check(
          "record preview opens without reading or writing",
          await page.locator(".responsive-data-view__drawer").getAttribute("aria-label"),
          data.overview.organizations[0].name,
        );
        await snap("record-preview", "组织记录预览 · 非组织详情路由", true);
        await page.locator(".responsive-data-view__drawer summary").click();
        await snap("record-technical", "记录预览技术详情", true);
        await page.keyboard.press("Escape");
        check(
          "record close restores trigger",
          await record.evaluate((n) => n === document.activeElement),
        );
      } else {
        await page.locator(".table-view-controls__toolbar summary").click();
        await snap("columns", "桌面列设置");
        await page.locator(".table-view-controls__toolbar summary").click();
      }
      await page
        .locator(".hero-actions")
        .getByRole("button", { name: "新建用户", exact: true })
        .click();
      await page.getByRole("dialog", { name: "新建用户或平台管理员", exact: true }).waitFor();
      await snap("create-user", "同一页面打开新建用户", true);
      await page.keyboard.press("Escape");
      held = new Promise((r) => (release = r));
      await refresh.click();
      await page.waitForFunction(
        () => document.querySelector(".p39-results-head button")?.disabled,
      );
      check(
        "background read keeps original global counts",
        await page.locator(".account-metrics strong").allTextContents(),
        ["2 / 3", "16 / 18", "2"],
      );
      await snap("refreshing", "后台读取 · 保留原数据");
      status = 500;
      release();
      held = null;
      await ready();
      check(
        "refresh failure retains snapshot and explicit original notice",
        (await page.locator(".account-message").innerText()).includes("已保留上次成功读取的数据"),
      );
      await snap("refresh-failed", "刷新失败 · 原快照保留");
      status = 200;
      variant = "empty";
      await visit();
      check(
        "empty organization array does not zero independent global totals",
        await page.locator(".account-metrics strong").allTextContents(),
        ["2 / 3", "16 / 18", "2"],
      );
      await snap("empty", "当前返回无组织 · 全局汇总仍独立");
      await visit("query=不存在&keep=composed");
      await snap("no-results", "已筛选但返回无组织 · 测试响应");
      status = 500;
      variant = "normal";
      await visit();
      check(
        "first read failure does not invent zero global counts",
        await page.locator(".account-metrics").count(),
        0,
      );
      await snap("first-failure", "首次读取失败 · 无伪造汇总");
      status = 200;
      held = new Promise((r) => (release = r));
      await page.goto(`${origin}/platform-admin/accounts?keep=composed`);
      await page.locator(".p39-results > .account-state").waitFor();
      await snap("loading", "首次读取中");
      release();
      held = null;
      await ready();
      check(
        "no unexpected writes/external requests or browser errors",
        { unexpected, errors },
        { unexpected: [], errors: [] },
      );
      observations.push({
        width,
        requests,
        scope:
          "GET fixtures only; full P39 parent composition, not App/NavigationShell, destination route rendering, real filtering or production",
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
        approval: "pending",
        scope:
          "Full P39 parent-component review composition; original script and control bindings with review-only template grouping/copy and CSS. Prior filter/create styles composed unchanged. Not complete app shell, real RBAC/backend/filtering, production implementation or all-state acceptance.",
        sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        sourceHashes,
        transformedSourceHash: hash(transformed),
        checks,
        observations,
        screenshots,
        processesClosed: true,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P39 整页组合审核</title><style>body{margin:24px auto;max-width:1440px;padding:20px;background:#edf1f6;color:#202c3d;font-family:'Microsoft YaHei',sans-serif}img{max-width:100%;border:1px solid #dbe1e9}section{margin:36px 0}</style><h1>P39 整页组合 · 待审核</h1><p>实际Vue父子逻辑，审核专用结构/样式，全部GET为测试响应。完整应用导航壳、真实权限/筛选、生产未验收。</p>${screenshots.map((s) => `<section><h2>${s.viewport.width}px · ${s.label}</h2><img src="${s.file}" alt="${s.label}"></section>`).join("\n")}`,
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
