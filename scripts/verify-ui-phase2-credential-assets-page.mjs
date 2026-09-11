import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p50-credential-page-review",
  component = "apps/web/src/components/CredentialAssetCenter.vue",
  css = "design-plans/ui-phase-2-2026-09-07/implementation/credential-assets-page-preview.css",
  fixture = "tests/e2e/m03-02-credential-assets.spec.ts",
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex");

const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true),
  declarations = [];
function visit(node) {
  if (ts.isVariableDeclaration(node)) declarations.push(node);
  ts.forEachChild(node, visit);
}
visit(ast);
const sourceFor = (name) => {
    const matches = declarations.filter((node) => node.name.getText(ast) === name);
    assert.equal(matches.length, 1, `fixture declaration ${name}`);
    return `const ${name}=${matches[0].initializer.getText(ast)};`;
  },
  box = {};
vm.runInNewContext(
  ts.transpileModule(
    ["provider", "secondProvider", "asset", "profile", "navigation"].map(sourceFor).join("\n") +
      "\nglobalThis.data={provider,secondProvider,asset,profile,navigation};",
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  box,
);
const data = JSON.parse(JSON.stringify(box.data)),
  widths = [390, 760, 1024, 1440],
  sources = new Set([
    component,
    css,
    fixture,
    "scripts/verify-ui-phase2-credential-assets-page.mjs",
    "apps/web/index.html",
    "apps/web/vite.config.ts",
  ]),
  runs = [],
  screenshots = [],
  ports = [];
const collectLoadedSource = {
  name: "p50-credential-page-source-collector",
  enforce: "pre",
  transform(_code, id) {
    const bare = id.split("?", 1)[0];
    if (!path.isAbsolute(bare)) return null;
    const relative = path.relative(process.cwd(), bare).replaceAll("\\", "/");
    if (
      !relative.includes("/node_modules/") &&
      (relative.startsWith("apps/") || relative.startsWith("packages/"))
    )
      sources.add(relative);
    return null;
  },
};

let browser, server;
try {
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const mode of ["baseline", "review"]) {
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
        collectLoadedSource,
        ...(mode === "baseline"
          ? []
          : [
              {
                name: "p50-credential-page-review-only",
                transformIndexHtml(html) {
                  return html
                    .replace("<body>", '<body class="p50-credential-page-review">')
                    .replace(
                      "</head>",
                      `<link rel="stylesheet" href="/@fs/${path.resolve(css).replaceAll("\\", "/")}"></head>`,
                    );
                },
              },
            ]),
      ],
    });
    await server.listen();
    console.log(`P50 credential page ${mode} ${origin}`);
    const runWidths = mode === "baseline" ? [390, 1440] : widths;
    for (const width of runWidths) {
      const context = await browser.newContext({
        viewport: { width, height: width <= 760 ? 1100 : 1200 },
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
          },
          picture = async (suffix, fullPage = false) => {
            if (!capture) return;
            const file = `${mode}-${width}-${suffix}.png`,
              bytes = await page.screenshot({
                fullPage,
                animations: "disabled",
                caret: "hide",
              });
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
        await page.clock.install({ time: new Date("2026-09-11T06:00:00Z") });
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/*", (route) => {
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
              "GET /api/v1/platform/credential-assets",
              "GET /api/v1/platform/crawler-profiles",
              "GET /api/v1/platform/credential-provider-options",
            ].includes(key)
          ) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, body: request.postData() });
          if (url.pathname.endsWith("/me/navigation"))
            return route.fulfill({ json: { data: data.navigation, request_id: "p50-nav" } });
          if (url.pathname.endsWith("/auth/session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          if (url.pathname.endsWith("/credential-assets"))
            return route.fulfill({ json: { data: [data.asset], request_id: "p50-assets" } });
          if (url.pathname.endsWith("/crawler-profiles"))
            return route.fulfill({ json: { data: [data.profile], request_id: "p50-profiles" } });
          return route.fulfill({
            json: {
              data: [data.provider, data.secondProvider],
              request_id: "p50-providers",
            },
          });
        });
        await page.goto(origin + "/platform-admin/credentials");
        const center = page.locator(".credential-center");
        await expect(
          center.getByRole("heading", { name: "凭证与浏览器档案", level: 2 }),
        ).toBeVisible();
        await expect(center.getByRole("heading", { name: data.asset.name })).toBeVisible();
        await expect(center.getByText(data.asset.fingerprint, { exact: true })).toBeVisible();
        check("three metric facts", await center.locator(".credential-metrics article").count(), 3);
        check(
          "one credential asset",
          await center.locator(".credential-grid > article").count(),
          1,
        );
        check("one runtime profile", await center.locator(".profile-list > article").count(), 1);
        check(
          "two authenticated sources",
          await center.locator(".credential-compatibility tbody tr").count(),
          2,
        );
        check(
          "no secret values in rendered text",
          await center.evaluate((element) =>
            [
              "secret-never",
              "cookie-value",
              "payload_ciphertext",
              "synthetic-no-real-cookie",
            ].every((value) => !element.textContent.includes(value)),
          ),
        );
        check(
          "three credential data GETs",
          requests.filter((request) => request.key.includes("/api/v1/platform/")).length,
          3,
        );
        check(
          "all requests are GET without bodies",
          requests.every((request) => request.key.startsWith("GET ") && request.body === null),
        );
        const loginButton = center.getByRole("button", { name: "配置网页登录", exact: true });
        await loginButton.focus();
        await expect(loginButton).toBeFocused();
        checks.push({
          name: "header action computed styles",
          actual: await center.locator(".credential-primary-actions").evaluate((container) => ({
            container: {
              backgroundColor: getComputedStyle(container).backgroundColor,
              backgroundImage: getComputedStyle(container).backgroundImage,
              beforeBackground: getComputedStyle(container, "::before").background,
            },
            controls: [...container.children].map((element) => ({
              text: element.textContent.trim(),
              backgroundColor: getComputedStyle(element).backgroundColor,
              backgroundImage: getComputedStyle(element).backgroundImage,
            })),
          })),
        });
        if (mode === "review") {
          check(
            "login action is44",
            await loginButton.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              return rect.width >= 44 && rect.height >= 44;
            }),
          );
          check(
            "login action is focal white",
            await loginButton.evaluate(
              (element) => getComputedStyle(element).backgroundColor === "rgb(255, 255, 255)",
            ),
          );
          check(
            "visible blue keyboard focus",
            await loginButton.evaluate(
              (element) => getComputedStyle(element).outlineStyle !== "none",
            ),
          );
        }
        check(
          "page has no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        );
        await page.evaluate(() => document.fonts.ready);
        await picture("default", true);

        await loginButton.click();
        const editor = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" }),
          editorPanel = editor.locator(".credential-editor.login-editor");
        await expect(editor).toBeVisible();
        await expect(editor.getByLabel("需要登录的来源")).toBeFocused();
        await expect(editor.getByLabel("需要登录的来源").locator("option:checked")).toHaveText(
          data.provider.name,
        );
        await expect(editor.locator(".login-provider-status strong")).toHaveText(
          data.provider.name,
        );
        check(
          "three import modes",
          await editor.getByLabel("导入方式").locator("option").allTextContents(),
          ["上传 Cookie 文件", "从当前浏览器读取", "完整浏览器档案"],
        );
        check(
          "file input exists but no file selected",
          await editor.locator('input[type="file"]').count(),
          1,
        );
        check(
          "no password field in login editor",
          await editor.locator('input[type="password"]').count(),
          0,
        );
        check(
          "save disabled before material",
          await editor.getByRole("button", { name: "加密保存并启用", exact: true }).isDisabled(),
        );
        check(
          "opening editor adds no request",
          requests.filter((request) => request.key.includes("/api/v1/platform/")).length,
          3,
        );
        if (mode === "review") {
          for (const [name, control] of [
            ["source", editor.getByLabel("需要登录的来源")],
            ["mode", editor.getByLabel("导入方式")],
            ["cancel", editor.getByRole("button", { name: "取消", exact: true })],
            ["save", editor.getByRole("button", { name: "加密保存并启用", exact: true })],
          ])
            check(
              `editor target44 ${name}`,
              await control.evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return rect.width >= 44 && rect.height >= 44;
              }),
            );
          check(
            "editor is single column on mobile",
            await editorPanel.evaluate(
              (element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
            ),
            width <= 760 ? 1 : 2,
          );
        }
        check(
          "editor has no horizontal overflow",
          await editorPanel.evaluate(
            (element) =>
              element.scrollWidth <= element.clientWidth + 1 &&
              document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
        );
        await picture("login-editor");
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        runs.push({ mode, width, checks, requests });
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
    server = undefined;
  }
} finally {
  if (server) await server.close();
  if (browser) await browser.close();
}

await new Promise((resolve) => setTimeout(resolve, 50));
const sourceHashes = {};
for (const file of [...sources].sort()) {
  try {
    sourceHashes[file] = hash(await read(file));
  } catch {}
}
const evidence = {
  kind: "P50-CREDENTIAL-PAGE-REVIEW-r1",
  generatedAt: new Date().toISOString(),
  reviewOnly: true,
  productionChanged: false,
  deployed: false,
  processesClosed: true,
  ports,
  runs,
  screenshots,
  sourceHashes,
  fixtureBoundary:
    "Provider, asset, profile and navigation values are parsed from the authoritative M03-02 E2E fixture. The browser routes only local GET responses; no real credential, Cookie, extension, API write, encryption, database or production data is accessed.",
  visualBoundary:
    "Actual App, ProviderRuntimeSurface and untransformed CredentialAssetCenter. Review-only CSS creates the P50 credential custody hierarchy and login editor composition without changing production SFC, events or contracts.",
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  const cards = screenshots
    .map(
      (shot) =>
        `<article><h2>${shot.mode} · ${shot.width}px · ${shot.suffix}</h2><a href="${shot.file}"><img src="${shot.file}" alt="${shot.mode} ${shot.width}px ${shot.suffix}"></a></article>`,
    )
    .join("");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P50 凭证与网页登录实际 Vue 评审</title><style>body{margin:0;padding:24px;background:#e9eef5;color:#142a46;font-family:sans-serif}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px}article{padding:14px;background:white;border:1px solid #cfd9e7}h1{grid-column:1/-1}h1,h2{margin:0 0 12px}h2{font-size:15px}img{display:block;width:100%;height:auto;border:1px solid #d8e0eb}</style><main><h1>P50 凭证与网页登录 · 实际 Vue 首批布局</h1>${cards}</main></html>`,
  );
}
console.log(
  JSON.stringify({
    runs: runs.length,
    checks: runs.reduce((sum, run) => sum + run.checks.length, 0),
    screenshots: screenshots.length,
    sources: Object.keys(sourceHashes).length,
    ports,
  }),
);
