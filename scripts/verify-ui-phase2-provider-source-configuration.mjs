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
  configurationDialogCopy,
  previewProviderSourceConfiguration,
} from "./lib/ui-phase2-provider-source-configuration-preview.mjs";

assert.ok(process.argv.slice(2).every((argument) => argument === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p48-source-configuration-review",
  component = "apps/web/src/components/ProviderSourceConfigurationDialog.vue",
  pageCss = "design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-page-preview.css",
  dialogCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-source-configuration-preview.css",
  fixture = "tests/e2e/m03-07-provider-sources.spec.ts",
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  source = await read(component),
  replacement = previewProviderSourceConfiguration(source);

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
    ["navigation", "automatic", "setup"].map(declarationSource).join("\n") +
      "\nglobalThis.data={navigation:navigation('platform_admin'),automatic,setup};",
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  box,
);
const fixtureData = JSON.parse(JSON.stringify(box.data)),
  scenes = [
    {
      name: "authenticated-disabled",
      item: fixtureData.setup[0],
      statusLabel: "来源设置状态",
      status: "disabled",
      action: "保存配置",
      smoke: false,
    },
    {
      name: "public-smoke-enable",
      item: {
        ...fixtureData.automatic[0],
        provisioned: {
          ...fixtureData.automatic[0].provisioned,
          status: "disabled",
          schedule_minutes: 15,
          timeout_ms: 20_000,
          retry_limit: 3,
          updated_at: "2026-09-11T05:00:00.000Z",
          concurrency_snapshot: { configured_limit: 1, active_subquery_count: 1 },
        },
      },
      statusLabel: "运行状态",
      status: "enabled",
      action: "烟测并启用",
      smoke: true,
    },
  ],
  loadedSources = new Set([
    component,
    pageCss,
    dialogCss,
    fixture,
    "scripts/lib/ui-phase2-provider-source-configuration-preview.mjs",
    "scripts/verify-ui-phase2-provider-source-configuration.mjs",
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
        name: "p48-source-configuration-review-only",
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
            .replace(
              "<body>",
              '<body class="p48-source-page-review p48-source-configuration-review">',
            )
            .replace("</head>", `${styles}</head>`);
        },
      },
    ],
  });
  await server.listen();
  console.log(`P48 source configuration ${origin}`);

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
          if (
            ![
              "GET /api/v1/me/navigation",
              "GET /api/v1/auth/session-status",
              "GET /api/v1/platform/provider-sources",
            ].includes(key)
          ) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, body: request.postData() });
          if (url.pathname.endsWith("/me/navigation"))
            return route.fulfill({ json: { data: fixtureData.navigation, request_id: "p48-nav" } });
          if (url.pathname.endsWith("/auth/session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          return route.fulfill({
            json: { data: [scene.item], request_id: `p48-${scene.name}` },
          });
        });

        await page.goto(origin + "/platform-admin/providers/sources");
        const editButton = page.getByRole("button", { name: "编辑采集设置" }),
          center = page.locator(".source-center");
        await expect(editButton).toBeVisible();
        await editButton.focus();
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog", {
            name: `${configurationDialogCopy.titlePrefix} · ${scene.item.name}`,
          }),
          heading = dialog.getByRole("heading", {
            name: `${configurationDialogCopy.titlePrefix} · ${scene.item.name}`,
          });
        await expect(dialog).toBeVisible();
        await expect(heading).toBeFocused();
        check("dialog title focused", true);
        check("background inert", (await center.locator(":scope > [inert]").count()) > 0);
        await expect(dialog).toHaveAttribute("aria-modal", "true");
        await expect(dialog).toHaveAttribute("aria-describedby", "source-edit-description");
        await expect(dialog.getByText(configurationDialogCopy.description)).toBeVisible();

        const schedule = dialog.getByLabel("采集频率（分钟）"),
          timeout = dialog.getByLabel("单次超时（毫秒）"),
          retry = dialog.getByLabel("失败重试次数"),
          status = dialog.getByLabel(scene.statusLabel),
          reason = dialog.getByLabel("变更原因");
        await expect(schedule).toHaveValue(String(scene.item.provisioned.schedule_minutes));
        await expect(timeout).toHaveValue(String(scene.item.provisioned.timeout_ms));
        await expect(retry).toHaveValue(String(scene.item.provisioned.retry_limit));
        await expect(schedule).toHaveAttribute("aria-describedby", "source-edit-schedule-help");
        await expect(timeout).toHaveAttribute("aria-describedby", "source-edit-timeout-help");
        await expect(retry).toHaveAttribute("aria-describedby", "source-edit-retry-help");
        await expect(reason).toHaveAttribute("aria-describedby", "source-edit-reason-help");
        check(
          "numeric constraints",
          await dialog.evaluate((element) => {
            const values = [...element.querySelectorAll('input[type="number"]')].map((input) => ({
              min: input.getAttribute("min"),
              max: input.getAttribute("max"),
              step: input.getAttribute("step"),
            }));
            return values;
          }),
          [
            { min: "1", max: "10080", step: "1" },
            { min: "1000", max: "120000", step: "1" },
            { min: "0", max: "10", step: "1" },
          ],
        );
        await status.selectOption(scene.status);
        await expect(status).toHaveValue(scene.status);
        await expect(dialog.getByRole("button", { name: scene.action })).toBeVisible();
        check("smoke notice visibility", await dialog.locator(".p48-source-configuration-smoke").isVisible(), scene.smoke);
        if (scene.smoke) {
          await expect(
            dialog.getByRole("heading", { name: "将先保存停用版，再执行真实页面烟测" }),
          ).toBeVisible();
          await expect(dialog.getByText("刚才保存的停用配置仍会保留", { exact: false })).toBeVisible();
          await expect(dialog.getByText("1 / 1")).toBeVisible();
        }
        check("form validity", await dialog.locator("form").evaluate((form) => form.checkValidity()));
        check(
          "no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        );
        check(
          "44px representative controls",
          await Promise.all(
            [schedule, status, dialog.getByRole("button", { name: scene.action })].map(async (locator) => {
              const box = await locator.boundingBox();
              return Boolean(box && box.height >= 44);
            }),
          ),
          [true, true, true],
        );
        await picture("top");
        if (width <= 760) {
          await reason.scrollIntoViewIfNeeded();
          await picture("reason-actions");
        }

        const closeButton = dialog.getByRole("button", { name: `关闭 ${scene.item.name} 采集设置` }),
          actionButton = dialog.getByRole("button", { name: scene.action });
        await closeButton.focus();
        await page.keyboard.press("Shift+Tab");
        await expect(actionButton).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(closeButton).toBeFocused();
        check("tab loop stays in dialog", true);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(editButton).toBeFocused();
        check("escape restores trigger", true);
        check("background inert cleared", await center.locator(":scope > [inert]").count(), 0);
        check("one source GET", requests.filter((request) => request.key.endsWith("provider-sources")).length, 1);
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
    kind: "P48-SOURCE-CONFIGURATION-REVIEW-r1",
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
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P48 编辑采集设置评审</title><style>body{margin:0;padding:24px;background:#e9eef6;color:#172033;font:14px system-ui}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}figure{margin:0;padding:12px;border-radius:16px;background:white;box-shadow:0 8px 24px #18243b1f}img{display:block;width:100%;height:auto;border-radius:10px}figcaption{padding-top:10px}</style><h1>P48 编辑采集设置 · 实际 Vue r1</h1><main>${cards}</main></html>`,
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
