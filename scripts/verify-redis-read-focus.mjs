import assert from "node:assert/strict";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "vite";
import { chromium } from "playwright";
import { redisPagePlugin, redisPageSources } from "./lib/redis-page-preview.mjs";
import { buildRedisDesignData } from "./lib/ui-phase2-redis-design-data.mjs";
import { statusReviewFixtures, statusFixtureFile } from "./lib/status-review-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const output = args.length ? path.resolve(`output/playwright/p67-read-focus-${args[1]}`) : null;
if (output) await mkdir(output);
const { data: designData } = await buildRedisDesignData(process.cwd());
const fixture = designData.datasets.original;
const { nav: navigationFixture } = await statusReviewFixtures();
const probe = reservePort();
const envelope = (data) => ({
  data,
  request_id: "p67-focus-fixture",
  trace_id: "p67-focus-fixture",
});
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [redisPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const sources = new Set([
    ...redisPageSources,
    ...designData.sourcePaths,
    statusFixtureFile,
    "scripts/lib/ui-phase2-redis-design-data.mjs",
    "scripts/lib/status-review-fixtures.mjs",
    "tests/e2e/m06-02-platform-dashboard.spec.ts",
    "scripts/verify-redis-read-focus.mjs",
    "scripts/lib/ui-imported-style-sources.mjs",
    "apps/web/vite.config.ts",
  ]),
  images = [],
  results = [];
const hash = (b) => createHash("sha256").update(b).digest("hex");
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P67 read focus ${origin}`);
  const outcomes = await Promise.allSettled(
    [1440, 390].flatMap((width) =>
      ["reduce", "no-preference"].map(async (motion) => {
        const context = await browser.newContext({
            viewport: { width, height: width === 390 ? 844 : 1000 },
            locale: "zh-CN",
            reducedMotion: motion,
          }),
          page = await context.newPage(),
          requests = [],
          unexpected = [],
          errors = [];
        context.setDefaultTimeout(8000);
        let mode = "failure",
          held,
          checks = 0;
        const check = (a, b, label) => {
          assert.deepEqual(a, b, `${width}/${motion}: ${label}`);
          checks++;
        };
        const failure = {
          status: 400,
          json: {
            error: {
              code: "local_focus_read_failed",
              message: "本地读取失败",
              action_hint: "本地样例：重新核验读取。",
            },
            request_id: "p67-focus-failed",
          },
        };
        const release = async (fail = false) => {
          assert.ok(held);
          const route = held;
          held = null;
          await route.fulfill(fail ? failure : { json: envelope(fixture) });
        };
        const capture = async (name, locator) => {
          await page.evaluate(() => document.fonts.ready);
          await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
          await page.evaluate(
            () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
          );
          const issues = await locator.evaluate((el) =>
            [...el.querySelectorAll("h1,h2,h3,p,summary,button")]
              .filter((n) => n.checkVisibility())
              .flatMap((n) => {
                const r = n.getBoundingClientRect(),
                  hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
                return r.top < 0 ||
                  r.bottom > innerHeight ||
                  r.left < 0 ||
                  r.right > innerWidth ||
                  (!n.contains(hit) && !hit?.contains(n))
                  ? [n.textContent]
                  : [];
              }),
          );
          check(issues, [], "visible focus region " + name);
          const box = await locator.boundingBox(),
            viewport = page.viewportSize();
          assert.ok(box && viewport);
          const x = Math.max(0, box.x - 6),
            y = Math.max(0, box.y - 6);
          const clip = {
            x,
            y,
            width: Math.min(viewport.width, box.x + box.width + 6) - x,
            height: Math.min(viewport.height, box.y + box.height + 6) - y,
          };
          assert.equal(
            await locator.evaluate((el) =>
              Array.from(el.querySelectorAll("button"))
                .filter((button) => button.checkVisibility())
                .every((button) => {
                  const rect = button.getBoundingClientRect();
                  return button.contains(
                    document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
                  );
                }),
            ),
            true,
            "captured buttons are not obscured",
          );
          if (!output || motion !== "reduce") return;
          const b = await page.screenshot({ animations: "disabled", clip }),
            file = `${width}-${name}.png`;
          await writeFile(path.join(output, file), b);
          images.push({
            file,
            sha256: hash(b),
            pixelWidth: b.readUInt32BE(16),
            pixelHeight: b.readUInt32BE(20),
          });
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
              return route.fulfill({ json: envelope(navigationFixture) });
            if (key === "GET /api/v1/auth/session-status")
              return route.fulfill({ json: envelope({ authenticated: true }) });
            if (key === "GET /api/v1/me/ui-preferences")
              return route.fulfill({ status: 503, json: { error: { code: "local_preferences" } } });
            if (key !== "GET /api/v1/platform/operations/redis" || url.search) {
              unexpected.push(key);
              return route.abort();
            }
            requests.push({ mode, body: req.postData() });
            if (mode === "hold") {
              held = route;
              return;
            }
            return route.fulfill(mode === "failure" ? failure : { json: envelope(fixture) });
          });
          await page.goto(origin + "/platform-admin/redis");
          const surface = page.locator(".redis-resilience--c"),
            header = surface.locator(".redis-resilience__hero"),
            refresh = header.getByRole("button"),
            state = surface.locator(".redis-resilience__state"),
            notice = surface.locator(".redis-resilience__refresh-notice");
          const focused = (locator) => locator.evaluate((el) => el === document.activeElement);
          const activate = async (locator) => {
            await locator.focus();
            await page.keyboard.press("Enter");
          };
          await state.getByText("Redis 运行事实暂不可用", { exact: true }).waitFor();
          check(await state.getAttribute("aria-busy"), "false", "settled first failure not busy");
          check(
            await surface
              .getByRole("region", { name: "Redis 运行事实暂不可用", exact: true })
              .count(),
            1,
            "first failure is a named read region",
          );
          await state.getByRole("button", { name: "重新核验", exact: true }).focus();
          await capture("initial-retry-focus", state);
          mode = "hold";
          await page.keyboard.press("Enter");
          await header.getByRole("button", { name: "正在刷新…", exact: true }).waitFor();
          check(await state.getAttribute("aria-busy"), "true", "pending read region is busy");
          check(
            await focused(refresh),
            true,
            "removed first retry hands focus to permanent read action",
          );
          check(
            await refresh.evaluate((el) => el.disabled),
            false,
            "pending read remains natively focusable",
          );
          check(
            await refresh.getAttribute("aria-disabled"),
            "true",
            "pending read exposes unavailable action",
          );
          check(await refresh.getAttribute("aria-busy"), "true", "pending read exposes busy");
          const visibleReadFocus = () =>
            refresh.evaluate((el) => {
              const rect = el.getBoundingClientRect();
              return (
                el === document.activeElement &&
                rect.top >= 0 &&
                rect.bottom <= innerHeight &&
                el.contains(
                  document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2),
                )
              );
            });
          check(await visibleReadFocus(), true, "handoff is visible before screenshot scrolling");
          await page.waitForFunction(
            () => {
              const el = document.querySelector('.redis-read-action[aria-disabled="true"]');
              if (!el) return false;
              const style = getComputedStyle(el);
              return (
                style.backgroundColor === "rgb(232, 237, 244)" &&
                style.color === "rgb(82, 103, 132)"
              );
            },
            undefined,
            { timeout: 8000 },
          );
          check(
            await refresh.evaluate((el) => {
              const s = getComputedStyle(el);
              return [s.backgroundColor, s.color, s.opacity, s.outlineColor, s.outlineWidth];
            }),
            ["rgb(232, 237, 244)", "rgb(82, 103, 132)", "1", "rgb(36, 101, 215)", "3px"],
            "C pending state stays muted with full contrast focus ring",
          );
          check(requests.length, 2, "one explicit retry");
          await page.keyboard.press("Enter");
          await page.keyboard.press("Space");
          await refresh.evaluate((el) => el.click());
          check(requests.length, 2, "busy click/Enter/Space do not duplicate read");
          await capture("initial-retry-pending", header);
          await release();
          await surface.locator(".p67-conclusion").waitFor();
          check(await focused(refresh), true, "successful response preserves read focus");
          check(await refresh.getAttribute("aria-disabled"), "false", "success re-enables action");
          check(await state.count(), 0, "success removes first error region");
          await capture("initial-retry-complete", header);
          mode = "failure";
          await activate(refresh);
          await notice.waitFor();
          check(
            await notice.getAttribute("aria-busy"),
            "false",
            "settled retained failure not busy",
          );
          check(
            await surface.getByRole("region", { name: "刷新未完成", exact: true }).count(),
            1,
            "retained failure is a named refresh region",
          );
          check(await focused(refresh), true, "header failure retains focus");
          await notice.getByRole("button", { name: "重新核验", exact: true }).focus();
          await capture("retained-retry-focus", notice);
          mode = "hold";
          await page.keyboard.press("Enter");
          await header.getByRole("button", { name: "正在刷新…", exact: true }).waitFor();
          check(await focused(refresh), true, "removed retained retry hands focus to header");
          check(
            await visibleReadFocus(),
            true,
            "retained retry scrolls owned header focus into view",
          );
          check(await notice.count(), 0, "original stale failure clears while reading");
          await capture("retained-retry-pending", header);
          await release(true);
          await notice.waitFor();
          check(await focused(refresh), true, "failed response does not lose header focus");
          const nav = page
            .locator(".platform-secondary-nav")
            .getByRole("link", { name: "系统状态", exact: true });
          mode = "hold";
          await activate(refresh);
          await header.getByRole("button", { name: "正在刷新…", exact: true }).waitFor();
          await nav.focus();
          await release();
          await header.getByRole("button", { name: "刷新运行事实", exact: true }).waitFor();
          check(await focused(nav), true, "success does not steal intentionally moved focus");
          mode = "hold";
          await activate(refresh);
          await header.getByRole("button", { name: "正在刷新…", exact: true }).waitFor();
          await nav.focus();
          await release(true);
          await notice.waitFor();
          check(await focused(nav), true, "failure does not steal intentionally moved focus");
          const noticeRetry = notice.getByRole("button", { name: "重新核验", exact: true });
          mode = "hold";
          await noticeRetry.evaluate((el) => el.click());
          await header.getByRole("button", { name: "正在刷新…", exact: true }).waitFor();
          check(await focused(nav), true, "unfocused programmatic retry does not steal focus");
          await release();
          await header.getByRole("button", { name: "刷新运行事实", exact: true }).waitFor();
          check(await focused(nav), true, "programmatic retry completion does not steal focus");
          check(requests.length, 7, "seven reads with no duplicate dispatch");
          check(unexpected, [], "no write or external request");
          check(errors, [], "no browser error");
          results.push({ width, motion, checks, requests });
          console.log(JSON.stringify({ width, motion, checks, reads: requests.length }));
        } finally {
          if (held) await held.abort().catch(() => {});
          await context.close();
        }
      }),
    ),
  );
  const failures = outcomes.filter((o) => o.status === "rejected");
  if (failures.length)
    throw new AggregateError(
      failures.map((o) => o.reason),
      "P67 focus checks failed",
    );
  for (const mod of server.moduleGraph.idToModuleMap.values()) {
    const f = mod.file && path.relative(process.cwd(), mod.file).replaceAll("\\", "/");
    if (f && !f.startsWith("..") && !f.includes("node_modules") && /\.(vue|ts|css|json)$/.test(f))
      sources.add(f);
  }
  await includeImportedStyleSources(sources, (file) => readFile(file, "utf8"));
  images.sort((a, b) => a.file.localeCompare(b.file));
  if (output) {
    const sourceHashes = Object.fromEntries(
      await Promise.all([...sources].sort().map(async (f) => [f, hash(await readFile(f))])),
    );
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P67",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope:
            "actual Vue local focus checks; no real probe, scheduler, audit or permission acceptance",
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P67读取焦点审核</title><style>body{font:16px/1.7 Micr' +
        "osoft YaHei;margin:24px}img{max-width:100%;display:block;border:1px solid #c7d3e4}article{margin:28px 0}</styl" +
        "e><h1>P67读取焦点局部待审</h1><p>本地样例；不代表真实权限、探针或全页验收。</p>" +
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
      checks: results.reduce((sum, r) => sum + r.checks, 0),
      images: images.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
