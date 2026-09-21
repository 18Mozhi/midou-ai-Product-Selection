import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { createServer } from "vite";
import { chromium } from "playwright";
import { expect } from "@playwright/test";
import { accountAppFixture, accountFixtureFile } from "./lib/ui-phase2-account-app-fixture.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

const args = process.argv.slice(2);
assert.ok(args.length <= 1 && args.every((arg) => ["--smoke", "--capture"].includes(arg)));
const capture = args.includes("--capture");
const output = "output/playwright/p43-actual-app-lifecycle-r1";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fixture = accountAppFixture(await read(accountFixtureFile));
const sources = new Set([
  accountFixtureFile,
  "scripts/verify-ui-phase2-account-app-lifecycle.mjs",
  "scripts/lib/ui-phase2-account-app-fixture.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
]);
if (capture) await mkdir(output); // Exclusive: do not overwrite any evidence packet.
let server, browser;
const runs = [],
  screenshots = [];
try {
  // OS-assigned local port; no existing service is stopped or replaced.
  const probe = reservePort();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const availablePort = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  server = await createServer({
    configFile: path.resolve("apps/web/vite.config.ts"),
    logLevel: "error",
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
    server: {
      host: "127.0.0.1",
      port: availablePort,
      strictPort: true,
      proxy: {},
      hmr: false,
      open: false,
    },
  });
  await server.listen();
  const port = server.httpServer.address().port;
  const origin = `http://127.0.0.1:${port}`;
  console.log(`P43 actual App lifecycle ${origin}`);
  browser = await chromium.launch();
  for (const width of args.includes("--smoke") ? [390] : [390, 1440])
    for (const action of ["create", "password"])
      for (const destination of ["shared-account-route", "cached-dashboard"])
        for (const outcome of ["success", "failure"]) {
          const context = await browser.newContext({
            viewport: { width, height: 1000 },
            locale: "zh-CN",
            timezoneId: "Asia/Shanghai",
            reducedMotion: "reduce",
          });
          let release;
          const gate = new Promise((resolve) => (release = resolve));
          const checks = [],
            requests = [],
            unexpected = [],
            errors = [];
          const label = `${width}-${action}-${destination}-${outcome}`;
          const check = (name, actual, expected = true) => {
            assert.deepEqual(actual, expected, `${label}: ${name}`);
            checks.push({ name, actual });
          };
          try {
            const page = await context.newPage();
            page.setDefaultTimeout(15000);
            page.on("pageerror", (error) => errors.push(error.message));
            const root = "/api/v1/platform/accounts";
            const detailPath = `${root}/users/${fixture.detail.user.id}`;
            const postPath = action === "create" ? `${root}/users` : `${detailPath}/password`;
            const envelope = (data) => ({
              data,
              request_id: "app-lifecycle-fixture",
              trace_id: "app-lifecycle-fixture",
            });
            await page.route("**/*", async (route) => {
              const request = route.request(),
                url = new URL(request.url());
              if (url.origin !== origin) {
                unexpected.push("external request");
                return route.abort();
              }
              if (!url.pathname.startsWith("/api/")) return route.continue();
              const key = `${request.method()} ${url.pathname}`;
              const values = {
                "GET /api/v1/auth/session-status": { authenticated: true },
                "GET /api/v1/me/navigation": fixture.navigation,
                "GET /api/v1/platform/roles": fixture.platformRoles,
                "GET /api/v1/platform/dashboard": fixture.dashboard,
                [`GET ${root}`]: fixture.overview,
                [`GET ${detailPath}`]: fixture.detail,
              };
              if (key in values) {
                requests.push({ key });
                return route.fulfill({ json: envelope(values[key]) });
              }
              // Exercise the existing optional preference read fallback, without creating a theme contract.
              if (key === "GET /api/v1/me/ui-preferences") {
                requests.push({ key, expectedFailure: true });
                return route.fulfill({
                  status: 503,
                  json: { error: { code: "fixture_theme_unavailable" } },
                });
              }
              if (key === `POST ${postPath}`) {
                assert.deepEqual(
                  request.postDataJSON(),
                  action === "create"
                    ? {
                        email: "submitted@example.test",
                        temporary_password: "Local-fixture-43!",
                        platform_role_code: null,
                        organization_id: null,
                        organization_role_code: "member",
                      }
                    : { temporary_password: "Local-fixture-43!", reason: "本地跨路由归属验证" },
                );
                check("exact synthetic write body", true);
                check("idempotency key present", Boolean(request.headers()["idempotency-key"]));
                requests.push({ key, body: "Exact synthetic body verified; password omitted" });
                await gate;
                return outcome === "success"
                  ? route.fulfill({
                      json: envelope(
                        action === "create" ? { id: fixture.detail.user.id } : { version: 2 },
                      ),
                    })
                  : route.fulfill({
                      status: 400,
                      json: {
                        error: {
                          code: "review_fixture_failure",
                          message: "原请求失败",
                          action_hint: "旧请求的测试提示",
                        },
                        request_id: "app-lifecycle-fixture",
                        trace_id: "app-lifecycle-fixture",
                      },
                    });
              }
              unexpected.push(key);
              return route.abort();
            });
            const shot = async (scene) => {
              if (!capture) return;
              await page.evaluate(() => document.fonts.ready);
              const bytes = await page.screenshot({ animations: "disabled" });
              const file = `${label}-${scene}.png`;
              await writeFile(`${output}/${file}`, bytes);
              screenshots.push({
                file,
                scene,
                width,
                action,
                destination,
                outcome,
                sha256: hash(bytes),
                pixelWidth: bytes.readUInt32BE(16),
                pixelHeight: bytes.readUInt32BE(20),
              });
            };
            await page.goto(`${origin}/platform-admin/users`);
            const detail = page.locator("dialog.detail-dialog");
            await detail.waitFor({ state: "attached" });
            const cached = await detail.elementHandle();
            const target =
              destination === "shared-account-route" ? "/platform-admin/admins" : "/platform-admin";
            const destinationLink =
              destination === "shared-account-route"
                ? page
                    .getByRole("navigation", { name: "账号与组织二级导航" })
                    .getByRole("link", { name: "管理员管理", exact: true })
                : page
                    .getByRole("navigation", { name: "面包屑" })
                    .getByRole("link", { name: "平台后台", exact: true });
            await destinationLink.click();
            await expect(page).toHaveURL(origin + target);
            if (destination === "cached-dashboard")
              await expect(
                page.getByText("平台还没有可展示的业务事实", { exact: true }),
              ).toBeVisible();
            await page.goBack();
            await expect(page).toHaveURL(origin + "/platform-admin/users");
            const openDetail = async () => {
              const email = fixture.overview.users[0].email;
              if (width <= 760) {
                await page
                  .getByRole("button", {
                    name: new RegExp(`${email.replaceAll(".", "\\.")}.*查看详情`),
                  })
                  .click();
                await page
                  .getByRole("dialog", { name: email, exact: true })
                  .getByRole("button", { name: "打开账号详情" })
                  .click();
              } else {
                await page
                  .getByRole("row")
                  .filter({ hasText: email })
                  .getByRole("button", { name: "账号详情" })
                  .click();
              }
              await expect(
                detail.getByRole("button", { name: "强制改密", exact: true }),
              ).toBeVisible();
            };
            const create = page.getByRole("dialog", { name: "新建用户或平台管理员", exact: true });
            const password = page.getByRole("dialog", { name: "强制重置密码", exact: true });
            const trigger = page
              .locator(".hero-actions")
              .getByRole("button", { name: "新建用户", exact: true });
            if (action === "create") {
              await trigger.click();
              await create.getByLabel("邮箱", { exact: true }).fill("submitted@example.test");
              await create.getByLabel("临时密码", { exact: true }).fill("Local-fixture-43!");
              await create.getByRole("button", { name: "确认创建", exact: true }).click();
            } else {
              await openDetail();
              await detail.getByRole("button", { name: "强制改密", exact: true }).click();
              await password.getByLabel("新临时密码", { exact: true }).fill("Local-fixture-43!");
              await password.getByRole("button", { name: "确认重置", exact: true }).click();
              const reason = page
                .getByRole("dialog")
                .filter({ has: page.getByLabel("操作原因", { exact: true }) });
              await reason.getByLabel("操作原因", { exact: true }).fill("本地跨路由归属验证");
              await reason.getByRole("button", { name: "确认执行", exact: true }).click();
              await expect(reason).toHaveCount(0);
            }
            await expect
              .poll(() => requests.filter((item) => item.key.startsWith("POST ")).length)
              .toBe(1);
            await shot("pending");
            await (action === "create" ? create : password)
              .getByRole("button", { name: "取消", exact: true })
              .click();
            if (action === "password") {
              check(
                "reset disabled while old write pending",
                await detail.getByRole("button", { name: "强制改密", exact: true }).isDisabled(),
              );
              await detail.getByRole("button", { name: "关闭账号详情", exact: true }).click();
            }
            await page.goForward();
            await expect(page).toHaveURL(origin + target);
            await expect
              .poll(() => cached.evaluate((node) => node.isConnected))
              .toBe(destination === "shared-account-route");
            check(
              "destination attachment matches actual cache path",
              await cached.evaluate((node) => node.isConnected),
              destination === "shared-account-route",
            );
            await page.goBack();
            await expect(page).toHaveURL(origin + "/platform-admin/users");
            await expect(detail).toBeAttached();
            check(
              "same cached account instance after history",
              await cached.evaluate(
                (node) =>
                  node.isConnected && node === document.querySelector("dialog.detail-dialog"),
              ),
            );
            await expect(page.getByRole("dialog")).toHaveCount(0);
            if (action === "create") {
              await trigger.click();
              await create.getByLabel("邮箱", { exact: true }).fill("replacement@example.test");
              await create.getByLabel("临时密码", { exact: true }).fill("Replacement-local-43!");
            } else {
              await openDetail();
              check(
                "replacement detail respects busy lock",
                await detail.getByRole("button", { name: "强制改密", exact: true }).isDisabled(),
              );
            }
            const readsBefore = requests.filter((item) => item.key === `GET ${root}`).length;
            await shot("replacement-before-response");
            const response = page.waitForResponse(
              (response) =>
                response.request().method() === "POST" &&
                new URL(response.url()).pathname === postPath,
            );
            release();
            await (await response).finished();
            const replacement = action === "create" ? create : detail;
            await expect(
              replacement.getByRole("button", {
                name: action === "create" ? "确认创建" : "强制改密",
                exact: true,
              }),
            ).toBeEnabled();
            check("replacement remains open", await replacement.evaluate((node) => node.open));
            check(
              "old failure does not contaminate replacement",
              (await replacement.innerText()).includes("旧请求的测试提示"),
              false,
            );
            if (action === "create") {
              check(
                "replacement email retained",
                await create.getByLabel("邮箱", { exact: true }).inputValue(),
                "replacement@example.test",
              );
              check(
                "replacement password retained",
                (await create.getByLabel("临时密码", { exact: true }).inputValue()) ===
                  "Replacement-local-43!",
              );
            } else {
              check(
                "replacement account retained",
                await detail.getAttribute("aria-label"),
                fixture.overview.users[0].email,
              );
              check(
                "old password dialog stays closed",
                await page
                  .locator('dialog[aria-label="强制重置密码"]')
                  .evaluate((node) => node.open),
                false,
              );
            }
            const notice = action === "create" ? "账号已创建" : "临时密码已更新";
            check(
              "original success notification preserved",
              await page.locator(".account-message").filter({ hasText: notice }).count(),
              outcome === "success" ? 1 : 0,
            );
            check(
              "success alone rereads account list",
              requests.filter((item) => item.key === `GET ${root}`).length - readsBefore,
              outcome === "success" ? 1 : 0,
            );
            check(
              "one original write only",
              requests.filter((item) => item.key.startsWith("POST ")).length,
              1,
            );
            check("no unexpected traffic", unexpected, []);
            check("no browser errors", errors, []);
            await shot("after-response");
            runs.push({ width, action, destination, outcome, checks, requests });
            console.log(`${label}: ${checks.length} checks`);
          } finally {
            release();
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
  await includeImportedStyleSources(sources, (file) =>
    file.startsWith("apps/web/src/") ? read(file) : "",
  );
  await browser.close();
  browser = null;
  await server.close();
  server = null;
  const evidence = {
    kind: "P43-ACTUAL-APP-LIFECYCLE-r1",
    functionalOnly: true,
    designApproval: "not_requested",
    boundary:
      "Untransformed App, NavigationShell, Router and KeepAlive. Local intercepted fixtures only. Original detail fixture lacks membership organization_id. Cancel dialogs before history navigation; open-dialog route cleanup, secret clearing, full C integration, real writes/RBAC and production are not covered.",
    processesClosed: true,
    port,
    runs,
    screenshots,
    sourceHashes: Object.fromEntries(
      await Promise.all([...sources].sort().map(async (file) => [file, hash(await read(file))])),
    ),
  };
  if (capture) {
    await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P43 真实应用交互证据</title><style>body{font:16px/1.6 sans-serif;margin:24px}img{max-width:100%}</style><h1>P43 真实应用交互证据</h1><p>现有未变换 App；仅本地测试数据。不是 C 方向最终设计稿，不代表生产或真实权限验收。</p><a href="evidence.json">机器证据</a>' +
        screenshots
          .map(
            (shot) =>
              `<h2>${shot.file}</h2><img loading="lazy" src="${shot.file}" alt="${shot.file}">`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((sum, run) => sum + run.checks.length, 0),
      screenshots: screenshots.length,
      sources: sources.size,
      port,
      processesClosed: true,
    }),
  );
} finally {
  await browser?.close();
  await server?.close();
}
