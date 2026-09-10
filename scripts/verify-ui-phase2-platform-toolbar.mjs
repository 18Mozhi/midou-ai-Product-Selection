import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createServer as reservePort } from "node:net";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { buildPlatformOverviewDesignData } from "./lib/ui-phase2-platform-overview-design-data.mjs";

const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const output = "output/playwright/p38-toolbar-compositions";
const baseStyle = "design-plans/ui-phase-2-2026-09-07/implementation/platform-overview-preview.css";
const controlStyle =
  "design-plans/ui-phase-2-2026-09-07/implementation/platform-overview-controls-preview.css";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const data = await buildPlatformOverviewDesignData(process.cwd());
const cssFiles = [
  ...(await read("apps/web/src/main.ts")).matchAll(/import "\.\/(.*?\.css)";/g),
].map((match) => match[1]);
const entry = "/__p38_toolbar.js";
const host = `import {createApp,h} from 'vue';
import {createRouter,createWebHistory} from 'vue-router';
import Current from '/src/components/PlatformDashboard.vue';
${cssFiles.map((file) => `import '/src/${file}';`).join("\n")}
${[baseStyle, controlStyle].map((file) => `import '/@fs/${path.resolve(file).replaceAll("\\", "/")}';`).join("\n")}
document.documentElement.dataset.design='signal-ledger';document.body.classList.add('p38-vue-preview');
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{render:()=>null}}]});
const app=createApp({render:()=>h('main',[
h('p',{class:'preview-disclaimer'},'P38 控制区 · 实际 Vue · 测试样例 · 本组合待审 / 未上线'),
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
      name: "p38-toolbar-preview",
      resolveId: (id) => (id === entry ? entry : undefined),
      load: (id) => (id === entry ? host : undefined),
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/platform-admin") return next();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>P38 控制区状态</title>
<div id="app"></div><script type="module" src="${entry}"></script></html>`);
        });
      },
    },
  ],
});
const checks = [],
  disabledComparisons = [],
  screenshots = [];
