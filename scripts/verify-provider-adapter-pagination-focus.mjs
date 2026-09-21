import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { format } from "prettier";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { parse } from "@vue/compiler-sfc";
import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";

assert.ok(
  process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === "--capture"),
);
const capture = process.argv.length === 3;
const output = "output/playwright/p47-pagination-focus-implementation";
const component = "apps/web/src/components/ProviderAdapterCenter.vue";
const fixture = "tests/e2e/m03-03-provider-adapter.spec.ts";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (text) => createHash("sha256").update(text).digest("hex");
const current = await read(component);
const ast = ts.createSourceFile(
  component,
  parse(current).descriptor.scriptSetup.content,
  ts.ScriptTarget.Latest,
  true,
);
const handlers = ast.statements.filter(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "turnPage",
);
assert.equal(handlers.length, 1);
const nav = current.match(
  /      <nav v-if="filtered.length" class="adapter-pagination"[\s\S]*?<\/nav>/g,
);
assert.equal(nav?.length, 1);
const before = await format(
  current.replace(handlers[0].getText(ast) + "\n", "").replace(
    nav[0],
    `      <nav v-if="filtered.length" class="adapter-pagination" aria-label="来源适配器分页">
        <button type="button" :disabled="page === 1" @click="page--">上一页</button>
        <span>第 {{ page }} / {{ totalPages }} 页 · 每页 {{ pageSize }} 条</span>
        <button type="button" :disabled="page === totalPages" @click="page++">下一页</button>
      </nav>`,
  ),
  { parser: "vue", printWidth: 100 },
);
// Reject any unrelated runtime/style change in the before/current comparison.
assert.equal(hash(before), "51c0ba1f86fa1179fcb0d25b9cb327ef8a38f34b0cef53d5a916f0ef2f92a2ee");
const fixtureAst = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true);
const declarations = [];
function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    ["navigation", "base", "items", "catalog"].includes(node.name.getText(fixtureAst))
  )
    declarations.push(node);
  ts.forEachChild(node, visit);
}
visit(fixtureAst);
assert.equal(declarations.length, 4);
const box = {};
vm.runInNewContext(
  ts.transpileModule(
    ["navigation", "base", "items", "catalog"]
      .map((name) => {
        const matches = declarations.filter((node) => node.name.getText(fixtureAst) === name);
        assert.equal(matches.length, 1);
        return `const ${name}=${matches[0].initializer.getText(fixtureAst)};`;
      })
      .join("\n") + "globalThis.fixture={navigation,catalog};",
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  box,
);
const { navigation, catalog } = JSON.parse(JSON.stringify(box.fixture));
assert.equal(catalog.length, 45);
const sources = new Set([
  component,
  fixture,
  "scripts/verify-provider-adapter-pagination-focus.mjs",
  "scripts/lib/ui-imported-style-sources.mjs",
  "apps/web/vite.config.ts",
  "apps/web/index.html",
]);
const runs = [],
  pictures = [],
  ports = [];
let server, browser;
try {
  // Existing services are not stopped; reserve a free port for each comparison mode.
  if (capture) await mkdir(output); // Exclusive: never overwrite delivered evidence.
  browser = await chromium.launch();
  for (const mode of ["before", "current"]) {
    const reservation = reservePort();
    await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
    const reservedPort = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    server = await createServer({
      configFile: path.resolve("apps/web/vite.config.ts"),
      logLevel: "error",
      define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
      server: { host: "127.0.0.1", port: reservedPort, strictPort: true, proxy: {}, hmr: false },
      plugins:
        mode === "current"
          ? []
          : [
              {
                name: "p47-pagination-before-only",
                enforce: "pre",
                transform(source, id) {
                  if (id.replaceAll("\\", "/") !== path.resolve(component).replaceAll("\\", "/"))
                    return null;
                  assert.equal(source.replaceAll("\r\n", "\n"), current);
                  return { code: before, map: null };
                },
              },
            ],
    });
    await server.listen();
    const port = server.httpServer.address().port;
    ports.push(port);
    const origin = `http://127.0.0.1:${port}`;
    console.log(`P47 pagination ${mode} ${origin}`);
    for (const width of [390, 760, 761, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 1600 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage();
        const requests = [],
          unexpected = [],
          errors = [],
          checks = [];
        let reads = 0;
        const check = (name, actual, expected = true) => {
          assert.deepEqual(actual, expected, `${mode}/${width}: ${name}`);
          checks.push({ name, actual });
        };
        const picture = async (locator, state) => {
          if (!capture) return;
          const file = `${mode}-${width}-${state}.png`;
          const bytes = await locator.screenshot({ animations: "disabled" });
          await writeFile(`${output}/${file}`, bytes);
          pictures.push({
            mode,
            width,
            state,
            file,
            sha256: hash(bytes),
            pixelWidth: bytes.readUInt32BE(16),
            pixelHeight: bytes.readUInt32BE(20),
          });
        };
        await page.clock.install({ time: new Date("2026-09-13T06:00:00Z") });
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/*", (route) => {
          const request = route.request(),
            url = new URL(request.url());
          const key = `${request.method()} ${url.pathname}`;
          if (url.origin !== origin) {
            unexpected.push("external");
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          requests.push({ key, body: request.postData() });
          if (key === "GET /api/v1/me/navigation")
            return route.fulfill({ json: { data: navigation, request_id: "nav" } });
          if (key === "GET /api/v1/auth/session-status")
            return route.fulfill({ json: { data: { authenticated: true } } });
          if (key === "GET /api/v1/platform/provider-adapters") {
            reads++;
            return route.fulfill({ json: { data: catalog, request_id: "catalog-45" } });
          }
          unexpected.push(key);
          return route.abort();
        });
        await page.goto(origin + "/platform-admin/providers/adapters");
        const center = page.locator(".adapter-center");
        const nav = center.locator(".adapter-pagination"),
          status = nav.locator("span");
        const previous = nav.getByRole("button", { name: "上一页", exact: true }),
          next = nav.getByRole("button", { name: "下一页", exact: true });
        const rows = center.locator(
          ".adapter-table-wrap tbody tr:visible, .responsive-data-view__mobile article:visible",
        );
        const input = center.locator(".adapter-search input");
        await expect(center.locator(".adapter-toolbar > span")).toHaveText("45 个结果");
        await page.evaluate(() => document.fonts.ready);
        check("first page rows", await rows.count(), 20);
        await next.focus();
        await page.keyboard.press("Enter");
        await expect(status).toHaveText("第 2 / 3 页 · 每页 20 条");
        check("middle page rows", await rows.count(), 20);
        check(
          "middle keeps trigger focus",
          await next.evaluate((el) => el === document.activeElement),
        );
        await page.keyboard.press("Enter");
        await expect(status).toHaveText("第 3 / 3 页 · 每页 20 条");
        check("last page rows", await rows.count(), 5);
        check("last button disabled", await next.isDisabled());
        check(
          "last focus",
          await status.evaluate((el) =>
            el === document.activeElement ? "status" : document.activeElement?.tagName,
          ),
          mode === "current" ? "status" : "BODY",
        );
        if (mode === "current") {
          check(
            "visible focus",
            await status.evaluate(
              (el) =>
                el.matches(":focus-visible") &&
                getComputedStyle(el).outlineStyle === "solid" &&
                getComputedStyle(el).outlineWidth === "3px",
            ),
          );
          check("polite page status", await status.getAttribute("aria-live"), "polite");
          await page.keyboard.press("Shift+Tab");
          await expect(previous).toBeFocused();
          await previous.press("Tab");
          check(
            "status not extra tab stop",
            await status.evaluate((el) => el !== document.activeElement),
          );
          await previous.focus();
        }
        // Restore focused status for the implementation screenshot without changing data.
        if (mode === "current") await status.focus();
        await picture(nav, "last-page-focus");
        await previous.focus();
        await page.keyboard.press("Enter");
        await expect(status).toHaveText("第 2 / 3 页 · 每页 20 条");
        check(
          "reverse middle keeps trigger focus",
          await previous.evaluate((el) => el === document.activeElement),
        );
        await page.keyboard.press("Enter");
        await expect(status).toHaveText("第 1 / 3 页 · 每页 20 条");
        check("first button disabled", await previous.isDisabled());
        check(
          "first focus",
          await status.evaluate((el) =>
            el === document.activeElement ? "status" : document.activeElement?.tagName,
          ),
          mode === "current" ? "status" : "BODY",
        );
        await picture(nav, "first-page-focus");
        await input.focus();
        await picture(nav, "neutral-page");
        // Script-dispatched click while another control owns focus must not steal it.
        await next.evaluate((el) => el.click());
        await expect(status).toHaveText("第 2 / 3 页 · 每页 20 条");
        await next.evaluate((el) => el.click());
        await expect(status).toHaveText("第 3 / 3 页 · 每页 20 条");
        check(
          "other control focus preserved",
          await input.evaluate((el) => el === document.activeElement),
        );
        await input.fill("CATALOG_SOURCE_45");
        await expect(status).toHaveText("第 1 / 1 页 · 每页 20 条");
        check("single page preserved", await nav.count(), 1);
        check("single result", await rows.count(), 1);
        check(
          "filter focus preserved",
          await input.evaluate((el) => el === document.activeElement),
        );
        await input.fill("no-match");
        await expect(nav).toHaveCount(0);
        await center.getByRole("button", { name: "清除筛选", exact: true }).click();
        await expect(status).toHaveText("第 1 / 3 页 · 每页 20 条");
        check(
          "empty reset focus preserved",
          await input.evaluate((el) => el === document.activeElement),
        );
        check("reset restores all results", await rows.count(), 20);
        check("no additional catalog GET", reads, 1);
        check(
          "GET only",
          requests.every((r) => r.key.startsWith("GET ") && r.body === null),
        );
        check("no unexpected network", unexpected, []);
        check("no page errors", errors, []);
        check(
          "no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
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
    server = null;
  }
  await browser.close();
  browser = null;
  await includeImportedStyleSources(sources, read);
  const comparisons = [];
  if (capture) {
    for (const width of [390, 760, 761, 1440]) {
      const pair = pictures.filter((p) => p.width === width && p.state === "neutral-page");
      assert.equal(pair.length, 2);
      assert.equal(
        pair[0].sha256,
        pair[1].sha256,
        `Unfocused pagination appearance changed at ${width}`,
      );
      comparisons.push({ width, unchanged: true });
    }
    await writeFile(
      `${output}/evidence.json`,
      JSON.stringify(
        {
          kind: "P47-PAGINATION-FOCUS-IMPLEMENTATION-r1",
          beforeSha: hash(before),
          currentSha: hash(current),
          processesClosed: true,
          ports,
          runs,
          pictures,
          comparisons,
          sourceHashes: Object.fromEntries(
            await Promise.all(
              [...sources].sort().map(async (file) => [file, hash(await read(file))]),
            ),
          ),
          boundary:
            "Actual untransformed current App vs exact prior component. Only boundary focus and persistent page live status; existing layout/filter/20-row page/API unchanged. Local GET fixtures,not real probe/permission/production acceptance.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P47 分页焦点实施</title><style>body{font:16px/1.7 Microsoft YaHei,sans-serif;margin:24px;background:#f5f7fb;color:#152b49}img{max-width:100%;display:block}article{margin:28px 0}a{color:#185adb}</style><h1>P47 分页边界焦点 · 实际 Vue</h1><p>before 为精确修复前，current 为未替换的当前组件。仅焦点保护，不批准待审分页新布局。数据为本地样例，未部署。</p><a href="evidence.json">验证与来源清单</a>' +
        pictures
          .map(
            (p) =>
              `<article><h2>${p.mode} / ${p.width} / ${p.state}</h2><a href="${p.file}"><img alt="${p.state}" src="${p.file}"></a></article>`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((n, r) => n + r.checks.length, 0),
      pictures: pictures.length,
      comparisons,
      sources: sources.size,
      ports,
      processesClosed: true,
      beforeSha: hash(before),
      currentSha: hash(current),
    }),
  );
} finally {
  await browser?.close();
  await server?.close();
}
