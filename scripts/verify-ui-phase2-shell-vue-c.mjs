import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium } from "playwright";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./lib/ui-phase2-shell-vue-preview.mjs";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

assert.ok(process.argv.slice(2).every((arg) => ["--capture", "--smoke"].includes(arg)));
assert.ok(process.argv.slice(2).length <= 1);
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
const output = "output/playwright/shell-vue-c-platform-r2";
const shell = "apps/web/src/components/NavigationShell.vue";
const adapterFixture = "tests/e2e/m03-03-provider-adapter.spec.ts";
const registryFixture = "tests/e2e/m03-01-provider-registry.spec.ts";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function fixture(file, names) {
  const ast = ts.createSourceFile(file, await read(file), ts.ScriptTarget.Latest, true);
  const declarations = [];
  const visit = (node) => {
    if (ts.isVariableDeclaration(node)) declarations.push(node);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const box = {};
  vm.runInNewContext(
    ts.transpileModule(
      names
        .map((name) => {
          const matches = declarations.filter((node) => node.name.getText(ast) === name);
          assert.equal(matches.length, 1, `Ambiguous fixture ${name}`);
          return `const ${name}=${matches[0].initializer.getText(ast)};`;
        })
        .join("\n") + `globalThis.result={${names.join(",")}};`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText,
    box,
  );
  return JSON.parse(JSON.stringify(box.result));
}
const adapters = await fixture(adapterFixture, ["navigation", "base", "items"]);
const registry = await fixture(registryFixture, ["definition", "blockedDefinition", "definitions"]);
const source = await read(shell),
  reviewSource = previewShellVue(source);
const sources = new Set([
  shell,
  shellReviewCss,
  shellReviewModule,
  adapterFixture,
  registryFixture,
  "scripts/verify-ui-phase2-shell-vue-c.mjs",
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "apps/web/index.html",
  "apps/web/vite.config.ts",
]);
const runs = [],
  screenshots = [],
  ports = [];
if (capture) await mkdir(output); // Exclusive creation: original review images can never be overwritten.
let browser, server;
try {
  browser = await chromium.launch();
  for (const mode of smoke ? ["review"] : ["baseline", "review"]) {
    const reserve = reservePort();
    await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
    const port = reserve.address().port;
    await new Promise((resolve) => reserve.close(resolve));
    ports.push(port);
    const origin = `http://127.0.0.1:${port}`;
    server = await createServer({
      configFile: path.resolve("apps/web/vite.config.ts"),
      logLevel: "error",
      define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
      server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
      plugins:
        mode === "baseline"
          ? []
          : [
              {
                name: "shell-c-review-only",
                enforce: "pre",
                transform(text, id) {
                  if (id.replaceAll("\\", "/") !== path.resolve(shell).replaceAll("\\", "/"))
                    return null;
                  assert.equal(text.replaceAll("\r\n", "\n"), source);
                  return { code: reviewSource, map: null };
                },
                transformIndexHtml(html) {
                  return html
                    .replace("<body>", '<body class="shell-vue-c">')
                    .replace(
                      "</head>",
                      `<link rel="stylesheet" href="/@fs/${path.resolve(shellReviewCss).replaceAll("\\", "/")}"></head>`,
                    );
                },
              },
            ],
    });
    await server.listen();
    console.log(`Shell Vue C ${mode} ${origin}`);
    for (const width of mode === "baseline" || smoke ? [390, 1440] : [390, 840, 841, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
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
          assert.deepEqual(actual, expected, `${mode}/${width}: ${name}`);
          checks.push({ name, actual });
        };
        const shot = async (scene, fullPage = false) => {
          if (!capture) return;
          await page.evaluate(() => document.fonts.ready);
          await page.evaluate(() => window.scrollTo(0, 0));
          const bytes = await page.screenshot({ fullPage, animations: "disabled" });
          const file = `${mode}-${width}-${scene}.png`;
          await writeFile(`${output}/${file}`, bytes);
          screenshots.push({
            file,
            mode,
            width,
            scene,
            fullPage,
            sha256: hash(bytes),
            pixelWidth: bytes.readUInt32BE(16),
            pixelHeight: bytes.readUInt32BE(20),
          });
        };
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/*", (route) => {
          const req = route.request(),
            url = new URL(req.url()),
            key = `${req.method()} ${url.pathname}`;
          if (url.origin !== origin) {
            unexpected.push("external");
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          const values = {
            "GET /api/v1/me/navigation": adapters.navigation,
            "GET /api/v1/auth/session-status": { authenticated: true },
            "GET /api/v1/platform/provider-adapters": adapters.items,
            "GET /api/v1/platform/providers": registry.definitions,
          };
          if (!(key in values)) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, body: req.postData() });
          return route.fulfill({ json: { data: values[key], request_id: "shell-local-fixture" } });
        });
        await page.goto(origin + "/platform-admin/providers/adapters");
        await page.waitForSelector('.role-shell[data-state="ready"] .adapter-toolbar');
        check(
          "actual adapter fixture",
          await page.locator(".adapter-toolbar > span").textContent(),
          "2 个结果",
        );
        const expectedMenu = await page.locator(".role-nav-menu a").evaluateAll((nodes) =>
          nodes.map((node) => ({
            href: node.getAttribute("href"),
            name: node.textContent.trim(),
          })),
        );
        check("authorized menu exists", expectedMenu.length >= 8);
        check(
          "no page overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (mode === "review") {
          check(
            "content is beside navigation and visible in first viewport",
            await page.evaluate(() => {
              const content = document.querySelector(".role-content").getBoundingClientRect();
              const frame = document
                .querySelector(".role-navigation-frame")
                .getBoundingClientRect();
              const topbar = document.querySelector(".role-topbar").getBoundingClientRect();
              return (
                topbar.y === 0 &&
                content.y >= topbar.bottom - 1 &&
                content.y < 150 &&
                (innerWidth <= 840 || content.x >= frame.right - 1)
              );
            }),
          );
          await shot("overview");
          await shot("full-page", true);
          check("old ledger ornament removed", await page.locator(".role-page-folio").count(), 0);
          check(
            "navigation success is not health proof",
            await page.locator(".role-signal-status").count(),
            0,
          );
          const frame = page.locator(".role-navigation-frame");
          if (width <= 840) {
            check("closed menu absent from layout", await frame.isVisible(), false);
            await page.getByRole("button", { name: "打开导航菜单", exact: true }).click();
            await page.waitForSelector(".role-navigation-frame:modal");
            check(
              "dialog initial close focus",
              await page
                .locator(".role-navigation-close")
                .evaluate((node) => node === document.activeElement),
            );
            await shot("navigation-open");
            await page.keyboard.press("Shift+Tab");
            check(
              "backward native focus contained",
              await frame.evaluate((node) => node.contains(document.activeElement)),
            );
            await page.keyboard.press("Tab");
            check(
              "forward native focus contained",
              await frame.evaluate((node) => node.contains(document.activeElement)),
            );
            await page.keyboard.press("Escape");
            await page.waitForSelector(".role-navigation-frame:not([open])", { state: "attached" });
            check(
              "escape restores opener",
              await page
                .getByRole("button", { name: "打开导航菜单", exact: true })
                .evaluate((node) => node === document.activeElement),
            );
            await page.getByRole("button", { name: "更多", exact: true }).click();
            await page.waitForSelector(".role-navigation-frame:modal");
          } else {
            check(
              "desktop menu is not modal",
              await frame.evaluate((node) => !node.matches(":modal")),
            );
            check(
              "desktop blue sidebar",
              await frame.evaluate((node) => getComputedStyle(node).backgroundColor),
              "rgb(36, 75, 176)",
            );
          }
          const query = page.getByRole("searchbox", { name: "搜索导航菜单", exact: true });
          await query.fill("无此菜单-shell-review");
          await page.waitForSelector(".role-menu-empty");
          check(
            "search empty does not remove business data",
            await page.locator(".adapter-toolbar > span").textContent(),
            "2 个结果",
          );
          await shot("navigation-empty");
          await query.fill("来源");
          check(
            "menu query filters actual catalog",
            (await page.locator(".role-nav-menu a").allTextContents()).every((text) =>
              text.includes("来源"),
            ),
          );
          await query.fill("");
          check(
            "all authorized entries restored",
            await page.locator(".role-nav-menu a").evaluateAll((nodes) =>
              nodes.map((node) => ({
                href: node.getAttribute("href"),
                name: node.textContent.trim(),
              })),
            ),
            expectedMenu,
          );
          const providerLink = page.locator('.role-nav-menu a[href="/platform-admin/providers"]');
          await providerLink.click();
          await page.waitForURL("**/platform-admin/providers");
          await page.getByRole("heading", { name: "来源注册中心", exact: true }).waitFor();
          check(
            "router menu clears search",
            await page.locator(".role-menu-search input").inputValue(),
            "",
          );
          if (width <= 840) check("route link closes modal", await frame.isVisible(), false);
          await page
            .locator('.provider-runtime-tabs a[href="/platform-admin/providers/adapters"]')
            .click();
          await page.waitForSelector(".adapter-toolbar");
          check(
            "real router returns to adapter page",
            new URL(page.url()).pathname,
            "/platform-admin/providers/adapters",
          );
          if (width <= 840) {
            await page.locator(".role-context-drawer > summary").click();
            await shot("context-open");
            await page.getByRole("button", { name: "打开导航菜单", exact: true }).click();
            await page.waitForSelector(".role-navigation-frame:modal");
            await page.setViewportSize({ width: 1000, height: 1000 });
            await page.waitForFunction(
              () => !document.querySelector(".role-navigation-frame").matches(":modal"),
            );
            check(
              "breakpoint restores visible focus",
              await page.evaluate(
                () =>
                  document.activeElement !== document.body &&
                  document.activeElement.getClientRects().length > 0,
              ),
            );
            await page.setViewportSize({ width, height: 1000 });
            await page.waitForSelector(".role-navigation-frame:not([open])", { state: "attached" });
          } else {
            await query.focus();
            await page.setViewportSize({ width: 390, height: 1000 });
            await page.waitForSelector(".role-navigation-frame:not([open])", { state: "attached" });
            check(
              "desktop focused menu hides to visible brand",
              await page.locator(".role-brand").evaluate((node) => node === document.activeElement),
            );
          }
        } else await shot("overview");
        check(
          "no writes or payloads",
          requests.every((item) => item.key.startsWith("GET ") && item.body === null),
        );
        check("no unexpected network", unexpected, []);
        check("no browser errors", errors, []);
        runs.push({ mode, width, checks, requests, expectedMenu });
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
  await includeImportedStyleSources(sources, (file) =>
    file.startsWith("apps/web/src/") ? read(file) : "",
  );
  await browser.close();
  browser = null;
  const evidence = {
    kind: "SHELL-VUE-C-PLATFORM-r2",
    reviewOnly: true,
    userReview: "pending",
    processesClosed: true,
    ports,
    runs,
    screenshots,
    sourceHashes: Object.fromEntries(
      await Promise.all([...sources].sort().map(async (file) => [file, hash(await read(file))])),
    ),
    boundary:
      "Actual App/NavigationShell/P47/P46 with review-only shell additions and CSS. Existing local E2E fixtures, GET-only. Platform representative composition, not all roles/themes, AccountShell, real permissions or production acceptance.",
  };
  if (capture) {
    await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>C 导航壳真实 Vue 审核</title><style>body{font:16px/1.7 sans-serif;margin:24px;background:#f3f6fb;color:#172d4c}img{max-width:100%;height:auto}article{margin:32px 0}a{color:#244bb0}</style><h1>C 导航壳 · 平台实际 Vue 装配提案</h1><p>待审核；本地测试数据。baseline 为现有界面，review 为新组合。P47 子目录改为横向排列需要新批准；不代表成员/组织壳层、全部主题、真实权限或生产验收。</p><a href="evidence.json">机器证据</a>' +
        screenshots
          .map(
            (shot) =>
              `<article><h2>${shot.mode} / ${shot.width} / ${shot.scene}</h2><a href="${shot.file}"><img loading="lazy" alt="${shot.mode} ${shot.width} ${shot.scene}" src="${shot.file}"></a></article>`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((n, run) => n + run.checks.length, 0),
      screenshots: screenshots.length,
      sources: sources.size,
      ports,
      processesClosed: true,
    }),
  );
} finally {
  await browser?.close();
  await server?.close();
}
