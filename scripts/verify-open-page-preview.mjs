import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { openPagePlugin, openPageSources } from "./lib/platform-open-page-preview.mjs";
import { openReviewFixtures, openEnvelope, openFixtureFile } from "./lib/open-review-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";
import { openDetailPlugin, openDetailCss } from "./lib/open-detail-preview.mjs";
import { verifyOpenDetails, openDetailCases } from "./lib/open-detail-verification.mjs";
import { openReadPlugin, openReadCss } from "./lib/open-read-state-preview.mjs";
import { verifyOpenReadStates } from "./lib/open-read-state-verification.mjs";
import { verifyOpenActionResults } from "./lib/open-action-result-verification.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 1 && ["--details", "--read-states", "--action-results"].includes(args[0])) ||
    (args.length === 2 &&
      [
        "--capture-review",
        "--capture-details",
        "--capture-read-states",
        "--capture-action-results",
      ].includes(args[0]) &&
      /^r[1-9]\d*$/.test(args[1])),
  "Use no arguments, --details, --read-states, --action-results, or one --capture-review/--capture-details/--capture-read-states/--capture-action-results rN",
);
const detailsMode = ["--details", "--capture-details"].includes(args[0]);
const readStatesMode = ["--read-states", "--capture-read-states"].includes(args[0]);
const actionResultsMode = ["--action-results", "--capture-action-results"].includes(args[0]);
const output =
  args.length === 2
    ? path.resolve(
        `output/playwright/p60-${actionResultsMode ? "action-results" : readStatesMode ? "read-states" : detailsMode ? "detail-composition" : "page-composition"}-${args[1]}`,
      )
    : null;
if (output) await mkdir(output); // Exclusive review packet: never replace old evidence.
const hash = (value) => createHash("sha256").update(value).digest("hex");
const { fixture, nav, orgId } = await openReviewFixtures();
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [openPagePlugin(), openReadPlugin(), ...(detailsMode ? [openDetailPlugin()] : [])],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const sources = new Set([
  ...openPageSources,
  openFixtureFile,
  "scripts/verify-open-page-preview.mjs",
  "scripts/lib/open-review-fixtures.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "apps/web/vite.config.ts",
  openReadCss,
  "scripts/lib/open-read-state-preview.mjs",
  "scripts/lib/open-read-state-verification.mjs",
]);
const results = [],
  images = [];
