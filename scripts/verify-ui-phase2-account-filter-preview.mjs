import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { accountFilterPreview } from "./lib/ui-phase2-account-filter-preview.mjs";
import { buildAccountOverviewDesignData } from "./lib/ui-phase2-account-overview-design-data.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p39-filter-preview";
const component = "apps/web/src/components/PlatformAccountCenter.vue";
const style = "design-plans/ui-phase-2-2026-09-07/implementation/account-filter-preview.css";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const data = await buildAccountOverviewDesignData(process.cwd());
const patched = accountFilterPreview(await read(component));
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((m) => `apps/web/src/${m[1]}`);
const sources = new Set([
  component,
  style,
  ...cssFiles,
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  "scripts/verify-ui-phase2-account-filter-preview.mjs",
  "scripts/lib/ui-phase2-account-filter-preview.mjs",
  "scripts/lib/ui-phase2-account-overview-design-data.mjs",
  "tests/e2e/m06-01-platform-accounts.spec.ts",
  "apps/api/src/platform-account-service.ts",
  "apps/api/src/mysql-platform-account-repository.ts",
]);
// Fingerprint the local import graph rather than treating the parent as all rendered code.
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
  await Promise.all([...sources].sort().map(async (file) => [file, hash(await read(file))])),
);
const entry = "/__p39_filter_preview.js";
const host = `import {createApp,h} from 'vue';import {createRouter,createWebHistory} from 'vue-router';
import Current from '/src/components/PlatformAccountCenter.vue';
${cssFiles.map((file) => `import '/src/${file.slice("apps/web/src/".length)}';`).join("\n")}
import '/@fs/${path.resolve(style).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p39-filter-preview');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const app=createApp({render:()=>h('main',[h('p',{class:'preview-disclaimer'},'P39 筛选 · Vue 逻辑 + 待审模板/CSS · 测试样例 · 未上线'),h(Current,{apiBaseUrl:'/api/v1',routePath:'/platform-admin/accounts'})])}).use(router);
await router.isReady();app.mount('#app');`;
const probe = reservePort();
await new Promise((done) => probe.listen(0, "127.0.0.1", done));
const port = probe.address().port;
await new Promise((done) => probe.close(done));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {}, hmr: false },
  plugins: [
    {
      name: "p39-filter-review-only",
      enforce: "pre",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      transform(source, id) {
        if (id.replaceAll("\\", "/") !== path.resolve(component).replaceAll("\\", "/")) return null;
        assert.equal(
          source.replaceAll("\r\n", "\n"),
          patched.source.replace(patched.form, patched.original),
        );
        return { code: patched.source, map: null };
      },
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/platform-admin/accounts") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P39 筛选组合预览</title><div id="app"></div><script type="module" src="${entry}"></script></html>`,
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
  console.log(`p39_filter_preview_host ${origin}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        requests = [],
        errors = [],
        unexpected = [];
      let held, release;
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (
          url.origin === origin &&
          url.pathname === "/api/v1/platform/accounts" &&
          request.method() === "GET"
        ) {
          requests.push(Object.fromEntries(url.searchParams));
          if (held) await held;
          return route.fulfill({
            json: {
              data: data.overview,
              request_id: "p39-filter-fixture",
              trace_id: "p39-filter-fixture",
            },
          });
        }
        if (url.origin === origin && !url.pathname.startsWith("/api/")) return route.continue();
        unexpected.push(`${request.method()} ${url.pathname}`);
        return route.abort();
      });
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ width, name });
      };
      await page.goto(`${origin}/platform-admin/accounts?keep=review`);
      const form = page.locator(".account-filter"),
        query = form.getByLabel("关键词", { exact: true }),
        status = form.getByRole("combobox"),
        search = form.getByRole("button", { name: "搜索", exact: true }),
        reset = form.getByRole("button", { name: "重置", exact: true });
      const ready = () =>
        page.waitForFunction(() => !document.querySelector(".account-filter button")?.disabled);
      const open = async () => {
        if (
          width <= 760 &&
          (await page
            .locator(".responsive-filter-drawer__trigger")
            .getAttribute("aria-expanded")) !== "true"
        )
          await page.locator(".responsive-filter-drawer__trigger").click();
        if (width <= 760)
          await page.waitForFunction(
            () =>
              document
                .querySelector(".responsive-filter-drawer__surface")
                ?.getAttribute("aria-hidden") === "false",
          );
        await form.waitFor({ state: "visible" });
      };
      await ready();
      await open();
      await page.evaluate(() => document.fonts.ready);
      const snap = async (state, label) => {
        if (!capture || ![390, 1440].includes(width)) return;
        const bytes = await form.screenshot({ animations: "disabled" }),
          file = `${width}-${state}.png`;
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          label,
          state,
          sha256: hash(bytes),
          viewport: page.viewportSize(),
          imageDimensions: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
          kind: "vue-review-template",
          routeId: "P39",
          concreteUrl: page.url(),
          role: "No real authentication; fixture GET only",
          theme: "review-only C blue/white filter",
          browser: `Chromium ${browser.version()}`,
          os: `${os.platform()} ${os.release()}`,
          capturedAt: new Date().toISOString(),
          sourceSha: hash(JSON.stringify(sourceHashes)),
        });
      };
      check(
        "exact original four status values and labels",
        await status
          .locator("option")
          .evaluateAll((nodes) => nodes.map((n) => [n.value, n.textContent])),
        [
          ["", "全部状态"],
          ["active", "正常使用"],
          ["disabled", "已停用"],
          ["archived", "已停用组织"],
        ],
      );
      check("default reset disabled", await reset.isDisabled());
      check(
        "C sans-serif typography also applies to desktop labels and actions",
        await form
          .locator("span,small,input,select,button")
          .evaluateAll((nodes) =>
            nodes.every((n) => getComputedStyle(n).fontFamily.includes("Microsoft YaHei")),
          ),
      );
      check(
        "grey reset is opaque at both desktop and mobile",
        await reset.evaluate((n) => ({
          opacity: getComputedStyle(n).opacity,
          background: getComputedStyle(n).backgroundColor,
          color: getComputedStyle(n).color,
        })),
        { opacity: "1", background: "rgb(237, 241, 246)", color: "rgb(88, 103, 123)" },
      );
      check(
        "labels and help resolve; no added validity policy",
        await form
          .locator("input,select")
          .evaluateAll((nodes) =>
            nodes.every(
              (n) =>
                n.labels.length &&
                !n.disabled &&
                !n.required &&
                !n.hasAttribute("maxlength") &&
                !n.hasAttribute("aria-invalid") &&
                document.getElementById(n.getAttribute("aria-describedby"))?.textContent,
            ),
          ),
      );
      const geometry = await form.locator("input,select,button").evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect(),
            s = getComputedStyle(n);
          return { x: r.x, y: r.y, w: r.width, h: r.height, font: parseFloat(s.fontSize) };
        }),
      );
      check(
        "all four controls at least 44px and 16px text",
        geometry.every((r) => r.w >= 44 && r.h >= 44 && r.font >= 16),
      );
      check(
        "responsive field arrangement",
        width <= 760
          ? geometry[0].x === geometry[1].x && geometry[1].y > geometry[0].y
          : geometry[0].y === geometry[1].y && geometry[1].x > geometry[0].x,
      );
      check(
        "no horizontal overflow in form",
        await form.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
      );
      await page.mouse.move(0, 0);
      await query.evaluate((n) => n.blur());
      await snap("default", "默认字段 · 重置禁用");
      await query.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      check(
        "keyword native keyboard focus",
        await query.evaluate((n) => ({
          focused: n === document.activeElement,
          visible: n.matches(":focus-visible"),
          outline: getComputedStyle(n).outlineColor,
          width: getComputedStyle(n).outlineWidth,
        })),
        { focused: true, visible: true, outline: "rgb(37, 74, 156)", width: "3px" },
      );
      await snap("query-focus", "关键词 · 蓝色键盘焦点");
      await page.keyboard.press("Tab");
      check(
        "status follows query in keyboard order",
        await status.evaluate((n) => n === document.activeElement),
      );
      await snap("status-focus", "账号状态 · 蓝色键盘焦点");
      await query.fill("米豆");
      await status.selectOption("archived");
      await status.evaluate((n) => n.blur());
      check(
        "typing is draft only; reset now enabled",
        requests.length === 1 && !(await reset.isDisabled()),
      );
      await snap("selected", "已填写 · 已停用组织");
      await search.hover();
      await snap("search-hover", "搜索 · 悬停");
      await page.mouse.move(0, 0);
      await status.focus();
      await page.keyboard.press("Tab");
      check("search keyboard focus", await search.evaluate((n) => n === document.activeElement));
      await snap("search-focus", "搜索 · 键盘焦点");
      await search.hover();
      const box = await search.boundingBox();
      await page.mouse.down();
      check(
        "pressed image is a native active button",
        await search.evaluate((n) => n.matches(":active")),
      );
      check(
        "pressed has no displacement or premature GET",
        JSON.stringify(await search.boundingBox()) === JSON.stringify(box) && requests.length === 1,
      );
      await snap("search-pressed", "搜索 · 按下未提交");
      held = new Promise((done) => (release = done));
      await page.mouse.up();
      await page.waitForFunction(() => document.querySelector(".account-filter button")?.disabled);
      await open();
      check(
        "pending disables only search and reset; fields still editable",
        (await search.isDisabled()) &&
          (await reset.isDisabled()) &&
          !(await query.isDisabled()) &&
          !(await status.isDisabled()),
      );
      check(
        "pending exact query/status GET and preserved other URL key",
        requests.at(-1)?.query === "米豆" &&
          requests.at(-1)?.status === "archived" &&
          new URL(page.url()).searchParams.get("keep") === "review",
      );
      await page.mouse.move(0, 0);
      await snap("pending", "读取中 · 搜索和重置禁用");
      release();
      held = null;
      await ready();
      await search.focus();
      await page.keyboard.press("Tab");
      check("reset focus after ready", await reset.evaluate((n) => n === document.activeElement));
      await snap("reset-focus", "重置 · 键盘焦点");
      await reset.click();
      await ready();
      await page.waitForFunction(
        () => document.querySelector(".account-filter input")?.value === "",
      );
      check(
        "reset removes only query/status and resets fields",
        (await query.inputValue()) === "" &&
          (await status.inputValue()) === "" &&
          new URL(page.url()).search === "?keep=review",
      );
      await query.fill("字".repeat(121));
      check(
        "editing 121 characters remains possible without inventing max length",
        (await query.inputValue()).length,
        121,
      );
      await query.fill("");
      if (width <= 760) {
        await page.keyboard.press("Escape");
        check(
          "mobile close returns focus to trigger",
          await page
            .locator(".responsive-filter-drawer__trigger")
            .evaluate((n) => n === document.activeElement),
        );
      }
      check(
        "no browser errors or external/write requests",
        { errors, unexpected },
        { errors: [], unexpected: [] },
      );
      observations.push({
        width,
        requests,
        fixtureSemantics: "Same original overview for every GET; does not prove backend filtering",
        mobileSearchClosesDrawer: width <= 760,
        pendingFieldsEditable: true,
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
          "Current Vue script and native bindings; review-host-only form wrappers, label/help attributes and C CSS. Not unchanged production template, full shell, real filtering, RBAC, API or production acceptance.",
        sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        sourceHashes,
        templateTransform: {
          originalHash: hash(patched.original),
          reviewHash: hash(patched.form),
          scriptUnchanged: true,
        },
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
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P39 筛选组合</title><style>body{max-width:1200px;margin:32px auto;padding:16px;font-family:'Microsoft YaHei',sans-serif;color:#202c3d;background:#edf1f6}img{max-width:100%;border:1px solid #dbe1e9}section{margin:32px 0}p{line-height:1.7}</style><h1>P39 筛选组合 · 待审</h1><p>真实 Vue 逻辑，预览专用模板和样式；所有接口返回测试样例。只审核字段及底部操作，不包含外层抽屉、整页、实际筛选或生产验收。</p>${screenshots.map((s) => `<section><h2>${s.viewport.width}px · ${s.label}</h2><img src="${s.file}" alt="${s.label}"></section>`).join("\n")}`,
  );
}
console.log(
  JSON.stringify({
    checks: checks.length,
    screenshots: screenshots.length,
    processesClosed: true,
    output,
  }),
);
