import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { securityPagePlugin, securityPageSources } from "./lib/platform-security-page-preview.mjs";
import { securityDetailPlugin, securityDetailCss } from "./lib/security-detail-preview.mjs";
import {
  securityReviewFixtures,
  securityEnvelope,
  securityFixtureFile,
} from "./lib/security-review-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";
import { verifySecurityDetailLifecycle } from "./lib/security-detail-lifecycle.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 1 && ["--baseline", "--lifecycle"].includes(args[0])) ||
    (args.length === 2 &&
      ["--capture-review", "--capture-lifecycle"].includes(args[0]) &&
      /^r[1-9]\d*$/.test(args[1])),
  "Use no arguments, --baseline, --lifecycle, --capture-review rN, or --capture-lifecycle rN",
);
const baseline = args[0] === "--baseline";
const lifecycle = ["--lifecycle", "--capture-lifecycle"].includes(args[0]);
const output = ["--capture-review", "--capture-lifecycle"].includes(args[0])
  ? path.resolve(
      `output/playwright/p59-detail-${lifecycle ? "lifecycle" : "composition"}-${args[1]}`,
    )
  : null;
if (output) await mkdir(output); // Exclusive review version; never overwrite historical evidence.
const hash = (value) => createHash("sha256").update(value).digest("hex");
const { nav, snapshot } = await securityReviewFixtures();
const scenarios = [
  {
    view: "events",
    label: "事件",
    index: 0,
    key: "events",
    title: "登录失败",
    fields: ["事件", "结果", "用户", "发生时间"],
    technical: ["事件代码", "事件 ID", "用户 ID", "请求 ID", "链路 ID"],
  },
  {
    view: "sessions",
    label: "会话",
    index: 0,
    key: "sessions",
    title: "security@example.test",
    fields: ["状态", "设备类别", "最近活动", "到期时间", "创建时间"],
    technical: ["会话 ID", "用户 ID"],
  },
  {
    view: "credentials",
    label: "访问与凭证",
    index: 0,
    key: "credentials",
    title: "生产读取凭证",
    fields: ["来源", "凭证类型", "状态", "到期时间", "最近轮换"],
    technical: ["凭证 ID", "来源 ID", "密钥版本", "脱敏指纹"],
  },
  {
    view: "credentials",
    label: "访问与凭证",
    index: 1,
    key: "tokens",
    title: "报表客户端",
    fields: ["状态", "权限", "到期时间", "最近使用"],
    technical: ["令牌 ID", "组织 ID", "令牌前缀"],
  },
  {
    view: "audit",
    label: "平台审计",
    index: 0,
    key: "audit",
    title: "查看安全运营事实",
    fields: ["操作", "对象", "结果", "发生时间"],
    technical: ["操作代码", "对象类型", "对象 ID", "操作者 ID", "请求 ID", "链路 ID"],
  },
];
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [securityPagePlugin(), ...(baseline ? [] : [securityDetailPlugin()])],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const sources = new Set([
  ...securityPageSources,
  securityFixtureFile,
  "scripts/verify-security-detail-preview.mjs",
  "scripts/lib/security-review-fixtures.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "scripts/lib/security-detail-lifecycle.mjs",
  "apps/web/vite.config.ts",
  ...(!baseline ? [securityDetailCss, "scripts/lib/security-detail-preview.mjs"] : []),
]);
const results = [],
  images = [];
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P59 detail ${baseline ? "baseline" : "C review"} ${origin}`);
  browser = await chromium.launch();
  for (const width of lifecycle ? [390, 760] : [390, 760, 761, 1440])
    for (const motion of ["reduce", "no-preference"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        reducedMotion: motion,
      });
      const page = await context.newPage(),
        requests = [],
        errors = [],
        unexpected = [],
        appearance = [];
      let nextRead = null;
      const releaseReads = [];
      const deferRead = (data) => {
        assert.equal(nextRead, null);
        let release, arrive;
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        const arrived = new Promise((resolve) => {
          arrive = resolve;
        });
        nextRead = async () => {
          arrive();
          await gate;
          return data;
        };
        releaseReads.push(release);
        return { arrived, release };
      };
      let checks = 0;
      const check = (actual, expected, message) => {
        assert.deepEqual(actual, expected, `${width}/${motion}: ${message}`);
        checks++;
      };
      const capture = async (key, frame, target = page) => {
        if (!output || motion !== "reduce" || (!lifecycle && ![390, 1440].includes(width))) return;
        if (lifecycle && frame !== "desktop-focus-return") return;
        const actualWidth = page.viewportSize().width;
        const bytes = await target.screenshot({ animations: "disabled" });
        const file = `${actualWidth}-${key}-${frame}.png`;
        await writeFile(path.join(output, file), bytes);
        images.push({
          file,
          sha256: hash(bytes),
          width: actualWidth,
          pixelWidth: bytes.readUInt32BE(16),
          pixelHeight: bytes.readUInt32BE(20),
          key,
          frame,
          scope: "local E2E detail region only; pending user review",
        });
      };
      try {
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/*", async (route) => {
          const request = route.request(),
            url = new URL(request.url()),
            key = `${request.method()} ${url.pathname}`;
          if (url.origin !== origin) {
            unexpected.push("external request");
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          if (key === "GET /api/v1/me/navigation")
            return route.fulfill({ json: securityEnvelope(nav) });
          if (key === "GET /api/v1/auth/session-status")
            return route.fulfill({ json: securityEnvelope({ authenticated: true }) });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({
              status: 503,
              json: { error: { code: "local_theme_fixture_unavailable" } },
            });
          if (key !== "GET /api/v1/platform/security/operations") {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, search: url.search, body: request.postData() });
          const pending = nextRead;
          nextRead = null;
          const data = pending ? await pending() : snapshot(url.searchParams.get("view"));
          return route.fulfill({ json: securityEnvelope(data) });
        });
        await page.goto(origin + "/platform-admin/security");
        const surface = page.locator(".security-ops--review");
        let currentView = "events";
        for (const scenario of scenarios) {
          if (scenario.view !== currentView)
            await surface.getByRole("link", { name: scenario.label, exact: true }).click();
          currentView = scenario.view;
          await page.waitForFunction(
            () => !!document.querySelector('.p59-investigation .security-grid[aria-busy="false"]'),
          );
          const region = surface.locator(".security-grid > section").nth(scenario.index);
          const readsBefore = requests.length;
          if (width <= 760) {
            const trigger = region.locator(".responsive-data-view__mobile article > button");
            await trigger.focus();
            await page.keyboard.press("Enter");
            const dialog = page.getByRole("dialog", { name: scenario.title, exact: true });
            await dialog.waitFor({ state: "visible" });
            const close = dialog.getByRole("button", { name: "关闭详情", exact: true });
            const details = dialog.locator(".responsive-data-view__details > details");
            const summary = details.locator("summary");
            await page.waitForFunction(() =>
              document.activeElement?.matches(".responsive-data-view__drawer > header button"),
            );
            check(
              await close.evaluate((node) => node === document.activeElement),
              true,
              `${scenario.key} initial focus`,
            );
            check(
              await page.locator("#app").evaluate((node) => node.inert),
              true,
              "background inert",
            );
            check(await dialog.getAttribute("aria-modal"), "true", "modal semantics");
            check(
              await dialog.locator(".responsive-data-view__details > dl dt").allTextContents(),
              scenario.fields,
              "original fact fields",
            );
            check(
              await details.evaluate((node) => node.open),
              false,
              "technical fields initially collapsed",
            );
            await page.keyboard.press("Shift+Tab");
            check(
              await summary.evaluate((node) => node === document.activeElement),
              true,
              "backward wraps to technical disclosure",
            );
            await page.keyboard.press("Tab");
            check(
              await close.evaluate((node) => node === document.activeElement),
              true,
              "forward wraps to close",
            );
            if (!baseline)
              await page.waitForFunction(
                () => getComputedStyle(document.activeElement).outlineColor === "rgb(47, 110, 229)",
                undefined,
                { timeout: 3000 },
              );
            const style = await dialog.evaluate((node) => ({
              header: getComputedStyle(node.querySelector("header")).backgroundColor,
              background: getComputedStyle(node).backgroundColor,
              focus: getComputedStyle(document.activeElement).outlineColor,
              font: getComputedStyle(node.querySelector("strong")).fontFamily,
            }));
            appearance.push({ key: scenario.key, ...style });
            if (!baseline) {
              check(style.header, "rgb(16, 42, 99)", "C blue header");
              check(style.background, "rgb(255, 255, 255)", "white facts");
              check(style.focus, "rgb(47, 110, 229)", "blue focus");
              check(style.font.includes("Microsoft YaHei"), true, "C title font");
            }
            await capture(scenario.key, "collapsed");
            await page.keyboard.press("Tab");
            check(
              await summary.evaluate((node) => node === document.activeElement),
              true,
              "technical detail keyboard reachable",
            );
            await page.keyboard.press("Enter");
            check(
              await details.evaluate((node) => node.open),
              true,
              "Enter expands technical fields",
            );
            check(
              await details.locator("dt").allTextContents(),
              scenario.technical,
              "original technical fields",
            );
            const lastValue = details.locator("dd").last();
            await lastValue.scrollIntoViewIfNeeded();
            check(
              await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
              true,
              "drawer no horizontal overflow",
            );
            check(
              await lastValue.evaluate((node) => {
                const b = node.getBoundingClientRect();
                return b.top >= 0 && b.bottom <= innerHeight + 1;
              }),
              true,
              "last technical value reachable",
            );
            if (!baseline)
              check(
                await close.evaluate((node) => {
                  const b = node.getBoundingClientRect();
                  return b.top >= 0 && b.bottom <= innerHeight;
                }),
                true,
                "sticky close remains visible while reading",
              );
            await capture(scenario.key, "technical");
            await page.keyboard.press("Escape");
            await dialog.waitFor({ state: "detached" });
            check(
              await trigger.evaluate((node) => node === document.activeElement),
              true,
              "Escape restores trigger",
            );
            check(
              await page.locator("#app").evaluate((node) => node.inert),
              false,
              "Escape releases background",
            );
            await trigger.click();
            await dialog.waitFor({ state: "visible" });
            check(
              await details.evaluate((node) => node.open),
              false,
              "reopen does not inherit disclosure state",
            );
            await close.click();
            await dialog.waitFor({ state: "detached" });
            check(
              await trigger.evaluate((node) => node === document.activeElement),
              true,
              "close button restores trigger",
            );
            await trigger.click();
            await dialog.waitFor({ state: "visible" });
            await page.mouse.click(5, 300);
            await dialog.waitFor({ state: "detached" });
            check(
              await trigger.evaluate((node) => node === document.activeElement),
              true,
              "scrim restores trigger",
            );
            check(
              await page.locator("#app").evaluate((node) => node.inert),
              false,
              "scrim releases background",
            );
          } else {
            const details = region.locator("tbody details"),
              summary = details.locator("summary");
            await summary.focus();
            await page.keyboard.press("Enter");
            check(
              await details.evaluate((node) => node.open),
              true,
              `${scenario.key} desktop native disclosure opens`,
            );
            check(
              await details.locator("dt").allTextContents(),
              scenario.technical,
              "desktop original technical fields",
            );
            check(
              await page.locator('.responsive-data-view__overlay [role="dialog"]').count(),
              0,
              "desktop remains inline, not forced into drawer",
            );
            check(
              await page.locator("#app").evaluate((node) => node.inert),
              false,
              "desktop stays non-modal",
            );
            if (!baseline) {
              check(
                await details.evaluate((node) => getComputedStyle(node).backgroundColor),
                "rgb(243, 246, 250)",
                "desktop C technical region",
              );
              check(
                await details
                  .locator("dd")
                  .first()
                  .evaluate((node) => getComputedStyle(node).marginLeft),
                "0px",
                "desktop removes inherited definition-list indentation",
              );
              check(
                await summary.evaluate((node) =>
                  getComputedStyle(node).fontFamily.includes("Microsoft YaHei"),
                ),
                true,
                "desktop technical title uses C font",
              );
            }
            await capture(scenario.key, "inline", region);
            await page.keyboard.press("Enter");
            check(await details.evaluate((node) => node.open), false, "desktop Enter collapses");
            check(
              await summary.evaluate((node) => node === document.activeElement),
              true,
              "desktop disclosure retains focus",
            );
          }
          check(requests.length, readsBefore, "detail interactions never fetch or write");
          check(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            true,
            "page no horizontal overflow",
          );
        }
        if (lifecycle)
          await verifySecurityDetailLifecycle({
            page,
            surface,
            check,
            width,
            deferRead,
            snapshot,
            capture,
          });
        check(
          requests.length,
          lifecycle ? 6 : 4,
          "one read for each actual view, credentials and tokens share read",
        );
        check(
          requests.every((request) => request.body === null),
          true,
          "GET only",
        );
        check(errors, [], "no page errors");
        check(unexpected, [], "no unknown/external requests");
        results.push({ width, motion, checks, requests, appearance });
        console.log(`P59 details ${width}/${motion}: ${checks} passed`);
      } finally {
        for (const release of releaseReads) release();
        await context.close();
      }
    }
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const file = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
    if (
      file &&
      !file.startsWith("..") &&
      !file.includes("node_modules") &&
      /\.(vue|ts|css|json)$/.test(file)
    )
      sources.add(file);
  }
  await includeImportedStyleSources(sources, (file) => readFile(file, "utf8"));
  if (output) {
    const sourceHashes = Object.fromEntries(
      await Promise.all(
        [...sources].sort().map(async (file) => [file, hash(await readFile(file))]),
      ),
    );
    const manifest = {
      page: "P59",
      revision: args[1],
      lifecycle,
      sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      capturedAt: new Date().toISOString(),
      scope:
        "actual App C review; current production drawer with visible focus fallback; original fields unchanged; local E2E samples; pending regional review; no deployment",
      sources: sourceHashes,
      images,
      results,
    };
    await writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    await writeFile(
      path.join(output, "index.html"),
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P59详情区域待审</title><style>body{font:16px/1.7 Microsoft YaHei;margin:24px;color:#17253c}img{max-width:100%;display:block;border:1px solid #c7d3e4}article{margin:32px 0}</style><h1>P59 实际 Vue 详情区域</h1><p>本地测试样例。手机抽屉 / 桌面原生展开；仅展示区域待审，非真实权限或生产验收。</p><a href="manifest.json">来源与验证</a>' +
        images
          .map(
            (image) =>
              `<article><h2>${image.width} / ${image.key} / ${image.frame}</h2><a href="${image.file}"><img src="${image.file}" alt="${image.key} ${image.frame} 待审"></a></article>`,
          )
          .join("\n") +
        "</html>",
    );
  }
  console.log(
    JSON.stringify({
      baseline,
      lifecycle,
      groups: results.length,
      checks: results.reduce((sum, group) => sum + group.checks, 0),
      sources: sources.size,
      images: images.length,
      port,
      ...(baseline ? { appearance: results[0].appearance } : {}),
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
