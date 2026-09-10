import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import os from "node:os";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { buildPlatformOverviewDesignData } from "./lib/ui-phase2-platform-overview-design-data.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const output = "output/playwright/p38-vue-c-preview";
const stylesheet =
  "design-plans/ui-phase-2-2026-09-07/implementation/platform-overview-preview.css";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fixture = await buildPlatformOverviewDesignData(process.cwd());
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((m) => m[1]);
const entry = "/__p38_vue_preview.js";
const host = `import {createApp,h} from 'vue';
import {createRouter,createWebHistory} from 'vue-router';
import Current from '/src/components/PlatformDashboard.vue';
${cssFiles.map((file) => `import '/src/${file}';`).join("\n")}
import '/@fs/${path.resolve(stylesheet).replaceAll("\\", "/")}';
document.documentElement.dataset.design='signal-ledger';
document.body.classList.add('p38-vue-preview');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
window.__previewPushWindow=(windowCode)=>router.push({query:{...router.currentRoute.value.query,window:windowCode}});
const app=createApp({render:()=>h('main',[
h('p',{class:'preview-disclaimer'},'P38 · 真实 Vue 独立设计预览 · 测试样例数据（非 MySQL 实测） · 未批准 / 未上线'),
h(Current,{apiBaseUrl:'/api/v1',capabilities:['platform:operate']})])}).use(router);
await router.isReady();app.mount('#app');`;
const probe = reservePort();
await new Promise((done) => probe.listen(0, "127.0.0.1", done));
const port = probe.address().port;
await new Promise((done) => probe.close(done));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {} },
  plugins: [
    {
      name: "p38-unchanged-vue-preview",
      resolveId(id) {
        if (id === entry) return entry;
      },
      load(id) {
        if (id === entry) return host;
      },
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/platform-admin") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>P38 真实 Vue C 方向预览</title><div id="app"></div>
<script type="module" src="${entry}"></script></html>`);
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
  console.log(`p38_vue_preview_host ${origin}`);
  browser = await chromium.launch({ headless: true });
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      await context.addInitScript(() => {
        window.__previewClipboard = { writes: [], deny: false };
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (value) => {
              if (window.__previewClipboard.deny) throw new Error("P38 synthetic clipboard denied");
              window.__previewClipboard.writes.push(value);
            },
          },
        });
      });
      const page = await context.newPage();
      const errors = [],
        unexpected = [],
        requests = [];
      let status = 200,
        response = structuredClone(fixture.dashboard),
        windowMarkers = false,
        release,
        held;
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (
          url.origin === origin &&
          url.pathname === "/api/v1/platform/dashboard" &&
          request.method() === "GET"
        ) {
          requests.push(url.searchParams.get("window"));
          if (held) await held;
          return route.fulfill({
            status,
            json:
              status === 200
                ? {
                    data: {
                      ...response,
                      window: url.searchParams.get("window"),
                      ...(windowMarkers
                        ? {
                            summary: {
                              ...response.summary,
                              active_organizations:
                                { "15m": 15, "7d": 7, "30d": 30 }[url.searchParams.get("window")] ??
                                24,
                            },
                          }
                        : {}),
                    },
                    request_id: "p38-local-fixture",
                    trace_id: "p38-local-fixture",
                  }
                : {
                    error: {
                      code: "preview_failure",
                      message: "测试样例错误",
                      action_hint: "仅供隔离状态验证",
                    },
                    request_id: "p38-local-failure",
                    trace_id: "p38-local-failure",
                  },
          });
        }
        if (url.origin === origin && !url.pathname.startsWith("/api/")) return route.continue();
        unexpected.push(`${request.method()} ${url.pathname}`);
        return route.abort();
      });
      const snap = async (name, locator = page.locator("#app")) => {
        if (!capture || ![390, 1440].includes(width)) return;
        const file = `${width}-${name}.png`;
        let bytes;
        if (name.startsWith("technical-") || name === "failure-technical-open") {
          await locator.scrollIntoViewIfNeeded();
          const clip = await locator.evaluate((node) => {
            const box = node.getBoundingClientRect();
            const x = Math.max(0, box.x + scrollX - 8);
            const y = Math.max(0, box.y + scrollY - 8);
            return {
              x,
              y,
              width: Math.min(document.documentElement.scrollWidth - x, box.width + 16),
              height: Math.min(document.documentElement.scrollHeight - y, box.height + 16),
            };
          });
          bytes = await page.screenshot({ clip, fullPage: true, animations: "disabled" });
        } else bytes = await locator.screenshot({ animations: "disabled" });
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          width,
          sha256: hash(bytes),
          artifactId: `P38-vue-c-${width}-${name}`,
          kind: "vue-isolated",
          routeId: "P38",
          concreteUrl: page.url(),
          role: "fixture platform:operate; no real authentication",
          state: name,
          theme: "review-only C blue-white",
          viewport: page.viewportSize(),
          imageDimensions: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
          buildSha: null,
          buildScope: "Vite development host; no production build",
          capturedAt: new Date().toISOString(),
          browser: `Chromium ${browser.version()}`,
          os: `${os.platform()} ${os.release()}`,
          caseId: `P38-VUE-${name}`,
          font: await locator.evaluate((node) => getComputedStyle(node).fontFamily),
        });
      };
      const ready = () =>
        expect(page.locator(".platform-dashboard")).toHaveAttribute("aria-busy", "false");
      const go = async () => {
        await page.goto(`${origin}/platform-admin?keep=yes`);
        await ready();
        await page.evaluate(() => document.fonts.ready);
      };
      await go();
      await expect(page.locator(".platform-facts")).toContainText("96.4%");
      await expect(page.locator(".platform-action-summary a").first()).toHaveAttribute(
        "href",
        "/platform-admin/collection",
      );
      await expect(page.locator(".platform-action-summary a").last()).toHaveAttribute(
        "href",
        "/platform-admin/collection/overview?root_cause=1",
      );
      await expect(page.locator(".platform-facts")).toContainText("仅超级管理员可查看明细");
      await snap("normal");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
        `overflow ${width}`,
      );
      const windowSelect = page.locator(".platform-dashboard-toolbar select");
      for (const code of ["15m", "7d", "30d", "24h"]) {
        await windowSelect.selectOption(code);
        await expect(page).toHaveURL(new RegExp(`keep=yes.*window=${code}`));
        await ready();
        assert.equal(requests.at(-1), code);
      }
      checks.push({
        width,
        name: "normal fixture, four window requests and preserved query, link targets, no document overflow",
      });
      held = new Promise((done) => (release = done));
      await page.locator(".platform-dashboard-toolbar button").click();
      await expect(windowSelect).toBeDisabled();
      await expect(page.locator(".platform-dashboard-toolbar button")).toBeDisabled();
      await expect(page.locator(".platform-facts")).toContainText("96.4%");
      await snap("refreshing", page.locator(".platform-dashboard-toolbar"));
      release();
      held = null;
      await ready();
      status = 403;
      await windowSelect.selectOption("7d");
      await expect(page.locator(".platform-refresh-feedback")).toBeVisible();
      await expect(page.locator(".platform-facts")).toContainText("96.4%");
      await snap("retained-error");
      observations.push({
        width,
        name: "Existing ready data remains visible after 403; selected window changes even when refresh fails. Not a permission or freshness pass.",
      });
      status = 200;
      await page.getByRole("button", { name: "重新刷新", exact: true }).click();
      await expect(page.locator(".platform-refresh-feedback")).toHaveCount(0);
      await ready();
      response = {
        ...fixture.dashboard,
        provider_health: fixture.providers15,
        task_trend: fixture.trend,
      };
      await go();
      const rows = page.locator(
        width <= 760 ? ".responsive-data-view__mobile article" : "tbody tr",
      );
      await expect(rows).toHaveCount(8);
      await page.locator(".platform-provider-disclosure").click();
      await expect(rows).toHaveCount(15);
      await snap("all-sources", page.locator(".platform-dashboard-grid > section").nth(1));
      await page.locator(".platform-provider-disclosure").click();
      await expect(rows).toHaveCount(8);
      checks.push({
        width,
        name: "pending disabled controls, retained data, error retry, source 8 to 15 to 8",
      });
      if (width <= 760) {
        const trigger = page.locator(".responsive-data-view__mobile article button").first();
        await trigger.click();
        const drawer = page.locator(".responsive-data-view__drawer"),
          close = drawer.getByRole("button", { name: "关闭详情" });
        await expect(close).toBeFocused();
        await snap("drawer", drawer);
        await drawer.locator("summary").click();
        await snap("drawer-technical", drawer);
        await page.keyboard.press("Escape");
        await expect(drawer).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await trigger.click();
        await close.click();
        await expect(trigger).toBeFocused();
        await trigger.click();
        await close.focus();
        await page.keyboard.press("Shift+Tab");
        await expect(drawer.locator("summary")).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(close).toBeFocused();
        await trigger.evaluate((node) => node.focus());
        await expect(close).toBeFocused();
        assert.equal(await page.locator("#app").evaluate((node) => node.inert), true);
        await close.click();
        checks.push({
          width,
          name: "actual mobile drawer modal focus trap, background isolation, technical disclosure, Escape and close focus return",
        });
      } else {
        const toolbar = page.locator(".table-view-controls__toolbar");
        await toolbar.locator("summary").click();
        await snap("columns", page.locator(".platform-dashboard-grid > section").nth(1));
        const toggles = toolbar.getByRole("checkbox");
        for (let i = 0; i < 3; i++) await toggles.nth(i).uncheck();
        await expect(toggles.nth(3)).toBeDisabled();
        assert.equal(await page.locator("thead th:visible").count(), 1);
        for (let i = 0; i < 3; i++) await toggles.nth(i).check();
        await toolbar.locator("summary").click();
        const freeze = toolbar.getByRole("button");
        await freeze.click();
        await expect(freeze).toHaveAttribute("aria-pressed", "false");
        await expect(page.locator(".table-view-controls__frozen")).toHaveCount(0);
        await freeze.click();
        const cell = page.locator("tbody td").first();
        const standard = await cell.evaluate((node) =>
          parseFloat(getComputedStyle(node).paddingTop),
        );
        await toolbar.locator("select").selectOption("compact");
        await expect(page.locator("table")).toHaveAttribute("data-table-density", "compact");
        await expect
          .poll(() => cell.evaluate((node) => parseFloat(getComputedStyle(node).paddingTop)))
          .toBeLessThan(standard);
        await snap("compact", page.locator(".platform-dashboard-grid > section").nth(1));
        checks.push({
          width,
          name: "actual columns, last-column protection, freeze toggle, density computed padding",
        });
      }
      for (const code of [401, 403, 429, 500]) {
        status = code;
        await go();
        const kind = { 401: "expired", 403: "forbidden", 429: "rate_limited", 500: "blocked" }[
          code
        ];
        await expect(page.locator(".platform-dashboard-state")).toHaveAttribute("data-kind", kind);
        await expect(page.locator(".platform-facts")).toHaveCount(0);
        await snap(`initial-${code}`, page.locator(".platform-dashboard-state"));
      }
      status = 200;
      response = {
        ...fixture.dashboard,
        summary: {},
        queues: [],
        alerts: [],
        provider_health: [],
        task_trend: [],
      };
      await go();
      await expect(page.locator(".platform-dashboard-state")).toHaveAttribute("data-kind", "empty");
      await snap("empty", page.locator(".platform-dashboard-state"));
      for (const rate of [null, 0]) {
        response = {
          ...fixture.dashboard,
          summary: { ...fixture.dashboard.summary, task_success_rate: rate },
        };
        await go();
        await expect(page.locator(".platform-facts")).toContainText(
          rate === null ? "暂无样本" : "0.0%",
        );
        await snap(rate === null ? "no-sample" : "zero-rate", page.locator(".platform-facts"));
      }
      response = structuredClone(fixture.dashboard);
      await go();
      const technical = page.locator(".platform-observed .technical-details");
      const summary = technical.locator("summary");
      await summary.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(summary).toBeFocused();
      await snap("technical-summary-focus", page.locator(".platform-observed"));
      await page.keyboard.press("Enter");
      await expect(technical).toHaveAttribute("open", "");
      await expect(technical.locator("code")).toHaveText("p38-local-fixture");
      await snap("technical-open", page.locator(".platform-observed"));
      await page.keyboard.press("Tab");
      const copyButton = technical.getByRole("button", { name: "复制请求编号" });
      await expect(copyButton).toBeFocused();
      await snap("technical-copy-focus", page.locator(".platform-observed"));
      await copyButton.blur();
      await copyButton.hover();
      await snap("technical-copy-hover", page.locator(".platform-observed"));
      await page.mouse.down();
      await snap("technical-copy-pressed", page.locator(".platform-observed"));
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await copyButton.focus();
      await page.keyboard.press("Enter");
      await expect(copyButton).toHaveText("已复制");
      assert.deepEqual(await page.evaluate(() => window.__previewClipboard.writes), [
        "p38-local-fixture",
      ]);
      await snap("technical-copy-success", page.locator(".platform-observed"));
      await expect(copyButton).toHaveText("复制", { timeout: 4000 });
      assert.equal(
        await copyButton.evaluate((node) => node.getBoundingClientRect().height >= 44),
        true,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
      );
      checks.push({
        width,
        name: "technical keyboard disclosure, exact request ID clipboard adapter, focus/hover/pressed/success, feedback expiry and 44px target",
      });
      await windowSelect.selectOption("15m");
      await ready();
      await page.evaluate(() => window.__previewPushWindow("7d"));
      await expect(page).toHaveURL(/window=7d/);
      await windowSelect.selectOption("30d");
      await ready();
      const beforeBack = requests.length;
      await page.goBack();
      await expect(page).toHaveURL(/window=15m/);
      await ready();
      await expect(windowSelect).toHaveValue("15m");
      assert.equal(requests.at(-1), "15m");
      assert.equal(requests.length, beforeBack + 1);
      await page.goForward();
      await expect(page).toHaveURL(/window=30d/);
      await ready();
      await expect(windowSelect).toHaveValue("30d");
      assert.equal(requests.at(-1), "30d");
      assert.equal(requests.length, beforeBack + 2);
      checks.push({
        width,
        name: "Actual browser Back and Forward synchronize window and issue exactly one matching read each; synthetic same-route history entry.",
      });
      windowMarkers = true;
      const beforeQueue = requests.length;
      held = new Promise((done) => (release = done));
      await page.locator(".platform-dashboard-toolbar button").click();
      await expect(windowSelect).toBeDisabled();
      await page.evaluate(() => window.__previewPushWindow("15m"));
      await page.evaluate(() => window.__previewPushWindow("7d"));
      await expect(windowSelect).toHaveValue("7d");
      assert.equal(requests.length, beforeQueue + 1);
      release();
      held = null;
      await ready();
      await expect(page.locator(".platform-facts article strong").first()).toHaveText("7");
      assert.deepEqual(requests.slice(beforeQueue), ["30d", "7d"]);
      await snap("history-latest-window");
      checks.push({
        width,
        name: "Held read followed by two history changes coalesces to latest 7d and renders the matching fixture marker",
      });
      windowMarkers = false;
      status = 500;
      await go();
      const failedTechnical = page.locator(".platform-dashboard-state .technical-details");
      await failedTechnical.locator("summary").click();
      await expect(failedTechnical.locator("code")).toHaveText("p38-local-failure");
      await snap("failure-technical-open", page.locator(".platform-dashboard-state"));
      const failedCopy = failedTechnical.getByRole("button", { name: "复制请求编号" });
      await failedCopy.click();
      await expect(failedCopy).toHaveText("已复制");
      assert.deepEqual(await page.evaluate(() => window.__previewClipboard.writes), [
        "p38-local-failure",
      ]);
      await expect(failedCopy).toHaveText("复制", { timeout: 4000 });
      checks.push({
        width,
        name: "initial failure diagnostic copies its own request ID through local adapter; no OS clipboard access",
      });
      assert.deepEqual(errors, []);
      assert.deepEqual(unexpected, []);
      checks.push({
        width,
        name: "initial 401/403/429/500, empty, null versus zero, no page errors or external/unexpected API requests",
      });
      await page.evaluate(() => {
        window.__previewClipboard.deny = true;
      });
      const denied = page.waitForEvent("pageerror", {
        predicate: (error) => error.message === "P38 synthetic clipboard denied",
      });
      await failedCopy.click();
      await denied;
      await expect(failedCopy).toHaveText("复制");
      assert.deepEqual(errors, ["P38 synthetic clipboard denied"]);
      assert.deepEqual(unexpected, []);
      observations.push({
        width,
        name: "Clipboard denial remains an uncaught page error with no user-facing failure feedback; deliberate local adapter rejection, not a pass.",
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
const sourceFiles = [
  "scripts/verify-ui-phase2-platform-overview-vue-preview.mjs",
  stylesheet,
  "scripts/lib/ui-phase2-platform-overview-design-data.mjs",
  "tests/e2e/m06-02-platform-dashboard.spec.ts",
  "apps/web/src/components/PlatformDashboard.vue",
  "apps/web/src/components/ResponsiveDataView.vue",
  "apps/web/src/components/TableViewControls.vue",
  "apps/web/src/components/TechnicalDetails.vue",
  "apps/web/src/api-client.ts",
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  ...cssFiles.map((file) => `apps/web/src/${file}`),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(sourceFiles.map(async (file) => [file, hash(await read(file))])),
);
const sourceSha = hash(JSON.stringify(sourceHashes));
for (const screenshot of screenshots) screenshot.sourceSha = sourceSha;
if (capture) {
  const evidence = {
    schemaVersion: 2,
    page: "P38",
    approval: "pending",
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    implementation:
      "Actual Vue with verified history-window synchronization; template and review CSS unchanged; no production CSS import",
    scope:
      "Fixture-intercepted GET only; no real API, MySQL, RBAC, full history/KeepAlive, OS clipboard or production acceptance. Browser history uses a synthetic same-route entry; copy uses a local success/rejection adapter. Real dashboard GET writes view and audit records.",
    checks,
    observations,
    sourceHashes,
    screenshots,
  };
  await writeFile(`${output}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P38 实际 Vue 审核图</title>
<h1>P38 实际 Vue · C 方向待审核</h1><p>测试样例；不是生产或权限验收。已知问题见 evidence.json。</p>
${screenshots.map(({ file }) => `<section><h2>${file}</h2><img style="max-width:100%" src="${file}" alt="${file}"></section>`).join("\n")}</html>\n`,
  );
}
console.log(
  JSON.stringify({
    checks: checks.length,
    screenshots: screenshots.length,
    observations,
    processesClosed: true,
  }),
);
