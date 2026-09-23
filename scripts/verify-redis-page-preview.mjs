import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer as reservePort } from "node:net";
import path from "node:path";
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
  ? path.resolve(`output/playwright/p67-page-composition-${args[1]}`)
  : null;
if (output) await mkdir(output);
const { data: designData } = await buildRedisDesignData(process.cwd());
const { nav } = await statusReviewFixtures();
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
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
  "scripts/lib/status-review-fixtures.mjs",
  "scripts/lib/ui-phase2-redis-design-data.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "scripts/verify-redis-page-preview.mjs",
  "apps/web/vite.config.ts",
]);
const images = [],
  results = [],
  hash = (v) => createHash("sha256").update(v).digest("hex");
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P67 actual Vue review ${origin}`);
  for (const width of [1440, 390])
    for (const motion of ["reduce", "no-preference"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: motion,
      });
      const page = await context.newPage(),
        errors = [],
        unexpected = [],
        requests = [];
      context.setDefaultTimeout(10000);
      let current = designData.datasets.original,
        checks = 0;
      const check = (actual, expected, label) => {
        assert.deepEqual(actual, expected, `${width}/${motion}: ${label}`);
        checks++;
      };
      const capture = async (name, selector) => {
        await page.evaluate(() => document.fonts.ready);
        const target = selector ? page.locator(selector) : page;
        let fullPage = !selector;
        if (selector) {
          fullPage = await target.evaluate((el) => {
            const nav = document.querySelector(".platform-secondary-nav");
            const navStyle = nav && getComputedStyle(nav);
            const reservedTop =
              navStyle?.position === "sticky"
                ? Math.max(0, parseFloat(navStyle.top) || 0) +
                  nav.getBoundingClientRect().height +
                  16
                : 16;
            const r = el.getBoundingClientRect();
            if (r.height > innerHeight - reservedTop - 16) return true;
            window.scrollTo(
              0,
              scrollY + r.top - reservedTop - (innerHeight - reservedTop - r.height) / 2,
            );
            return false;
          });
          await page.evaluate(
            () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
          );
          check(
            await target.evaluate((el) => {
              const r = el.getBoundingClientRect();
              return r.left >= 0 && r.right <= innerWidth + 1 && r.width > 0;
            }),
            true,
            name + " horizontal bounds",
          );
          if (!fullPage)
            check(
              await target.evaluate((el) => {
                const r = el.getBoundingClientRect();
                const issues = [...el.querySelectorAll("h2,h3,p,dt,dd,b,small,code,button,summary")]
                  .filter((n) => n.checkVisibility())
                  .filter((n) => {
                    const b = n.getBoundingClientRect();
                    const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
                    return !n.contains(hit) && !hit?.contains(n);
                  })
                  .map((n) => n.textContent.slice(0, 60));
                return { withinViewport: r.top >= 0 && r.bottom <= innerHeight, covered: issues };
              }),
              { withinViewport: true, covered: [] },
              name + " region visible without fixed-nav occlusion",
            );
        }
        if (fullPage) await page.evaluate(() => window.scrollTo(0, 0));
        if (!output || motion !== "reduce") return;
        const buffer = await (fullPage ? page : target).screenshot({
          ...(fullPage ? { fullPage: true } : {}),
          animations: "disabled",
        });
        const file = `${width}-${name}.png`;
        await writeFile(path.join(output, file), buffer);
        images.push({
          file,
          scope: fullPage ? "full-page (region too tall or default)" : selector,
          sha256: hash(buffer),
          pixelWidth: buffer.readUInt32BE(16),
          pixelHeight: buffer.readUInt32BE(20),
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
          const envelope = (data) => ({
            data,
            request_id: "p67-local-fixture",
            trace_id: "p67-local-fixture",
          });
          if (key === "GET /api/v1/me/navigation") return route.fulfill({ json: envelope(nav) });
          if (key === "GET /api/v1/auth/session-status")
            return route.fulfill({ json: envelope({ authenticated: true }) });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({ status: 503, json: { error: { code: "local_preferences" } } });
          if (key !== "GET /api/v1/platform/operations/redis" || url.search) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ method: req.method(), body: req.postData() });
          return route.fulfill({ json: envelope(current) });
        });
        await page.goto(origin + "/platform-admin/redis");
        const root = page.locator(".redis-resilience--c"),
          refresh = root.getByRole("button", { name: "刷新运行事实", exact: true });
        await root.locator(".p67-sampling").waitFor();
        check(await page.locator("h1").count(), 1, "one page h1");
        const entries = [
          ["original", current],
          ...Object.entries(designData.datasets).filter(([k]) => k !== "original"),
        ];
        for (const [name, fixture] of entries) {
          if (name !== "original") {
            current = fixture;
            await refresh.click();
            await page.waitForFunction(
              () =>
                document
                  .querySelector(".redis-resilience__hero button")
                  ?.getAttribute("aria-busy") === "false",
            );
          }
          check(await root.getAttribute("data-state"), fixture.state, name + " actual verdict");
          check(
            await root.locator(".p67-finding-list article").count(),
            fixture.findings.length,
            name + " findings",
          );
          check(
            await root.locator(".p67-sample-list article").count(),
            fixture.keyspace_sample.hotspots.length,
            name + " sample groups",
          );
          check(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            true,
            name + " no horizontal overflow",
          );
          const unavailable = fixture.findings.some((f) => f.code === "redis_unavailable");
          check(
            await root.locator(".p67-resource").count(),
            unavailable ? 0 : 2,
            name + " unavailable not measured zero",
          );
          if (!unavailable)
            for (const [resource, prefix] of [
              ["memory", "redis_memory"],
              ["connections", "redis_connections"],
            ]) {
              const level = fixture.findings.some((f) => f.code === prefix + "_stop")
                ? "blocked"
                : fixture.findings.some((f) => f.code === prefix + "_warning")
                  ? "warning"
                  : "ready";
              check(
                await root.locator(`[data-resource="${resource}"]`).getAttribute("data-severity"),
                level,
                name + resource + " independent severity",
              );
            }
          check(
            await root.locator(".p67-sample-list .p67-bar").count(),
            fixture.keyspace_sample.total_sampled_bytes > 0
              ? fixture.keyspace_sample.hotspots.length
              : 0,
            name + " meaningful denominator only",
          );
          if (name === "sample-all-failed")
            check(
              (await root.locator(".p67-sample-empty").innerText()).includes(
                "不能据此判断没有业务键",
              ),
              true,
              name,
            );
          if (name === "original") {
            for (const selector of [".p67-persistence", ".p67-policy", ".p67-resources"])
              check(await root.locator(selector).isVisible(), true, selector);
            const ids = await page.locator("[id]").evaluateAll((ns) => ns.map((n) => n.id));
            check(ids.length, new Set(ids).size, "no duplicate ids");
            const headingStyles = await root.locator("h1,h2,h3").evaluateAll((ns) =>
              ns.map((n) => {
                const css = getComputedStyle(n);
                return {
                  tag: n.tagName.toLowerCase(),
                  text: n.textContent?.trim().slice(0, 50),
                  fontFamily: css.fontFamily,
                  fontWeight: css.fontWeight,
                };
              }),
            );
            check(
              headingStyles.every(
                (item) =>
                  item.fontFamily.includes("Microsoft YaHei") && Number(item.fontWeight) >= 700,
              ),
              true,
              `C headings do not inherit old serif font: ${JSON.stringify(headingStyles)}`,
            );
            check(
              await root.locator(".redis-resilience__footer").evaluate((el) => {
                const r = el.getBoundingClientRect();
                const first = el.firstElementChild.getBoundingClientRect();
                return first.left - r.left <= 8 && getComputedStyle(el).textAlign === "left";
              }),
              true,
              "footer starts at workspace left",
            );
            const controls = await root.locator("button,summary").evaluateAll((ns) =>
              ns
                .filter((n) => n.checkVisibility())
                .map((n) => ({
                  name: n.textContent.trim(),
                  height: n.getBoundingClientRect().height,
                })),
            );
            check(
              controls.filter((c) => c.height < 44),
              [],
              "44px native controls",
            );
            await capture("default");
            await capture("persistence", ".p67-persistence");
            await capture("sampling", ".p67-sampling");
            const summary = root.locator(".redis-resilience__footer summary");
            await summary.focus();
            await page.keyboard.press("Enter");
            check(
              await root.locator(".redis-resilience__footer details").getAttribute("open"),
              "",
              "native disclosure opens",
            );
            check(
              await root.locator(".redis-resilience__footer code").innerText(),
              "p67-local-fixture",
              "original disclosure ID",
            );
            check(
              await summary.evaluate((el) => el.matches(":focus-visible")),
              true,
              "keyboard disclosure focus",
            );
            await capture("trace", ".redis-resilience__footer");
            await page.keyboard.press("Enter");
          }
          if (
            [
              "probe-failed",
              "memory-unbounded",
              "memory-over",
              "custom-policy",
              "zero-resources",
            ].includes(name)
          )
            await capture(name + "-resources", ".p67-resources");
          if (
            ["sample-all-failed", "sample-zero", "sample-empty", "sample-unsupported"].includes(
              name,
            )
          )
            await capture(name + "-sampling", ".p67-sampling");
          if (["sample-all-failed", "sample-unsupported"].includes(name))
            await capture(name + "-feedback", ".p67-sample-empty");
        }
        check(requests.length, 37, "one read per sample, no extra reads");
        check(
          requests.every((r) => r.method === "GET" && r.body === null),
          true,
          "only bodyless local GET",
        );
        check(
          await root.locator("dialog,input,textarea,select").count(),
          0,
          "no invented business controls",
        );
        check(errors, [], "no browser exceptions");
        check(unexpected, [], "no live API/writes/download");
        results.push({ width, motion, checks, requests: requests.length });
        console.log(JSON.stringify(results.at(-1)));
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
          page: "P67",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope:
            "Actual Vue C review; 36 inert source-generated datasets and one original E2E. No live Redis/MySQL/probe/audit or recovery. Read failures and lifecycle not covered.",
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P67实际Vue待审</title><style>body{font:16px/1.7 Microsoft YaHei;margin:24px;color:#182d4a}img{max-width:100%;border:1px solid #dce4ee}article{margin:32px 0}</style><h1>P67 Redis运行 · 实际Vue C待审</h1><p>本地合成样例，无真实Redis/MySQL请求；不是权限、恢复或生产验收。</p>' +
        images
          .map(
            (i) =>
              `<article><h2>${i.file}</h2><img src="${i.file}" alt="${i.file} 待审"></article>`,
          )
          .join("") +
        "</html>",
    );
  }
  console.log(
    JSON.stringify({
      groups: results.length,
      checks: results.reduce((s, r) => s + r.checks, 0),
      reads: results.reduce((s, r) => s + r.requests, 0),
      images: images.length,
      sources: sources.size,
      port,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
