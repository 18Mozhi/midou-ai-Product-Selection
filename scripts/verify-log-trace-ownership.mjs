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
);
const output = args.length
  ? path.resolve(`output/playwright/p62-trace-ownership-${args[1]}`)
  : null;
if (output) await mkdir(output);
const { fixture, nav } = await logReviewFixtures();
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  plugins: [logPagePlugin()],
  server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false, open: false },
});
const sources = new Set([
  ...logPageSources,
  logFixtureFile,
  "scripts/lib/log-review-fixtures.mjs",
  "scripts/lib/status-review-fixtures.mjs",
  "scripts/verify-log-trace-ownership.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "apps/web/vite.config.ts",
]);
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");
const images = [],
  results = [];
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P62 trace review ${origin}`);
  browser = await chromium.launch();
  for (const width of [1440, 390])
    for (const reducedMotion of ["reduce", "no-preference"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        reducedMotion,
      });
      const page = await context.newPage(),
        unexpected = [],
        errors = [],
        writes = [];
      let mode = "failure",
        heldRead = null,
        heldExport = null,
        reads = 0,
        checks = 0;
      const id = (kind) => `p62-local-${kind}-00000000-0000-4000-8000-000000000062`;
      const check = (actual, expected, label) => {
        assert.deepEqual(actual, expected, `${width}/${reducedMotion}: ${label}`);
        checks++;
      };
      const waitHeld = async (getRoute) => {
        const deadline = Date.now() + 5000;
        while (!getRoute() && Date.now() < deadline) await page.waitForTimeout(20);
        assert.ok(getRoute(), "local request reached interception");
      };
      const releaseExport = async () => {
        await waitHeld(() => heldExport);
        await heldExport.fulfill({
          status: 400,
          json: {
            error: {
              code: "local_export_failure",
              message: "本地测试导出失败",
              action_hint: "本地测试导出未完成。",
            },
            request_id: id("export"),
          },
        });
        heldExport = null;
      };
      try {
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("download", () => unexpected.push("download"));
        await page.route("**/*", async (route) => {
          const request = route.request(),
            url = new URL(request.url()),
            key = request.method() + " " + url.pathname;
          if (url.origin !== origin) {
            unexpected.push("external");
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          if (key === "GET /api/v1/me/navigation") return route.fulfill({ json: logEnvelope(nav) });
          if (key === "GET /api/v1/auth/session-status")
            return route.fulfill({ json: logEnvelope({ authenticated: true }) });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({
              status: 503,
              json: { error: { code: "local_preferences_unavailable" } },
            });
          const failure = (kind) =>
            route.fulfill({
              status: 400,
              json: {
                error: {
                  code: "local_trace_failure",
                  message: "本地测试失败",
                  action_hint: "本地测试请求未完成。",
                },
                request_id: id(kind),
              },
            });
          if (key === "POST /api/v1/platform/management/logs/exports") {
            writes.push({ body: request.postDataJSON(), accept: request.headers().accept });
            heldExport = route;
            return;
          }
          if (key !== "GET /api/v1/platform/management" || url.search !== "?domain=logs") {
            unexpected.push(key + url.search);
            return route.abort();
          }
          reads++;
          if (mode === "hold") {
            heldRead = route;
            return;
          }
          if (mode === "failure") return failure("read-failure");
          const data =
            mode === "empty"
              ? { ...fixture, items: [], summary: { total: 0, api: 0, worker: 0, crawler: 0 } }
              : fixture;
          return route.fulfill({ json: { ...logEnvelope(data), request_id: id(mode) } });
        });
        await page.goto(origin + "/platform-admin/logs");
        const surface = page.locator(".platform-log-center--review"),
          footer = surface.locator(".platform-log-traces");
        const readFeedback = surface.getByRole("status", { name: "日志读取反馈", exact: true }),
          exportFeedback = surface.getByRole("status", { name: "最近导出反馈", exact: true }),
          feedbacks = surface.locator(".platform-log-feedbacks");
        const trace = (kind) => footer.locator(`[data-log-trace="${kind}"]`);
        const ready = async (kind, value) => {
          await page.waitForFunction(
            ({ kind, value }) =>
              document.querySelector(`[data-log-trace="${kind}"] code`)?.textContent === value,
            { kind, value },
          );
        };
        const expand = async (kind, expected) => {
          const detail = trace(kind),
            summary = detail.locator("summary");
          await summary.focus();
          await page.keyboard.press("Enter");
          check(
            await detail.evaluate((element) => element.open),
            true,
            "native keyboard expands " + kind,
          );
          check(await detail.locator("code").innerText(), expected, "full ID " + kind);
          check(
            await summary.evaluate(
              (element) => element === document.activeElement && element.matches(":focus-visible"),
            ),
            true,
            "visible keyboard focus " + kind,
          );
          check(
            await detail
              .locator("code")
              .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
            true,
            "ID wraps " + kind,
          );
        };
        const capture = async (name, target = footer) => {
          if (!output || reducedMotion !== "reduce") return;
          await page.evaluate(() => document.fonts.ready);
          await target.evaluate((element) => element.scrollIntoView({ block: "center" }));
          const buffer = await target.screenshot({ animations: "disabled" }),
            file = `${width}-${name}.png`;
          await writeFile(path.join(output, file), buffer);
          images.push({
            file,
            sha256: hash(buffer),
            pixelWidth: buffer.readUInt32BE(16),
            pixelHeight: buffer.readUInt32BE(20),
          });
        };
        await ready("read-failure", id("read-failure"));
        check(await trace("snapshot").count(), 0, "first failure has no snapshot trace");
        check(
          await footer.locator(":scope > span").count(),
          0,
          "first failure has no snapshot timestamp",
        );
        await expand("read-failure", id("read-failure"));
        await capture("first-failure");
        mode = "ready";
        await surface.getByRole("button", { name: "重新加载", exact: true }).click();
        await ready("snapshot", id("ready"));
        check(await trace("read-failure").count(), 0, "recovery clears failure");
        await expand("snapshot", id("ready"));
        const timestamp = await footer.locator(":scope > span").innerText();
        mode = "failure";
        await surface.getByRole("button", { name: "刷新日志", exact: true }).click();
        await ready("read-failure", id("read-failure"));
        check(
          await trace("snapshot").locator("code").innerText(),
          id("ready"),
          "retained snapshot ID",
        );
        check(
          await footer.locator(":scope > span").innerText(),
          timestamp,
          "retained snapshot timestamp",
        );
        check(
          await trace("snapshot").evaluate((element) => element.open),
          true,
          "read failure preserves expanded snapshot",
        );
        await expand("read-failure", id("read-failure"));
        await capture("retained-failure");
        const originalReadFeedback = await readFeedback.innerText();
        const exportButton = surface.getByRole("button", { name: "导出当前筛选", exact: true });
        await exportButton.click();
        const reason = page.getByRole("dialog", { name: "填写日志导出原因", exact: true });
        await reason.locator("textarea").fill("本地追踪隔离测试");
        await reason.getByRole("button", { name: "确认提交", exact: true }).click();
        await surface.getByRole("button", { name: "正在导出…", exact: true }).waitFor();
        check(
          await readFeedback.innerText(),
          originalReadFeedback,
          "starting export preserves read failure",
        );
        check(await exportFeedback.count(), 0, "new export has no stale feedback");
        await releaseExport();
        await ready("export", id("export"));
        check(
          await readFeedback.innerText(),
          originalReadFeedback,
          "export failure cannot overwrite read failure",
        );
        check(
          await exportFeedback.innerText(),
          "最近导出反馈\n本地测试导出未完成。",
          "distinct named export status",
        );
        await capture("independent-feedbacks", feedbacks);
        check(
          writes,
          [{ body: { query: "", reason: "本地追踪隔离测试" }, accept: "text/csv" }],
          "original export body keeps empty query and omits absent source",
        );
        check(
          await trace("snapshot").locator("code").innerText(),
          id("ready"),
          "export does not overwrite snapshot",
        );
        check(
          await trace("read-failure").locator("code").innerText(),
          id("read-failure"),
          "export does not overwrite read failure",
        );
        await expand("export", id("export"));
        await capture("three-traces");
        await exportButton.click();
        await reason.getByRole("button", { name: "取消", exact: true }).click();
        check(writes.length, 1, "reason cancellation makes no POST");
        check(await exportFeedback.count(), 1, "cancel preserves recent export feedback");
        check(
          await trace("export").locator("code").innerText(),
          id("export"),
          "cancel retains recent export trace",
        );
        mode = "hold";
        await surface.getByRole("button", { name: "刷新日志", exact: true }).click();
        await waitHeld(() => heldRead);
        check(await readFeedback.count(), 0, "new read clears only read feedback");
        check(await exportFeedback.count(), 1, "export feedback survives an in-flight read");
        await capture("export-feedback-while-reading", feedbacks);
        await heldRead.fulfill({
          json: {
            ...logEnvelope({
              ...fixture,
              items: [],
              summary: { total: 0, api: 0, worker: 0, crawler: 0 },
            }),
            request_id: id("empty"),
          },
        });
        heldRead = null;
        await ready("snapshot", id("empty"));
        await surface.getByText("没有匹配事件", { exact: true }).waitFor();
        check(await trace("read-failure").count(), 0, "new read clears failure");
        check(
          await trace("export").locator("code").innerText(),
          id("export"),
          "new read retains recent export",
        );
        check(await footer.locator(":scope > span").count(), 1, "empty snapshot has its timestamp");
        check(
          await trace("snapshot").evaluate((element) => element.open),
          true,
          "empty preserves snapshot expansion",
        );
        await trace("snapshot").locator("summary").focus();
        await page.keyboard.press("Space");
        check(
          await trace("snapshot").evaluate((element) => element.open),
          false,
          "native Space collapses",
        );
        await page.keyboard.press("Enter");
        await capture("empty-snapshot");
        check(
          await exportFeedback.count(),
          1,
          "empty read recovery retains recent export feedback",
        );
        const emptyRegion = surface.locator(".platform-log-state");
        check(
          (await emptyRegion.innerText()).includes("本地测试导出未完成。"),
          false,
          "export error cannot relabel empty read state",
        );
        await capture("empty-read-region", emptyRegion);
        await exportButton.click();
        await reason.getByRole("button", { name: "确认提交", exact: true }).click();
        await waitHeld(() => heldExport);
        check(await exportFeedback.count(), 0, "explicit new export clears only its old feedback");
        mode = "failure";
        await surface.getByRole("button", { name: "刷新日志", exact: true }).click();
        await ready("read-failure", id("read-failure"));
        const emptyReadFailure = await emptyRegion.innerText();
        await releaseExport();
        await exportFeedback.waitFor();
        check(
          await emptyRegion.innerText(),
          emptyReadFailure,
          "later export failure cannot replace empty snapshot read failure",
        );
        await capture("empty-export-feedback", feedbacks);
        await capture("empty-read-failure", emptyRegion);
        check(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
          "page does not overflow",
        );
        check(reads, 5, "five explicit GETs, no read from trace controls/export");
        check(writes.length, 2, "two explicit local exports only");
        check(unexpected, [], "no actual downloads/external/unexpected calls");
        check(errors, [], "no browser errors");
        results.push({ width, reducedMotion, checks, reads, mockedExports: writes.length });
        console.log(JSON.stringify(results.at(-1)));
      } finally {
        if (heldRead) await heldRead.abort().catch(() => {});
        if (heldExport) await heldExport.abort().catch(() => {});
        await context.close();
      }
    }
  for (const module of server.moduleGraph.idToModuleMap.values()) {
    const file = module.file && path.relative(process.cwd(), module.file).replaceAll("\\", "/");
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
          page: "P62",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope:
            "actual Vue local fixtures; independent read/export feedback and trace regions; held export POST intercepted as 400, no real downloads or production operations; pending visual review",
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P62独立反馈与追踪待审</title><style>body{font:16px/1.7 Microsoft YaHei;margin:24px;color:#17253c}img{max-width:100%;display:block;border:1px solid #c7d3e4}article{margin:28px 0}</style><h1>P62独立反馈与追踪待审</h1><p>本地样例。仅展示的反馈及追踪区域，不代表整页、真实导出、权限或生产验收。</p>' +
        images
          .map(
            (item) =>
              `<article><h2>${item.file}</h2><img src="${item.file}" alt="${item.file} 待审"></article>`,
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
