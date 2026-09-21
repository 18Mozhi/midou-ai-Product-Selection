import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { previewCommercialCreate } from "./lib/ui-phase2-commercial-create-preview.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p58-create-current-review",
  component = "apps/web/src/components/CommercialOperationsCenter.vue",
  fixture = "tests/e2e/m06-06-commercial.spec.ts",
  css = "design-plans/ui-phase-2-2026-09-07/implementation/commercial-create-preview.css";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const source = await read(component),
  preview = previewCommercialCreate(source);
const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true);
const dataNodes = [],
  navigationNodes = [];
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "data")
    dataNodes.push(node.initializer);
  if (
    ts.isObjectLiteralExpression(node) &&
    node.properties.some(
      (prop) =>
        ts.isPropertyAssignment(prop) &&
        prop.name.getText(ast) === "shell" &&
        prop.initializer.getText(ast) === '"platform_admin"',
    )
  )
    navigationNodes.push(node);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(dataNodes.length, 1);
assert.equal(navigationNodes.length, 1);
const box = {};
vm.runInNewContext(
  ts.transpileModule(
    `globalThis.fixtures={data:${dataNodes[0].getText(ast)},navigation:${navigationNodes[0].getText(ast)}}`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  box,
);
const fixtures = JSON.parse(JSON.stringify(box.fixtures));
const sources = new Set([
  component,
  fixture,
  css,
  "scripts/verify-ui-phase2-commercial-create.mjs",
  "scripts/lib/ui-phase2-commercial-create-preview.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
]);
const runs = [],
  screenshots = [],
  ports = [];
let browser, server;
try {
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const mode of ["baseline", "review"]) {
    server = await createServer({
      configFile: path.resolve("apps/web/vite.config.ts"),
      logLevel: "error",
      define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
      server: { host: "127.0.0.1", port: 0, proxy: {}, hmr: false },
      plugins:
        mode === "baseline"
          ? []
          : [
              {
                name: "p58-draft-review-only",
                enforce: "pre",
                transform(text, id) {
                  if (id.replaceAll("\\", "/") !== path.resolve(component).replaceAll("\\", "/"))
                    return null;
                  assert.equal(text.replaceAll("\r\n", "\n"), source);
                  return { code: preview, map: null };
                },
                transformIndexHtml(html) {
                  return html
                    .replace("<body>", '<body class="p58-draft-review">')
                    .replace(
                      "</head>",
                      `<link rel="stylesheet" href="/@fs/${path.resolve(css).replaceAll("\\", "/")}"></head>`,
                    );
                },
              },
            ],
    });
    await server.listen();
    const port = server.httpServer.address().port,
      origin = `http://127.0.0.1:${port}`;
    ports.push(port);
    console.log(`P58 create ${mode} ${origin}`);
    for (const width of [390, 760, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage(),
          requests = [],
          unexpected = [],
          errors = [],
          checks = [];
        const check = (name, actual, expected = true) => {
          assert.deepEqual(actual, expected, `${mode}/${width}:${name}`);
          checks.push({ name, actual });
        };
        await page.clock.install({ time: new Date("2026-09-12T06:00:00Z") });
        await page.clock.setFixedTime(new Date("2026-09-12T06:00:00Z"));
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/*", (route) => {
          const req = route.request(),
            url = new URL(req.url()),
            key = `${req.method()} ${url.pathname}`;
          if (url.origin !== origin) {
            unexpected.push(key);
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          if (
            ![
              "GET /api/v1/me/navigation",
              "GET /api/v1/auth/session-status",
              "GET /api/v1/platform/commercial",
            ].includes(key)
          ) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, body: req.postData() });
          return route.fulfill({
            json: {
              data: url.pathname.endsWith("navigation")
                ? fixtures.navigation
                : url.pathname.endsWith("session-status")
                  ? { authenticated: true }
                  : fixtures.data,
              request_id: "p58-local-create-review",
            },
          });
        });
        await page.goto(origin + "/platform-admin/commercial?organization_id=o1");
        const trigger = page.getByRole("button", { name: "新建配额方案", exact: true }),
          dialog = page.getByRole("dialog", { name: "新建配额方案", exact: true });
        await expect(page.getByText("380 / 1050")).toBeVisible();
        const background = await page.locator(".commercial").screenshot({ animations: "disabled" });
        await trigger.focus();
        await page.keyboard.press("Enter");
        await expect(dialog).toBeVisible();
        check("native modal open", await dialog.evaluate((el) => el.matches(":modal")));
        check("seven original fields", await dialog.locator("input,textarea").count(), 7);
        check("three original buttons", await dialog.getByRole("button").count(), 3);
        check(
          "initial focus remains in dialog",
          await dialog.evaluate((el) => el.contains(document.activeElement)),
        );
        check(
          "no dialog horizontal overflow",
          await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        );
        if (mode === "review")
          check(
            "all controls have44px height",
            await dialog
              .locator("input,textarea,button")
              .evaluateAll((els) => els.every((el) => el.getBoundingClientRect().height >= 44)),
          );
        check(
          "original quota defaults",
          await dialog
            .locator('input[type="number"]')
            .evaluateAll((els) => els.map((el) => el.value)),
          ["100", "1000", "20"],
        );
        const picture = async (suffix) => {
          if (!capture) return;
          const bytes = await dialog.screenshot({ animations: "disabled" }),
            file = `${mode}-${width}-${suffix}.png`;
          await writeFile(`${output}/${file}`, bytes);
          screenshots.push({
            file,
            mode,
            width,
            suffix,
            sha256: hash(bytes),
            pixelWidth: bytes.readUInt32BE(16),
            pixelHeight: bytes.readUInt32BE(20),
          });
        };
        const sequence = async (suffix) => {
          const size = await dialog.evaluate((el) => ({
            total: el.scrollHeight,
            height: el.clientHeight,
          }));
          let index = 0;
          for (let offset = 0; ; offset += Math.max(100, size.height - 80)) {
            const target = Math.min(offset, Math.max(0, size.total - size.height));
            await dialog.evaluate((el, y) => (el.scrollTop = y), target);
            await picture(`${suffix}-part${++index}`);
            if (target >= size.total - size.height) break;
          }
        };
        await page.evaluate(() => document.fonts.ready);
        await sequence("empty");
        const code = dialog.getByLabel("内部标识", { exact: true });
        const patternResults = [];
        for (const value of ["basic_2026", "basic-2026", "a", "Basic", "bad code", "_bad"]) {
          await code.fill(value);
          patternResults.push({
            value,
            mismatch: await code.evaluate((el) => el.validity.patternMismatch),
          });
        }
        if (mode === "review")
          check(
            "intended code alphabet enforced",
            patternResults.map((v) => v.mismatch),
            [false, false, false, true, true, true],
          );
        checks.push({ name: "observed native pattern results", actual: patternResults });
        await code.fill("basic_2026");
        await dialog.getByLabel("方案名称", { exact: true }).fill("审核样例配额方案");
        await dialog
          .getByLabel("方案说明", { exact: true })
          .fill("本地审核样例：核对资料与基础配额，不涉及价格或收费。");
        await dialog.getByLabel("创建原因", { exact: true }).fill("验证创建窗字段排列");
        await sequence("filled");
        const close = dialog.getByRole("button", { name: "关闭新建配额方案" }),
          submit = dialog.getByRole("button", { name: "创建草稿", exact: true });
        await submit.focus();
        for (const [direction, target, name] of [
          ["Tab", close, "forward"],
          ["Shift+Tab", submit, "reverse"],
        ]) {
          const path = [];
          for (let step = 0; step < 3; step++) {
            await page.keyboard.press(direction);
            const tag = await page.evaluate(() => document.activeElement?.tagName);
            path.push(tag);
            if (await target.evaluate((el) => document.activeElement === el)) break;
            assert.ok(["BODY", "DIALOG"].includes(tag), `${name}: unexpected focus ${tag}`);
          }
          checks.push({ name: `native ${name} focus path`, actual: path });
          await expect(target).toBeFocused();
          check(`${name} returns within three native stops`, true);
        }
        await picture("submit-focus");
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
        await expect(trigger).toBeFocused();
        check("escape returns focus", true);
        await page.keyboard.press("Enter");
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: "取消", exact: true }).click();
        await expect(trigger).toBeFocused();
        check("cancel returns focus", true);
        check(
          "one commercial GET",
          requests.filter((r) => r.key.endsWith("/commercial")).length,
          1,
        );
        check("no write requests", requests.filter((r) => !r.key.startsWith("GET ")).length, 0);
        check(
          "no request bodies",
          requests.every((r) => r.body === null),
        );
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        // Retain a raw image digest for later neighboring-page comparisons, not approval.
        runs.push({ mode, width, checks, requests, backgroundSha256: hash(background) });
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
    await server.close();
    server = null;
  }
  await includeImportedStyleSources(sources, read);
  await browser.close();
  browser = null;
  if (capture) {
    await writeFile(
      `${output}/evidence.json`,
      JSON.stringify(
        {
          kind: "P58-CREATE-CURRENT-REVIEW-r1",
          reviewOnly: true,
          userReview: "pending",
          processesClosed: true,
          ports,
          runs,
          screenshots,
          sourceHashes: Object.fromEntries(
            await Promise.all(
              [...sources].sort().map(async (file) => [file, hash(await read(file))]),
            ),
          ),
          boundary:
            "Actual App and existing E2E fixtures. Only create-dialog presentation/help and equivalent HTML-v pattern escaping in review. Production/GET/POST/API/permissions unchanged; no submit or real writes, no busy/error/save/complete-page acceptance.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P58 创建窗审核</title><style>body{font:16px/1.6 sans-serif;margin:24px}img{max-width:100%;border:1px solid #ddd}article{margin:32px 0}</style><h1>P58 实际 Vue 创建窗 · C 方向</h1><p>本地样例，未提交。连续局部图覆盖滚动区域；不代表保存或完整页面验收。</p>' +
        screenshots
          .map(
            (s) =>
              `<article><h2>${s.file}</h2><img loading="lazy" alt="${s.file}" src="${s.file}"></article>`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((n, r) => n + r.checks.length, 0),
      images: screenshots.length,
      sources: sources.size,
      ports,
    }),
  );
} finally {
  await browser?.close();
  await server?.close();
}
