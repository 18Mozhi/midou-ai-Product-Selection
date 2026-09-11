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
  output = "output/playwright/p50-credential-editor-focus-review",
  fixture = "tests/e2e/m03-02-credential-assets.spec.ts",
  reviewCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/credential-assets-page-preview.css",
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
  states = [
    {
      id: "asset-create",
      trigger: "新建凭证资产",
      dialog: "创建凭证资产",
      first: "所属来源",
      kind: "editor",
    },
    {
      id: "asset-rotate",
      trigger: "更新资料",
      dialog: `轮换 ${data.asset.name}`,
      first: "内容格式",
      kind: "editor",
    },
    {
      id: "profile",
      trigger: "关联运行档案",
      dialog: "创建浏览器档案引用",
      first: "网页登录档案",
      kind: "editor",
    },
    {
      id: "login",
      trigger: "配置网页登录",
      dialog: "导入已经登录的浏览器档案",
      first: "需要登录的来源",
      kind: "editor",
    },
    {
      id: "revoke",
      trigger: "撤销",
      dialog: "确认撤销凭证资产？",
      kind: "confirm",
    },
  ],
  sources = new Set([
    "apps/web/src/components/CredentialAssetCenter.vue",
    "apps/web/src/components/ConfirmDialog.vue",
    "apps/web/src/use-modal-dialog.ts",
    "apps/web/src/credential-assets.css",
    "apps/web/src/credential-login.css",
    reviewCss,
    fixture,
    "scripts/verify-ui-phase2-credential-editor-focus.mjs",
    "apps/web/index.html",
    "apps/web/vite.config.ts",
  ]),
  runs = [],
  screenshots = [];
