import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

// Observe the actual C composition and preserve-cache route. No production transforms or lifecycle stubs.
assert.ok(process.argv.slice(2).every((arg) => ["--capture", "--e2e"].includes(arg)));
const capture = process.argv.includes("--capture");
const output = "output/playwright/p47-c-integration";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fixture = "tests/e2e/m03-03-provider-adapter.spec.ts";
const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true);
const declarations = [];
function visit(node) {
  if (ts.isVariableDeclaration(node)) declarations.push(node);
  ts.forEachChild(node, visit);
}
visit(ast);
const sandbox = {};
vm.runInNewContext(
  ts.transpileModule(
    ["navigation", "base", "items"]
      .map((name) => {
        const matches = declarations.filter((node) => node.name.getText(ast) === name);
        assert.equal(matches.length, 1);
        return `const ${name}=${matches[0].initializer.getText(ast)};`;
      })
      .join("\n") + "globalThis.fixture={navigation,items};",
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  sandbox,
);
const data = JSON.parse(JSON.stringify(sandbox.fixture));
const sources = new Set([
  fixture,
  "scripts/verify-ui-phase2-provider-adapters-c-integration.mjs",
  "config/route-catalog.json",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
]);
const runs = [],
  screenshots = [];
let browser,
  server,
  e2eResult = null;
const reserve = reservePort();
await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
const port = reserve.address().port;
await new Promise((resolve) => reserve.close(resolve));
const origin = `http://127.0.0.1:${port}`;
try {
  server = await createServer({
    configFile: path.resolve("apps/web/vite.config.ts"),
    logLevel: "error",
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
    server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
  });
  await server.listen();
  console.log(`P47 C integration verification ${origin}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 1440]) {
    for (const action of ["read", "probe", "initial"]) {
      for (const outcome of ["success", "failure"]) {
        for (const timing of ["away", "returned"]) {
          const scenario = `${action}-${outcome}-${timing}`;
          const context = await browser.newContext({
            viewport: { width, height: 1000 },
            locale: "zh-CN",
            timezoneId: "Asia/Shanghai",
            reducedMotion: "reduce",
          });
          try {
            const page = await context.newPage();
            const requests = [],
              unexpected = [],
              errors = [],
              checks = [];
            let hold = false,
              release,
              completed = false;
            const updated = { ...data.items[0], adapter_version: "rss-lifecycle-v3", version: 3 };
            const check = (name, actual, expected = true) => {
              assert.deepEqual(actual, expected, `${width}:${scenario}:${name}`);
              checks.push({ name, actual });
            };
            await page.clock.install({ time: new Date("2026-09-11T05:00:00Z") });
            page.on("pageerror", (error) => errors.push(error.message));
            await page.route("**/*", async (route) => {
              const req = route.request(),
                url = new URL(req.url());
              const key = `${req.method()} ${url.pathname}`;
              if (url.origin !== origin) {
                unexpected.push("external");
                return route.abort();
              }
              if (!url.pathname.startsWith("/api/")) return route.continue();
              const isProbe =
                key === `POST /api/v1/platform/provider-adapters/${data.items[0].id}/health-check`;
              const isRead = key === "GET /api/v1/platform/provider-adapters";
              if (
                !isProbe &&
                !isRead &&
                ![
                  "GET /api/v1/me/navigation",
                  "GET /api/v1/auth/session-status",
                  "GET /api/v1/platform/providers",
                ].includes(key)
              ) {
                unexpected.push(key);
                return route.abort();
              }
              requests.push({ key, body: req.postData() });
              if (url.pathname.endsWith("navigation"))
                return route.fulfill({ json: { data: data.navigation, request_id: "navigation" } });
              if (url.pathname.endsWith("session-status"))
                return route.fulfill({ json: { data: { authenticated: true } } });
              if (url.pathname.endsWith("/providers"))
                return route.fulfill({ json: { data: [], request_id: "provider-list" } });
              const deferred = hold && (action === "probe" ? isProbe : isRead);
              if (!deferred)
                return route.fulfill({ json: { data: data.items, request_id: "initial" } });
              await new Promise((resolve) => {
                release = resolve;
              });
              await route.fulfill(
                outcome === "success"
                  ? {
                      json: {
                        data: isProbe ? updated : [updated, data.items[1]],
                        request_id: "lifecycle-result",
                      },
                    }
                  : {
                      status: 409,
                      json: {
                        error: {
                          code: "conflict",
                          message: "隔离测试拒绝",
                          action_hint: "本次请求未完成，请核对后再试。",
                        },
                        request_id: "lifecycle-result",
                      },
                    },
              );
              completed = true;
            });
            const center = page.locator(".adapter-center");
            const registry = page.locator(".provider-registry");
            const drawer = page.locator(".responsive-data-view__drawer");
            const registryStyle = () =>
              registry.evaluate((el) => {
                const style = getComputedStyle(el.querySelector("h2"));
                return [
                  getComputedStyle(document.body).backgroundColor,
                  style.color,
                  style.fontFamily,
                ];
              });
            const returnFocus =
              action === "initial"
                ? center.getByRole("link", { name: "返回来源定义", exact: true })
                : center.getByRole("searchbox", { name: "搜索来源" });
            const tabs = page.getByRole("navigation", { name: "来源管理视图", exact: true });
            const goAdapters = async () => {
              await tabs.getByRole("link", { name: "采集程序（高级）", exact: true }).click();
              await expect(center).toBeVisible();
              await expect(registry).toHaveCount(0);
            };
            const open = async () => {
              if (width > 760) return;
              await center
                .locator(".responsive-data-view__mobile")
                .getByRole("button")
                .filter({ hasText: data.items[0].name })
                .click();
              await expect(drawer).toBeVisible();
            };
            const shot = async (state) => {
              if (!capture) return;
              await page.evaluate(() => document.fonts.ready);
              const bytes = await page.screenshot({
                animations: "disabled",
                fullPage: state === "default" || state === "filters",
              });
              const file = `${width}-${scenario}-${state}.png`;
              await writeFile(`${output}/${file}`, bytes);
              screenshots.push({
                width,
                scenario,
                state,
                file,
                sha256: hash(bytes),
                pixelWidth: bytes.readUInt32BE(16),
                pixelHeight: bytes.readUInt32BE(20),
              });
            };
            await page.goto(`${origin}/platform-admin/providers`);
            await expect(registry.getByRole("heading", { name: "来源注册中心" })).toBeVisible();
            const previousStyle = await registryStyle();
            if (action === "initial") hold = true;
            await goAdapters();
            if (action !== "initial") {
              await expect(center.locator(".adapter-toolbar > span")).toHaveText("2 个结果");
              await expect(center).toHaveClass(/adapter-center--c/);
              if (scenario === "read-success-away") {
                await shot("default");
                await center.getByText("更多筛选与排序", { exact: true }).click();
                await shot("filters");
                await center
                  .getByRole("combobox", { name: "接入模式", exact: true })
                  .selectOption("manual");
                await expect(
                  center.getByRole("heading", { name: "没有符合筛选条件的适配器" }),
                ).toBeVisible();
                await center.getByRole("button", { name: "清除筛选", exact: true }).click();
                await expect(
                  center.getByRole("combobox", { name: "接入模式", exact: true }),
                ).toHaveValue("all");
                await center.getByText("更多筛选与排序", { exact: true }).click();
              }
              await center.getByRole("searchbox", { name: "搜索来源" }).fill("公开");
              await expect(center.locator(".adapter-toolbar > span")).toHaveText("1 个结果");
              hold = true;
              if (action === "read") {
                await center.getByRole("button", { name: "刷新状态", exact: true }).click();
                await open();
              } else {
                await open();
                await (width <= 760 ? drawer : center)
                  .getByRole("button", {
                    name: width <= 760 ? "执行健康检查" : "健康检查",
                    exact: true,
                  })
                  .click();
              }
              await expect.poll(() => Boolean(release)).toBe(true);
            }
            await expect.poll(() => Boolean(release)).toBe(true);
            // Real browser Back traverses the SPA entry created by the actual RouterLink.
            await page.goBack();
            await expect(registry).toBeVisible();
            await expect(center).toHaveCount(0);
            await expect(drawer).toHaveCount(0);
            check("C styles stop matching on P46", await registryStyle(), previousStyle);
            await registry.getByRole("button", { name: "＋ 新建来源", exact: true }).click();
            const editor = registry.getByRole("dialog", { name: "登记来源", exact: true });
            const search = editor.getByRole("textbox", { name: "名称", exact: true });
            await search.fill("新页面输入");
            await expect(search).toBeFocused();
            check(
              "background released after browser Back",
              await search.evaluate((el) => !el.closest("[inert]")),
            );
            const adapterReads = () =>
              requests.filter((req) => req.key === "GET /api/v1/platform/provider-adapters").length;
            const before = adapterReads();
            if (timing === "returned") {
              await editor.getByRole("button", { name: "关闭来源设置编辑", exact: true }).click();
              await goAdapters();
              if (action !== "initial")
                await expect(center.getByRole("searchbox", { name: "搜索来源" })).toHaveValue(
                  "公开",
                );
              await expect(drawer).toHaveCount(0);
              if (action === "probe" && width <= 760) await open();
              const pending = (action === "probe" && width <= 760 ? drawer : center).getByRole(
                "button",
                {
                  name: action === "probe" ? "检查中…" : "刷新中…",
                  exact: true,
                },
              );
              await expect(pending).toBeDisabled();
              check("pending lock retained after return", true);
              if (action === "probe" && width <= 760) {
                await expect(drawer.locator(".adapter-detail-feedback p")).toHaveText(
                  "正在检查此来源，请稍候。",
                );
                await page.keyboard.press("Escape");
                await expect(drawer).toHaveCount(0);
              }
              await returnFocus.focus();
            }
            release();
            await expect.poll(() => completed).toBe(true);
            await page.clock.runFor(50);
            if (timing === "away") {
              await expect(search).toBeFocused();
              await expect(search).toHaveValue("新页面输入");
              await expect(center).toHaveCount(0);
              await expect(drawer).toHaveCount(0);
              check("late response leaves new page and focus untouched", true);
              await editor.getByRole("button", { name: "关闭来源设置编辑", exact: true }).click();
              await goAdapters();
            } else {
              await expect(returnFocus).toBeFocused();
              check("completion does not steal return-page focus", true);
            }
            if (action === "initial") {
              check("initial read retained across cached return", adapterReads(), 1);
              await expect(
                center.getByRole("button", { name: "刷新状态", exact: true }),
              ).toBeEnabled();
              if (outcome === "failure") {
                await expect(center.locator(".ui-state-panel")).toBeVisible();
                if (width === 390) await shot("initial-error");
                hold = false;
                await center.getByRole("button", { name: "重新读取状态", exact: true }).click();
              }
              await expect(center.locator(".adapter-toolbar > span")).toHaveText("2 个结果");
              await expect(center.getByRole("searchbox", { name: "搜索来源" })).toHaveValue("");
              await expect(center.locator(".adapter-message")).toHaveCount(0);
              check(
                "initial read or explicit recovery count",
                adapterReads(),
                outcome === "failure" ? 2 : 1,
              );
              check(
                "initial read never probes",
                requests.filter((req) => req.key.startsWith("POST ")).length,
                0,
              );
              check("no unexpected network", unexpected, []);
              check("no browser errors", errors, []);
              check(
                "no request bodies",
                requests.every((req) => req.body === null),
              );
              runs.push({ width, action, outcome, timing, scenario, checks, requests });
              console.log(`P47 C integration passed ${width} ${scenario}`);
              continue;
            }
            await expect(center.getByRole("searchbox", { name: "搜索来源" })).toHaveValue("公开");
            await expect(drawer).toHaveCount(0);
            const result =
              outcome === "failure"
                ? "本次请求未完成，请核对后再试。"
                : action === "probe"
                  ? `${data.items[0].name} 健康检查通过`
                  : "已刷新 2 个来源适配器状态";
            await expect(center.locator(".adapter-message > span")).toHaveText(result);
            await expect(
              center.getByRole("button", { name: "刷新状态", exact: true }),
            ).toBeEnabled();
            await expect(center.locator("tbody tr")).toContainText(
              outcome === "success" ? "rss-lifecycle-v3" : "rss-v1",
            );
            check("cached return does not request another list", adapterReads(), before);
            check("exact adapter GET count", adapterReads(), action === "read" ? 2 : 1);
            check(
              "no probe replay",
              requests.filter((req) => req.key.startsWith("POST ")).length,
              action === "probe" ? 1 : 0,
            );
            check(
              "cached result remains source-owned",
              await center.locator(".adapter-message > span").textContent(),
              result,
            );
            check("drawer stays closed on return", await drawer.count(), 0);
            // Keep a compact review pack: screenshot only the 390px completed states.
            if (width === 390) await shot("returned");
            await open();
            if (width <= 760 && action === "probe") {
              check(
                "C detail header palette",
                await drawer
                  .locator("header")
                  .evaluate((el) => getComputedStyle(el).backgroundColor),
                "rgb(41, 76, 175)",
              );
              await expect(drawer.locator(".adapter-detail-feedback p")).toHaveText(result);
              await drawer.getByText("本次检查追踪", { exact: true }).click();
              await expect(drawer.locator(".adapter-detail-feedback code")).toHaveText(
                "lifecycle-result",
              );
              await drawer.locator(".adapter-detail-feedback code").scrollIntoViewIfNeeded();
              await expect(drawer.locator(".adapter-detail-feedback code")).toBeInViewport();
              if (width === 390) await shot("reopened-feedback");
              check("reopened same-source feedback and trace", true);
              const last = drawer.getByText("技术详情", { exact: true });
              const first = drawer.getByRole("button", { name: "关闭详情", exact: true });
              await last.focus();
              await page.keyboard.press("Tab");
              await expect(first).toBeFocused();
              await page.keyboard.press("Shift+Tab");
              await expect(last).toBeFocused();
              check("C detail focus cycles both directions", true);
            }
            if (width <= 760) {
              await page.keyboard.press("Escape");
              await expect(drawer).toHaveCount(0);
              await expect(
                center.locator(".responsive-data-view__mobile").getByRole("button"),
              ).toBeFocused();
              check("explicit close restores source trigger", true);
            }
            check(
              "no request bodies",
              requests.every((req) => req.body === null),
            );
            check("no unexpected network", unexpected, []);
            check("no browser errors", errors, []);
            runs.push({ width, action, outcome, timing, scenario, checks, requests });
            console.log(`P47 C integration passed ${width} ${scenario}`);
          } finally {
            await context.close();
          }
        }
      }
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
  if (process.argv.includes("--e2e")) {
    sources.add("tests/e2e/provider-adapters-c.config.ts");
    e2eResult = await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          "node_modules/playwright/cli.js",
          "test",
          "--config",
          "tests/e2e/provider-adapters-c.config.ts",
        ],
        {
          env: { ...process.env, PLAYWRIGHT_WEB_PORT: String(port) },
          windowsHide: true,
        },
      );
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk;
        process.stdout.write(chunk);
      });
      child.stderr.on("data", (chunk) => {
        output += chunk;
        process.stderr.write(chunk);
      });
      child.once("error", reject);
      child.once("close", (exitCode) => resolve({ exitCode, output }));
    });
    assert.equal(e2eResult.exitCode, 0, "Original M03-03 UI cases must pass");
  }
  await browser.close();
  browser = null;
  await server.close();
  server = null;
  if (capture) {
    await writeFile(
      `${output}/evidence.json`,
      JSON.stringify(
        {
          kind: "P47-C-INTEGRATION-r1",
          e2eResult,
          runs,
          screenshots,
          sourceHashes: Object.fromEntries(
            await Promise.all(
              [...sources].sort().map(async (file) => [file, hash(await read(file))]),
            ),
          ),
          port,
          processesClosed: true,
          productionUntransformed: true,
          fixtureBoundary:
            "Original two M03-03 rows; explicit synthetic same-source version v3 and409 rejection. All API locally fulfilled; no real probe or database writes.",
          scope:
            "Actual C production page, P46/P47 style isolation, initial pending read and explicit error recovery, cached return before/after read/probe success/failure, drawer focus cycle, original preserve policy without replay/focus theft. Original 16 M03-03 cases run with --e2e. Not unmount/cache eviction, unknown-write policy, screen-reader or full production acceptance.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P47 C 整合与交互核对</title><style>body{font:16px/1.7 sans-serif;margin:24px}img{max-width:100%}article{margin:32px 0}</style><h1>P47 C 整合与交互核对</h1><p>当前生产源码已整合C页面与详情，不经模板替换或样式注入。图中数据为本地隔离样例，不代表线上部署。</p>' +
        screenshots
          .map(
            (s) =>
              `<article><h2>${s.scenario} · ${s.state}</h2><img loading="lazy" alt="${s.scenario} ${s.state}" src="${s.file}"></article>`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((n, run) => n + run.checks.length, 0),
      screenshots: screenshots.length,
      sources: sources.size,
    }),
  );
} finally {
  await browser?.close();
  await server?.close();
}
