import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { securityPagePlugin, securityPageSources } from "./lib/platform-security-page-preview.mjs";
import {
  securityReviewFixtures,
  securityEnvelope,
  securityFixtureFile,
} from "./lib/security-review-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";
import { verifySecurityReadStates } from "./lib/security-read-state-preview.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 1 && args[0] === "--read-states") ||
    (args.length === 2 &&
      ["--capture-review", "--capture-read-states"].includes(args[0]) &&
      /^r[1-9]\d*$/.test(args[1])),
  "Use no arguments or --capture-review rN, --read-states, --capture-read-states rN",
);
const readStates = ["--read-states", "--capture-read-states"].includes(args[0]);
const capture = args.length === 2;
const output = capture
  ? path.resolve(
      `output/playwright/p59-${readStates ? "read-states" : "page-composition"}-${args[1]}`,
    )
  : null;
if (capture) await mkdir(output); // Exclusive version directory: never overwrite a previous review.
const hash = (value) => createHash("sha256").update(value).digest("hex");
const { fixture, nav, snapshot } = await securityReviewFixtures();
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [securityPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const sources = new Set([
  ...securityPageSources,
  securityFixtureFile,
  "scripts/verify-security-page-preview.mjs",
  "scripts/lib/security-review-fixtures.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "scripts/lib/security-read-state-preview.mjs",
  "apps/web/vite.config.ts",
]);
const results = [],
  images = [];
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P59 C Vue review ${origin}`);
  browser = await chromium.launch();
  for (const { width, motion } of [1440, 390].flatMap((width) =>
    (readStates ? ["reduce", "no-preference"] : ["reduce"]).map((motion) => ({ width, motion })),
  )) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      reducedMotion: motion,
    });
    const page = await context.newPage(),
      requests = [],
      errors = [],
      unexpected = [];
    let checks = 0;
    const check = (actual, expected, message) => {
      assert.deepEqual(actual, expected, `${width}: ${message}`);
      checks++;
    };
    try {
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (url.origin !== origin) {
          unexpected.push("external request");
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        const key = `${request.method()} ${url.pathname}`;
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
        const data = snapshot(url.searchParams.get("view"));
        if (url.searchParams.get("query") === "no-match") {
          for (const collection of Object.keys(data.pagination)) {
            data[collection] = [];
            data.pagination[collection] = { page: 1, page_size: 20, total: 0, total_pages: 1 };
          }
        }
        return route.fulfill({ json: securityEnvelope(data) });
      });
      if (readStates) {
        await verifySecurityReadStates({
          page,
          origin,
          snapshot,
          check,
          requests,
          capture: async (state, region) => {
            if (!capture || motion !== "reduce") return;
            await region.evaluate((node) => node.scrollIntoView({ block: "center" }));
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
            );
            const bytes = await page.screenshot({ animations: "disabled" });
            const file = `${width}-${state}.png`;
            await writeFile(path.join(output, file), bytes);
            images.push({
              file,
              sha256: hash(bytes),
              width,
              pixelWidth: bytes.readUInt32BE(16),
              pixelHeight: bytes.readUInt32BE(20),
              view: state,
              scope: "read-state region only; local fixtures; pending review",
            });
          },
        });
        check(errors, [], "read states no page errors");
        check(unexpected, [], "read states no unexpected requests");
        results.push({ width, motion, checks, requests });
        console.log(`P59 read states ${width}/${motion} passed ${checks}`);
      } else {
        await page.goto(origin + "/platform-admin/security");
        const surface = page.locator(".security-ops--review");
        const ready = () =>
          page.waitForFunction(
            () => !!document.querySelector('.p59-investigation .security-grid[aria-busy="false"]'),
          );
        for (const [view, label, count] of [
          ["events", "事件", 1],
          ["sessions", "会话", 1],
          ["credentials", "访问与凭证", 2],
          ["audit", "平台审计", 1],
        ]) {
          if (view !== "events")
            await surface.getByRole("link", { name: label, exact: true }).click();
          await ready();
          await page.evaluate(() => document.fonts.ready);
          await page.waitForFunction(
            () =>
              getComputedStyle(document.querySelector(".security-view-nav")).backgroundColor ===
              "rgb(16, 42, 99)",
          );
          check(
            await surface.locator(".security-grid > section").count(),
            count,
            `${view} original collection count`,
          );
          check(
            await surface.locator('.security-view-nav a[aria-current="page"]').innerText(),
            label,
            "current view",
          );
          check(await page.locator(".role-page-title").count(), 0, "no duplicate outer title");
          check(await surface.locator("h1").count(), 1, "one page title");
          check(
            await surface.locator(".security-kpis strong").allTextContents(),
            Object.values(fixture.summary).map(String),
            "global summary unchanged",
          );
          check(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            true,
            "no horizontal overflow",
          );
          const layout = await surface.evaluate((node) => {
            const selectors = [".security-view-nav", ".p59-background", ".p59-investigation"];
            return selectors.map((selector) => {
              const element = node.querySelector(selector),
                box = element.getBoundingClientRect();
              return {
                top: box.top,
                bottom: box.bottom,
                width: box.width,
                background: getComputedStyle(element).backgroundColor,
              };
            });
          });
          check(
            layout[0].bottom <= layout[1].top && layout[1].bottom <= layout[2].top,
            true,
            "source and visual order",
          );
          check(
            layout
              .slice(1)
              .every((item) => item.background === "rgb(255, 255, 255)" && item.width >= 300),
            true,
            "white readable work regions",
          );
          check(
            await surface
              .locator("h1")
              .evaluate(
                (node) =>
                  getComputedStyle(node).fontFamily.includes("Microsoft YaHei") &&
                  getComputedStyle(node).fontWeight === "700",
              ),
            true,
            "C heading typography",
          );
          if (width === 1440)
            check(
              await surface
                .locator("td.table-view-controls__frozen")
                .first()
                .evaluate((node) => getComputedStyle(node).backgroundColor),
              "rgb(255, 255, 255)",
              "no legacy ivory frozen cell",
            );
          if (capture) {
            const frames =
              width === 390
                ? [
                    ["top", null],
                    ["summary", ".p59-background"],
                    ["results", ".p59-investigation"],
                    ...(view === "credentials"
                      ? [["tokens", ".security-grid > section:last-child"]]
                      : []),
                  ]
                : [["page", null]];
            for (const [frame, selector] of frames) {
              if (selector)
                await surface
                  .locator(selector)
                  .evaluate((node) => scrollTo(0, node.getBoundingClientRect().top + scrollY - 16));
              else await page.evaluate(() => scrollTo(0, 0));
              const name = `${width}-${view}-${frame}.png`,
                bytes = await page.screenshot({ fullPage: width !== 390, animations: "disabled" });
              await writeFile(path.join(output, name), bytes);
              images.push({
                file: name,
                sha256: hash(bytes),
                width,
                pixelWidth: bytes.readUInt32BE(16),
                pixelHeight: bytes.readUInt32BE(20),
                view,
                frame,
                scope: "page structure only; local E2E fixtures; pending review",
              });
            }
          }
        }
        const search = surface.getByRole("searchbox");
        await search.fill("no-match");
        await surface.getByRole("button", { name: "查询", exact: true }).click();
        await ready();
        check(await surface.locator(".security-inline-empty").count(), 1, "audit empty result");
        check(await surface.locator(".security-view-nav a").count(), 4, "empty retains navigation");
        check(
          await surface.locator(".security-kpis strong").allTextContents(),
          Object.values(fixture.summary).map(String),
          "query does not relabel global summary",
        );
        await surface.getByRole("button", { name: "重置", exact: true }).click();
        await ready();
        check(await search.inputValue(), "", "query reset");
        check(await surface.locator(".security-inline-empty").count(), 0, "records return");
        await search.focus();
        await page.keyboard.press("Tab");
        await page.waitForFunction(
          () =>
            document.activeElement?.matches(":focus-visible") &&
            getComputedStyle(document.activeElement).outlineColor === "rgb(47, 110, 229)",
          undefined,
          { timeout: 3000 },
        );
        check(
          await surface
            .getByRole("combobox", { name: "状态", exact: true })
            .evaluate((node) => node === document.activeElement),
          true,
          "query keyboard order",
        );
        check(
          await page.evaluate(() => getComputedStyle(document.activeElement).outlineColor),
          "rgb(47, 110, 229)",
          "blue keyboard focus",
        );
        check(
          requests.every((request) => request.body === null),
          true,
          "GET only",
        );
        check(requests.length, 6, "one read per view/query/reset");
        check(errors, [], "no page errors");
        check(unexpected, [], "no unexpected requests");
        results.push({ width, checks, requests });
        console.log(`P59 C ${width} passed ${checks}`);
      }
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
      /\.(vue|ts|css|json)$/.test(file)
    )
      sources.add(file);
  }
  await includeImportedStyleSources(sources, (file) => readFile(file, "utf8"));
  if (capture) {
    const sourceHashes = Object.fromEntries(
      await Promise.all(
        [...sources].sort().map(async (file) => [file, hash(await readFile(file))]),
      ),
    );
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P59",
          revision: args[1],
          readStates,
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          capturedAt: new Date().toISOString(),
          scope:
            "actual Vue C review transform; source business scripts unchanged; original E2E aggregate/row counts are synthetic, not production metrics; no deployment or approval",
          sources: sourceHashes,
          images,
          results,
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      path.join(output, "index.html"),
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P59 实际Vue布局待审</title><style>body{font:16px/1.7 Microsoft YaHei;margin:24px;color:#17253c}img{display:block;max-width:100%;border:1px solid #c7d3e4}article{margin:28px 0}</style><h1>P59 C 实际Vue整合预览</h1><p>本地合成样例；结构待审，非生产。摘要与记录数量不代表真实统计；不含全部详情/按钮状态验收。</p><a href="manifest.json">来源与验证</a>' +
        images
          .map(
            (image) =>
              `<article><h2>${image.width} / ${image.view}</h2><a href="${image.file}"><img src="${image.file}" alt="${image.width} ${image.view} 待审"></a></article>`,
          )
          .join("\n") +
        "</html>",
    );
  }
  console.log(
    JSON.stringify({
      groups: results.length,
      readStates,
      checks: results.reduce((sum, result) => sum + result.checks, 0),
      images: images.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