if (actionResultsMode) sources.add("scripts/lib/open-action-result-verification.mjs");
if (detailsMode)
  for (const file of [
    openDetailCss,
    "scripts/lib/open-detail-preview.mjs",
    "scripts/lib/open-detail-verification.mjs",
  ])
    sources.add(file);
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P60 local actual Vue review ${origin}`);
  browser = await chromium.launch();
  for (const { width, motion } of (detailsMode ? [1440, 768, 390, 320] : [1440, 390]).flatMap(
    (width) =>
      (detailsMode || readStatesMode || actionResultsMode
        ? ["reduce", "no-preference"]
        : ["reduce"]
      ).map((motion) => ({
        width,
        motion,
      })),
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
    let detailFixture = fixture;
    const check = (actual, expected, message) => {
      assert.deepEqual(actual, expected, `${width}: ${message}`);
      checks++;
    };
    const capture = async (view, locator, viewport = false) => {
      if (!output || motion !== "reduce") return;
      await page.evaluate(() => document.fonts.ready);
      const bytes = locator
        ? await locator.screenshot({ animations: "disabled" })
        : await page.screenshot({ fullPage: !viewport, animations: "disabled" });
      const file = `${width}-${view}.png`;
      await writeFile(path.join(output, file), bytes);
      images.push({
        file,
        sha256: hash(bytes),
        width,
        pixelWidth: bytes.readUInt32BE(16),
        pixelHeight: bytes.readUInt32BE(20),
        view,
        scope: "local actual Vue review composition; synthetic data; pending user review",
      });
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
        if (key === "GET /api/v1/me/navigation") return route.fulfill({ json: openEnvelope(nav) });
        if (key === "GET /api/v1/auth/session-status")
          return route.fulfill({ json: openEnvelope({ authenticated: true }) });
        if (key === "GET /api/v1/me/ui-preferences")
          return route.fulfill({
            status: 503,
            json: { error: { code: "local_theme_fixture_unavailable" } },
          });
        if (key !== "GET /api/v1/platform/open") {
          unexpected.push(key);
          return route.abort();
        }
        requests.push({ key, search: url.search, body: request.postData() });
        const data = structuredClone(detailsMode ? detailFixture : fixture);
        for (const [view, prefix] of [
          ["clients", "client"],
          ["webhooks", "webhook"],
          ["deliveries", "delivery"],
        ])
          if (url.searchParams.get(`${prefix}_query`) === "no-match") {
            data[view] = [];
            data.pagination[view] = { page: 1, page_size: 20, total: 0, total_pages: 1 };
          }
        return route.fulfill({ json: openEnvelope(data) });
      });
      if (actionResultsMode) {
        await verifyOpenActionResults({ page, origin, width, fixture, requests, check, capture });
        check(errors, [], "no action-result page errors");
        check(unexpected, [], "no unknown/external requests");
        results.push({ width, motion, checks, requests });
        console.log(`P60 action results ${width}/${motion} passed ${checks}`);
        continue;
      }
      if (readStatesMode) {
        await verifyOpenReadStates({ page, origin, fixture, requests, check, capture });
        check(errors, [], "no read-state page errors");
        check(unexpected, [], "no unknown/external requests");
        results.push({ width, motion, checks, requests });
        console.log(`P60 read states ${width}/${motion} passed ${checks}`);
        continue;
      }
      if (detailsMode) {
        await verifyOpenDetails({
          page,
          origin,
          width,
          fixture,
          setFixture: (value) => {
            detailFixture = value;
          },
          check,
          capture,
        });
        check(
          requests.length,
          openDetailCases.length,
          "one GET per detail scenario, zero action writes",
        );
        check(
          requests.every((request) => request.body === null),
          true,
          "detail GET only",
        );
        check(errors, [], "no detail page errors");
        check(unexpected, [], "no unknown/external requests");
        results.push({ width, motion, checks, requests });
        console.log(`P60 details ${width}/${motion} passed ${checks}`);
        continue;
      }
      await page.goto(origin + "/platform-admin/open-platform");
      const surface = page.locator(".open-platform--review");
      await surface.locator(".open-workspace").waitFor();
      await page.waitForFunction(
        () =>
          getComputedStyle(document.querySelector(".open-summary")).backgroundColor ===
          "rgb(16, 42, 99)",
      );
      for (const [view, title] of [
        ["clients", "接口访问账号"],
        ["webhooks", "事件回调地址"],
        ["deliveries", "投递记录"],
      ]) {
        if (view !== "clients") await surface.locator(`[data-view="${view}"]`).click();
        check(
          await surface.locator(".open-workspace > header h2").innerText(),
          title,
          `${view} task title`,
        );
        check(
          await surface.locator('.open-summary [aria-current="page"]').getAttribute("data-view"),
          view,
          "selected task semantics",
        );
        check(await page.locator(".role-page-title").count(), 0, "no duplicate shell title");
        check(await surface.locator("h1").count(), 1, "one main heading");
        check(
          await surface.locator(".open-summary strong").allTextContents(),
          ["1", "1", "1"],
          "original synthetic aggregates",
        );
        check(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
          "no page horizontal overflow",
        );
        check(
          await surface.locator(".open-create:visible").count(),
          0,
          "default list is not displaced by expanded creation form",
        );
        check(
          await surface.locator(".p60-create-launch").count(),
          view === "deliveries" ? 0 : 1,
          "create availability unchanged by task",
        );
        check(
          await surface
            .locator(".open-workspace")
            .evaluate((node) => getComputedStyle(node).backgroundColor),
          "rgb(255, 255, 255)",
          "white work region",
        );
        await page.evaluate(() => scrollTo(0, 0));
        await capture(`${view}-default`);
        if (width === 390) {
          await capture(`${view}-top-viewport`, null, true);
          await surface.locator(".responsive-data-view__mobile").scrollIntoViewIfNeeded();
          await capture(`${view}-records-viewport`, null, true);
        }
        if (view === "deliveries") continue;
        const launch = surface.locator(".p60-create-launch button");
        await launch.click();
        const dialog = page.locator("dialog.p60-create-dialog[open]");
        await dialog.waitFor();
        check(
          await surface
            .locator(".p60-create-launch p")
            .evaluate((node) => getComputedStyle(node).color),
          "rgb(23, 37, 60)",
          "creation helper has readable dark text",
        );
        check(
          await dialog
            .locator(".p60-create-heading h2")
            .evaluate((node) => getComputedStyle(node).color),
          "rgb(255, 255, 255)",
          "dialog heading is white on blue",
        );
        check(
          await dialog
            .locator(".p60-create-heading p")
            .evaluate((node) => getComputedStyle(node).color),
          "rgb(255, 255, 255)",
          "step caption is white on blue",
        );
        check(
          await dialog
            .locator("input")
            .first()
            .evaluate((node) => node === document.activeElement),
          true,
          "initial focus is organization field",
        );
        check(
          await dialog.evaluate((node) => node.matches(":modal")),
          true,
          "native modal blocks background interaction",
        );
        check(
          await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
          true,
          "no modal horizontal overflow",
        );
        await capture(`${view}-create`, dialog);
        const submit = dialog.locator(".open-create > button");
        if (width === 390) {
          await submit.scrollIntoViewIfNeeded();
          await capture(`${view}-create-footer`, dialog);
        }
        await submit.click();
        await dialog.locator('[aria-invalid="true"]').first().waitFor();
        check(await page.getByRole("alertdialog").count(), 0, "invalid form remains in input step");
        check(
          await dialog.locator("#p60-org-error").count(),
          view === "clients" ? 1 : 0,
          "organization validation retains actual shared value",
        );
        check(
          (await dialog.locator(".field-error:visible").count()) > 0,
          true,
          "original validation displayed",
        );
        await capture(`${view}-invalid`, dialog);
        await dialog.getByRole("textbox", { name: "组织内部编号", exact: true }).fill(orgId);
        await dialog.getByRole("textbox", { name: "名称", exact: true }).fill("审核样例连接");
        if (view === "webhooks")
          await dialog
            .getByRole("textbox", { name: "事件回调安全网址", exact: true })
            .fill("https://example.com/hooks/scoutops");
        // The review wrapper constrains both ends using only visible, enabled controls.
        await dialog.getByRole("button", { name: "关闭创建填写窗" }).focus();
        await page.keyboard.press("Shift+Tab");
        check(
          await submit.evaluate((node) => node === document.activeElement),
          true,
          "reverse Tab remains inside input dialog",
        );
        await page.keyboard.press("Tab");
        check(
          await dialog
            .getByRole("button", { name: "关闭创建填写窗" })
            .evaluate((node) => node === document.activeElement),
          true,
          "forward Tab wraps to close",
        );
        await submit.click();
        const confirmation = page.getByRole("alertdialog");
        await confirmation.waitFor();
        check(
          await page.locator("dialog.p60-create-dialog[open]").count(),
          0,
          "input modal closes before shared confirmation",
        );
        check(
          await confirmation
            .getByRole("button", { name: "取消", exact: true })
            .evaluate((node) => node === document.activeElement),
          true,
          "confirmation receives safe initial focus",
        );
        check(
          await confirmation
            .innerText()
            .then((text) =>
              text.includes(view === "clients" ? "不包含业务数据写入权限" : "DNS 和私网地址"),
            ),
          true,
          "original impact wording preserved",
        );
        await capture(`${view}-confirmation`, confirmation);
        await confirmation.getByRole("button", { name: "取消", exact: true }).click();
        await dialog.waitFor();
        await page.waitForFunction(() =>
          document
            .querySelector("dialog.p60-create-dialog[open]")
            ?.contains(document.activeElement),
        );
        check(
          await dialog.getByRole("textbox", { name: "名称", exact: true }).inputValue(),
          "审核样例连接",
          "cancel preserves original form draft",
        );
        await page.keyboard.press("Escape");
        check(
          await page.locator("dialog.p60-create-dialog[open]").count(),
          0,
          "Escape closes input step",
        );
        check(
          await launch.evaluate((node) => node === document.activeElement),
          true,
          "input close restores launcher focus",
        );
      }
      const search = surface.getByRole("textbox", { name: "搜索", exact: true });
      await search.fill("no-match");
      await surface.getByRole("button", { name: "应用", exact: true }).click();
      await surface.locator(".open-empty").waitFor();
      check(new URL(page.url()).searchParams.get("query"), "no-match", "URL filter unchanged");
      await surface.getByRole("button", { name: "清除筛选", exact: true }).click();
      await surface.locator(".open-empty").waitFor({ state: "detached" });
      check(await search.inputValue(), "", "reset restores input");
      check(
        requests.length,
        3,
        "one initial read, filter read, reset read; no switching or creation writes",
      );
      check(
        requests.every((request) => request.body === null),
        true,
        "all open-platform requests are GET",
      );
      check(errors, [], "no browser errors");
      check(unexpected, [], "no unexpected or external requests");
      results.push({ width, checks, requests });
      console.log(`P60 ${width} passed ${checks}`);
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
  if (output) {
    const sourceHashes = Object.fromEntries(
      await Promise.all(
        [...sources].sort().map(async (file) => [file, hash(await readFile(file))]),
      ),
    );
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P60",
          detailsMode,
          readStatesMode,
          actionResultsMode,
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope: actionResultsMode
            ? "actual Vue operation and refresh feedback; local intercepted synthetic PATCH/POST and GET only; no real mutations, secret generation, delivery or production acceptance"
            : readStatesMode
              ? "actual App C read states; actual 15000ms application timer; synthetic GET errors and recovery only; no write/permission/production acceptance"
              : detailsMode
                ? "actual App C detail regrouping; original script/fields/actions preserved; E2E-derived synthetic status and long-text samples; confirmations cancelled without writes; no secret/production/permission acceptance"
                : "actual App with C review-only transform; original business script plus isolated input-modal component; original synthetic E2E data; GET only; no production deployment or approval; row actions and one-time secret lifecycle not covered",
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P60 C 实际Vue待审</title><style>body{font:16px/1.7 Microsoft YaHei;margin:24px;color:#17253c}img{display:block;max-width:100%;border:1px solid #c7d3e4}article{margin:28px 0}</style><h1>P60 C 实际Vue审核版</h1><p>本地合成样例；' +
        (actionResultsMode
          ? "操作与列表读取结果分开；PATCH/POST全部本地拦截，未发送真实请求。"
          : readStatesMode
            ? "首次/保留数据的读取、失败与恢复；超时使用实际15秒计时。"
            : detailsMode
              ? "三类详情、技术信息与取消确认路径。"
              : "三工作区默认布局、创建填写及取消确认路径。") +
        '不是全部状态、真实权限或发送验收。未部署。</p><a href="manifest.json">来源与验证</a>' +
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
