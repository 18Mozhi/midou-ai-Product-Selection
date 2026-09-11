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
  compatibilityCopy,
  previewProviderCompatibilityDialog,
} from "./lib/ui-phase2-provider-compatibility-preview.mjs";

assert.ok(process.argv.slice(2).every((argument) => argument === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p48-compatibility-review",
  component = "apps/web/src/components/ProviderCompatibilityMatrixDialog.vue",
  pageCss = "design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-page-preview.css",
  dialogCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-compatibility-preview.css",
  fixture = "tests/e2e/m03-07-provider-sources.spec.ts",
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  source = await read(component),
  replacement = previewProviderCompatibilityDialog(source);

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
    ["navigation", "automatic"].map(declarationSource).join("\n") +
      "\nglobalThis.data={navigation:navigation('platform_admin'),automatic};",
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  box,
);
const fixtureData = JSON.parse(JSON.stringify(box.data)),
  provider = fixtureData.automatic[136],
  row = (status, fingerprint, overrides = {}) => ({
    parser_version: "structured-public-page-v1",
    page_version_sha256: fingerprint.repeat(64),
    status,
    observation_count: 3,
    succeeded_count: status === "compatible" ? 3 : status === "unverified" ? 0 : 1,
    parser_failure_count: status === "compatible" || status === "unverified" ? 0 : 2,
    last_observed_at: "2026-08-21T08:00:00.000Z",
    ...overrides,
  }),
  compatible = row("compatible", "a"),
  incompatible = row("incompatible", "b", { observation_count: 5, parser_failure_count: 4 }),
  mixed = row("mixed", "c", { observation_count: 6, succeeded_count: 4 }),
  unverified = row("unverified", "d", { observation_count: 1 }),
  scenes = [
    { name: "loading", loading: true, rows: [] },
    { name: "compatible", rows: [compatible] },
    { name: "incompatible", rows: [incompatible] },
    { name: "mixed", rows: [mixed] },
    { name: "unverified", rows: [unverified] },
    {
      name: "all-statuses",
      rows: [
        compatible,
        incompatible,
        mixed,
        {
          ...unverified,
          parser_version:
            "structured-public-page-parser-v2026.09.11-compatibility-candidate-test-fixture",
          last_observed_at: "2026-09-11T05:30:00.000Z",
        },
      ],
    },
    { name: "empty", rows: [] },
    { name: "adapter-version-missing", rows: [compatible], adapterVersion: null },
    { name: "summary-missing", rows: [], summaryMissing: true },
    { name: "service-failed", rows: [], serviceFailure: true },
  ],
  loadedSources = new Set([
    component,
    pageCss,
    dialogCss,
    fixture,
    "scripts/lib/ui-phase2-provider-compatibility-preview.mjs",
    "scripts/verify-ui-phase2-provider-compatibility.mjs",
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
        name: "p48-compatibility-review-only",
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
          if (normalized !== path.resolve(component).replaceAll("\\", "/")) return null;
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
            .replace("<body>", '<body class="p48-source-page-review p48-compatibility-review">')
            .replace("</head>", `${styles}</head>`);
        },
      },
    ],
  });
  await server.listen();
  console.log(`P48 compatibility ${origin}`);

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
        let releaseCompatibility;
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
            "GET /api/v1/platform/provider-adapters",
          ];
          if (!allowed.includes(key)) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, body: request.postData() });
          if (url.pathname.endsWith("/me/navigation"))
            return route.fulfill({ json: { data: fixtureData.navigation, request_id: "p48-nav" } });
          if (url.pathname.endsWith("/auth/session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          if (url.pathname.endsWith("/provider-sources"))
            return route.fulfill({ json: { data: [provider], request_id: "p48-sources" } });
          if (scene.loading)
            await new Promise((resolve) => {
              releaseCompatibility = resolve;
            });
          if (scene.serviceFailure)
            return route.fulfill({
              status: 503,
              json: {
                error: {
                  code: "dependency_unavailable",
                  message: "兼容观测服务暂不可用",
                  action_hint: "稍后重新打开此任务窗读取。",
                },
                request_id: "p48-compatibility-failed",
                trace_id: "p48-compatibility-failed",
              },
            });
          const summaries = scene.summaryMissing
            ? []
            : [
                {
                  id: provider.provisioned.id,
                  adapter_version:
                    scene.adapterVersion === null ? null : "structured-public-page-adapter-v1",
                  compatibility_matrix: scene.rows,
                },
              ];
          return route.fulfill({
            json: { data: summaries, request_id: `p48-${scene.name}` },
          });
        });

        await page.goto(origin + "/platform-admin/providers/sources");
        const trigger = page.getByRole("button", { name: "解析兼容矩阵" }),
          center = page.locator(".source-center");
        await expect(trigger).toBeVisible();
        await trigger.focus();
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog", { name: `解析兼容矩阵 · ${provider.name}` }),
          heading = dialog.getByRole("heading", { name: `解析兼容矩阵 · ${provider.name}` });
        await expect(dialog).toBeVisible();
        await expect(heading).toBeFocused();
        check("dialog title focused", true);
        check("background inert", (await center.locator(":scope > [inert]").count()) > 0);
        await expect(dialog).toHaveAttribute("aria-modal", "true");
        await expect(dialog).toHaveAttribute("aria-describedby", "compatibility-description");
        await expect(dialog.getByText(compatibilityCopy.description)).toBeVisible();
        await expect(dialog.getByText(compatibilityCopy.boundary)).toBeVisible();

        if (scene.loading) {
          await expect(dialog.getByRole("heading", { name: "正在汇总真实页面版本" })).toBeVisible();
          await expect(dialog.locator('[aria-busy="true"]')).toBeVisible();
          check("ledger hidden while loading", await dialog.locator("table").count(), 0);
          releaseCompatibility?.();
          await expect(dialog.locator('[aria-busy="true"]')).toHaveCount(0);
        } else if (scene.serviceFailure || scene.summaryMissing) {
          await expect(dialog.getByRole("heading", { name: "暂时无法读取兼容矩阵" })).toBeVisible();
          await expect(
            dialog.getByText(
              scene.serviceFailure
                ? "稍后重新打开此任务窗读取。"
                : "当前来源没有对应的采集程序观测。",
            ),
          ).toBeVisible();
          check("ledger hidden on error", await dialog.locator("table").count(), 0);
        } else if (scene.name === "empty") {
          await expect(
            dialog.getByRole("heading", { name: "尚无可比较的真实页面版本" }),
          ).toBeVisible();
          check("ledger hidden when empty", await dialog.locator("table").count(), 0);
        } else {
          const table = dialog.locator("table");
          await expect(table).toBeVisible();
          check("matrix row count", await table.locator("tbody tr").count(), scene.rows.length);
          for (const label of [
            "页面版本",
            "状态",
            "解析器版本",
            "观测次数",
            "成功 / 失败",
            "最近观测",
          ])
            await expect(table.locator("thead th").filter({ hasText: label })).toHaveCount(1);
          for (const currentRow of scene.rows) {
            await expect(
              dialog.getByText(`sha256:${currentRow.page_version_sha256.slice(0, 12)}`),
            ).toBeVisible();
            await expect(
              dialog.getByText(currentRow.page_version_sha256, { exact: true }),
            ).not.toBeVisible();
          }
          const expectedTitle = scene.rows.some((item) => item.status === "incompatible")
            ? "存在解析不兼容的页面版本"
            : scene.rows.some((item) => item.status === "mixed")
              ? "存在结果不一致的页面版本"
              : scene.rows.some((item) => item.status === "unverified")
                ? "仍有页面版本待验证"
                : "留存观测均显示兼容";
          await expect(dialog.getByRole("heading", { name: expectedTitle })).toBeVisible();
          if (scene.name === "adapter-version-missing")
            await expect(dialog.getByText("采集程序版本未提供")).toBeVisible();
          else
            await expect(
              dialog.getByText("采集程序 structured-public-page-adapter-v1"),
            ).toBeVisible();
          for (const text of ["已兼容", "解析不兼容", "结果不一致", "待验证"])
            if (
              scene.rows.some(
                (item) =>
                  item.status ===
                  {
                    已兼容: "compatible",
                    解析不兼容: "incompatible",
                    结果不一致: "mixed",
                    待验证: "unverified",
                  }[text],
              )
            )
              await expect(table.locator("i").filter({ hasText: text })).toBeVisible();
        }

        check(
          "no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        );
        const panelFits = await dialog
          .locator(".p48-compatibility-panel")
          .evaluate((panel) => panel.scrollWidth <= panel.clientWidth);
        check("dialog has no horizontal scroll", panelFits);
        const close = dialog.getByRole("button", { name: "关闭", exact: true }),
          closeIcon = dialog.getByRole("button", {
            name: `关闭 ${provider.name} 解析兼容矩阵`,
          }),
          representative = [closeIcon, close];
        if (!scene.loading && scene.rows.length)
          representative.push(dialog.getByText("完整指纹").first());
        check(
          "44px representative controls",
          await Promise.all(
            representative.map(async (locator) => {
              const bounds = await locator.boundingBox();
              return Boolean(bounds && bounds.height >= 44);
            }),
          ),
          representative.map(() => true),
        );
        await heading.evaluate((element) => element.focus({ preventScroll: true }));
        await page.evaluate(() => window.scrollTo(0, 0));
        await dialog.locator(".p48-compatibility-panel").evaluate((panel) => {
          panel.scrollTop = 0;
        });
        await picture("top");
        if (width <= 760 && scene.name === "all-statuses") {
          const detail = dialog.getByText("完整指纹").first();
          await detail.click();
          await detail.scrollIntoViewIfNeeded();
          check(
            "expanded fingerprint has no horizontal scroll",
            await dialog
              .locator(".p48-compatibility-panel")
              .evaluate((panel) => panel.scrollWidth <= panel.clientWidth),
          );
          await picture("fingerprint-detail");
          await expect(
            dialog.getByText(compatible.page_version_sha256, { exact: true }),
          ).toBeVisible();
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
        check(
          "one source GET",
          requests.filter((request) => request.key.endsWith("provider-sources")).length,
          1,
        );
        check(
          "expected adapter GET count",
          requests.filter((request) => request.key.endsWith("provider-adapters")).length,
          scene.serviceFailure ? 3 : 1,
        );
        check(
          "no write requests",
          requests.filter((request) => !request.key.startsWith("GET ")).length,
          0,
        );
        check(
          "no request bodies",
          requests.every((request) => request.body == null),
        );
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        runs.push({
          width,
          scene: scene.name,
          fixtureKind: "synthetic-review-fixture",
          checks,
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
    kind: "P48-COMPATIBILITY-REVIEW-r1",
    generatedAt: new Date().toISOString(),
    reviewOnly: true,
    fixtureNotice:
      "All provider, adapter, parser, fingerprint, count, status, and time values are synthetic review fixtures.",
    productionChanged: false,
    deployed: false,
    processesClosed: true,
    layoutMechanicalScan: {
      status: "not_run",
      reason: "The optional impeccable package install produced no output and was terminated.",
      substituteChecks: [
        "PostCSS selector isolation",
        "multi-viewport rendering",
        "horizontal overflow",
        "keyboard order",
        "44px target size",
      ],
    },
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
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P48 解析兼容矩阵评审</title><style>body{margin:0;padding:24px;background:#e9eef6;color:#172033;font:14px system-ui}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}figure{margin:0;padding:12px;border-radius:16px;background:white;box-shadow:0 8px 24px #18243b1f}img{display:block;width:100%;height:auto;border-radius:10px}figcaption{padding-top:10px}</style><h1>P48 解析兼容矩阵 · 实际 Vue r1</h1><p>全部数据均为本地合成评审样例，不代表生产页面版本、解析结果或来源状态。</p><main>${cards}</main></html>`,
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
