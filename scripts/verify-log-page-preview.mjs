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
const output = args.length
  ? path.resolve(`output/playwright/p62-page-composition-${args[1]}`)
  : null;
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
const sources = new Set([
    ...logPageSources,
    logFixtureFile,
    "scripts/lib/log-review-fixtures.mjs",
    "scripts/lib/status-review-fixtures.mjs",
    "scripts/verify-log-page-preview.mjs",
    "scripts/lib/ui-imported-style-sources.mjs",
    "apps/web/vite.config.ts",
  ]),
  images = [],
  results = [],
  hash = (b) => createHash("sha256").update(b).digest("hex");
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log("P62 actual Vue review " + origin);
  browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: "zh-CN",
        reducedMotion: "reduce",
      }),
      page = await context.newPage(),
      requests = [],
      unexpected = [],
      errors = [];
    let empty = false,
      failure = false,
      checks = 0;
    const check = (a, b, label) => {
      assert.deepEqual(a, b, width + ": " + label);
      checks++;
    };
    const capture = async (name, locator, viewport = false) => {
      if (!output) return;
      await page.evaluate(() => document.fonts.ready);
      if (locator) await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
      const b = locator
          ? await locator.screenshot({ animations: "disabled" })
          : await page.screenshot({ fullPage: !viewport, animations: "disabled" }),
        file = `${width}-${name}.png`;
      await writeFile(path.join(output, file), b);
      images.push({
        file,
        sha256: hash(b),
        pixelWidth: b.readUInt32BE(16),
        pixelHeight: b.readUInt32BE(20),
      });
    };
    const click = async (locator) => {
      await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await locator.click();
    };
    try {
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
        if (key === "GET /api/v1/me/navigation") return route.fulfill({ json: logEnvelope(nav) });
        if (key === "GET /api/v1/auth/session-status")
          return route.fulfill({ json: logEnvelope({ authenticated: true }) });
        if (key === "GET /api/v1/me/ui-preferences")
          return route.fulfill({
            status: 503,
            json: { error: { code: "local_preferences_unavailable" } },
          });
        if (
          key !== "GET /api/v1/platform/management" ||
          url.searchParams.get("domain") !== "logs"
        ) {
          unexpected.push(key);
          return route.abort();
        }
        requests.push({ key, search: url.search, body: req.postData() });
        if (failure)
          return route.fulfill({
            status: 400,
            json: {
              error: {
                code: "local_scope_read_failed",
                message: "本地读取失败",
                action_hint: "本地测试尚未取得新条件的日志。",
              },
              request_id: "p62-local-scope-failure",
            },
          });
        const source = url.searchParams.get("status"),
          query = url.searchParams.get("query");
        const items = empty
          ? []
          : fixture.items.filter(
              (i) => (!source || i.source === source) && (!query || i.trace_id === query),
            );
        return route.fulfill({
          json: logEnvelope({
            ...fixture,
            items,
            summary: {
              total: items.length,
              api: items.filter((i) => i.source === "api").length,
              worker: items.filter((i) => i.source === "worker").length,
              crawler: items.filter((i) => i.source === "crawler").length,
            },
          }),
        });
      });
      await page.goto(origin + "/platform-admin/logs");
      const surface = page.locator(".platform-log-center--review"),
        workspace = surface.locator(".p62-workspace"),
        active = () => surface.locator(".p62-events:visible"),
        choose = (id) => surface.locator(`[data-log-chain="${id}"]`);
      await workspace.waitFor();
      const scope = surface.getByRole("region", { name: "查询与日志范围", exact: true }),
        applied = scope.locator('[data-log-scope="applied"]'),
        displayed = scope.locator('[data-log-scope="displayed"]');
      check(
        await applied.innerText(),
        "已应用条件\n运行面：全部运行面\n检索条件：未设置",
        "default applied scope",
      );
      check(
        await displayed.innerText(),
        "已显示日志对应条件\n运行面：全部运行面\n检索条件：未设置",
        "default displayed scope",
      );
      check(
        await scope.getByRole("status", { name: "条件变化提示" }).count(),
        0,
        "default scope matches",
      );
      check(
        (await scope.innerText()).includes("不等同于屏幕上的固定快照"),
        true,
        "export snapshot boundary explicit",
      );
      await capture("scope-default", scope);
      check(await surface.locator("h1").count(), 1, "one main title");
      check(await page.locator(".role-page-title").count(), 0, "no duplicate shell title");
      check(
        await choose("trace-shared").getAttribute("aria-pressed"),
        "true",
        "first actual chain selected",
      );
      check(await active().count(), 1, "one visible event workspace");
      check(
        await surface.locator(".platform-log-chain").count(),
        2,
        "both original chain instances mounted",
      );
      check(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        true,
        "page no horizontal overflow",
      );
      await page.evaluate(() => scrollTo(0, 0));
      await capture("default");
      if (width === 390) await capture("default-viewport", null, true);
      await capture("directory", surface.locator(".p62-directory"));
      if (width === 1440) {
        const rows = active().locator("tbody tr");
        check(
          (await rows.first().innerText()).includes("collection.task.read"),
          true,
          "chronological first API",
        );
        check(
          (await rows.last().innerText()).includes("crawler.run.failed"),
          true,
          "chronological last crawler",
        );
        check(await active().locator("th").count(), 7, "seven original columns");
        const menu = active().getByText("列设置", { exact: true });
        await click(menu);
        const col = active().getByRole("checkbox", { name: "切换第 2 列", exact: true });
        await col.uncheck();
        await capture("columns", active().locator(".table-view-controls__toolbar"));
        await click(choose("trace-worker"));
        await click(active().getByText("列设置", { exact: true }));
        check(
          await active().getByRole("checkbox", { name: "切换第 2 列", exact: true }).isChecked(),
          true,
          "second chain columns independent",
        );
        await click(choose("trace-shared"));
        check(
          await active().getByRole("checkbox", { name: "切换第 2 列", exact: true }).isChecked(),
          false,
          "first chain setting retained",
        );
        await active().getByRole("checkbox", { name: "切换第 2 列", exact: true }).check();
      }
      const expectedTask = (id) =>
          `/platform-admin/collection?task=${id}&from=%2Fplatform-admin%2Flogs`,
        expectedProvider = (id) =>
          `/platform-admin/providers/sources?provider_id=${id}&from=%2Fplatform-admin%2Flogs`;
      for (const chain of ["trace-shared", "trace-worker"]) {
        await click(choose(chain));
        check(await active().count(), 1, "selected chain visible only once");
        await capture(chain === "trace-worker" ? "worker-chain" : "shared-chain", active());
        if (width === 390) {
          const triggers = active().locator(".responsive-data-view__mobile article > button"),
            count = await triggers.count();
          check(count, chain === "trace-shared" ? 2 : 1, "original mobile event count");
          for (let i = 0; i < count; i++) {
            const trigger = triggers.nth(i);
            await click(trigger);
            const dialog = page.locator('.responsive-data-view__drawer[role="dialog"]');
            await dialog.waitFor();
            const record =
              chain === "trace-worker"
                ? fixture.items[2]
                : i === 0
                  ? fixture.items[1]
                  : fixture.items[0];
            check(
              (await dialog.innerText()).includes(
                record.source === "crawler" ? "爬虫" : record.source === "api" ? "API" : "Worker",
              ),
              true,
              "original runtime identity",
            );
            check(
              await dialog.getByRole("link", { name: "查看关联任务" }).count(),
              record.task_id ? 1 : 0,
              "no invented task link",
            );
            check(
              await dialog.getByRole("link", { name: "查看关联来源" }).count(),
              record.provider_id ? 1 : 0,
              "no invented provider link",
            );
            if (record.task_id)
              check(
                await dialog.getByRole("link", { name: "查看关联任务" }).getAttribute("href"),
                expectedTask(record.task_id),
                "exact task target",
              );
            if (record.provider_id)
              check(
                await dialog.getByRole("link", { name: "查看关联来源" }).getAttribute("href"),
                expectedProvider(record.provider_id),
                "exact provider target",
              );
            await click(dialog.getByText("技术详情", { exact: true }));
            check(
              (await dialog.innerText()).includes(record.request_id),
              true,
              "full original request ID",
            );
            await capture("detail-" + record.source, dialog);
            await page.keyboard.press("Escape");
            await dialog.waitFor({ state: "detached" });
            check(
              await trigger.evaluate((el) => el === document.activeElement),
              true,
              "detail returns focus",
            );
          }
        } else {
          const records =
              chain === "trace-worker" ? [fixture.items[2]] : [fixture.items[1], fixture.items[0]],
            record = records.at(-1);
          check(
            await active().getByRole("link", { name: "查看关联任务" }).getAttribute("href"),
            expectedTask(record.task_id),
            "desktop original task",
          );
          check(
            await active().getByRole("link", { name: "查看关联来源" }).count(),
            record.provider_id ? 1 : 0,
            "desktop original provider availability",
          );
        }
      }
      await choose("trace-shared").focus();
      await page.keyboard.press("Enter");
      check(
        await choose("trace-shared").getAttribute("aria-pressed"),
        "true",
        "keyboard selects original chain",
      );
      check(requests.length, 1, "chain/column/detail actions make no GET");
      await click(active().getByText("完整 trace_id", { exact: true }));
      check(
        (await active().locator(".platform-log-chain__sources details").innerText()).includes(
          "trace-shared",
        ),
        true,
        "full trace expands",
      );
      await capture("trace", active().locator(".platform-log-chain > header"));
      const filter = page.getByRole(width === 390 ? "dialog" : "group", {
        name: "筛选链路日志",
        exact: true,
      });
      if (width === 390)
        await click(surface.getByRole("button", { name: "筛选链路日志", exact: true }));
      const query = filter.getByPlaceholder("请求编号、链路编号、任务、事件或错误码"),
        source = filter.getByLabel("运行面");
      await query.fill("trace-shared");
      await source.selectOption("crawler");
      check(requests.length, 1, "draft does not query");
      check(
        (await applied.innerText()).includes("检索条件：未设置"),
        true,
        "draft cannot change applied scope",
      );
      check(
        (await displayed.innerText()).includes("全部运行面"),
        true,
        "draft cannot relabel displayed logs",
      );
      check(await query.getAttribute("maxlength"), "120", "query original maximum");
      await capture("filter", filter);
      await click(filter.getByRole("button", { name: "检索", exact: true }));
      await surface.getByText("调用链 1 条", { exact: true }).waitFor();
      check(requests.length, 2, "one applied GET");
      check(new URL(page.url()).searchParams.get("source"), "crawler", "URL source retained");
      check(
        new URLSearchParams(requests.at(-1).search).get("status"),
        "crawler",
        "GET source maps to status",
      );
      check(
        await active()
          .locator(width === 390 ? ".responsive-data-view__mobile article" : "tbody tr")
          .count(),
        1,
        "filtered sample one crawler",
      );
      check(
        await applied.innerText(),
        "已应用条件\n运行面：爬虫\n检索条件：trace-shared",
        "filtered applied scope",
      );
      check(
        await displayed.innerText(),
        "已显示日志对应条件\n运行面：爬虫\n检索条件：trace-shared",
        "filtered success scope",
      );
      await capture("scope-filtered", scope);
      const exportButton = surface.getByRole("button", { name: "导出当前筛选", exact: true });
      await click(exportButton);
      const reason = page.getByRole("dialog", { name: "填写日志导出原因", exact: true });
      await reason.waitFor();
      check(
        await reason.locator("textarea").evaluate((el) => el === document.activeElement),
        true,
        "original reason initial focus",
      );
      await capture("export-reason", reason);
      await click(reason.getByRole("button", { name: "取消", exact: true }));
      await reason.waitFor({ state: "hidden" });
      check(
        await exportButton.evaluate((el) => el === document.activeElement),
        true,
        "reason cancel restores trigger",
      );
      check(requests.length, 2, "cancel does not export or reread");
      empty = true;
      await click(surface.getByRole("button", { name: "刷新日志", exact: true }));
      await surface.getByText("没有匹配事件", { exact: true }).waitFor();
      check(await workspace.count(), 0, "empty removes chain workspace");
      await capture("empty", surface.locator(".platform-log-state"));
      check(requests.length, 3, "three management GETs total");
      failure = true;
      if (width === 390)
        await click(surface.getByRole("button", { name: "筛选链路日志 2 项已选", exact: true }));
      await query.fill("trace-worker");
      await source.selectOption("worker");
      check(
        (await applied.innerText()).includes("trace-shared"),
        true,
        "second draft leaves applied scope unchanged",
      );
      await click(filter.getByRole("button", { name: "检索", exact: true }));
      await scope.getByRole("status", { name: "条件变化提示", exact: true }).waitFor();
      await surface.getByRole("button", { name: "刷新日志", exact: true }).waitFor();
      check(
        await applied.innerText(),
        "已应用条件\n运行面：Worker\n检索条件：trace-worker",
        "failed request shows newly applied scope",
      );
      check(
        await displayed.innerText(),
        "已显示日志对应条件\n运行面：爬虫\n检索条件：trace-shared",
        "failed request preserves empty snapshot scope",
      );
      check(requests.length, 4, "one failed new-scope GET");
      await capture("scope-failed-filter", scope);
      failure = false;
      await click(surface.getByRole("button", { name: "刷新日志", exact: true }));
      await scope
        .getByRole("status", { name: "条件变化提示", exact: true })
        .waitFor({ state: "detached" });
      check(
        await displayed.innerText(),
        "已显示日志对应条件\n运行面：Worker\n检索条件：trace-worker",
        "empty recovery updates successful scope",
      );
      await capture("scope-recovered-empty", scope);
      if (width === 390)
        await click(surface.getByRole("button", { name: "筛选链路日志 2 项已选", exact: true }));
      await query.fill("长".repeat(150));
      check((await query.inputValue()).length, 120, "original query input maximum unchanged");
      await click(filter.getByRole("button", { name: "检索", exact: true }));
      await page.waitForFunction(
        (value) =>
          document.querySelector('[data-log-scope="displayed"]')?.textContent?.includes(value),
        "长".repeat(120),
      );
      check(
        (await applied.innerText()).includes("长".repeat(120)),
        true,
        "applied long query not truncated in scope display",
      );
      check(
        (await displayed.innerText()).includes("长".repeat(120)),
        true,
        "displayed long query complete",
      );
      check(
        await scope.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        true,
        "long scope has no horizontal overflow",
      );
      check(requests.length, 6, "six explicit management GETs");
      await capture("scope-long-query", scope);
      check(unexpected, [], "no writes or external requests");
      check(errors, [], "no browser errors");
      results.push({ width, checks, requests });
      console.log(`P62 ${width}: ${checks} checks`);
    } finally {
      await context.close();
    }
  }
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
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          page: "P62",
          revision: args[1],
          capturedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          scope:
            "actual Vue C review only;original synthetic three-event fixture;no exports or real operations",
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
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P62实际Vue审核</title><style>body{font:16px/1.7 Microsoft YaHei;margin:24px;color:#17253c}img{max-width:100%;display:block;border:1px solid #c7d3e4}article{margin:28px 0}</style><h1>P62实际Vue区域待审</h1><p>本地三事件样例；未真实导出、未部署，不代表完整链或生产验收。</p>' +
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
