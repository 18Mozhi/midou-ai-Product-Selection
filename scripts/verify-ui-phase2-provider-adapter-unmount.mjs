import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

// Read-only lifecycle observation of real App/router/KeepAlive, no component transformations.
assert.ok(process.argv.slice(2).every((arg) => ["--capture", "--smoke"].includes(arg)));
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(!(capture && smoke), "Smoke cannot publish a full evidence pack");
const output = "output/playwright/p47-unmount-review";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fixture = "tests/e2e/m03-03-provider-adapter.spec.ts";
const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true),
  declarations = [];
function visit(node) {
  if (ts.isVariableDeclaration(node)) declarations.push(node);
  ts.forEachChild(node, visit);
}
visit(ast);
const box = {};
vm.runInNewContext(
  ts.transpileModule(
    ["navigation", "base", "items"]
      .map((name) => {
        const matches = declarations.filter((node) => node.name.getText(ast) === name);
        assert.equal(matches.length, 1);
        return `const ${name}=${matches[0].initializer.getText(ast)};`;
      })
      .join("\n") + "globalThis.data={navigation,items};",
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  box,
);
const data = JSON.parse(JSON.stringify(box.data));
const routes = JSON.parse(await read("config/route-catalog.json")).routes;
const target = "/platform-admin/providers/adapters";
const evictionPaths = [
  "/platform-admin/providers",
  "/platform-admin/providers/sources",
  "/platform-admin/providers/sources/1688-acceptance",
  "/platform-admin/credentials",
  "/platform-admin/collection",
  "/platform-admin/collection/overview",
  "/platform-admin/collection/browser-runtime",
  "/platform-admin/data",
  "/platform-admin/governance",
  "/platform-admin/content",
  "/platform-admin/notifications",
  "/platform-admin/logs",
];
const evictionNames = evictionPaths.map((path) => {
  const route = routes.find((route) => route.path === path);
  assert.equal(route.cachePolicy, "preserve");
  assert.ok(route.capabilities.some((c) => data.navigation.platform_capabilities.includes(c)));
  assert.notEqual(route.surface, "platform-account-center");
  return route.name;
});
assert.equal(new Set(evictionNames).size, 12);
assert.match(await read("apps/web/src/components/NavigationShell.vue"), /<KeepAlive :max="12">/);
const sources = new Set([
  fixture,
  "config/route-catalog.json",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
  "scripts/verify-ui-phase2-provider-adapter-unmount.mjs",
]);
const runs = [],
  screenshots = [];
let browser, server;
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
  console.log(`P47 unmount verification ${origin}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of smoke ? [390] : [390, 1440])
    for (const exit of smoke ? ["cache-eviction"] : ["shell-unmount", "cache-eviction"])
      for (const action of smoke ? ["initial"] : ["initial", "read", "probe"])
        for (const outcome of ["success", "failure"]) {
          const scenario = `${exit}-${action}-${outcome}`;
          const context = await browser.newContext({
            viewport: { width, height: 1000 },
            locale: "zh-CN",
            timezoneId: "Asia/Shanghai",
            reducedMotion: "reduce",
          });
          try {
            const page = await context.newPage(),
              requests = [],
              blockedReads = [],
              unexpected = [],
              errors = [],
              checks = [],
              cacheObservations = [];
            let hold = action === "initial",
              release,
              completed = false,
              held = false;
            const check = (name, actual, expected = true) => {
              assert.deepEqual(actual, expected, `${width}/${scenario}:${name}`);
              checks.push({ name, actual });
            };
            await page.clock.install({ time: new Date("2026-09-11T08:00:00Z") });
            await page.clock.pauseAt(new Date("2026-09-11T08:00:01Z"));
            page.on("pageerror", (error) => errors.push(error.message));
            await page.route("**/*", async (route) => {
              const req = route.request(),
                url = new URL(req.url()),
                key = `${req.method()} ${url.pathname}`;
              if (url.origin !== origin) {
                unexpected.push("external");
                return route.abort();
              }
              if (!url.pathname.startsWith("/api/")) return route.continue();
              if (key === "GET /api/v1/me/navigation")
                return route.fulfill({ json: { data: data.navigation, request_id: "nav" } });
              if (key === "GET /api/v1/auth/session-status")
                return route.fulfill({ json: { data: { authenticated: true } } });
              const isRead = key === "GET /api/v1/platform/provider-adapters",
                isProbe =
                  key ===
                  `POST /api/v1/platform/provider-adapters/${data.items[0].id}/health-check`;
              if (!isRead && !isProbe) {
                if (req.method() === "GET") {
                  blockedReads.push(key);
                  return route.abort("blockedbyclient");
                }
                unexpected.push(key);
                return route.abort();
              }
              requests.push({
                key,
                body: req.postData(),
                idempotencyKey: req.headers()["idempotency-key"] ?? null,
              });
              if (hold && !held && (action === "probe" ? isProbe : isRead)) {
                held = true;
                await new Promise((resolve) => {
                  release = resolve;
                });
                const updated = {
                  ...data.items[0],
                  adapter_version: "old-unmounted-v9",
                  version: 9,
                };
                await route.fulfill(
                  outcome === "success"
                    ? {
                        json: {
                          data: isProbe ? updated : [updated, data.items[1]],
                          request_id: "old-unmounted-result",
                        },
                      }
                    : {
                        status: 409,
                        json: {
                          error: {
                            code: "conflict",
                            message: "旧实例本地拒绝",
                            action_hint: "旧实例检查未完成",
                          },
                          request_id: "old-unmounted-result",
                        },
                      },
                );
                completed = true;
                return;
              }
              return route.fulfill({
                json: { data: data.items, request_id: "fresh-mounted-result" },
              });
            });
            const navigate = async (path) =>
              page.evaluate(async (path) => {
                const { router } = await import("/src/router.ts");
                await router.push(path);
              }, path);
            const center = page.locator(".adapter-center"),
              drawer = page.locator(".responsive-data-view__drawer");
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
              if (!capture || width !== 390 || action !== "probe") return;
              await page.evaluate(() => document.fonts.ready);
              const bytes = await page.screenshot({ animations: "disabled" }),
                file = `${width}-${scenario}-${state}.png`;
              await writeFile(`${output}/${file}`, bytes);
              screenshots.push({
                file,
                width,
                scenario,
                state,
                sha256: hash(bytes),
                pixelWidth: bytes.readUInt32BE(16),
                pixelHeight: bytes.readUInt32BE(20),
              });
            };
            await page.goto(origin + target);
            await expect(center).toBeVisible();
            await center.evaluate((el) => {
              let old = el.__vueParentComponent;
              while (old && !String(old.type.__file ?? "").endsWith("ProviderAdapterCenter.vue"))
                old = old.parent;
              if (!old) throw new Error("Actual adapter instance not found");
              let cache = old.parent;
              while (cache && !cache.type.__isKeepAlive) cache = cache.parent;
              if (!cache) throw new Error("Actual KeepAlive not found");
              window.__p47UnmountObservation = { old, cache };
            });
            if (action !== "initial") {
              await expect(center.locator(".adapter-toolbar > span")).toHaveText("2 个结果");
              await center.getByRole("searchbox", { name: "搜索来源" }).fill("公开");
              hold = true;
              if (action === "read")
                await center.getByRole("button", { name: "刷新状态", exact: true }).click();
              await open();
              if (action === "probe")
                await (width <= 760 ? drawer : center)
                  .getByRole("button", {
                    name: width <= 760 ? "执行健康检查" : "健康检查",
                    exact: true,
                  })
                  .click();
            }
            await expect.poll(() => Boolean(release)).toBe(true);
            const oldState = () =>
              page.evaluate(() => {
                const { old, cache } = window.__p47UnmountObservation;
                return {
                  unmounted: old.isUnmounted,
                  cacheUnmounted: cache.isUnmounted,
                  cacheKeys: [...(cache.__v_cache?.keys() ?? [])],
                };
              });
            check("original instance starts mounted", (await oldState()).unmounted, false);
            if (exit === "shell-unmount") {
              await navigate("/onboarding");
              await expect(page.getByTestId("onboarding")).toBeVisible();
            } else {
              for (let i = 0; i < evictionPaths.length; i++) {
                const requestsBeforeNavigation = blockedReads.length;
                await navigate(evictionPaths[i]);
                try {
                  await expect
                    .poll(async () => (await oldState()).cacheKeys.includes(evictionNames[i]), {
                      timeout: 10000,
                      message: `${scenario}: ${evictionPaths[i]} must enter real KeepAlive`,
                    })
                    .toBe(true);
                } catch (error) {
                  console.log(
                    JSON.stringify({
                      failedRoute: evictionPaths[i],
                      url: page.url(),
                      old: await oldState(),
                      visible: (await page.locator("main").innerText()).slice(0, 1200),
                      errors,
                      blockedReads,
                    }),
                  );
                  throw error;
                }
                const state = await oldState();
                // Cached vnode insertion precedes child onMounted URL synchronization.
                // Each selected surface performs an initial read after that synchronization.
                await expect.poll(() => blockedReads.length > requestsBeforeNavigation).toBe(true);
                await page.evaluate(async () => {
                  const { router } = await import("/src/router.ts");
                  await router.replace(router.currentRoute.value.fullPath);
                });
                cacheObservations.push({ path: evictionPaths[i], ...state });
                check(
                  `cache capacity after route ${i + 1}`,
                  state.cacheKeys.length,
                  Math.min(i + 2, 12),
                );
                check(`old instance unmounted after route ${i + 1}`, state.unmounted, i === 11);
              }
            }
            await expect.poll(async () => (await oldState()).unmounted).toBe(true);
            check("actual original instance unmounted", (await oldState()).unmounted);
            await expect(center).toHaveCount(0);
            await expect(drawer).toHaveCount(0);
            check(
              "body background released",
              await page.locator("#app").evaluate((el) => !el.inert),
            );
            check(
              "P47 marker no longer matches",
              await page.evaluate(() => !document.body.matches(":has(#app .adapter-center--c)")),
            );
            await navigate(target);
            await expect(center.locator(".adapter-toolbar > span")).toHaveText("2 个结果");
            check(
              "remount has a distinct actual instance",
              await center.evaluate((el) => {
                let current = el.__vueParentComponent;
                while (
                  current &&
                  !String(current.type.__file ?? "").endsWith("ProviderAdapterCenter.vue")
                )
                  current = current.parent;
                return current !== window.__p47UnmountObservation.old;
              }),
            );
            await expect(center.getByRole("searchbox", { name: "搜索来源" })).toHaveValue("");
            check("remount starts fresh filters", true);
            await expect(drawer).toHaveCount(0);
            await open();
            const newProbe = (width <= 760 ? drawer : center)
              .getByRole("button", {
                name: width <= 760 ? "执行健康检查" : "健康检查",
                exact: true,
              })
              .first();
            check("new instance probe enabled before old completion", await newProbe.isEnabled());
            await newProbe.focus();
            await expect(newProbe).toBeFocused();
            await shot("new-instance-old-pending");
            release();
            await expect.poll(() => completed).toBe(true);
            await page.clock.runFor(50);
            await expect(newProbe).toBeFocused();
            await expect(newProbe).toBeEnabled();
            check("old completion does not steal new focus", true);
            await expect(center.locator(".adapter-message")).toHaveCount(0);
            check(
              "old result not shown in new page",
              !(await center.textContent()).includes("old-unmounted"),
            );
            await expect(center.locator("tbody")).toContainText("rss-v1");
            if (width <= 760) {
              await expect(drawer.locator(".adapter-detail-feedback p")).toBeEmpty();
              check("new drawer has no old result", true);
            }
            await shot("old-completed");
            check(
              "only original local probe, no automatic replay",
              requests.filter((r) => r.key.startsWith("POST")).length,
              action === "probe" ? 1 : 0,
            );
            check(
              "initial plus remount GET count",
              requests.filter((r) => r.key.startsWith("GET")).length,
              action === "read" ? 3 : 2,
            );
            check(
              "no request bodies",
              requests.every((r) => r.body === null),
            );
            check("no unexpected non-read network", unexpected, []);
            check("no runtime errors", errors, []);
            runs.push({
              width,
              exit,
              action,
              outcome,
              scenario,
              checks,
              requests,
              blockedReads,
              cacheObservations,
            });
            console.log(`P47 unmount passed ${width} ${scenario}`);
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
  await browser.close();
  browser = null;
  await server.close();
  server = null;
  if (capture) {
    await writeFile(
      `${output}/evidence.json`,
      JSON.stringify(
        {
          kind: "P47-UNMOUNT-ACTUAL-r1",
          productionUntransformed: true,
          processesClosed: true,
          port,
          runs,
          screenshots,
          sourceHashes: Object.fromEntries(
            await Promise.all(
              [...sources].sort().map(async (file) => [file, hash(await read(file))]),
            ),
          ),
          boundary:
            "Actual exported router.push to registered routes; real KeepAlive max12 observed read-only without mutation. Non-P47 read APIs aborted, not their functional acceptance. Old component refs retained only to inspect isUnmounted, not a GC/leak proof. Local mocked API results, no real writes. New instance can offer probe while old request is unresolved: observation only, not a new unknown-write policy.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P47 卸载与缓存淘汰核对</title><style>body{font:16px/1.7 sans-serif;margin:24px}img{max-width:100%}article{margin:32px 0}</style><h1>P47 卸载与缓存淘汰</h1><p>真实Vue与路由，全部数据本地拦截；图片不是未知写入策略或真实权限验收。</p>' +
        screenshots
          .map(
            (s) =>
              `<article><h2>${s.scenario} / ${s.state}</h2><img loading="lazy" alt="${s.scenario} ${s.state}" src="${s.file}"></article>`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((n, r) => n + r.checks.length, 0),
      screenshots: screenshots.length,
      sources: sources.size,
    }),
  );
} finally {
  await browser?.close();
  await server?.close();
}
