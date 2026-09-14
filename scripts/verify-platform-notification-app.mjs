import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import vm from "node:vm";
import path from "node:path";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

const capture = process.argv[2] === "--capture-review";
assert.ok(process.argv.length === 2 || (capture && process.argv.length === 3));
const output = path.resolve(
  "design-plans/ui-phase-2-2026-09-07/design/platform-notifications-direction-c/app-review-r3",
);
if (capture) await mkdir(output);
const fixtureFile = "tests/e2e/platform-message-management.spec.ts";
const ast = ts.createSourceFile(
  fixtureFile,
  await readFile(fixtureFile, "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((node) => [...node.declarationList.declarations]);
const code = ["messageId", "notificationMessage", "notificationSnapshot"].map((name) => {
  const found = declarations.filter((node) => node.name.getText(ast) === name);
  assert.equal(found.length, 1, `Original fixture ${name}`);
  return `const ${name}=${found[0].initializer.getText(ast)};`;
});
const navigation = [];
function visit(node) {
  if (
    ts.isObjectLiteralExpression(node) &&
    ["shell", "platform_capabilities", "guard_reason"].every((key) =>
      node.properties.some((p) => p.name?.getText(ast) === key),
    )
  )
    navigation.push(node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(navigation.length);
const evaluate = (expression) =>
  JSON.parse(
    JSON.stringify(
      vm.runInNewContext(
        ts.transpileModule(`${code.join("\n")}\n(${expression})`, {
          compilerOptions: { target: ts.ScriptTarget.ES2022 },
        }).outputText,
        {},
        { timeout: 1000 },
      ),
    ),
  );
const fixture = evaluate(`{snapshot:notificationSnapshot(),navigation:${navigation[0]}}`);
for (const item of navigation) assert.deepEqual(evaluate(item), fixture.navigation);
const envelope = (data) => ({
  data,
  request_id: "platform-message-e2e",
  trace_id: "platform-message-e2e",
});
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  server: { host: "127.0.0.1", port: 0, open: false, proxy: {}, hmr: false },
});
const runs = [],
  images = [],
  failures = [];
let browser;
try {
  await server.listen();
  const port = server.httpServer.address().port,
    origin = `http://127.0.0.1:${port}`;
  console.log(`p57_actual_app=${origin} pid=${process.pid}`);
  browser = await chromium.launch();
  for (const width of [390, 1440])
    for (const motion of ["reduce", "no-preference"]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: motion,
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
      });
      const requests = [],
        unexpected = [],
        errors = [],
        checks = [];
      try {
        const page = await context.newPage();
        page.on("pageerror", (e) => errors.push(e.message));
        await page.route("**/*", async (route) => {
          const request = route.request(),
            url = new URL(request.url()),
            key = `${request.method()} ${url.pathname}`;
          if (url.origin !== origin) {
            unexpected.push("external request");
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/") && request.method() === "GET")
            return route.continue();
          requests.push(key);
          if (key === "GET /api/v1/auth/session-status")
            return route.fulfill({ json: envelope({ authenticated: true }) });
          if (key === "GET /api/v1/me/navigation")
            return route.fulfill({ json: envelope(fixture.navigation) });
          if (key === "GET /api/v1/me/ui-preferences")
            return route.fulfill({
              status: 503,
              json: { error: { code: "fixture_theme_unavailable" } },
            });
          if (key === "GET /api/v1/platform/management") {
            assert.equal(url.searchParams.get("domain"), "notifications");
            const snapshot = structuredClone(fixture.snapshot);
            snapshot.pagination.page = Number(url.searchParams.get("page") || 1);
            snapshot.message_pagination.page = Number(url.searchParams.get("message_page") || 1);
            return route.fulfill({ json: envelope(snapshot) });
          }
          unexpected.push(key);
          return route.abort();
        });
        const shot = async (name, dialog = false) => {
          if (!capture || motion !== "reduce") return;
          await page.evaluate(() => document.fonts.ready);
          const file = `P57-${width}-${name}.png`,
            bytes = await page.screenshot({
              path: path.join(output, file),
              fullPage: !dialog,
              animations: "disabled",
            });
          images.push({
            file,
            sha256: hash(bytes),
            scope: dialog ? "actual App viewport with dialog" : "actual App full page",
            approval: "pending-user-review",
          });
        };
        const focus = async (locator, name) => {
          await locator.focus();
          await page.keyboard.press("Tab");
          await page.keyboard.press("Shift+Tab");
          await expect(locator).toBeFocused();
          await expect(locator).toHaveCSS("outline-color", "rgb(47, 110, 229)");
          const visual = await locator.evaluate((el) => {
            const s = getComputedStyle(el);
            return {
              focus: el.matches(":focus-visible"),
              outline: s.outlineColor,
              width: s.outlineWidth,
              style: s.outlineStyle,
            };
          });
          checks.push({ name, visual });
          if (
            !visual.focus ||
            visual.outline !== "rgb(47, 110, 229)" ||
            parseFloat(visual.width) < 2 ||
            visual.style === "none"
          )
            failures.push({ width, motion, name, visual });
        };
        await page.goto(`${origin}/platform-admin/notifications`);
        const workspace = page.locator(".platform-notifications");
        await expect(
          workspace.getByRole("heading", { name: "通知管理", exact: true }),
        ).toBeVisible();
        await expect(page.locator(".role-shell")).toBeVisible();
        const navigation = workspace.getByRole("navigation", { name: "通知管理页面分区" });
        await focus(navigation.getByRole("button").first(), "message-section");
        await focus(workspace.getByRole("button", { name: "新建草稿", exact: true }), "new-draft");
        const directory = workspace.locator(".message-directory button");
        await expect(directory).toHaveCount(3);
        await focus(directory.first(), "message-directory");
        await shot("messages");
        const messagePage = workspace.getByRole("navigation", { name: "人工消息分页" });
        await focus(messagePage.getByRole("button", { name: "下一页" }), "message-next");
        await messagePage.getByRole("button", { name: "下一页" }).click();
        await expect(page).toHaveURL(/message_page=2/);
        await expect(messagePage.getByRole("button", { name: "下一页" })).toBeDisabled();
        await messagePage.getByRole("button", { name: "上一页" }).click();
        if (width <= 760) await directory.first().click();
        const cancel = workspace.getByRole("button", { name: "取消草稿", exact: true });
        await cancel.hover();
        await cancel.evaluate(async (el) => {
          await Promise.all(el.getAnimations().map((animation) => animation.finished));
        });
        await expect(cancel).toHaveCSS("color", "rgb(173, 57, 53)");
        const danger = await cancel.evaluate((el) => getComputedStyle(el).color);
        checks.push({ name: "reader-cancel-hover", danger });
        if (danger !== "rgb(173, 57, 53)")
          failures.push({ width, motion, name: "reader-cancel-hover", danger });
        if (width <= 760) {
          await focus(workspace.getByRole("button", { name: "关闭完整消息" }), "reader-close");
          await shot("reader", true);
          await page.keyboard.press("Escape");
          await expect(directory.first()).toBeFocused();
        } else {
          const body = workspace.locator(".message-reader details summary");
          await focus(body, "full-body");
          await body.press("Enter");
          await shot("reader");
          await body.press("Space");
        }
        await workspace.getByRole("button", { name: "新建草稿", exact: true }).click();
        const editor = page.getByRole("dialog", { name: "新建平台消息草稿" });
        await focus(editor.getByLabel("标题"), "editor-title");
        await shot("editor", true);
        await page.keyboard.press("Escape");
        await expect(
          workspace.getByRole("button", { name: "新建草稿", exact: true }),
        ).toBeFocused();
        await navigation.getByRole("button", { name: /投递观测/ }).click();
        const filter = workspace.getByRole("button", { name: /筛选投递记录/ });
        await focus(filter, "filter-trigger");
        await filter.click();
        const sheet = page.getByRole("dialog", { name: "筛选投递记录" });
        await focus(sheet.getByRole("textbox", { name: "搜索投递记录" }), "filter-query");
        await sheet.getByRole("textbox", { name: "搜索投递记录" }).fill("采集");
        await sheet.getByRole("combobox", { name: "通知类型" }).selectOption("task");
        await focus(sheet.getByRole("textbox", { name: "搜索投递记录" }), "filter-filled-query");
        await expect(sheet).toBeVisible();
        await sheet.evaluate(async (el) => {
          await Promise.all(el.getAnimations().map((animation) => animation.finished));
        });
        const geometry = await sheet.locator(".platform-management-filter").evaluate((form) => {
          const fields = [...form.querySelectorAll("input,select,button")];
          return fields.map((el) => {
            const rect = el.getBoundingClientRect();
            return {
              x: rect.x,
              y: rect.y,
              right: rect.right,
              bottom: rect.bottom,
              height: rect.height,
            };
          });
        });
        assert.equal(geometry.length, 4);
        assert.ok(
          geometry.every(
            (rect, i) =>
              rect.height >= 44 &&
              rect.x >= 0 &&
              rect.right <= width &&
              (!i || rect.y >= geometry[i - 1].bottom + 8),
          ),
          JSON.stringify({ width, motion, geometry }),
        );
        checks.push({ name: "filter-stacked-targets", geometry });
        const apply = sheet.getByRole("button", { name: "筛选", exact: true });
        await page.mouse.move(0, 0);
        await expect(apply).toHaveCSS("color", "rgb(255, 255, 255)");
        await expect(apply).toHaveCSS("background-color", "rgb(31, 85, 189)");
        checks.push({ name: "filter-primary-visible", color: "white-on-blue" });
        for (const label of ["搜索投递记录", "通知类型"]) {
          const field = sheet.getByLabel(label, { exact: true });
          assert.ok(
            await field.evaluate((el) =>
              [...el.labels].some(
                (item) => item.textContent.trim() === el.getAttribute("aria-label"),
              ),
            ),
          );
        }
        checks.push({ name: "filter-visible-associated-labels" });
        await shot("filter", true);
        await sheet.getByRole("button", { name: "筛选", exact: true }).click();
        await expect(page).toHaveURL(/status=task/);
        await expect(sheet).not.toBeVisible();
        await expect(filter).toBeFocused();
        const deliveryPage = workspace.getByRole("navigation", { name: "通知与投递记录分页" });
        await focus(deliveryPage.getByRole("button", { name: "下一页" }), "delivery-next");
        await deliveryPage.getByRole("button", { name: "下一页" }).click();
        await expect(page).toHaveURL(/(?:\?|&)page=2/);
        assert.equal(new URL(page.url()).searchParams.get("message_page"), null);
        await shot("deliveries");
        await navigation.getByRole("button", { name: /系统事实/ }).click();
        await expect(workspace.getByText("邮件服务未接入，管理入口保持关闭。")).toBeVisible();
        await shot("system-facts");
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          "No horizontal page overflow",
        );
        assert.deepEqual(unexpected, []);
        assert.deepEqual(errors, []);
        assert.ok(requests.every((item) => item.startsWith("GET ")));
        runs.push({ width, motion, checks, requests });
        console.log(`p57_app_run=${width}/${motion} checks=${checks.length}`);
      } finally {
        await context.close();
      }
    }
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((n, r) => n + r.checks.length, 0),
      failures,
    }),
  );
  assert.equal(failures.length, 0);
  if (capture) {
    const files = new Set([
      fixtureFile,
      "scripts/verify-platform-notification-app.mjs",
      "scripts/lib/ui-imported-style-sources.mjs",
      "apps/web/src/main.ts",
      "apps/web/index.html",
      "apps/web/vite.config.ts",
      "package-lock.json",
    ]);
    for (const mod of server.moduleGraph.idToModuleMap.values())
      if (
        mod.file?.replaceAll("\\", "/").includes("/apps/web/src/") &&
        /\.(vue|ts|css|json)$/.test(mod.file)
      )
        files.add(path.relative(process.cwd(), mod.file).replaceAll("\\", "/"));
    await includeImportedStyleSources(files, (file) => readFile(file, "utf8"));
    const sources = Object.fromEntries(
      await Promise.all([...files].sort().map(async (file) => [file, hash(await readFile(file))])),
    );
    await writeFile(
      path.join(output, "manifest.json"),
      JSON.stringify(
        {
          scope:
            "Unmodified App,Router,NavigationShell and P57. Existing E2E fixtures; no real API/roles/writes/production acceptance. Not all App routes,states or accessibility checks.",
          images,
          sources,
          runs,
        },
        null,
        2,
      ) + "\n",
    );
  }
} finally {
  await browser?.close();
  await server.close();
  console.log(
    `p57_app_cleanup=browser-and-server-closed; ${capture ? "review packet retained" : "no artifacts written"}`,
  );
}
