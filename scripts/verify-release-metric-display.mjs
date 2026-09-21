import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { releasePagePlugin, releasePageSources } from "./lib/release-page-preview.mjs";
import { releaseReviewFixtures, releaseFixtureFile } from "./lib/release-review-fixtures.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const output = args.length ? path.resolve(`output/playwright/p65-metric-display-${args[1]}`) : null;
if (output) await mkdir(output);
const { fixture, nav } = await releaseReviewFixtures(),
  probe = reservePort();
const envelope = (data) => ({
  data,
  request_id: "p65-local-fixture",
  trace_id: "p65-local-fixture",
});
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [releasePagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const sources = new Set([
    ...releasePageSources,
    releaseFixtureFile,
    "scripts/lib/release-review-fixtures.mjs",
    "scripts/lib/status-review-fixtures.mjs",
    "tests/e2e/m06-02-platform-dashboard.spec.ts",
    "scripts/lib/ui-imported-style-sources.mjs",
    "scripts/verify-release-metric-display.mjs",
    "apps/web/vite.config.ts",
    "apps/api/src/mysql-release-rollout-repository.ts",
    "database/migrations/0026_release_rollout_m07_05.up.sql",
  ]),
  images = [],
  results = [];
const hash = (value) => createHash("sha256").update(value).digest("hex");
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P65 actual Vue review ${origin}`);
  for (const { width, motion } of [1440, 390].flatMap((width) =>
    ["reduce", "no-preference"].map((motion) => ({ width, motion })),
  )) {
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
    let current = structuredClone(fixture),
      failure = false,
      checks = 0;
    const check = (a, b, label) => {
      assert.deepEqual(a, b, `${width}: ${label}`);
      checks++;
    };
    const capture = async (name, locator) => {
      await page.evaluate(() => document.fonts.ready);
      if (locator) {
        await locator.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        const issues = await locator.evaluate((el) =>
          [...el.querySelectorAll("h2,h3,dt,dd,button,summary")]
            .filter((n) => n.checkVisibility())
            .flatMap((n) => {
              const r = n.getBoundingClientRect(),
                hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
              return r.top < 0 ||
                r.bottom > innerHeight ||
                r.left < 0 ||
                r.right > innerWidth ||
                (!n.contains(hit) && !hit?.contains(n))
                ? [{ text: n.textContent.slice(0, 60), bounds: r.toJSON(), hit: hit?.className }]
                : [];
            }),
        );
        assert.deepEqual(issues, [], width + " capture visible region " + name);
      }
      if (!output || motion !== "reduce") return;
      const b = locator
        ? await locator.screenshot({ animations: "disabled" })
        : await page.screenshot({ fullPage: true, animations: "disabled" });
      const file = width + "-" + name + ".png";
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
        if (key === "GET /api/v1/me/navigation") return route.fulfill({ json: envelope(nav) });
        if (key === "GET /api/v1/auth/session-status")
          return route.fulfill({ json: envelope({ authenticated: true }) });
        if (key === "GET /api/v1/me/ui-preferences")
          return route.fulfill({ status: 503, json: { error: { code: "local_preferences" } } });
        if (key !== "GET /api/v1/platform/operations/releases" || url.search) {
          unexpected.push(key + url.search);
          return route.abort();
        }
        requests.push({ method: req.method(), body: req.postData() });
        if (failure)
          return route.fulfill({
            status: 503,
            json: {
              error: {
                code: "local_release_unavailable",
                message: "本地读取失败",
                action_hint: "本地测试暂未读取到更新。",
              },
              request_id: "p65-local-read-failure",
            },
          });
        return route.fulfill({ json: envelope(current) });
      });
      await page.goto(origin + "/platform-admin/releases");
      const surface = page.locator(".release-center--review"),
        metrics = surface.locator("#p65-metrics"),
        refresh = surface.getByRole("button", { name: "刷新发布事实", exact: true });
      await metrics.waitFor();
      const fields = ["error_rate_percent", "read_p95_ms", "write_p95_ms", "async_lag_seconds"];
      const cases = [
        {
          name: "missing",
          values: [null, null, null, null],
          desktop: ["尚无记录", "尚无记录", "尚无记录", "尚无记录"],
          mobile: ["尚无记录", "尚无记录", "尚无记录", "尚无记录"],
        },
        {
          name: "zero",
          values: [0, 0, 0, 0],
          desktop: ["0%", "0 ms", "0 ms", "0 s"],
          mobile: ["0%", "0 ms", "0 ms", "0 秒"],
        },
        {
          name: "mixed",
          values: [null, 0, 200, null],
          desktop: ["尚无记录", "0 ms", "200 ms", "尚无记录"],
          mobile: ["尚无记录", "0 ms", "200 ms", "尚无记录"],
        },
        {
          name: "large",
          values: [999.9999, 4294967295, 4294967295, 4294967295],
          desktop: ["999.9999%", "4294967295 ms", "4294967295 ms", "4294967295 s"],
          mobile: ["999.9999%", "4294967295 ms", "4294967295 ms", "4294967295 秒"],
        },
      ];
      for (const scenario of cases) {
        // Explicit field-rendering variants. Preserve original contradictory E2E verdict, not service qualification proof.
        current = structuredClone(fixture);
        const row = current.gates.find((g) => g.gate_kind === "canary_5");
        fields.forEach((field, i) => {
          row[field] = scenario.values[i];
        });
        if (scenario.name === "large") {
          row.id = "12345678-1234-4123-8123-123456789abc";
          row.release_id = "87654321-1234-4123-8123-cba987654321";
        }
        const before = requests.length;
        await refresh.click();
        await page.waitForFunction(
          () =>
            document.querySelector(".release-read-action")?.getAttribute("aria-busy") === "false",
        );
        check(requests.length - before, 1, "one explicit local scenario read");
        check(
          await surface.locator(".verdict").getAttribute("data-state"),
          fixture.state,
          "display formatter does not recompute service verdict",
        );
        check(
          await surface.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
          true,
          "page stays inside viewport",
        );
        if (width === 1440) {
          const record = metrics.locator("tbody tr").first();
          const values = await record.locator("td").allTextContents();
          check(
            values.slice(1, 5).map((v) => v.trim()),
            scenario.desktop,
            "all desktop metric cells",
          );
          check(await metrics.locator("tbody tr").count(), 3, "other original gate records remain");
          await capture(scenario.name + "-table", metrics);
          if (scenario.name === "large") {
            await record.locator("summary").click();
            check(
              await record.getByText(row.id, { exact: true }).textContent(),
              row.id,
              "complete stored-shape gate UUID",
            );
            check(
              await record.getByText(row.release_id, { exact: true }).textContent(),
              row.release_id,
              "complete release UUID",
            );
            await capture("large-technical", record.locator("details"));
          }
        } else {
          const trigger = metrics
            .locator(".responsive-data-view__mobile")
            .getByRole("button")
            .first();
          const summary = await trigger.textContent();
          check(
            summary.includes("错误 " + scenario.mobile[0]),
            true,
            "mobile summary error-rate value",
          );
          check(
            summary.includes("读取 " + scenario.mobile[1]),
            true,
            "mobile summary read-latency value",
          );
          await capture(
            scenario.name + "-summary",
            metrics.locator(".responsive-data-view__mobile article").first(),
          );
          await trigger.click();
          const dialog = page.getByRole("dialog", { name: "5% 观察门", exact: true });
          await dialog.waitFor();
          const body = dialog.locator(".responsive-data-view__details > dl");
          check(
            (await body.locator("dd").allTextContents()).slice(2).map((v) => v.trim()),
            scenario.mobile,
            "all four detail metrics",
          );
          check(
            await dialog.getByText("1800 秒 / 20 个", { exact: true }).count(),
            1,
            "duration/sample not reinterpreted",
          );
          await capture(scenario.name + "-detail", body);
          if (scenario.name === "large") {
            await dialog.locator("summary").click();
            check(
              await dialog.getByText(row.id, { exact: true }).textContent(),
              row.id,
              "full gate UUID in narrow detail",
            );
            check(
              await dialog.getByText(row.release_id, { exact: true }).textContent(),
              row.release_id,
              "full release UUID in narrow detail",
            );
            check(
              await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
              true,
              "long fields wrap inside dialog",
            );
            await capture("large-technical", dialog.locator("details"));
          }
          await page.keyboard.press("Escape");
          check(await dialog.count(), 0, "detail closes");
          check(
            await trigger.evaluate((el) => el === document.activeElement),
            true,
            "detail trigger focus restored",
          );
        }
        check(requests.length - before, 1, "local details and disclosure never read again");
      }
      check(requests.length, 5, "initial plus four scenario reads");
      check(unexpected, [], "no production/write/external/download request");
      check(errors, [], "no browser exceptions");
      results.push({ width, motion, checks, requests });
      console.log(JSON.stringify({ width, motion, checks }));
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
          page: "P65",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope:
            "actual Vue C review; original contradictory E2E with four explicit numeric display variants and stored-shape UUIDs; no release or rollback execution",
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P65指标显示审核</title>' +
        "<style>body{font:16px/1.7 Microsoft YaHei;margin:24px;color:#182739}" +
        "img{max-width:100%;border:1px solid #c7d3e4;display:block}article{margin:28px 0}</style>" +
        "<h1>P65 指标显示待审</h1><p>本地样例，只读展示；未执行发布或回滚，不代表真实权限或生产验收。</p>" +
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
