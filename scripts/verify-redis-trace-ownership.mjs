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
const output = args.length
  ? path.resolve(`output/playwright/p67-trace-ownership-${args[1]}`)
  : null;
if (output) await mkdir(output);
const { data: designData } = await buildRedisDesignData(process.cwd());
const fixture = designData.datasets.original;
const { nav: navigationFixture } = await statusReviewFixtures();
const probe = reservePort();
const envelope = (data) => ({
  data,
  request_id: "p67-trace-fixture",
  trace_id: "p67-trace-fixture",
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
    "scripts/verify-redis-trace-ownership.mjs",
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
  console.log(`P67 trace ownership ${origin}`);
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
        let currentData = fixture;
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
              code: "local_trace_read_failed",
              message: "本地读取失败",
              action_hint: "本地样例：重新核验读取。",
            },
            request_id: "p67-trace-failed",
          },
        };
        const capture = async (name, locator) => {
          await page.evaluate(() => document.fonts.ready);
          await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
          await page.evaluate(
            () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
          );
          const issues = await locator.evaluate((el) =>
            [...el.querySelectorAll("b,h3,p,summary,code,button,dt,dd")]
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
          check(issues, [], "visible trace region " + name);
          if (!output || motion !== "reduce") return;
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
            requests.push({ mode, body: req.postData(), requestId: req.headers()["x-request-id"] });
            if (mode === "hold") {
              held = route;
              return;
            }
            return route.fulfill(mode === "failure" ? failure : { json: envelope(currentData) });
          });

          await page.addInitScript(() => {
            window.__copyWrites = [];
            window.__copyMode = "reject";
            Object.defineProperty(navigator, "clipboard", {
              configurable: true,
              value: {
                writeText: async (value) => {
                  window.__copyWrites.push(value);
                  if (window.__copyMode === "reject") throw new Error("local clipboard denial");
                  if (window.__copyMode === "hold")
                    return new Promise((resolve) => {
                      window.__finishCopy = resolve;
                    });
                },
              },
            });
          });
          await page.goto(origin + "/platform-admin/redis");
          const surface = page.locator(".redis-resilience--review"),
            header = surface.locator(".redis-resilience__hero"),
            refresh = header.getByRole("button"),
            state = surface.locator(".redis-resilience__state--danger"),
            notice = surface.locator(".redis-resilience__refresh-notice"),
            snapshot = surface.locator(".redis-resilience__footer .technical-details");
          const failureTrace = () =>
            surface.locator(
              ".redis-resilience__state--danger .technical-details, .redis-resilience__refresh-notice .technical-details",
            );
          const open = async (locator) => {
            if ((await locator.getAttribute("open")) === null) {
              await locator.locator("summary").focus();
              await page.keyboard.press("Enter");
            }
          };
          await state.waitFor();
          check(await state.getAttribute("aria-busy"), "false", "settled first failure not busy");
          check(
            await surface
              .getByRole("region", { name: "Redis 运行事实暂不可用", exact: true })
              .count(),
            1,
            "first failure is a named read region",
          );
          check(await snapshot.count(), 0, "initial failure has no snapshot");
          check(
            await failureTrace().locator("summary").innerText(),
            "本次失败读取追踪",
            "initial trace label",
          );
          check(
            await failureTrace().locator("code").textContent(),
            "p67-trace-failed",
            "initial failure ID",
          );
          await capture("initial-collapsed", state);
          await open(failureTrace());
          const copyStyle = await failureTrace()
            .getByRole("button", { name: "复制请求编号", exact: true })
            .evaluate((el) => {
              const style = getComputedStyle(el);
              return [style.backgroundColor, style.color, style.borderTopWidth];
            });
          check(
            copyStyle,
            ["rgb(255, 255, 255)", "rgb(23, 72, 160)", "1px"],
            "C copy button is secondary white with blue text",
          );
          check(
            await failureTrace()
              .locator("summary")
              .evaluate((el) => el.getBoundingClientRect().height >= 44),
            true,
            "trace disclosure has 44px height",
          );
          check(
            (await failureTrace().getAttribute("open")) !== null,
            true,
            "keyboard opens failure trace",
          );
          await capture("initial-expanded", state);
          await failureTrace().getByRole("button", { name: "复制请求编号", exact: true }).click();
          await failureTrace().getByRole("status").waitFor();
          check(
            await page.evaluate(() => window.__copyWrites.at(-1)),
            "p67-trace-failed",
            "copy uses first failure ID",
          );
          await capture("initial-copy-denied", state);
          await page.evaluate(() => {
            window.__copyMode = "success";
          });
          await failureTrace().getByRole("button", { name: "复制请求编号", exact: true }).click();
          await failureTrace().getByText("已复制", { exact: true }).waitFor();
          check(await failureTrace().getByRole("status").count(), 0, "retry copy clears denial");
          mode = "success";
          await state.getByRole("button", { name: "重新核验", exact: true }).click();
          await snapshot.waitFor({ state: "attached" });
          check(
            await snapshot.locator("code").textContent(),
            "p67-trace-fixture",
            "success owns snapshot ID",
          );
          check(await failureTrace().count(), 0, "success clears first failure trace");
          await open(snapshot);
          check(
            await surface
              .locator(".redis-resilience__footer")
              .evaluate((el) => getComputedStyle(el).textAlign),
            "left",
            "snapshot footer aligns with trace",
          );
          await capture("snapshot-expanded", surface.locator(".redis-resilience__footer"));
          mode = "failure";
          failure.json.request_id = "retained-failure";
          await refresh.click();
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
          check(
            await snapshot.locator("code").textContent(),
            "p67-trace-fixture",
            "failed read cannot relabel snapshot",
          );
          check(
            await failureTrace().locator("code").textContent(),
            "retained-failure",
            "retained failure owns its ID",
          );
          await open(failureTrace());
          check(
            await notice
              .locator("p")
              .first()
              .evaluate((el) => {
                const css = getComputedStyle(el);
                return [css.fontFamily.includes("Microsoft YaHei"), css.color];
              }),
            [true, "rgb(82, 103, 132)"],
            "failure copy uses C body font and neutral color",
          );
          check(
            await failureTrace()
              .getByRole("button", { name: "复制请求编号", exact: true })
              .evaluate((el) => {
                const rect = el.getBoundingClientRect(),
                  parent = el.parentElement.getBoundingClientRect();
                return rect.width < parent.width && rect.height >= 44;
              }),
            true,
            "secondary copy remains compact and 44px high",
          );
          await failureTrace().getByRole("button", { name: "复制请求编号", exact: true }).click();
          await failureTrace().getByText("已复制", { exact: true }).waitFor();
          check(
            await page.evaluate(() => window.__copyWrites.at(-1)),
            "retained-failure",
            "failure consumer copies its own ID",
          );
          await snapshot.getByRole("button", { name: "复制请求编号", exact: true }).click();
          await snapshot.getByText("已复制", { exact: true }).waitFor();
          check(
            await page.evaluate(() => window.__copyWrites.at(-1)),
            "p67-trace-fixture",
            "snapshot consumer copies original ID",
          );
          await capture("retained-failure-expanded", notice);
          await capture("retained-snapshot-expanded", surface.locator(".redis-resilience__footer"));
          delete failure.json.request_id;
          await refresh.click();
          await notice.waitFor();
          check(
            await failureTrace().locator("code").textContent(),
            requests.at(-1).requestId,
            "missing response ID uses actual client-sent ID",
          );
          check(
            await snapshot.locator("code").textContent(),
            "p67-trace-fixture",
            "client fallback cannot replace snapshot ID",
          );
          mode = "hold";
          await refresh.click();
          await header.getByRole("button", { name: "正在刷新…", exact: true }).waitFor();
          check(await failureTrace().count(), 0, "starting read removes previous failure trace");
          check(
            await snapshot.locator("code").textContent(),
            "p67-trace-fixture",
            "pending read preserves snapshot ID",
          );
          await notice.getByText("刷新已超时", { exact: true }).waitFor({ timeout: 20000 });
          check(
            await failureTrace().locator("code").textContent(),
            requests.at(-1).requestId,
            "real 15-second timeout uses this outgoing request ID",
          );
          check(
            await snapshot.locator("code").textContent(),
            "p67-trace-fixture",
            "timeout leaves snapshot provenance",
          );
          if (held) {
            await held.abort().catch(() => {});
            held = null;
          }
          await open(failureTrace());
          await capture("timeout-expanded", notice);
          mode = "failure";
          failure.status = 403;
          failure.json.error.code = "forbidden";
          failure.json.request_id = "permission-failure";
          await refresh.click();
          await state.waitFor();
          check(await snapshot.count(), 0, "permission failure removes snapshot trace with facts");
          check(
            await surface.locator(".p67-conclusion").count(),
            0,
            "permission failure removes facts",
          );
          check(
            await failureTrace().locator("code").textContent(),
            "permission-failure",
            "permission failure only displays own trace",
          );
          await open(failureTrace());
          await capture("permission-expanded", state);
          failure.status = 401;
          failure.json.error.code = "expired";
          failure.json.request_id = "expired-failure";
          await refresh.click();
          await state.getByRole("link", { name: "重新登录", exact: true }).waitFor();
          check(await snapshot.count(), 0, "expired read has no snapshot trace");
          check(
            await failureTrace().locator("code").textContent(),
            "expired-failure",
            "expired trace owns its ID",
          );
          check(
            await state.getByRole("link", { name: "重新登录", exact: true }).getAttribute("href"),
            "/login",
            "original login destination retained without navigation",
          );
          await open(failureTrace());
          await capture("expired-expanded", state);
          mode = "success";
          currentData = null;
          await refresh.click();
          await state.getByText("尚无 Redis 观测", { exact: true }).waitFor();
          check(await snapshot.count(), 0, "null response has no snapshot");
          check(
            await state.locator("summary").innerText(),
            "本次读取追踪",
            "empty success is a read, not a failure",
          );
          check(
            await state.locator("code").textContent(),
            "p67-trace-fixture",
            "empty accepted read owns response ID",
          );
          await open(state.locator(".technical-details"));
          await capture("empty-read-expanded", state);
          mode = "failure";
          failure.status = 400;
          failure.json.error.code = "local_trace_read_failed";
          failure.json.request_id = "00000000-0000-4000-8000-000000000067";
          await refresh.click();
          await state.getByText("Redis 运行事实暂不可用", { exact: true }).waitFor();
          check(await snapshot.count(), 0, "failure after empty still has no snapshot");
          check(
            await failureTrace().locator("code").textContent(),
            failure.json.request_id,
            "failure replaces only empty read provenance",
          );
          check(
            await failureTrace().locator("summary").innerText(),
            "本次失败读取追踪",
            "empty-to-failure label changes",
          );
          await open(failureTrace());
          await capture("after-empty-failure-expanded", state);
          await page.evaluate(() => {
            window.__copyMode = "hold";
          });
          await failureTrace().getByRole("button", { name: "复制请求编号", exact: true }).click();
          mode = "success";
          currentData = fixture;
          await refresh.click();
          await snapshot.waitFor({ state: "attached" });
          await page.evaluate(() => window.__finishCopy());
          check(
            await failureTrace().count(),
            0,
            "late clipboard completion cannot restore removed failure region",
          );
          check(
            await snapshot.getByText("已复制", { exact: true }).count(),
            0,
            "late failure copy cannot mark snapshot copied",
          );
          check(requests.length, 10, "ten reads and no duplicates");
          check(unexpected, [], "no external or write requests");
          check(errors, [], "no browser errors");
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
      "P67 trace checks failed",
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
            "actual Vue local trace ownership and clipboard consumer checks; no real Redis/MySQL/probe/audit/clipboard or permission acceptance",
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P67读取追踪审核</title><style>body{font:16px/1.7 Microsoft YaHei;margin:24px}img{max-width:100%;display:block;border:1px solid #c7d3e4}article{margin:28px 0}</style><h1>P67读取追踪局部待审</h1><p>本地样例；不代表真实权限、探针或全页验收。</p>' +
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
