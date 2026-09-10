import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { buildAccountOverviewDesignData } from "./lib/ui-phase2-account-overview-design-data.mjs";
import { buildPlatformOverviewDesignData } from "./lib/ui-phase2-platform-overview-design-data.mjs";

// Full production entry/router/shell, no template transformations or C preview stylesheet.
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((value) => value === "--capture"));
const output = "output/playwright/p42-shell-lifecycle";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const fixture = await buildAccountOverviewDesignData(process.cwd());
const dashboard = await buildPlatformOverviewDesignData(process.cwd());
const record = fixture.overview.organizations[0];
const listPath = "/platform-admin/organizations";
const detailPath = `${listPath}/${record.id}`;
const env = (data) => ({ data, request_id: "p42-shell-fixture", trace_id: "p42-shell-fixture" });
const probe = reservePort();
await new Promise((done) => probe.listen(0, "127.0.0.1", done));
const port = probe.address().port;
await new Promise((done) => probe.close(done));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {}, hmr: false },
});
let browser;
const scenarios = [],
  screenshots = [];
const sourceFiles = new Set([
  "scripts/verify-ui-phase2-organization-shell-lifecycle.mjs",
  "scripts/lib/ui-phase2-account-overview-design-data.mjs",
  "scripts/lib/ui-phase2-organization-action-baseline.mjs",
  "scripts/lib/ui-phase2-platform-overview-design-data.mjs",
  "tests/e2e/m06-01-platform-accounts.spec.ts",
  "tests/e2e/m06-02-platform-dashboard.spec.ts",
  "apps/web/vite.config.ts",
]);
try {
  await server.listen();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`p42_shell_host ${origin}`);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 1440])
    for (const action of ["profile", "status"])
      for (const mode of [
        "success-away",
        "error-away",
        "success-return",
        "error-return",
        "reason",
      ]) {
        const context = await browser.newContext({
          viewport: { width, height: 1000 },
          locale: "zh-CN",
          timezoneId: "Asia/Shanghai",
          reducedMotion: "reduce",
        });
        let release;
        try {
          const page = await context.newPage();
          const requests = [],
            errors = [],
            unexpected = [],
            checks = [];
          const held = new Promise((done) => (release = done));
          const target = `/api/v1/platform/accounts/organizations/${record.id}${action === "status" ? "/status" : ""}`;
          page.on("pageerror", (error) => errors.push(error.message));
          await page.route("**/*", async (route) => {
            const req = route.request(),
              url = new URL(req.url());
            if (url.origin !== origin) {
              unexpected.push(req.url());
              return route.abort();
            }
            if (!url.pathname.startsWith("/api/")) return route.continue();
            requests.push({
              method: req.method(),
              path: url.pathname,
              body: req.postDataJSON(),
              key: Boolean(req.headers()["idempotency-key"]),
            });
            if (req.method() === "GET" && url.pathname === "/api/v1/me/navigation")
              return route.fulfill({
                json: env({
                  shell: "platform_admin",
                  organization_id: null,
                  workspace_id: null,
                  roles: [],
                  capabilities: [],
                  platform_roles: ["platform_super_admin"],
                  platform_capabilities: ["platform:operate", "platform:superadmin"],
                  guard_reason: "navigation_platform_admin_allowed",
                }),
              });
            if (req.method() === "GET" && url.pathname === "/api/v1/platform/dashboard")
              return route.fulfill({
                json: env({
                  ...dashboard.dashboard,
                  task_trend: dashboard.trend,
                  window: url.searchParams.get("window"),
                }),
              });
            if (req.method() === "GET" && url.pathname === "/api/v1/platform/accounts")
              return route.fulfill({ json: env(fixture.overview) });
            if (
              url.pathname === target &&
              req.method() === (action === "status" ? "POST" : "PATCH")
            ) {
              await held;
              if (mode.startsWith("error"))
                return route.fulfill({
                  status: 500,
                  json: {
                    error: {
                      code: "fixture_failure",
                      message: "测试失败",
                      action_hint: "测试：旧操作失败",
                    },
                    request_id: "p42-shell-fixture",
                    trace_id: "p42-shell-fixture",
                  },
                });
              return route.fulfill({ json: env({ ...record, ...req.postDataJSON() }) });
            }
            unexpected.push(`${req.method()} ${url.pathname}`);
            return route.abort();
          });
          const check = (name, actual, expected = true) => {
            assert.deepEqual(actual, expected, `${width}/${action}/${mode}: ${name}`);
            checks.push(name);
          };
          const detail = page.locator(".organization-detail-dialog");
          const title = action === "profile" ? "保存组织资料" : "停用组织";
          const reason = page.getByRole("dialog", { name: title, exact: true });
          const snap = async (state) => {
            if (!capture) return;
            const file = `${width}-${action}-${mode}-${state}.png`;
            const bytes = await page.screenshot({ animations: "disabled" });
            await writeFile(`${output}/${file}`, bytes);
            screenshots.push({
              file,
              width,
              action,
              mode,
              state,
              sha256: hash(bytes),
              url: new URL(page.url()).pathname,
            });
          };
          await page.goto(origin + "/platform-admin");
          await expect(page.locator(".platform-dashboard")).toBeVisible();
          if (width === 390)
            await page.getByRole("button", { name: "打开导航菜单", exact: true }).click();
          await page.getByRole("searchbox", { name: "搜索导航菜单", exact: true }).fill("组织管理");
          await page
            .locator("#role-navigation")
            .getByRole("link", { name: "组织管理", exact: true })
            .click();
          await expect(page).toHaveURL(origin + listPath);
          await expect(page.getByRole("button", { name: "刷新数据", exact: true })).toBeEnabled();
          if (width === 1440)
            await page
              .getByRole("row")
              .filter({ hasText: record.name })
              .getByRole("button", { name: "查看详情", exact: true })
              .click();
          else {
            await page.getByRole("button").filter({ hasText: record.name }).click();
            await page.getByRole("button", { name: "打开组织详情", exact: true }).click();
          }
          await expect(page).toHaveURL(origin + detailPath);
          await expect(detail).toBeVisible();
          const cachedNode = await detail.elementHandle();
          if (action === "profile")
            await detail.getByLabel("组织名称", { exact: true }).fill("已提交的旧资料");
          await detail.getByRole("button", { name: title, exact: true }).click();
          await reason.getByLabel("操作原因", { exact: true }).fill("缓存离页验证");
          if (mode === "reason") await snap("pending-reason");
          else {
            const sent = page.waitForRequest(
              (request) => new URL(request.url()).pathname === target && request.method() !== "GET",
            );
            await reason.getByRole("button", { name: "确认执行", exact: true }).click();
            await sent;
          }
          await page.goBack();
          await expect(page).toHaveURL(origin + listPath);
          await expect(page.getByRole("dialog")).toHaveCount(0);
          await page.goBack();
          await expect(page).toHaveURL(origin + "/platform-admin");
          await expect(page.locator(".platform-dashboard")).toBeVisible();
          await expect(page.getByRole("dialog")).toHaveCount(0);
          check(
            "away no explicit inert background",
            await page.locator("#app").evaluate((node) => node.inert),
            false,
          );
          await snap("away");
          const backToDetail = async () => {
            await page.goForward();
            await expect(page).toHaveURL(origin + listPath);
            await page.goForward();
            await expect(page).toHaveURL(origin + detailPath);
            await expect(detail).toBeVisible();
            await expect(reason).toHaveCount(0);
            check(
              "same cached dialog node",
              await cachedNode.evaluate(
                (node) =>
                  node.isConnected &&
                  node === document.querySelector(".organization-detail-dialog"),
              ),
            );
            await detail.getByLabel("组织名称", { exact: true }).fill("返回后的新草稿");
          };
          if (mode.endsWith("return") || mode === "reason") await backToDetail();
          const readsBeforeRelease = requests.filter(
            (req) => req.path === "/api/v1/platform/accounts",
          ).length;
          if (mode !== "reason") {
            const received = page.waitForResponse(
              (response) => new URL(response.url()).pathname === target,
            );
            release();
            await (await received).finished();
            // Bounded settling window only after a known response; no reliance on networkidle.
            await page.waitForTimeout(200);
          }
          check(
            "late result does not trigger overview read",
            requests.filter((req) => req.path === "/api/v1/platform/accounts").length,
            readsBeforeRelease,
          );
          if (mode.endsWith("away")) {
            await expect(page.getByRole("dialog")).toHaveCount(0);
            await backToDetail();
          }
          await expect(detail.getByLabel("组织名称", { exact: true })).toHaveValue(
            "返回后的新草稿",
          );
          await expect(detail.getByRole("alert")).toHaveCount(0);
          await expect(detail.getByRole("status")).toHaveCount(0);
          checks.push(
            "new draft retained and no stale success/error feedback",
            "route-owned detail reopened only by forward navigation",
          );
          await snap("returned");
          const writes = requests.filter((req) => req.method !== "GET");
          check("exact write count", writes.length, mode === "reason" ? 0 : 1);
          if (writes.length) {
            check("same target and idempotency", writes[0].path === target && writes[0].key);
            check(
              "unchanged payload",
              writes[0].body,
              action === "status"
                ? { status: "archived", reason: "缓存离页验证" }
                : {
                    name: "已提交的旧资料",
                    timezone: "Asia/Shanghai",
                    data_retention_days: 365,
                    reason: "缓存离页验证",
                  },
            );
          }
          await page.keyboard.press("Escape");
          await expect(page).toHaveURL(origin + listPath);
          await expect(page.getByRole("dialog")).toHaveCount(0);
          await page.locator(".role-brand").click();
          await expect(page).toHaveURL(origin + "/platform-admin");
          await expect(page.locator(".platform-dashboard")).toBeVisible();
          checks.push("Escape closes and real background link clickable");
          check("no browser errors", errors, []);
          check("no unexpected network", unexpected, []);
          scenarios.push({ width, action, mode, checks, requests });
          console.log(`passed ${width}/${action}/${mode}`);
        } finally {
          release?.();
          await context.close();
        }
      }
  // Bind all loaded local app modules, including lazy shell children and actual CSS.
  for (const file of server.moduleGraph.fileToModulesMap.keys()) {
    const relative = path.relative(process.cwd(), file).replaceAll("\\", "/");
    if (
      /^(apps\/web\/src\/|packages\/)/.test(relative) &&
      !relative.includes("node_modules") &&
      !relative.includes("?")
    )
      sourceFiles.add(relative);
  }
} finally {
  await browser?.close();
  await server.close();
}
const sourceHashes = Object.fromEntries(
  await Promise.all([...sourceFiles].sort().map(async (file) => [file, hash(await read(file))])),
);
const result = {
  schemaVersion: 1,
  scope:
    "Full current App/NavigationShell/KeepAlive and original production styling; all API calls intercepted. No C design approval, actual RBAC, persistence or deployment acceptance. Return-to-detail via history intentionally opens detail; old callbacks must not own its new draft.",
  sourceHashes,
  scenarios,
  screenshots,
  processesClosed: true,
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(result, null, 2) + "\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P42 完整应用缓存验证</title><h1>P42 完整应用缓存验证</h1><p>原生产样式与测试数据，不是 C 视觉审核或真实业务验收。</p>${screenshots.map((shot) => `<h2>${shot.file}</h2><img style="max-width:100%" src="${shot.file}" alt="${shot.state}">`).join("\n")}</html>`,
  );
}
console.log(
  JSON.stringify({
    scenarios: scenarios.length,
    checks: scenarios.reduce((n, scenario) => n + scenario.checks.length, 0),
    screenshots: screenshots.length,
    sourceFiles: sourceFiles.size,
    processesClosed: true,
  }),
);