const collectLoadedSource = {
  name: "p50-credential-editor-focus-source-collector",
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

const reservation = reservePort();
await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const origin = `http://127.0.0.1:${port}`;
let browser, server;
try {
  if (capture) await mkdir(output, { recursive: true });
  server = await createServer({
    configFile: path.resolve("apps/web/vite.config.ts"),
    logLevel: "error",
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
    server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
    plugins: [
      collectLoadedSource,
      {
        name: "p50-credential-editor-focus-review-only",
        transformIndexHtml(html) {
          return html
            .replace("<body>", '<body class="p50-credential-page-review">')
            .replace(
              "</head>",
              `<link rel="stylesheet" href="/@fs/${path.resolve(reviewCss).replaceAll("\\", "/")}"></head>`,
            );
        },
      },
    ],
  });
  await server.listen();
  browser = await chromium.launch();
  console.log(`P50 credential editor focus ${origin}`);
  for (const width of widths) {
    for (const state of states) {
      const context = await browser.newContext({
        viewport: { width, height: width <= 760 ? 1100 : 1000 },
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
          assert.deepEqual(actual, expected, `${width}/${state.id}:${name}`);
          checks.push({ name, actual });
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
            return route.fulfill({ json: { data: data.navigation, request_id: "p50-focus-nav" } });
          if (url.pathname.endsWith("/auth/session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          if (url.pathname.endsWith("/credential-assets"))
            return route.fulfill({ json: { data: [data.asset], request_id: "p50-focus-assets" } });
          if (url.pathname.endsWith("/crawler-profiles"))
            return route.fulfill({
              json: { data: [data.profile], request_id: "p50-focus-profiles" },
            });
          return route.fulfill({
            json: {
              data: [data.provider, data.secondProvider],
              request_id: "p50-focus-providers",
            },
          });
        });
        await page.goto(origin + "/platform-admin/credentials");
        const trigger = page.getByRole("button", { name: state.trigger, exact: true }).first();
        await trigger.focus();
        await trigger.click();
        const dialog = page.getByRole(state.kind === "editor" ? "dialog" : "alertdialog", {
          name: state.dialog,
        });
        await expect(dialog).toBeVisible();
        check("dialog accessible name", (await dialog.getAttribute("aria-labelledby")) !== null);
        if (state.kind === "editor") {
          check("native dialog tag", await dialog.evaluate((element) => element.tagName), "DIALOG");
          check("native dialog open", (await dialog.getAttribute("open")) !== null);
          check(
            "native modal top layer",
            await dialog.evaluate((element) => element.matches(":modal")),
          );
          await expect(dialog.getByLabel(state.first)).toBeFocused();
          check(
            "initial field has visible focus",
            await dialog.getByLabel(state.first).evaluate((element) => {
              const style = getComputedStyle(element);
              return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
            }),
          );
        } else {
          check("explicit aria modal", await dialog.getAttribute("aria-modal"), "true");
          await expect(dialog.getByRole("button", { name: "取消", exact: true })).toBeFocused();
          check(
            "custom confirmation is not native dialog",
            await dialog.evaluate((element) => element.tagName),
            "SECTION",
          );
        }
        const overflowMetrics = await dialog.evaluate((element) => ({
          panelScrollWidth:
            element.tagName === "DIALOG"
              ? element.firstElementChild?.scrollWidth
              : element.scrollWidth,
          panelClientWidth:
            element.tagName === "DIALOG"
              ? element.firstElementChild?.clientWidth
              : element.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          windowWidth: window.innerWidth,
        }));
        check(
          "dialog has no horizontal overflow",
          overflowMetrics.panelScrollWidth <= overflowMetrics.panelClientWidth + 1 &&
            overflowMetrics.documentScrollWidth <= overflowMetrics.windowWidth + 1,
        );
        check(
          "only local GET requests",
          requests.every((request) => request.key.startsWith("GET ") && request.body === null),
        );
        check(
          "three credential data GETs",
          requests.filter((request) => request.key.includes("/api/v1/platform/")).length,
          3,
        );
        if (capture) {
          const file = `${width}-${state.id}.png`,
            bytes = await page.screenshot({ animations: "disabled", caret: "hide" });
          await writeFile(`${output}/${file}`, bytes);
          screenshots.push({
            file,
            width,
            state: state.id,
            sha256: hash(bytes),
            pixelWidth: bytes.readUInt32BE(16),
            pixelHeight: bytes.readUInt32BE(20),
          });
        }
        const focusable = dialog.locator(
            "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
          ),
          firstFocusable = focusable.first(),
          lastFocusable = focusable.last();
        await firstFocusable.focus();
        await page.keyboard.press("Shift+Tab");
        await expect(lastFocusable).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(firstFocusable).toBeFocused();
        check("tab loop reaches both boundaries", true);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
        check("escape closes and restores trigger", true);
        if (state.id === "login") {
          await trigger.click();
          const reopened = page.getByRole("dialog", { name: state.dialog });
          await reopened.dispatchEvent("mousedown");
          await expect(reopened).toHaveCount(0);
          await expect(trigger).toBeFocused();
          check("backdrop closes and restores trigger", true);
        }
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        runs.push({ width, state: state.id, checks, requests });
      } finally {
        await context.close();
      }
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
  kind: "P50-CREDENTIAL-EDITOR-FOCUS-r1",
  generatedAt: new Date().toISOString(),
  reviewOnly: true,
  productionChanged: true,
  deployed: false,
  processesClosed: true,
  port,
  runs,
  screenshots,
  sourceHashes,
  fixtureBoundary:
    "Provider, asset, profile and navigation values are parsed from the authoritative M03-02 E2E fixture. Only local GET responses are fulfilled; no real secret, Cookie, API write, encryption, database or production data is accessed.",
  implementationBoundary:
    "The four credential editors use the production native dialog and shared useModalDialog focus-return behavior. The existing revoke confirmation remains the shared custom alertdialog. C-direction styling is injected only for review evidence.",
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  const cards = screenshots
    .map(
      (shot) =>
        `<article><h2>${shot.width}px · ${shot.state}</h2><a href="${shot.file}"><img src="${shot.file}" alt="${shot.width}px ${shot.state}"></a></article>`,
    )
    .join("");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P50 凭证弹窗焦点闭环</title><style>body{margin:0;padding:24px;background:#e9eef5;color:#142a46;font-family:sans-serif}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px}article{padding:14px;background:white;border:1px solid #cfd9e7}h1{grid-column:1/-1}h1,h2{margin:0 0 12px}h2{font-size:15px}img{display:block;width:100%;height:auto;border:1px solid #d8e0eb}</style><main><h1>P50 凭证弹窗焦点闭环 · 实际 Vue</h1>${cards}</main></html>`,
  );
}
console.log(
  JSON.stringify({
    runs: runs.length,
    checks: runs.reduce((sum, run) => sum + run.checks.length, 0),
    screenshots: screenshots.length,
    sources: Object.keys(sourceHashes).length,
    port,
  }),
);
