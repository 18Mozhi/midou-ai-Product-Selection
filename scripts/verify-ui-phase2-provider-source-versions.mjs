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
  previewProviderSourceVersions,
  versionDialogCopy,
} from "./lib/ui-phase2-provider-source-versions-preview.mjs";

assert.ok(process.argv.slice(2).every((argument) => argument === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p48-source-versions-review",
  component = "apps/web/src/components/ProviderSourceConfigurationDialog.vue",
  pageCss = "design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-page-preview.css",
  dialogCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-source-versions-preview.css",
  fixture = "tests/e2e/m03-07-provider-sources.spec.ts",
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  source = await read(component),
  replacement = previewProviderSourceVersions(source);

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
  history = [
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
  scenes = [
    { name: "loading", currentVersion: 3, versions: history, loading: true },
    { name: "history", currentVersion: 3, versions: history },
    { name: "reason-required", currentVersion: 3, versions: history, invalidReason: true },
    {
      name: "no-visible-change",
      currentVersion: 3,
      versions: [
        { ...history[0], changes: [] },
        { ...history[1], changes: [] },
      ],
    },
    { name: "empty", currentVersion: 1, versions: [] },
  ],
  loadedSources = new Set([
    component,
    pageCss,
    dialogCss,
    fixture,
    "scripts/lib/ui-phase2-provider-source-versions-preview.mjs",
    "scripts/verify-ui-phase2-provider-source-versions.mjs",
    "apps/web/index.html",
    "apps/web/vite.config.ts",
  ]),
  runs = [],
  screenshots = [],
  ports = [];

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
        name: "p48-source-versions-review-only",
        enforce: "pre",
        transform(text, id) {
          if (id.includes("?")) return null;
          const bare = id.split("?", 1)[0];
          if (path.isAbsolute(bare)) {
            const relative = path.relative(process.cwd(), bare).replaceAll("\\", "/");
            if (
              !relative.includes("/node_modules/") &&
              (relative.startsWith("apps/") || relative.startsWith("packages/"))
            )
              loadedSources.add(relative);
          }
          if (bare.replaceAll("\\", "/") !== path.resolve(component).replaceAll("\\", "/"))
            return null;
          assert.equal(text.replaceAll("\r\n", "\n"), source);
          return { code: replacement, map: null };
        },
        transformIndexHtml(html) {
          const styles = [pageCss, dialogCss]
            .map(
              (file) =>
                `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
            )
            .join("");
          return html
            .replace("<body>", '<body class="p48-source-page-review p48-source-versions-review">')
            .replace("</head>", `${styles}</head>`);
        },
      },
    ],
  });
  await server.listen();
  console.log(`P48 source versions ${origin}`);

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
        let releaseVersions;
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
          const allowed = [
            "GET /api/v1/me/navigation",
            "GET /api/v1/auth/session-status",
            "GET /api/v1/platform/provider-sources",
          ];
          if (!allowed.includes(key) && !key.endsWith("/configuration/versions")) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, body: request.postData() });
          if (url.pathname.endsWith("/me/navigation"))
            return route.fulfill({ json: { data: fixtureData.navigation, request_id: "p48-nav" } });
          if (url.pathname.endsWith("/auth/session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          if (url.pathname.endsWith("/provider-sources"))
            return route.fulfill({ json: { data: fixtureData.setup, request_id: "p48-sources" } });
          if (scene.loading)
            await new Promise((resolve) => {
              releaseVersions = resolve;
            });
          return route.fulfill({
            json: {
              data: {
                provider_id: fixtureData.setup[0].provisioned.id,
                current_version: scene.currentVersion,
                versions: scene.versions,
              },
              request_id: `p48-${scene.name}`,
            },
          });
        });

        await page.goto(origin + "/platform-admin/providers/sources");
        await page.getByPlaceholder("搜索 Amazon、eBay、Reddit、国家或来源网址").fill("Amazon");
        const trigger = page.getByRole("button", { name: "版本与回滚" }).first(),
          center = page.locator(".source-center");
        await expect(trigger).toBeVisible();
        await trigger.focus();
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog", {
            name: `配置历史 · ${fixtureData.setup[0].name}`,
          }),
          heading = dialog.getByRole("heading", {
            name: `配置历史 · ${fixtureData.setup[0].name}`,
          });
        await expect(dialog).toBeVisible();
        await expect(heading).toBeFocused();
        check("dialog title focused", true);
        check("background inert", (await center.locator(":scope > [inert]").count()) > 0);
        await expect(dialog).toHaveAttribute("aria-modal", "true");
        await expect(dialog).toHaveAttribute("aria-describedby", "configuration-version-description");
        await expect(dialog.getByText(versionDialogCopy.description)).toBeVisible();
        await expect(dialog.getByText(versionDialogCopy.privacy)).toBeVisible();

        if (scene.loading) {
          await expect(dialog.getByRole("heading", { name: "正在读取配置历史" })).toBeVisible();
          await expect(dialog.locator('[aria-busy="true"]')).toBeVisible();
          check("rollback reason hidden", await dialog.getByLabel("回滚原因").count(), 0);
        } else if (scene.name === "empty") {
          await expect(dialog.getByRole("heading", { name: "还没有可显示的配置版本" })).toBeVisible();
          check("rollback reason hidden", await dialog.getByLabel("回滚原因").count(), 0);
        } else {
          await expect(dialog.getByText(`当前第 ${scene.currentVersion} 版`)).toBeVisible();
          await expect(dialog.getByText(`${scene.versions.length} 条历史`)).toBeVisible();
          const reason = dialog.getByLabel("回滚原因");
          await expect(reason).toHaveAttribute("minlength", "2");
          await expect(reason).toHaveAttribute("maxlength", "500");
          await expect(reason).toHaveAttribute("aria-describedby", "configuration-rollback-help");
          if (scene.invalidReason) {
            await reason.fill("短");
            check("all restore actions disabled", await dialog.locator("button", { hasText: "恢复第" }).evaluateAll((buttons) => buttons.every((button) => button.disabled)));
          }
          if (scene.name === "history") {
            for (const text of ["30 分钟", "45 分钟", "20000 毫秒", "30000 毫秒", "3 次", "2 次", "停用", "启用", "未设置"])
              await expect(dialog.getByText(text, { exact: true }).first()).toBeVisible();
            await expect(dialog.getByRole("button", { name: "恢复第 2 版" })).toBeEnabled();
            await expect(dialog.getByRole("button", { name: "恢复第 1 版" })).toBeEnabled();
          }
          if (scene.name === "no-visible-change")
            check("two no-diff messages", await dialog.getByText("与上一版本的可见采集设置一致。").count(), 2);
        }

        check("no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        const close = dialog.getByRole("button", { name: "关闭", exact: true }),
          closeIcon = dialog.getByRole("button", { name: `关闭 ${fixtureData.setup[0].name} 配置历史` });
        check(
          "44px representative controls",
          await Promise.all(
            [closeIcon, close, ...(scene.loading || scene.name === "empty" ? [] : [dialog.getByLabel("回滚原因")])].map(async (locator) => {
              const box = await locator.boundingBox();
              return Boolean(box && box.height >= 44);
            }),
          ),
          scene.loading || scene.name === "empty" ? [true, true] : [true, true, true],
        );
        await picture("top");
        if (width <= 760 && ["history", "reason-required", "no-visible-change"].includes(scene.name)) {
          await dialog.locator(".p48-source-versions-panel").evaluate((panel) => {
            panel.scrollTop = panel.scrollHeight;
          });
          await picture("history-bottom");
        }

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
        if (scene.loading) releaseVersions?.();
        check("one source GET", requests.filter((request) => request.key.endsWith("provider-sources")).length, 1);
        check("one versions GET", requests.filter((request) => request.key.endsWith("/configuration/versions")).length, 1);
        check("no write requests", requests.filter((request) => !request.key.startsWith("GET ")).length, 0);
        check("no request bodies", requests.every((request) => request.body == null));
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        runs.push({ width, scene: scene.name, checks, requests });
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
    kind: "P48-SOURCE-VERSIONS-REVIEW-r1",
    generatedAt: new Date().toISOString(),
    reviewOnly: true,
    productionChanged: false,
    deployed: false,
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
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P48 配置历史评审</title><style>body{margin:0;padding:24px;background:#e9eef6;color:#172033;font:14px system-ui}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}figure{margin:0;padding:12px;border-radius:16px;background:white;box-shadow:0 8px 24px #18243b1f}img{display:block;width:100%;height:auto;border-radius:10px}figcaption{padding-top:10px}</style><h1>P48 配置历史与回滚 · 实际 Vue r1</h1><main>${cards}</main></html>`,
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
