import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import {
  previewProviderSourceVersionActionsDialog,
  previewProviderSourceVersionActionsParent,
  versionActionCopy,
} from "./lib/ui-phase2-provider-source-version-actions-preview.mjs";

assert.ok(process.argv.slice(2).every((argument) => argument === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p48-source-version-actions-review",
  parentComponent = "apps/web/src/components/ProviderSourceCenter.vue",
  dialogComponent = "apps/web/src/components/ProviderSourceConfigurationDialog.vue",
  pageCss = "design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-page-preview.css",
  versionCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-source-versions-preview.css",
  actionCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-source-version-actions-preview.css",
  fixture = "tests/e2e/m03-07-provider-sources.spec.ts",
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  parentSource = await read(parentComponent),
  dialogSource = await read(dialogComponent),
  parentReplacement = previewProviderSourceVersionActionsParent(parentSource),
  dialogReplacement = previewProviderSourceVersionActionsDialog(dialogSource);

const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true),
  declarations = [];
function visit(node) {
  if (ts.isVariableDeclaration(node)) declarations.push(node);
  ts.forEachChild(node, visit);
}
visit(ast);
const declarationSource = (name) => {
    const matches = declarations.filter((node) => node.name.getText(ast) === name);
    assert.equal(matches.length, 1, `fixture declaration ${name}`);
    return `const ${name}=${matches[0].initializer.getText(ast)};`;
  },
  box = {};
vm.runInNewContext(
  ts.transpileModule(
    ["navigation", "setup"].map(declarationSource).join("\n") +
      "\nglobalThis.data={navigation:navigation('platform_admin'),setup};",
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  box,
);
const fixtureData = JSON.parse(JSON.stringify(box.data)),
  initialHistory = [
    {
      version: 3,
      action: "configuration_updated",
      created_at: "2026-08-20T03:00:00.000Z",
      current: true,
      rollback_available: false,
      changes: [{ field: "schedule_minutes", before: 30, after: 45 }],
    },
    {
      version: 2,
      action: "configuration_updated",
      created_at: "2026-08-19T04:30:00.000Z",
      current: false,
      rollback_available: true,
      changes: [
        { field: "timeout_ms", before: 20_000, after: 30_000 },
        { field: "retry_limit", before: 3, after: 2 },
        { field: "status", before: "disabled", after: "enabled" },
      ],
    },
    {
      version: 1,
      action: "created",
      created_at: "2026-08-18T00:00:00.000Z",
      current: false,
      rollback_available: true,
      changes: [
        { field: "schedule_minutes", before: null, after: 30 },
        { field: "status", before: null, after: "disabled" },
      ],
    },
  ],
  refreshedHistory = [
    {
      version: 4,
      action: "configuration_rolled_back",
      created_at: "2026-09-11T06:30:00.000Z",
      current: true,
      rollback_available: false,
      changes: [{ field: "schedule_minutes", before: 45, after: 30 }],
    },
    ...initialHistory.map((version) => ({ ...version, current: false, rollback_available: true })),
  ],
  scenes = [
    { name: "submitting", response: "success", holdPost: true },
    { name: "success", response: "success" },
    { name: "conflict", response: "conflict", recover: true },
    { name: "forbidden", response: "forbidden" },
    { name: "failed", response: "failed" },
    { name: "catalog-failed", response: "success", catalogFailure: true, recover: true },
    { name: "history-failed", response: "success", historyFailure: true, recover: true },
    { name: "initial-read-failed", response: "none", initialReadFailure: true, recover: true },
  ],
  loadedSources = new Set([
    parentComponent,
    dialogComponent,
    pageCss,
    versionCss,
    actionCss,
    fixture,
    "scripts/lib/ui-phase2-provider-source-versions-preview.mjs",
    "scripts/lib/ui-phase2-provider-source-version-actions-preview.mjs",
    "scripts/verify-ui-phase2-provider-source-version-actions.mjs",
    "apps/web/index.html",
    "apps/web/vite.config.ts",
  ]),
  runs = [],
  screenshots = [],
  ports = [];

const errorPayload = (status, requestId) => ({
  error: {
    code:
      status === 403
        ? "authorization_denied"
        : status === 409
          ? "version_conflict"
          : status === 503
            ? "dependency_unavailable"
            : "internal_error",
    message: "请求未完成",
    action_hint:
      status === 403
        ? "权限调整后再试。"
        : status === 409
          ? "请读取最新版本。"
          : status === 503
            ? "服务暂不可用，请稍后重试。"
            : "服务没有确认生成新版本。",
  },
  request_id: requestId,
  trace_id: requestId,
});

let browser, server;
try {
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  const reservation = reservePort();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  ports.push(port);
  const origin = `http://127.0.0.1:${port}`;
  server = await createServer({
    configFile: path.resolve("apps/web/vite.config.ts"),
    logLevel: "error",
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
    server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
    plugins: [
      {
        name: "p48-source-version-actions-review-only",
        enforce: "pre",
        transform(text, id) {
          if (id.includes("?")) return null;
          const bare = id.split("?", 1)[0],
            normalized = bare.replaceAll("\\", "/");
          if (path.isAbsolute(bare)) {
            const relative = path.relative(process.cwd(), bare).replaceAll("\\", "/");
            if (
              !relative.includes("/node_modules/") &&
              (relative.startsWith("apps/") || relative.startsWith("packages/"))
            )
              loadedSources.add(relative);
          }
          if (normalized === path.resolve(parentComponent).replaceAll("\\", "/")) {
            assert.equal(text.replaceAll("\r\n", "\n"), parentSource);
            return { code: parentReplacement, map: null };
          }
          if (normalized === path.resolve(dialogComponent).replaceAll("\\", "/")) {
            assert.equal(text.replaceAll("\r\n", "\n"), dialogSource);
            return { code: dialogReplacement, map: null };
          }
          return null;
        },
        transformIndexHtml(html) {
          const styles = [pageCss, versionCss, actionCss]
            .map(
              (file) =>
                `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
            )
            .join("");
          return html
            .replace(
              "<body>",
              '<body class="p48-source-page-review p48-source-versions-review p48-source-version-actions-review">',
            )
            .replace("</head>", `${styles}</head>`);
        },
      },
    ],
  });
  await server.listen();
  console.log(`P48 source version actions ${origin}`);

  for (const width of [390, 760, 1024, 1440])
    for (const scene of scenes) {
      const context = await browser.newContext({
        viewport: { width, height: width <= 760 ? 1040 : 1100 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage(),
          requests = [],
          unexpected = [],
          errors = [],
          checks = [],
          check = (name, actual, expected = true) => {
            assert.deepEqual(actual, expected, `${width}/${scene.name}:${name}`);
            checks.push({ name, actual });
          },
          picture = async (suffix) => {
            if (!capture) return;
            const file = `${width}-${scene.name}-${suffix}.png`,
              bytes = await page.screenshot({ animations: "disabled" });
            await writeFile(`${output}/${file}`, bytes);
            screenshots.push({
              file,
              width,
              scene: scene.name,
              suffix,
              sha256: hash(bytes),
              pixelWidth: bytes.readUInt32BE(16),
              pixelHeight: bytes.readUInt32BE(20),
            });
          };
        let sourceCalls = 0,
          versionCalls = 0,
          rollbackCalls = 0,
          releasePost;
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/*", async (route) => {
          const request = route.request(),
            url = new URL(request.url()),
            key = `${request.method()} ${url.pathname}`;
          if (url.origin !== origin) {
            unexpected.push(`external ${key}`);
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          const isVersions = key.endsWith("/configuration/versions"),
            isRollback = key.endsWith("/configuration/rollbacks"),
            allowed = [
              "GET /api/v1/me/navigation",
              "GET /api/v1/auth/session-status",
              "GET /api/v1/platform/provider-sources",
            ];
          if (!allowed.includes(key) && !isVersions && !isRollback) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({
            key,
            body: request.postData(),
            idempotencyKey: request.headers()["idempotency-key"] ?? "",
          });
          if (url.pathname.endsWith("/me/navigation"))
            return route.fulfill({ json: { data: fixtureData.navigation, request_id: "p48-nav" } });
          if (url.pathname.endsWith("/auth/session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          if (url.pathname.endsWith("/provider-sources")) {
            sourceCalls += 1;
            if (scene.catalogFailure && sourceCalls === 2)
              return route.fulfill({
                status: 500,
                json: errorPayload(500, `p48-catalog-${sourceCalls}`),
              });
            const refreshed = sourceCalls > 1 && scene.response !== "forbidden" && scene.response !== "failed";
            return route.fulfill({
              json: {
                data: refreshed
                  ? fixtureData.setup.map((item, index) =>
                      index === 0
                        ? {
                            ...item,
                            provisioned: { ...item.provisioned, version: 4, schedule_minutes: 30 },
                          }
                        : item,
                    )
                  : fixtureData.setup,
                request_id: `p48-sources-${sourceCalls}`,
              },
            });
          }
          if (isVersions) {
            versionCalls += 1;
            if (scene.initialReadFailure && versionCalls <= 3)
              return route.fulfill({
                status: 503,
                json: errorPayload(503, `p48-read-${versionCalls}`),
              });
            if (scene.historyFailure && versionCalls === 2)
              return route.fulfill({
                status: 500,
                json: errorPayload(500, `p48-history-${versionCalls}`),
              });
            const useRefreshed =
              versionCalls > (scene.initialReadFailure ? 4 : 1) ||
              (versionCalls === 2 && !scene.historyFailure && scene.response !== "none");
            return route.fulfill({
              json: {
                data: {
                  provider_id: fixtureData.setup[0].provisioned.id,
                  current_version: useRefreshed ? 4 : 3,
                  versions: useRefreshed ? refreshedHistory : initialHistory,
                },
                request_id: `p48-versions-${versionCalls}`,
              },
            });
          }
          rollbackCalls += 1;
          if (scene.holdPost)
            await new Promise((resolve) => {
              releasePost = resolve;
            });
          if (scene.response === "conflict")
            return route.fulfill({ status: 409, json: errorPayload(409, "p48-rollback-conflict") });
          if (scene.response === "forbidden")
            return route.fulfill({ status: 403, json: errorPayload(403, "p48-rollback-forbidden") });
          if (scene.response === "failed")
            return route.fulfill({ status: 500, json: errorPayload(500, "p48-rollback-failed") });
          return route.fulfill({
            json: {
              data: { ...fixtureData.setup[0].provisioned, version: 4, schedule_minutes: 30 },
              request_id: "p48-rollback-success",
            },
          });
        });

        await page.goto(origin + "/platform-admin/providers/sources");
        await page.getByPlaceholder("搜索 Amazon、eBay、Reddit、国家或来源网址").fill("Amazon");
        const trigger = page.getByRole("button", { name: "版本与回滚" }).first(),
          center = page.locator(".source-center");
        await trigger.focus();
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog", {
            name: `配置历史 · ${fixtureData.setup[0].name}`,
          }),
          feedback = dialog.locator(".p48-source-version-action-feedback"),
          restore = dialog.getByRole("button", { name: "恢复第 2 版" });
        await expect(dialog).toBeVisible();

        if (scene.initialReadFailure) {
          await expect(feedback.getByRole("heading", { name: versionActionCopy.readFailed.title })).toBeFocused();
          await expect(feedback.getByRole("button", { name: "重新读取配置历史" })).toBeVisible();
          await picture("read-failed");
          await feedback.getByRole("button", { name: "重新读取配置历史" }).click();
          await expect(dialog.getByText("第 3 版", { exact: true })).toBeVisible();
          await expect(feedback).toHaveCount(0);
          await picture("recovered");
        } else {
          await expect(restore).toBeVisible();
          await dialog.getByLabel("回滚原因").fill("恢复稳定采集设置");
          await restore.click();
          const post = requests.find((request) => request.key.endsWith("/configuration/rollbacks"));
          await expect.poll(() => Boolean(post)).toBe(true);
          check("rollback body", JSON.parse(post.body), {
            target_version: 2,
            expected_version: 3,
            reason: "恢复稳定采集设置",
          });
          check("rollback idempotency key", Boolean(post.idempotencyKey));

          if (scene.holdPost) {
            await expect(feedback.getByRole("heading", { name: versionActionCopy.submitting.title })).toBeVisible();
            check(
              "all restore actions disabled while pending",
              await dialog.locator("button", { hasText: "恢复第" }).evaluateAll((buttons) =>
                buttons.every((button) => button.disabled),
              ),
            );
            await expect(dialog.getByLabel("回滚原因")).toBeDisabled();
            await expect(dialog.getByRole("button", { name: `关闭 ${fixtureData.setup[0].name} 配置历史` })).toBeDisabled();
            await picture("submitting");
            releasePost?.();
            await expect(feedback.getByRole("heading", { name: versionActionCopy.success.title })).toBeFocused();
            await picture("confirmed");
          } else if (scene.response === "success") {
            if (scene.catalogFailure || scene.historyFailure) {
              const failureTitle = scene.catalogFailure
                ? "新版本已生成，来源目录尚未更新"
                : versionActionCopy.syncFailed.title;
              await expect(feedback.getByRole("heading", { name: failureTitle })).toBeFocused();
              await expect(feedback.getByText("本窗仍显示操作前历史", { exact: false })).toBeVisible();
              await expect(dialog.getByText("当前第 3 版")).toBeVisible();
              await picture("sync-failed");
              await feedback.getByRole("button", { name: "重新核对目录与历史" }).click();
              await expect(feedback.getByRole("heading", { name: "新的当前版本已确认" })).toBeFocused();
              await picture("recovered");
            } else {
              await expect(feedback.getByRole("heading", { name: versionActionCopy.success.title })).toBeFocused();
              await picture("success");
            }
          } else {
            const expected =
              scene.response === "conflict"
                ? versionActionCopy.conflict
                : scene.response === "forbidden"
                  ? versionActionCopy.forbidden
                  : versionActionCopy.failed;
            await expect(feedback.getByRole("heading", { name: expected.title })).toBeFocused();
            await expect(feedback.getByText(expected.description)).toBeVisible();
            await expect(dialog.getByText("当前第 3 版")).toBeVisible();
            await picture(scene.response);
            if (scene.recover) {
              await feedback.getByRole("button", { name: "读取最新版本" }).click();
              await expect(feedback.getByRole("heading", { name: "已读取最新版本" })).toBeFocused();
              await picture("recovered");
            }
          }

          if (["success", "submitting"].includes(scene.name) || scene.recover) {
            await expect(dialog.getByText("当前第 4 版")).toBeVisible();
            await expect(dialog.getByText("第 4 版", { exact: true })).toBeVisible();
            await expect(dialog.getByText("从历史版本恢复", { exact: true })).toBeVisible();
          }
        }

        check("no duplicate page message", await center.locator(".source-message").count(), 0);
        check("no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        check("background remains inert", (await center.locator(":scope > [inert]").count()) > 0);
        check(
          "44px action feedback controls",
          await dialog.evaluate((element) =>
            [...element.querySelectorAll("button, textarea")]
              .filter((control) => control.getClientRects().length > 0)
              .slice(0, 5)
              .every((control) => control.getBoundingClientRect().height >= 44),
          ),
        );

        const closeIcon = dialog.getByRole("button", {
            name: `关闭 ${fixtureData.setup[0].name} 配置历史`,
          }),
          close = dialog.getByRole("button", { name: "关闭", exact: true });
        await closeIcon.focus();
        await page.keyboard.press("Shift+Tab");
        await expect(close).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(closeIcon).toBeFocused();
        check("tab loop stays in dialog", true);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
        check("escape restores trigger", true);
        check("background inert cleared", await center.locator(":scope > [inert]").count(), 0);
        check("rollback calls", rollbackCalls, scene.response === "none" ? 0 : 1);
        check("rollback requests are POST", requests.filter((request) => request.key.endsWith("/configuration/rollbacks")).every((request) => request.key.startsWith("POST ")));
        check("GET requests have no bodies", requests.filter((request) => request.key.startsWith("GET ")).every((request) => request.body == null));
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        runs.push({
          width,
          scene: scene.name,
          checks,
          counts: { sourceCalls, versionCalls, rollbackCalls },
          requests,
        });
      } finally {
        await context.close();
      }
    }
} finally {
  await browser?.close();
  await server?.close();
}

if (capture) {
  const sourceHashes = {};
  for (const file of [...loadedSources].sort()) sourceHashes[file] = hash(await read(file));
  const evidence = {
    kind: "P48-SOURCE-VERSION-ACTIONS-REVIEW-r1",
    generatedAt: new Date().toISOString(),
    reviewOnly: true,
    productionChanged: false,
    deployed: false,
    writesInterceptedLocally: true,
    processesClosed: true,
    ports,
    runs,
    screenshots,
    sourceHashes,
  };
  await writeFile(`${output}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  const cards = screenshots
    .map(
      (shot) =>
        `<figure><img src="${shot.file}" alt="${shot.width}px ${shot.scene} ${shot.suffix}"><figcaption>${shot.width}px · ${shot.scene} · ${shot.suffix}</figcaption></figure>`,
    )
    .join("\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P48 配置回滚交互评审</title><style>body{margin:0;padding:24px;background:#e9eef6;color:#172033;font:14px system-ui}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}figure{margin:0;padding:12px;border-radius:16px;background:white;box-shadow:0 8px 24px #18243b1f}img{display:block;width:100%;height:auto;border-radius:10px}figcaption{padding-top:10px}</style><h1>P48 配置回滚交互 · 实际 Vue r1</h1><main>${cards}</main></html>`,
  );
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((sum, run) => sum + run.checks.length, 0),
      screenshots: screenshots.length,
      sourceHashes: Object.keys(sourceHashes).length,
    }),
  );
}
