import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { statusPagePlugin, statusPageSources } from "./lib/platform-status-page-preview.mjs";
import {
  statusReviewFixtures,
  statusEnvelope,
  statusFixtureFile,
} from "./lib/status-review-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
  "Use no arguments or --capture-review rN",
);
const output = args.length ? path.resolve(`output/playwright/p61-read-feedback-${args[1]}`) : null;
if (output) await mkdir(output);
const { fixture, metrics, nav } = await statusReviewFixtures(),
  probe = reservePort();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [statusPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const hash = (b) => createHash("sha256").update(b).digest("hex"),
  images = [],
  results = [],
  sources = new Set([
    ...statusPageSources,
    statusFixtureFile,
    "scripts/lib/status-review-fixtures.mjs",
    "scripts/verify-status-read-feedback.mjs",
    "scripts/lib/ui-imported-style-sources.mjs",
    "apps/web/vite.config.ts",
  ]);
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log("P61 read feedback " + origin);
  const groups = [1440, 390].flatMap((width) =>
    ["reduce", "no-preference"].map((motion) => ({ width, motion })),
  );
  const outcomes = await Promise.allSettled(
    groups.map(async ({ width, motion }) => {
      const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
          locale: "zh-CN",
          reducedMotion: motion,
        }),
        page = await context.newPage(),
        requests = [],
        unexpected = [],
        errors = [],
        held = [];
      let mode = "failure",
        checks = 0;
      const check = (actual, expected, label) => {
        assert.deepEqual(actual, expected, `${width}/${motion}: ${label}`);
        checks++;
      };
      const capture = async (name, locator) => {
        if (!output || motion !== "reduce") return;
        await page.evaluate(() => document.fonts.ready);
        await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
        const b = await locator.screenshot({ animations: "disabled" }),
          file = `${width}-${name}.png`;
        await writeFile(path.join(output, file), b);
        images.push({
          file,
          sha256: hash(b),
          pixelWidth: b.readUInt32BE(16),
          pixelHeight: b.readUInt32BE(20),
        });
      };
      const release = async () => {
        await Promise.all(held.splice(0).map((route) => route.abort().catch(() => {})));
      };
      try {
        await page.addInitScript(
          (m) => sessionStorage.setItem("scoutops:realtime-client-metrics", JSON.stringify(m)),
          metrics,
        );
        page.on("pageerror", (e) => errors.push(e.message));
        await page.route("**/*", async (route) => {
          const req = route.request(),
            url = new URL(req.url()),
            key = req.method() + " " + url.pathname;
          if (url.origin !== origin) {
            unexpected.push("external");
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          if (key === "GET /api/v1/me/navigation")
            return route.fulfill({ json: statusEnvelope(nav) });
          if (key === "GET /api/v1/auth/session-status")
            return route.fulfill({ json: statusEnvelope({ authenticated: true }) });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({
              status: 503,
              json: { error: { code: "local_preferences_unavailable" } },
            });
          if (
            key !== "GET /api/v1/platform/management" ||
            url.searchParams.get("domain") !== "status"
          ) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, search: url.search, body: req.postData(), mode });
          if (mode === "hold") {
            held.push(route);
            return;
          }
          return route.fulfill(
            mode === "failure"
              ? {
                  status: 503,
                  json: {
                    error: {
                      message: "本地测试读取失败",
                      action_hint: "本地测试暂时无法读取系统状态，请重新加载。",
                    },
                    request_id: "p61-failure-sample",
                  },
                }
              : { json: statusEnvelope(fixture) },
          );
        });
        await page.goto(origin + "/platform-admin/status");
        const surface = page.locator(".platform-management--status-review"),
          state = surface.locator(".platform-management-state"),
          notice = surface.locator(".platform-management-message"),
          workspace = surface.locator(".p61-workspace"),
          refresh = surface.getByRole("button", { name: "刷新数据", exact: true });
        const waitError = () =>
          state.getByRole("heading", { name: "系统状态暂不可用", exact: true }).waitFor();
        await waitError();
        check(await notice.count(), 0, "no duplicate first failure message");
        check(
          await state
            .getByText("本地测试暂时无法读取系统状态，请重新加载。", { exact: true })
            .count(),
          1,
          "original hint shown once",
        );
        check(await state.getAttribute("aria-busy"), "false", "first failure settled");
        check(await workspace.count(), 0, "no invented snapshot");
        await capture("first-failure", state);
        mode = "hold";
        const started = Date.now();
        await state.getByRole("button", { name: "重新加载", exact: true }).click();
        await state.getByRole("heading", { name: "正在读取系统状态", exact: true }).waitFor();
        check(await state.getAttribute("aria-busy"), "true", "retry is busy");
        check(await notice.count(), 0, "old failure cleared while reading");
        check(await state.locator("button").count(), 0, "no duplicate retry while pending");
        check(
          await surface.getByRole("button", { name: "刷新中…", exact: true }).isDisabled(),
          true,
          "original native disabled refresh",
        );
        await capture("first-loading", state);
        await waitError();
        check(Date.now() - started >= 14500, true, "real fifteen-second product timer");
        check(
          await state.locator("p").innerText(),
          "读取超过 15 秒，已停止本次等待。 尚未取得系统状态数据。",
          "first timeout has no false retention or server cancellation",
        );
        check(await notice.count(), 0, "first timeout shown once");
        check(await state.getAttribute("aria-busy"), "false", "timeout settles busy");
        await release();
        const retry = state.getByRole("button", { name: "重新加载", exact: true });
        await retry.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        check(
          await retry.evaluate((el) => el === document.activeElement),
          true,
          "keyboard returns to native retry",
        );
        await capture("first-timeout", state);
        mode = "success";
        await page.keyboard.press("Enter");
        await workspace.waitFor();
        check(await state.count(), 0, "retry restores workspace");
        check(await notice.count(), 0, "successful retry clears timeout");
        check(
          await workspace.locator(".platform-propagation-alert").count(),
          2,
          "observed warnings retained",
        );
        mode = "failure";
        await refresh.click();
        await notice.waitFor();
        check(
          (await notice.innerText()).includes("已保留上次成功数据"),
          true,
          "failed refresh identifies stale snapshot",
        );
        check(await state.count(), 0, "no initial error region with snapshot");
        check(await workspace.isVisible(), true, "snapshot retained");
        await capture("retained-failure", notice);
        mode = "hold";
        const retainedStarted = Date.now();
        await refresh.click();
        await surface.getByRole("button", { name: "刷新中…", exact: true }).waitFor();
        check(await notice.count(), 0, "old failure cleared in retained retry");
        check(await workspace.isVisible(), true, "pending retains actual workspace");
        await notice.waitFor({ timeout: 20000 });
        check(Date.now() - retainedStarted >= 14500, true, "retained request uses real timer");
        check(
          await notice.innerText(),
          "读取超过 15 秒，已停止本次等待。 已保留上次成功数据。",
          "retained timeout copy",
        );
        check(await state.count(), 0, "retained timeout not initial error");
        check(
          await workspace.locator(".platform-propagation-alert").count(),
          2,
          "same original warning facts",
        );
        await release();
        await capture("retained-timeout", notice);
        mode = "success";
        await refresh.click();
        await notice.waitFor({ state: "detached" });
        check(await workspace.isVisible(), true, "recovered snapshot visible");
        check(
          JSON.parse(
            await page.evaluate(() => sessionStorage.getItem("scoutops:realtime-client-metrics")),
          ),
          metrics,
          "browser metrics untouched",
        );
        check(requests.length, 10, "original retries and recovery request count");
        check(
          requests.every((r) => r.body === null),
          true,
          "GETs have no write payload",
        );
        check(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
          "no horizontal overflow",
        );
        check(errors, [], "no browser errors");
        check(unexpected, [], "no unknown or external request");
        results.push({ width, motion, checks, requests });
        console.log(`P61 ${width}/${motion}: ${checks} checks`);
      } finally {
        await release();
        await context.close();
      }
    }),
  );
  const failed = outcomes.filter((o) => o.status === "rejected");
  if (failed.length)
    throw new AggregateError(
      failed.map((o) => o.reason),
      "P61 read groups failed",
    );
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const f = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
    if (f && !f.startsWith("..") && !f.includes("node_modules") && /\.(vue|ts|css|json)$/.test(f))
      sources.add(f);
  }
  await includeImportedStyleSources(sources, (f) => readFile(f, "utf8"));
  if (output) {
    const sourceHashes = Object.fromEntries(
      await Promise.all([...sources].sort().map(async (f) => [f, hash(await readFile(f))])),
    );
    images.sort((a, b) => a.file.localeCompare(b.file));
    results.sort((a, b) => a.width - b.width || a.motion.localeCompare(b.motion));
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P61",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope:
            "actual Vue C review;synthetic requests;real15s client timer;not production acceptance",
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P61读取状态待审</title><style>body{font:16px/1.7 Microsoft YaHei;margin:24px;color:#17253c}img{max-width:100%;display:block;border:1px solid #c7d3e4}article{margin:28px 0}</style><h1>P61实际Vue读取反馈</h1><p>本地样例，非生产。仅区域图待审，不代表整页或真实系统健康。</p>' +
        images
          .map(
            (i) =>
              `<article><h2>${i.file}</h2><img src="${i.file}" alt="${i.file} 待审"></article>`,
          )
          .join("\n") +
        "</html>",
    );
  }
  console.log(
    JSON.stringify({
      groups: results.length,
      checks: results.reduce((n, r) => n + r.checks, 0),
      images: images.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
