import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { previewAdapterFilterPagination } from "./lib/ui-phase2-adapter-filter-pagination-preview.mjs";

assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p47-filter-pagination-review",
  component = "apps/web/src/components/ProviderAdapterCenter.vue",
  css =
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-filter-pagination-preview.css",
  fixture = "tests/e2e/m03-03-provider-adapter.spec.ts";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  source = await read(component),
  replacement = previewAdapterFilterPagination(source);
const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true),
  declarations = [];
function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    ["navigation", "base", "items", "catalog"].includes(node.name.getText(ast))
  )
    declarations.push(node);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(declarations.length, 4);
const box = {};
vm.runInNewContext(
  ts.transpileModule(
    ["navigation", "base", "items", "catalog"]
      .map((name) => {
        const matches = declarations.filter((node) => node.name.getText(ast) === name);
        assert.equal(matches.length, 1);
        return `const ${name}=${matches[0].initializer.getText(ast)};`;
      })
      .join("\n") + "globalThis.data={navigation,catalog};",
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  box,
);
const { navigation, catalog } = JSON.parse(JSON.stringify(box.data));
assert.equal(catalog.length, 45);
const sources = new Set([
    component,
    css,
    fixture,
    "scripts/lib/ui-phase2-adapter-filter-pagination-preview.mjs",
    "scripts/verify-ui-phase2-provider-adapter-filter-pagination.mjs",
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
  for (const mode of ["baseline", "review"]) {
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
                name: "p47-filter-pagination-review-only",
                enforce: "pre",
                transform(text, id) {
                  if (id.replaceAll("\\", "/") !== path.resolve(component).replaceAll("\\", "/"))
                    return null;
                  assert.equal(text.replaceAll("\r\n", "\n"), source);
                  return { code: replacement, map: null };
                },
                transformIndexHtml(html) {
                  return html
                    .replace("<body>", '<body class="p47-filter-page-review">')
                    .replace(
                      "</head>",
                      `<link rel="stylesheet" href="/@fs/${path.resolve(css).replaceAll("\\", "/")}"></head>`,
                    );
                },
              },
            ],
    });
    await server.listen();
    console.log(`P47 filter/page ${mode} ${origin}`);
    for (const width of [390, 760, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 1600 },
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
        let reads = 0;
        const check = (name, actual, expected = true) => {
          assert.deepEqual(actual, expected, `${mode}/${width}:${name}`);
          checks.push({ name, actual });
        };
        const picture = async (locator, suffix) => {
          if (!capture) return;
          const file = `${mode}-${width}-${suffix}.png`,
            bytes = await locator.screenshot({ animations: "disabled" });
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
          const req = route.request(),
            url = new URL(req.url()),
            key = `${req.method()} ${url.pathname}`;
          if (url.origin !== origin) {
            unexpected.push("external");
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          if (
            ![
              "GET /api/v1/me/navigation",
              "GET /api/v1/auth/session-status",
              "GET /api/v1/platform/provider-adapters",
            ].includes(key)
          ) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, body: req.postData() });
          if (url.pathname.endsWith("navigation"))
            return route.fulfill({ json: { data: navigation, request_id: "nav" } });
          if (url.pathname.endsWith("session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          reads++;
          return route.fulfill({ json: { data: catalog, request_id: "catalog-45" } });
        });
        await page.goto(origin + "/platform-admin/providers/adapters");
        const center = page.locator(".adapter-center"),
          toolbar = center.locator(".adapter-toolbar"),
          details = center.locator(".adapter-advanced"),
          summary = details.locator("summary"),
          resultCount = center.locator(".adapter-toolbar > span"),
          rows = center.locator(
            ".adapter-table-wrap tbody tr:visible, .responsive-data-view__mobile article:visible",
          ),
          nav = center.locator(".adapter-pagination"),
          previous = nav.getByRole("button", { name: "上一页", exact: true }),
          next = nav.getByRole("button", { name: "下一页", exact: true }),
          status = nav.locator("span"),
          input = center.locator(".adapter-search input"),
          selects = center.locator(".adapter-advanced-fields select");
        await expect(resultCount).toHaveText("45 个结果");
        check("one initial catalog GET", reads, 1);
        check("page one has20 rows", await rows.count(), 20);
        check("five labeled filter selects", await selects.count(), 5);
        await summary.focus();
        await page.keyboard.press("Enter");
        await expect(details).toHaveAttribute("open", "");
        await expect(summary).toBeFocused();
        check("native details remains keyboard controlled", await details.getAttribute("open"), "");
        check(
          "filter summary 44px",
          await summary.evaluate((el) => el.getBoundingClientRect().height >= 44),
        );
        check(
          "toolbar has no horizontal overflow",
          await toolbar.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        );
        if (mode === "review") {
          check(
            "result count announced politely",
            await resultCount.getAttribute("role"),
            "status",
          );
          check("result count atomic", await resultCount.getAttribute("aria-atomic"), "true");
        }
        await page.evaluate(() => document.fonts.ready);
        await picture(toolbar, "filters-open");
        await summary.focus();
        await page.keyboard.press("Enter");
        await expect(details).not.toHaveAttribute("open", "");
        await expect(nav).toBeVisible();
        await expect(previous).toBeDisabled();
        await expect(next).toBeEnabled();
        await expect(status).toHaveText("第 1 / 3 页 · 每页 20 条");
        await next.focus();
        await expect(next).toBeFocused();
        check(
          "pagination controls 44px",
          await nav
            .locator("button")
            .evaluateAll((els) => els.every((el) => el.getBoundingClientRect().height >= 44)),
        );
        check(
          "pagination has no horizontal overflow",
          await nav.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        );
        await picture(nav, "page-1");
        await page.keyboard.press("Enter");
        await expect(status).toHaveText("第 2 / 3 页 · 每页 20 条");
        check("page two has20 rows", await rows.count(), 20);
        await expect(next).toBeFocused();
        await picture(nav, "page-2");
        await page.keyboard.press("Enter");
        await expect(status).toHaveText("第 3 / 3 页 · 每页 20 条");
        check("page three has5 rows", await rows.count(), 5);
        await expect(next).toBeDisabled();
        check(
          "last-page focus target",
          await page.evaluate(() =>
            document.activeElement?.matches(".adapter-page-status")
              ? "status"
              : document.activeElement?.tagName,
          ),
          mode === "review" ? "status" : "BODY",
        );
        if (mode === "review") {
          await expect(status).toBeFocused();
          check("page status announced politely", await status.getAttribute("role"), "status");
          check("page status atomic", await status.getAttribute("aria-atomic"), "true");
        }
        await picture(nav, "page-3");
        await previous.focus();
        await page.keyboard.press("Enter");
        await expect(status).toHaveText("第 2 / 3 页 · 每页 20 条");
        await expect(previous).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(status).toHaveText("第 1 / 3 页 · 每页 20 条");
        await expect(previous).toBeDisabled();
        check(
          "first-page focus target",
          await page.evaluate(() =>
            document.activeElement?.matches(".adapter-page-status")
              ? "status"
              : document.activeElement?.tagName,
          ),
          mode === "review" ? "status" : "BODY",
        );
        await picture(nav, "page-1-return");
        await next.focus();
        await page.keyboard.press("Enter");
        await page.keyboard.press("Enter");
        await expect(status).toHaveText("第 3 / 3 页 · 每页 20 条");
        await input.fill("CATALOG_SOURCE_45");
        await expect(resultCount).toHaveText("1 个结果");
        check(
          "filter resets page to one",
          await center.locator(".adapter-pagination span").count(),
          mode === "review" ? 0 : 1,
        );
        check("single result row", await rows.count(), 1);
        check("query keeps focus", await input.evaluate((el) => document.activeElement === el));
        check(
          "review hides redundant single-page pagination",
          await nav.count(),
          mode === "review" ? 0 : 1,
        );
        await picture(toolbar, "single-result");
        await input.fill("no-match");
        await details.evaluate((el) => (el.open = true));
        for (const [index, value] of [
          "manual",
          "enabled",
          "registered",
          "ready",
          "recent",
        ].entries())
          await selects.nth(index).selectOption(value);
        await center.getByRole("button", { name: "清除筛选", exact: true }).click();
        check("clear restores search", await input.inputValue(), "");
        check(
          "clear restores five selects",
          await selects.evaluateAll((els) => els.map((el) => el.value)),
          ["all", "all", "all", "all", "attention"],
        );
        await expect(resultCount).toHaveText("45 个结果");
        check(
          "clear restores page one",
          await nav.locator("span").textContent(),
          "第 1 / 3 页 · 每页 20 条",
        );
        check("filters and pages add no GET", reads, 1);
        check(
          "no write requests",
          requests.filter((request) => !request.key.startsWith("GET ")).length,
          0,
        );
        check(
          "no request bodies",
          requests.every((request) => request.body === null),
        );
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
    server = null;
  }
  await browser.close();
  browser = null;
  if (capture) {
    await writeFile(
      `${output}/evidence.json`,
      JSON.stringify(
        {
          kind: "P47-FILTER-PAGINATION-REVIEW-r1",
          reviewOnly: true,
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
            "Actual App and45-row source fixture. Review-only nextTick page-boundary focus, live result/page status, single-page hide and scoped CSS. Original six models,20-page size,watch resets,GET/API/data/actions unchanged. Local GET only; no real API/probe/write/deploy or full a11y acceptance.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P47 筛选分页审核</title><style>body{font:16px/1.7 sans-serif;margin:24px}img{max-width:100%}article{margin:32px 0}</style><h1>P47 筛选与分页 · 独立审核稿</h1><p>实际Vue与原45条fixture；生产未改。分别截筛选和分页区域，不代表完整列表或全页通过。</p>' +
        screenshots
          .map(
            (s) =>
              `<article><h2>${s.mode} / ${s.width} / ${s.suffix}</h2><img loading="lazy" alt="${s.suffix}" src="${s.file}"></article>`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((sum, run) => sum + run.checks.length, 0),
      screenshots: screenshots.length,
      sources: sources.size,
      ports,
    }),
  );
} finally {
  await browser?.close();
  await server?.close();
}
