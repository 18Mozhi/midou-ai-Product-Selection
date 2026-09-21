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
const output = args.length ? path.resolve(`output/playwright/p62-export-reason-${args[1]}`) : null;
if (output) await mkdir(output);
const { fixture, nav } = await logReviewFixtures(),
  probe = reservePort();
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
  "scripts/verify-log-export-reason.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "apps/web/vite.config.ts",
]);
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex"),
  images = [],
  results = [];
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P62 export reason review ${origin}`);
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
      let held = null,
        reads = 0,
        checks = 0;
      const check = (actual, expected, label) => {
        assert.deepEqual(actual, expected, `${width}/${reducedMotion}: ${label}`);
        checks++;
      };
      const capture = async (name, locator) => {
        if (!output || reducedMotion !== "reduce") return;
        await page.evaluate(() => document.fonts.ready);
        const buffer = locator
          ? await locator.screenshot({ animations: "disabled" })
          : await page.screenshot({ animations: "disabled" });
        const file = `${width}-${name}.png`;
        await writeFile(path.join(output, file), buffer);
        images.push({
          file,
          sha256: hash(buffer),
          pixelWidth: buffer.readUInt32BE(16),
          pixelHeight: buffer.readUInt32BE(20),
        });
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
          if (
            key === "GET /api/v1/platform/management" &&
            url.search === "?domain=logs&query=trace-shared&status=crawler"
          ) {
            reads++;
            const items = fixture.items.filter(
              (item) => item.source === "crawler" && item.trace_id === "trace-shared",
            );
            return route.fulfill({
              json: logEnvelope({
                ...fixture,
                items,
                summary: { total: 1, api: 0, worker: 0, crawler: 1 },
              }),
            });
          }
          if (key === "POST /api/v1/platform/management/logs/exports") {
            writes.push({
              body: request.postDataJSON(),
              accept: request.headers().accept,
              hasIdempotencyKey: Boolean(request.headers()["idempotency-key"]),
            });
            held = route;
            return;
          }
          unexpected.push(key + url.search);
          return route.abort();
        });
        await page.goto(origin + "/platform-admin/logs?query=trace-shared&source=crawler");
        const surface = page.locator(".platform-log-center--review"),
          trigger = surface.getByRole("button", { name: "导出当前筛选", exact: true });
        const dialog = page.getByRole("dialog", { name: "填写日志导出原因", exact: true }),
          input = dialog.locator("textarea"),
          submit = dialog.getByRole("button", { name: "确认提交", exact: true }),
          cancel = dialog.getByRole("button", { name: "取消", exact: true }),
          close = dialog.getByRole("button", { name: "关闭原因填写", exact: true });
        await surface.locator(".p62-workspace").waitFor();
        const initial = "导出当前链路日志用于故障排查";
        const focused = (locator) =>
          locator.evaluate((element) => element === document.activeElement);
        const open = async () => {
          await trigger.click();
          await dialog.waitFor();
          await input.waitFor();
          check(await focused(input), true, "reason initial focus");
        };
        const closed = async () => {
          await dialog.waitFor({ state: "hidden" });
          check(await focused(trigger), true, "cancel returns trigger focus");
          check(writes.length, 0, "cancel makes no write");
        };
        await open();
        check(await input.inputValue(), initial, "original default reason");
        check(
          await input.evaluate(
            (element) =>
              element.getBoundingClientRect().top -
                element.closest("label").getBoundingClientRect().top <
              64,
          ),
          true,
          "limit caption stays together instead of three grid rows",
        );
        check(
          await cancel.evaluate((element) => getComputedStyle(element).backgroundColor),
          "rgb(255, 255, 255)",
          "cancel is a secondary white action",
        );
        check(
          await close.evaluate((element) => getComputedStyle(element).backgroundColor),
          "rgb(255, 255, 255)",
          "close is a secondary white action",
        );
        check(
          await submit.evaluate((element) => getComputedStyle(element).backgroundColor),
          "rgb(23, 72, 181)",
          "submit retains primary blue",
        );
        await cancel.hover();
        await page.waitForFunction(
          () => {
            const element = document.querySelector(
              '.audited-reason-dialog[open] footer button[type="button"]',
            );
            return element && getComputedStyle(element).backgroundColor === "rgb(237, 243, 255)";
          },
          null,
          { timeout: 2000 },
        );
        check(
          await cancel.evaluate((element) => getComputedStyle(element).backgroundColor),
          "rgb(237, 243, 255)",
          "secondary hover is light blue",
        );
        await input.hover();
        check(await input.getAttribute("required"), "", "required input");
        check(await input.getAttribute("minlength"), "2", "original minimum two");
        check(
          await input.getAttribute("aria-describedby"),
          "audited-reason-help",
          "help association",
        );
        check(
          await page.locator("#audited-reason-help").count(),
          1,
          "unique help target on this page",
        );
        await capture("default", dialog);
        await close.focus();
        await page.keyboard.press("Shift+Tab");
        check(await focused(submit), true, "reverse wraps first to submit");
        await page.keyboard.press("Tab");
        check(await focused(close), true, "forward wraps submit to first");
        await page.keyboard.press("Tab");
        check(await focused(input), true, "Tab to reason");
        await page.keyboard.press("Tab");
        check(await focused(cancel), true, "Tab to cancel");
        await page.keyboard.press("Tab");
        check(await focused(submit), true, "Tab to confirm");
        check(
          await submit.evaluate((element) => element.matches(":focus-visible")),
          true,
          "confirm keyboard focus visible",
        );
        await capture("confirm-focus", dialog);
        for (const [name, value] of [
          ["empty", ""],
          ["whitespace", "   "],
          ["one-character", "查"],
        ]) {
          await input.fill(value);
          check(await submit.isDisabled(), true, name + " cannot submit");
          await input.press("Control+Enter");
          check(writes.length, 0, name + " no POST");
          await cancel.focus();
          await page.keyboard.press("Tab");
          check(await focused(close), true, name + " disabled confirm skipped in loop");
          await page.keyboard.press("Shift+Tab");
          check(await focused(cancel), true, name + " reverse loop excludes disabled confirm");
          if (name === "one-character") await capture("minimum-disabled", dialog);
        }
        await input.fill("排查");
        check(await submit.isEnabled(), true, "two characters enables original minimum");
        await input.fill("未提交草稿");
        await page.keyboard.press("Escape");
        await closed();
        await open();
        check(
          await input.inputValue(),
          initial,
          "reopen uses original default not cancelled draft",
        );
        await close.click();
        await closed();
        await open();
        await cancel.click();
        await closed();
        await open();
        // Use browser input semantics, not a programmatic value assignment, for the native limit.
        await input.fill("查".repeat(301));
        const reasonLimit = {
          maximumLength: await input.getAttribute("maxlength"),
          acceptedLength: (await input.inputValue()).length,
          submitEnabled: await submit.isEnabled(),
        };
        check(
          reasonLimit,
          { maximumLength: "300", acceptedLength: 300, submitEnabled: true },
          "native input limits the reason to the existing 300-character contract",
        );
        check(
          (await dialog.locator("#audited-reason-help").innerText()).includes("300 / 300"),
          true,
          "counter reports actual accepted input",
        );
        await capture("maximum-reason", dialog);
        await input.fill("  本地导出状态核对  ");
        await submit.click();
        await page.waitForFunction(() =>
          [...document.querySelectorAll("button")].some(
            (element) =>
              element.textContent?.trim() === "正在导出…" &&
              element.getAttribute("aria-busy") === "true",
          ),
        );
        await dialog.waitFor({ state: "hidden" });
        const waiting = surface.getByRole("button", { name: "正在导出…", exact: true });
        check(
          await waiting.getAttribute("aria-disabled"),
          "true",
          "waiting action is semantically disabled",
        );
        check(
          await waiting.evaluate((element) => element.disabled),
          false,
          "waiting remains natively focusable",
        );
        check(await focused(waiting), true, "reason submit returns focus to waiting action");
        await page.waitForFunction(
          () => {
            const element = document.querySelector('.platform-log-export[aria-busy="true"]');
            return element && getComputedStyle(element).backgroundColor === "rgb(233, 238, 245)";
          },
          null,
          { timeout: 2000 },
        );
        check(
          await waiting.evaluate((element) => getComputedStyle(element).backgroundColor),
          "rgb(233, 238, 245)",
          "waiting retains disabled gray styling",
        );
        await waiting.evaluate((element) => element.click());
        await page.keyboard.press("Enter");
        await page.keyboard.press("Space");
        await page.waitForTimeout(80);
        check(
          await waiting.evaluate((element) => element.matches(":focus-visible")),
          true,
          "waiting keyboard focus remains visible",
        );
        check(writes.length, 1, "disabled activation does not dispatch twice");
        check(await dialog.isVisible(), false, "waiting activations do not reopen reason dialog");
        check(
          writes[0],
          {
            body: { query: "trace-shared", source: "crawler", reason: "本地导出状态核对" },
            accept: "text/csv",
            hasIdempotencyKey: true,
          },
          "original trimmed payload and idempotency header",
        );
        const pendingFocus = await page.evaluate(() => ({
          tag: document.activeElement?.tagName,
          text: document.activeElement?.textContent?.trim().slice(0, 60),
        }));
        check(
          pendingFocus,
          { tag: "BUTTON", text: "正在导出…" },
          "waiting focus belongs to export button",
        );
        await waiting.scrollIntoViewIfNeeded();
        await capture("pending-viewport");
        assert.ok(held, "local POST held");
        await held.fulfill({
          status: 400,
          json: {
            error: {
              code: "local_export_failure",
              message: "本地导出失败",
              action_hint: "本地测试导出未完成，请核对后重试。",
            },
            request_id: "p62-local-export-reason-failure",
          },
        });
        held = null;
        await trigger.waitFor();
        const message = surface.getByRole("status", { name: "最近导出反馈", exact: true });
        await message.getByText("本地测试导出未完成，请核对后重试。", { exact: true }).waitFor();
        check(await trigger.isEnabled(), true, "failure re-enables export");
        check(await focused(trigger), true, "failure does not lose waiting focus");
        check(await trigger.getAttribute("aria-busy"), "false", "failure clears busy state");
        check(
          await surface.locator('[data-log-trace="snapshot"] code').textContent(),
          "p62-local-fixture",
          "failure preserves snapshot trace",
        );
        check(
          await surface.locator('[data-log-trace="export"] code').textContent(),
          "p62-local-export-reason-failure",
          "failure owns export trace",
        );
        await capture("failure", message);
        await open();
        check(await input.inputValue(), initial, "manual retry opens fresh reason");
        await capture("retry-reason", dialog);
        await cancel.click();
        await dialog.waitFor({ state: "hidden" });
        check(writes.length, 1, "manual retry cancellation no second POST");
        check(await focused(trigger), true, "retry cancellation focus returns");
        await open();
        await submit.click();
        await waiting.waitFor();
        await dialog.waitFor({ state: "hidden" });
        await page.waitForFunction(() =>
          document.activeElement?.classList.contains("platform-log-export"),
        );
        const refresh = surface.getByRole("button", { name: "刷新日志", exact: true });
        await refresh.focus();
        check(await focused(refresh), true, "user can move focus away during export");
        assert.ok(held, "second local POST held");
        await held.fulfill({
          status: 400,
          json: {
            error: {
              code: "local_export_failure",
              message: "本地导出失败",
              action_hint: "本地测试第二次导出未完成。",
            },
            request_id: "p62-local-export-second-failure",
          },
        });
        held = null;
        await message.getByText("本地测试第二次导出未完成。", { exact: true }).waitFor();
        check(await focused(refresh), true, "settled export does not steal user-moved focus");
        check(writes.length, 2, "explicit second submission dispatches once");
        check(reads, 1, "reason actions do not reread logs");
        check(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
          "page no horizontal overflow",
        );
        check(errors, [], "no page errors");
        check(unexpected, [], "no actual download/external/unexpected requests");
        results.push({
          width,
          reducedMotion,
          checks,
          reads,
          mockedExports: writes.length,
          reasonLimit,
          pendingFocus,
        });
        console.log(JSON.stringify(results.at(-1)));
      } finally {
        if (held) await held.abort().catch(() => {});
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
            "actual Vue C local fixtures; native300character input,reason states,waiting focus and guarded activation; held POST intercepted400,no download or production; export lifecycle/realCSV not accepted",
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P62导出原因待审</title><style>body{font:16px/1.7 Microsoft YaHei;margin:24px;color:#17253c}img{max-width:100%;display:block;border:1px solid #c7d3e4}article{margin:28px 0}</style><h1>P62导出原因区域待审</h1><p>本地样例。原生300字限制和等待焦点已核对；未真实导出，不代表全生命周期或生产通过。</p>' +
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
