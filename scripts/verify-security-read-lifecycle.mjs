import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";

assert.equal(process.argv.length, 2, "No capture or live-service mode is supported");
const fixtureFile = "tests/e2e/m06-04-security-operations.spec.ts";
const ast = ts.createSourceFile(
  fixtureFile,
  await readFile(fixtureFile, "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const dataNodes = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((node) => [...node.declarationList.declarations])
  .filter((node) => node.name.getText(ast) === "data");
assert.equal(dataNodes.length, 1);
const navigation = [];
function visit(node) {
  if (
    ts.isObjectLiteralExpression(node) &&
    ["shell", "platform_capabilities", "guard_reason"].every((key) =>
      node.properties.some((property) => property.name?.getText(ast) === key),
    )
  )
    navigation.push(node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(navigation.length, 1);
const evaluate = (text) =>
  JSON.parse(JSON.stringify(vm.runInNewContext(`(${text})`, {}, { timeout: 1000 })));
const fixture = evaluate(dataNodes[0].initializer.getText(ast)),
  nav = evaluate(navigation[0]);
const envelope = (data, request_id = "security-local-fixture") => ({
  data,
  request_id,
  trace_id: request_id,
});
function snapshot(view) {
  const data = structuredClone(fixture);
  data.view = view;
  const keys = {
    events: ["security_events"],
    sessions: ["sessions"],
    credentials: ["credential_assets", "organization_tokens"],
    audit: ["audit_events"],
  }[view];
  assert.ok(keys);
  for (const key of Object.keys(data.pagination)) {
    if (!keys.includes(key)) data[key] = [];
    data.pagination[key] = { page: 1, page_size: 20, total: data[key].length, total_pages: 1 };
  }
  return data;
}

// Dynamic loopback port, actual untransformed App/Router, no backend proxy or filesystem output.
const probe = reservePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const reservedPort = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  server: {
    host: "127.0.0.1",
    port: reservedPort,
    strictPort: true,
    proxy: {},
    hmr: false,
    open: false,
  },
});
let browser;
const results = [];
try {
  await server.listen();
  const port = server.httpServer.address().port,
    origin = `http://127.0.0.1:${port}`;
  console.log(`P59 read lifecycle ${origin}`);
  browser = await chromium.launch();
  for (const width of [390, 1440]) {
    for (const scene of ["view-race", "initial-timeout", "retained-timeout"]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        locale: "zh-CN",
        reducedMotion: "reduce",
      });
      const page = await context.newPage(),
        requests = [],
        unexpected = [],
        errors = [],
        deferred = [];
      let mode = scene === "initial-timeout" ? "hold" : "success";
      try {
        await page.clock.install({ time: new Date("2026-09-15T04:00:00Z") });
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/*", async (route) => {
          const request = route.request(),
            url = new URL(request.url());
          if (url.origin !== origin) {
            unexpected.push("external request");
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          const key = `${request.method()} ${url.pathname}`;
          if (key === "GET /api/v1/me/navigation") return route.fulfill({ json: envelope(nav) });
          if (key === "GET /api/v1/auth/session-status")
            return route.fulfill({ json: envelope({ authenticated: true }) });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({
              status: 503,
              json: { error: { code: "local_theme_fixture_unavailable" } },
            });
          if (key !== "GET /api/v1/platform/security/operations") {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, search: url.search, body: request.postData() });
          const view = url.searchParams.get("view");
          assert.equal(url.searchParams.get("page_size"), "20");
          assert.equal(url.searchParams.get("token_page_size"), "20");
          if (mode === "hold" && (scene !== "view-race" || view === "events")) {
            deferred.push(route);
            return;
          }
          if (mode === "forbidden")
            return route.fulfill({
              status: 403,
              json: {
                error: { code: "forbidden", action_hint: "当前权限无法读取此视图。" },
                request_id: "security-local-denied",
              },
            });
          return route.fulfill({ json: envelope(snapshot(view), `security-local-${view}`) });
        });
        await page.goto(origin + "/platform-admin/security");
        const surface = page.locator(".security-ops"),
          grid = surface.locator(".security-grid");
        if (scene !== "initial-timeout") await grid.waitFor();
        if (scene === "view-race") {
          mode = "hold";
          await surface.getByRole("button", { name: "刷新数据", exact: true }).click();
          await page.waitForFunction(
            () => document.querySelector(".security-grid")?.getAttribute("aria-busy") === "true",
          );
          await surface.getByRole("link", { name: "会话", exact: true }).click();
          await page.waitForFunction(
            () =>
              document
                .querySelector('.security-view-nav a[aria-current="page"]')
                ?.textContent.trim() === "会话" &&
              document.querySelector(".security-grid")?.getAttribute("aria-busy") === "false",
          );
          assert.equal(requests.length, 3);
          assert.deepEqual(
            requests.map((request) => new URLSearchParams(request.search).get("view")),
            ["events", "events", "sessions"],
          );
          assert.equal(deferred.length, 1);
          // The superseded browser request is aborted; the unit test separately covers transports ignoring abort.
          await deferred
            .pop()
            .fulfill({ json: envelope(snapshot("events"), "obsolete-events") })
            .catch(() => {});
          assert.ok((await grid.textContent()).includes("security@example.test"));
          assert.equal(
            await surface.getByRole("heading", { name: "登录与风险事件", exact: true }).count(),
            0,
          );
          mode = "forbidden";
          await surface.getByRole("link", { name: "平台审计", exact: true }).click();
          await surface.getByRole("heading", { name: "你没有安全运营权限", exact: true }).waitFor();
          assert.equal(await grid.count(), 0);
          assert.equal(
            await surface.getByText("security@example.test", { exact: true }).count(),
            0,
          );
          assert.ok((await surface.textContent()).includes("security-local-denied"));
          assert.equal((await surface.textContent()).includes("security-local-sessions"), false);
        } else {
          if (scene === "retained-timeout") {
            mode = "hold";
            await surface.getByRole("button", { name: "刷新数据", exact: true }).click();
          }
          await page.waitForFunction(
            () => document.querySelector(".security-hero-actions button")?.disabled === true,
          );
          await page.clock.fastForward(15001);
          const expected =
            scene === "initial-timeout"
              ? "读取超过 15 秒，已停止本次请求，尚未取得安全运营数据。"
              : "读取超过 15 秒，已停止本次请求并保留上次成功数据。";
          await surface.getByText(expected, { exact: true }).waitFor();
          assert.equal(await grid.count(), scene === "initial-timeout" ? 0 : 1);
          mode = "success";
          await surface
            .getByRole("button", {
              name: scene === "initial-timeout" ? "重新读取" : "刷新数据",
              exact: true,
            })
            .click();
          await grid.waitFor();
          await page.waitForFunction(
            () => document.querySelector(".security-grid")?.getAttribute("aria-busy") === "false",
          );
          assert.equal(await surface.getByText(expected, { exact: true }).count(), 0);
          assert.equal(requests.length, scene === "initial-timeout" ? 2 : 3);
        }
        assert.ok(requests.every((request) => request.body === null));
        assert.deepEqual(unexpected, []);
        assert.deepEqual(errors, []);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
        );
        results.push({ width, scene, reads: requests.length, writes: 0, errors: 0 });
        console.log(`P59 passed ${width} ${scene}`);
      } finally {
        for (const route of deferred) await route.abort().catch(() => {});
        await context.close();
      }
    }
  }
  console.log(JSON.stringify({ results, images: 0, port }));
} finally {
  await browser?.close();
  await server.close();
}