const require = createRequire(import.meta.url);
const { PNG } = require(
  path.join(path.dirname(require.resolve("playwright-core/package.json")), "lib/utilsBundle.js"),
);
function comparePixels(before, after) {
  const a = PNG.sync.read(before),
    b = PNG.sync.read(after);
  assert.deepEqual([a.width, a.height], [b.width, b.height]);
  let changedPixels = 0,
    maxChannelDelta = 0;
  for (let p = 0; p < a.width * a.height; p++) {
    let changed = false;
    for (let c = 0; c < 4; c++) {
      const delta = Math.abs(a.data[p * 4 + c] - b.data[p * 4 + c]);
      changed ||= delta > 0;
      maxChannelDelta = Math.max(maxChannelDelta, delta);
    }
    if (changed) changedPixels++;
  }
  return {
    beforeSha256: hash(before),
    afterSha256: hash(after),
    dimensions: [a.width, a.height],
    changedPixels,
    maxChannelDelta,
  };
}
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`p38_toolbar_host ${origin}`);
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
        errors = [],
        unexpected = [],
        requests = [];
      let status = 200,
        held,
        release;
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (
          url.origin === origin &&
          url.pathname === "/api/v1/platform/dashboard" &&
          req.method() === "GET"
        ) {
          requests.push(url.searchParams.get("window"));
          if (held) await held;
          return route.fulfill({
            status,
            json:
              status === 200
                ? {
                    data: { ...data.dashboard, window: url.searchParams.get("window") },
                    request_id: "p38-toolbar-fixture",
                    trace_id: "p38-toolbar-fixture",
                  }
                : {
                    error: {
                      code: "preview_failure",
                      message: "测试读取失败",
                      action_hint: "仅供隔离验证",
                    },
                    request_id: "p38-toolbar-failure",
                    trace_id: "p38-toolbar-failure",
                  },
          });
        }
        if (url.origin === origin && !url.pathname.startsWith("/api/")) return route.continue();
        unexpected.push(`${req.method()} ${url.pathname}`);
        return route.abort();
      });
      await page.goto(`${origin}/platform-admin?window=24h&keep=toolbar`);
      const toolbar = page.locator(".platform-dashboard-toolbar"),
        range = toolbar.getByRole("combobox"),
        refresh = toolbar.getByRole("button"),
        dashboard = page.locator(".platform-dashboard");
      const ready = () => expect(dashboard).toHaveAttribute("aria-busy", "false");
      await ready();
      await expect(range).toHaveValue("24h");
      await page.evaluate(() => document.fonts.ready);
      const snap = async (name, withFeedback = false) => {
        if (!capture || ![390, 1440].includes(width)) return;
        await toolbar.scrollIntoViewIfNeeded();
        const clip = await toolbar.evaluate((node, includeFeedback) => {
          const nodes = [
            node,
            ...(includeFeedback ? [document.querySelector(".platform-refresh-feedback")] : []),
          ];
          const boxes = nodes.filter(Boolean).map((n) => n.getBoundingClientRect());
          const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) + scrollX - 8),
            y = Math.max(0, Math.min(...boxes.map((b) => b.y)) + scrollY - 8);
          return {
            x,
            y,
            width: Math.min(
              document.documentElement.scrollWidth - x,
              Math.max(...boxes.map((b) => b.right)) + scrollX - x + 8,
            ),
            height: Math.min(
              document.documentElement.scrollHeight - y,
              Math.max(...boxes.map((b) => b.bottom)) + scrollY - y + 8,
            ),
          };
        }, withFeedback);
        const bytes = await page.screenshot({ clip, fullPage: true, animations: "disabled" }),
          file = `${width}-${name}.png`;
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({
          file,
          sha256: hash(bytes),
          artifactId: `P38-toolbar-${width}-${name}`,
          kind: "vue-isolated",
          routeId: "P38",
          state: name,
          role: "fixture platform:operate; no real authentication",
          concreteUrl: page.url(),
          theme: "review-only C blue-white",
          viewport: page.viewportSize(),
          imageDimensions: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
          capturedAt: new Date().toISOString(),
          browser: `Chromium ${browser.version()}`,
          os: `${os.platform()} ${os.release()}`,
          font: await toolbar.evaluate((n) => getComputedStyle(n).fontFamily),
          buildSha: null,
          buildScope: "Vite development host; no production build",
          caseId: `P38-toolbar-${name}`,
        });
      };
      const setSkin = async (disabled) =>
        page.evaluate((disabled) => {
          const sheets = [...document.querySelectorAll("style[data-vite-dev-id]")].filter((n) =>
            n.dataset.viteDevId.endsWith("/platform-overview-controls-preview.css"),
          );
          if (sheets.length !== 1) throw Error("Missing unique toolbar review stylesheet");
          sheets[0].sheet.disabled = disabled;
        }, disabled);
      await page.mouse.move(0, 0);
      await setSkin(true);
      const before = await toolbar.screenshot({ animations: "disabled" });
      await setSkin(false);
      assert.equal(hash(await toolbar.screenshot({ animations: "disabled" })), hash(before));
      await setSkin(true);
      const factsBefore = await page
        .locator(".platform-facts")
        .screenshot({ animations: "disabled" });
      await setSkin(false);
      assert.equal(
        hash(await page.locator(".platform-facts").screenshot({ animations: "disabled" })),
        hash(factsBefore),
      );
      await snap("normal");
      for (const control of [range, refresh]) {
        const box = await control.boundingBox();
        assert.ok(box.height >= 44);
        assert.ok(
          Number.parseFloat(await control.evaluate((n) => getComputedStyle(n).fontSize)) >= 16,
        );
      }
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
      );
      checks.push({
        width,
        name: "normal toolbar and non-target facts pixels preserved; 44px controls/16px text and no page overflow",
      });

      await range.hover();
      await expect(range).toHaveCSS("background-color", "rgb(240, 245, 255)");
      await snap("range-hover");
      await page.mouse.move(0, 0);
      await range.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(range).toBeFocused();
      await expect(range).toHaveCSS("outline-color", "rgb(255, 255, 255)");
      await expect(range).toHaveCSS("outline-width", "3px");
      await snap("range-focus");
      checks.push({
        width,
        name: "native range hover and keyboard focus; four unchanged options; no invented popup",
      });

      await refresh.hover();
      await expect(refresh).toHaveCSS("background-color", "rgb(240, 245, 255)");
      await snap("refresh-hover");
      await page.mouse.move(0, 0);
      await range.focus();
      await page.keyboard.press("Tab");
      await expect(refresh).toBeFocused();
      await snap("refresh-focus");
      await refresh.hover();
      const unpressed = await refresh.boundingBox();
      await page.mouse.down();
      await expect(refresh).toHaveCSS("background-color", "rgb(219, 231, 251)");
      await expect(refresh).toHaveCSS("transform", "none");
      assert.deepEqual(await refresh.boundingBox(), unpressed);
      assert.equal(requests.length, 1);
      await snap("refresh-pressed");
      checks.push({
        width,
        name: "refresh hover/focus/pressed are distinct; no pressed displacement or read before release",
      });

      held = new Promise((done) => (release = done));
      await page.mouse.up();
      await expect(refresh).toHaveText("刷新中…");
      await expect(refresh).toBeDisabled();
      await expect(range).toBeDisabled();
      await expect.poll(() => requests.length).toBe(2);
      await page.mouse.move(0, 0);
      await snap("refresh-loading");
      await refresh.evaluate((n) => n.click());
      assert.equal(requests.length, 2);
      await setSkin(true);
      const disabledStyles = async () =>
        toolbar.locator("button,select").evaluateAll((nodes) =>
          nodes.map((node) => {
            const style = getComputedStyle(node);
            return Object.fromEntries(
              [
                "backgroundColor",
                "borderColor",
                "outline",
                "color",
                "opacity",
                "transform",
                "fontFamily",
                "fontSize",
                "lineHeight",
                "width",
                "height",
                "padding",
                "borderRadius",
                "boxShadow",
                "transition",
              ].map((key) => [key, style[key]]),
            );
          }),
        );
      for (const control of [range, refresh]) {
        await expect(control).toHaveCSS("background-color", "rgb(227, 233, 243)");
        await expect(control).toHaveCSS("color", "rgb(98, 112, 134)");
      }
      const stylesBefore = await disabledStyles();
      const disabledBefore = await toolbar.screenshot({ animations: "disabled" });
      await setSkin(false);
      assert.deepEqual(await disabledStyles(), stylesBefore);
      const disabledAfter = await toolbar.screenshot({ animations: "disabled" });
      disabledComparisons.push({
        width,
        computedStylesIdentical: true,
        ...comparePixels(disabledBefore, disabledAfter),
      });
      status = 500;
      release();
      held = null;
      await ready();
      await expect(page.locator(".platform-refresh-feedback")).toContainText(
        "继续显示上一份观测结果",
      );
      await expect(refresh).toBeEnabled();
      await snap("refresh-failed", true);
      checks.push({
        width,
        name: "loading keeps existing grey disabled visuals and single read; failed refresh retains snapshot and re-enables controls",
      });

      status = 200;
      await range.focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect(range).toHaveValue("7d");
      await ready();
      await expect.poll(() => requests.at(-1)).toBe("7d");
      assert.equal(new URL(page.url()).searchParams.get("keep"), "toolbar");
      assert.equal(requests.length, 3);
      await page.mouse.move(0, 0);
      await snap("range-7d");
      assert.deepEqual(errors, []);
      assert.deepEqual(unexpected, []);
      checks.push({
        width,
        name: "keyboard selection triggers one 7d read and preserves other query; no real API, writes or browser errors",
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
const files = [
  "scripts/verify-ui-phase2-platform-toolbar.mjs",
  baseStyle,
  controlStyle,
  "scripts/lib/ui-phase2-platform-overview-design-data.mjs",
  "tests/e2e/m06-02-platform-dashboard.spec.ts",
  "apps/web/src/components/PlatformDashboard.vue",
  "apps/web/src/components/ResponsiveDataView.vue",
  "apps/web/src/components/TechnicalDetails.vue",
  "apps/web/src/components/TableViewControls.vue",
  "apps/web/src/api-client.ts",
  "apps/web/src/main.ts",
  "apps/web/vite.config.ts",
  ...cssFiles.map((file) => `apps/web/src/${file}`),
];
const sourceHashes = Object.fromEntries(
    await Promise.all(files.map(async (file) => [file, hash(await read(file))])),
  ),
  sourceSha = hash(JSON.stringify(sourceHashes));
for (const shot of screenshots) shot.sourceSha = sourceSha;
if (capture) {
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        schemaVersion: 2,
        approval: "pending",
        sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        scope:
          "Actual Vue toolbar with fixture GET and scoped review CSS; not native popup, full page, real RBAC/API, MySQL or production acceptance",
        checks,
        disabledComparisons,
        sourceHashes,
        screenshots,
        processesClosed: true,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P38 控制区逐态审核</title>
<h1>P38 控制区 · 实际 Vue · 待审核</h1><p>测试样例、局部组合，不代表整页、业务接口或生产验收。</p>
${screenshots.map((s) => `<section><h2>${s.file}</h2><img style="max-width:100%" src="${s.file}" alt="${s.state}"></section>`).join("\n")}\n`,
  );
}
console.log(
  JSON.stringify({
    checks: checks.length,
    screenshots: screenshots.length,
    disabledComparisons,
    processesClosed: true,
  }),
);
