import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { logPagePlugin, logPageSources } from "./lib/platform-log-page-preview.mjs";
import { logReviewFixtures, logEnvelope, logFixtureFile } from "./lib/log-review-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
  "Use no arguments or --capture-review rN",
);
const output = args.length ? path.resolve(`output/playwright/p62-read-feedback-${args[1]}`) : null;
if (output) await mkdir(output);
const { fixture, nav } = await logReviewFixtures(),
  probe = reservePort();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [logPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const hash = (b) => createHash("sha256").update(b).digest("hex"),
  images = [],
  results = [],
  sources = new Set([
    ...logPageSources,
    logFixtureFile,
    "scripts/lib/log-review-fixtures.mjs",
    "scripts/lib/status-review-fixtures.mjs",
    "scripts/verify-log-read-feedback.mjs",
    "scripts/lib/ui-imported-style-sources.mjs",
    "apps/web/vite.config.ts",
  ]);
const hint = "本地测试暂时无法读取链路日志，请重新加载。";
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log("P62 read feedback " + origin);
  const outcomes = await Promise.allSettled(
    [1440, 390].flatMap((width) =>
      ["reduce", "no-preference"].map(async (motion) => {
        const context = await browser.newContext({
          viewport: { width, height: width === 390 ? 844 : 1000 },
          locale: "zh-CN",
          reducedMotion: motion,
        });
        const page = await context.newPage(),
          requests = [],
          errors = [],
          unexpected = [],
          held = [];
        let mode = "failure",
          checks = 0;
        const check = (a, b, label) => {
          assert.deepEqual(a, b, `${width}/${motion}: ${label}`);
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
        const release = () => Promise.all(held.splice(0).map((r) => r.abort().catch(() => {})));
        const click = async (locator) => {
          await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
          await locator.click();
        };
        try {
          page.on("pageerror", (e) => errors.push(e.message));
          page.on("download", () => unexpected.push("download"));
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
              return route.fulfill({ json: logEnvelope(nav) });
            if (key === "GET /api/v1/auth/session-status")
              return route.fulfill({ json: logEnvelope({ authenticated: true }) });
            if (key === "GET /api/v1/me/ui-preferences")
              return route.fulfill({
                status: 503,
                json: { error: { code: "local_preferences_unavailable" } },
              });
            if (key !== "GET /api/v1/platform/management" || url.search !== "?domain=logs") {
              unexpected.push(key + url.search);
              return route.abort();
            }
            requests.push({ key, search: url.search, body: req.postData(), mode });
            if (mode === "hold") {
              held.push(route);
              return;
            }
            if (mode === "failure")
              return route.fulfill({
                status: 503,
                json: {
                  error: {
                    code: "local_read_failed",
                    message: "本地测试读取失败",
                    action_hint: hint,
                  },
                  request_id: "p62-local-read-failure",
                },
              });
            return route.fulfill({
              json: logEnvelope(
                mode === "empty"
                  ? { ...fixture, items: [], summary: { total: 0, api: 0, worker: 0, crawler: 0 } }
                  : fixture,
              ),
            });
          });
          await page.goto(origin + "/platform-admin/logs");
          const surface = page.locator(".platform-log-center--review"),
            state = surface.locator(".platform-log-state"),
            notice = surface.locator(".platform-log-message"),
            workspace = surface.locator(".p62-workspace"),
            refresh = surface.getByRole("button", { name: "刷新日志", exact: true }),
            retry = state.getByRole("button", { name: "重新加载", exact: true });
          const firstError = () =>
            state
              .getByRole("heading", { name: "链路日志暂不可用", exact: true })
              .waitFor({ timeout: 20000 });
          const settled = () => refresh.waitFor();
          await firstError();
          check(await state.locator("p").innerText(), hint, "first failure keeps original hint");
          check(await notice.count(), 0, "first failure appears once");
          check(await workspace.count(), 0, "first failure has no invented logs");
          check(await state.getAttribute("aria-busy"), "false", "first failure settled");
          check(
            await surface.getByRole("region", { name: "链路日志暂不可用", exact: true }).count(),
            1,
            "named read region",
          );
          check(
            await state.locator("h2#platform-log-read-title").count(),
            1,
            "C review heading follows h1",
          );
          await capture("first-failure", state);
          mode = "hold";
          let started = Date.now();
          await click(retry);
          await state.getByRole("heading", { name: "正在读取链路日志" }).waitFor();
          check(await state.getAttribute("aria-busy"), "true", "first pending announces busy");
          check(await state.locator("p").innerText(), "", "old failure removed during pending");
          check(await retry.count(), 0, "original first pending retry is removed");
          check(
            await surface.getByRole("button", { name: "正在刷新…", exact: true }).isDisabled(),
            true,
            "original header refresh disabled",
          );
          check(
            await surface.getByRole("button", { name: "导出当前筛选", exact: true }).isDisabled(),
            true,
            "export disabled while loading",
          );
          await capture("first-loading", state);
          await firstError();
          check(Date.now() - started >= 14500, true, "first real 15s timer");
          check(
            await state.locator("p").innerText(),
            "读取超过 15 秒，已停止本次等待。 尚未取得链路日志。",
            "first timeout no false snapshot",
          );
          check(await state.getAttribute("aria-busy"), "false", "first timeout settles busy");
          await release();
          await retry.focus();
          await page.keyboard.press("Tab");
          await page.keyboard.press("Shift+Tab");
          check(
            await retry.evaluate(
              (el) => el === document.activeElement && el.matches(":focus-visible"),
            ),
            true,
            "settled retry visible keyboard focus",
          );
          await capture("first-timeout", state);
          mode = "success";
          await page.keyboard.press("Enter");
          await workspace.waitFor();
          await settled();
          check(await state.count(), 0, "successful recovery removes first-error region");
          check(await notice.count(), 0, "successful recovery clears timeout");
          check(
            await workspace.locator(".platform-log-chain").count(),
            2,
            "original two chains recovered",
          );
          check(
            await surface.locator(".platform-log-summary strong").innerText(),
            "3",
            "original three events recovered",
          );
          const previous = await workspace.innerText(),
            observed = await surface.locator(":scope > footer > span").innerText();
          mode = "failure";
          await click(refresh);
          await notice.waitFor();
          await settled();
          check(await notice.innerText(), hint + " 已保留上次成功日志。", "retained failure hint");
          check(await workspace.innerText(), previous, "retained chain identity unchanged");
          check(await state.count(), 0, "retained failure not initial error");
          // Existing footer request ID changes on failure; only observed timestamp is a snapshot fact.
          check(
            await surface.locator(":scope > footer > span").innerText(),
            observed,
            "observed time unchanged",
          );
          await capture("retained-failure", notice);
          mode = "hold";
          started = Date.now();
          await click(refresh);
          await surface.getByRole("button", { name: "正在刷新…", exact: true }).waitFor();
          check(await notice.count(), 0, "retained loading clears previous hint");
          check(await workspace.innerText(), previous, "pending retains same chains");
          await notice.waitFor({ timeout: 20000 });
          await settled();
          check(Date.now() - started >= 14500, true, "retained real 15s timer");
          check(
            await notice.innerText(),
            "读取超过 15 秒，已停止本次等待。 已保留上次成功日志。",
            "retained timeout accurately described",
          );
          check(await workspace.innerText(), previous, "timeout retains same chains");
          await release();
          await capture("retained-timeout", notice);
          mode = "empty";
          await click(refresh);
          await state.getByRole("heading", { name: "没有匹配事件" }).waitFor();
          await settled();
          check(await notice.count(), 0, "empty success clears retained error");
          check(await workspace.count(), 0, "zero successful records remove old chains");
          check(
            await state.locator("p").innerText(),
            "调整检索条件或运行面后重试。",
            "original empty help",
          );
          await capture("empty-success", state);
          mode = "failure";
          await click(retry);
          await state.getByText(hint + " 已保留上次成功日志。", { exact: true }).waitFor();
          await settled();
          check(
            await state.getByRole("heading", { name: "没有匹配事件" }).count(),
            1,
            "failed refresh preserves empty snapshot state",
          );
          check(await notice.count(), 0, "empty failure shown once");
          check(await workspace.count(), 0, "empty failure cannot revive previous chains");
          await capture("empty-failure", state);
          mode = "hold";
          started = Date.now();
          await click(retry);
          await surface.getByRole("button", { name: "正在刷新…", exact: true }).waitFor();
          check(await state.getAttribute("aria-busy"), "true", "empty snapshot refresh busy");
          check(
            await state.getByRole("heading", { name: "没有匹配事件" }).count(),
            1,
            "empty heading retained while reading",
          );
          const pendingCount = requests.length;
          await retry.focus();
          await page.keyboard.press("Enter");
          await page.keyboard.press("Space");
          check(
            requests.length,
            pendingCount,
            "original load guard prevents duplicate empty reloads",
          );
          await capture("empty-loading", state);
          await state
            .getByText("读取超过 15 秒，已停止本次等待。 已保留上次成功日志。", { exact: true })
            .waitFor({ timeout: 20000 });
          await settled();
          check(Date.now() - started >= 14500, true, "empty real 15s timer");
          check(await state.getAttribute("aria-busy"), "false", "empty timeout settles busy");
          check(await workspace.count(), 0, "empty timeout retains no records");
          await release();
          await capture("empty-timeout", state);
          mode = "success";
          await click(retry);
          await workspace.waitFor();
          await settled();
          check(await state.count(), 0, "final recovery restores result region");
          check(await notice.count(), 0, "final recovery clears failure");
          check(await workspace.innerText(), previous, "final recovery original fixture");
          check(requests.length, 15, "nine reads including original safe retries");
          check(
            requests.filter((r) => r.mode === "failure").length,
            9,
            "three 503 groups retry three times each",
          );
          check(requests.filter((r) => r.mode === "hold").length, 3, "one pending GET per timeout");
          check(
            requests.every((r) => r.body === null),
            true,
            "only GET without write bodies",
          );
          check(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            true,
            "no page horizontal overflow",
          );
          check(errors, [], "no browser errors");
          check(unexpected, [], "no writes/external/unknown/downloads");
          results.push({ width, motion, checks, requests });
          console.log(`P62 ${width}/${motion}: ${checks} checks`);
        } finally {
          await release();
          await context.close();
        }
      }),
    ),
  );
  const failed = outcomes.filter((o) => o.status === "rejected");
  if (failed.length)
    throw new AggregateError(
      failed.map((o) => o.reason),
      "P62 read groups failed",
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
          page: "P62",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope:
            "actual Vue C read states;local synthetic GET;real15s timer;not permission/export/production acceptance",
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P62读取反馈待审</title><style>body{font:16px/1.7 Microsoft YaHei;margin:24px;color:#17253c}img{max-width:100%;display:block;border:1px solid #c7d3e4}article{margin:28px 0}</style><h1>P62实际Vue读取反馈</h1><p>本地合成样例，非生产。区域图待审，不代表整页、权限或真实导出。</p>' +
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
