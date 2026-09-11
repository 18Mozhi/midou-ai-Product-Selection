import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { previewAdapterEmpty, emptyCopy } from "./lib/ui-phase2-adapter-empty-preview.mjs";

assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture");
const output = "output/playwright/p47-empty-review";
const component = "apps/web/src/components/ProviderAdapterCenter.vue";
const css = "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-empty-preview.css";
const fixture = "tests/e2e/m03-03-provider-adapter.spec.ts";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const source = await read(component),
  replacement = previewAdapterEmpty(source);
const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true);
const declarations = [];
function visit(node) {
  if (ts.isVariableDeclaration(node)) declarations.push(node);
  ts.forEachChild(node, visit);
}
visit(ast);
const box = {};
vm.runInNewContext(
  ts.transpileModule(
    ["navigation", "base", "items"]
      .map((name) => {
        const matches = declarations.filter((node) => node.name.getText(ast) === name);
        assert.equal(matches.length, 1);
        return `const ${name}=${matches[0].initializer.getText(ast)};`;
      })
      .join("\n") + "globalThis.data={navigation,items};",
    {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    },
  ).outputText,
  box,
);
const data = JSON.parse(JSON.stringify(box.data));
const sources = new Set([
  component,
  css,
  fixture,
  "scripts/lib/ui-phase2-adapter-empty-preview.mjs",
  "scripts/verify-ui-phase2-provider-adapter-empty.mjs",
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
                name: "p47-empty-review-only",
                enforce: "pre",
                transform(text, id) {
                  if (id.replaceAll("\\", "/") !== path.resolve(component).replaceAll("\\", "/"))
                    return null;
                  assert.equal(text.replaceAll("\r\n", "\n"), source);
                  return { code: replacement, map: null };
                },
                transformIndexHtml(html) {
                  return html
                    .replace("<body>", '<body class="p47-empty-review">')
                    .replace(
                      "</head>",
                      `<link rel="stylesheet" href="/@fs/${path.resolve(css).replaceAll("\\", "/")}"></head>`,
                    );
                },
              },
            ],
    });
    await server.listen();
    console.log(`P47 empty ${mode} ${origin}`);
    for (const width of [390, 760, 1440])
      for (const scene of ["catalog", "search", "combined"]) {
        const context = await browser.newContext({
          viewport: { width, height: 1200 },
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
            assert.deepEqual(actual, expected, `${mode}/${width}/${scene}:${name}`);
            checks.push({ name, actual });
          };
          const picture = async (locator, suffix) => {
            if (!capture) return;
            const file = `${mode}-${width}-${scene}-${suffix}.png`;
            const bytes = await locator.screenshot({ animations: "disabled" });
            await writeFile(`${output}/${file}`, bytes);
            screenshots.push({
              file,
              mode,
              width,
              scene,
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
                "GET /api/v1/platform/providers",
              ].includes(key)
            ) {
              unexpected.push(key);
              return route.abort();
            }
            requests.push({ key, body: req.postData() });
            if (url.pathname.endsWith("navigation"))
              return route.fulfill({ json: { data: data.navigation, request_id: "nav" } });
            if (url.pathname.endsWith("session-status"))
              return route.fulfill({ json: { data: { authenticated: true } } });
            if (url.pathname.endsWith("/providers"))
              return route.fulfill({ json: { data: [], request_id: "providers-empty" } });
            reads++;
            return route.fulfill({
              json: {
                data: scene === "catalog" ? [] : data.items,
                request_id: "local-empty-review",
              },
            });
          });
          await page.goto(origin + "/platform-admin/providers/adapters");
          const center = page.locator(".adapter-center"),
            input = center.locator(".adapter-search input"),
            selects = center.locator(".adapter-advanced-fields select"),
            panel = center.locator(".adapter-empty");
          await expect(center.locator(".adapter-toolbar > span")).toHaveText(
            scene === "catalog" ? "0 个结果" : "2 个结果",
          );
          if (scene !== "catalog") {
            await input.fill("不存在的来源");
            if (scene === "combined") {
              await center.locator(".adapter-advanced summary").click();
              for (const [i, value] of [
                "manual",
                "draft",
                "unregistered",
                "blocked",
                "recent",
              ].entries())
                await selects.nth(i).selectOption(value);
            }
          }
          await expect(panel).toBeVisible();
          await expect(center.locator(".adapter-toolbar > span")).toHaveText("0 个结果");
          check(
            "global metrics retain catalog facts",
            await center.locator(".adapter-metrics strong").allTextContents(),
            scene === "catalog" ? ["0", "0", "0", "0"] : ["2", "1", "1", "1"],
          );
          if (mode === "review") {
            await expect(panel.getByRole("heading")).toHaveText(
              emptyCopy[scene === "catalog" ? "catalog" : "filtered"][0],
            );
            await expect(panel.locator("p")).toHaveText(
              emptyCopy[scene === "catalog" ? "catalog" : "filtered"][1],
            );
          }
          check("one empty state", await panel.count(), 1);
          const action =
            scene === "catalog"
              ? panel.getByRole("link", { name: "登记来源", exact: true })
              : panel.getByRole("button", { name: "清除筛选", exact: true });
          await action.scrollIntoViewIfNeeded();
          await action.focus();
          await expect(action).toBeFocused();
          await page.evaluate(() => document.fonts.ready);
          check(
            "44px action",
            await action.evaluate((el) => {
              const r = el.getBoundingClientRect();
              return r.width >= 44 && r.height >= 44;
            }),
          );
          check(
            "no horizontal overflow",
            await panel.evaluate(
              (el) =>
                el.scrollWidth <= el.clientWidth + 1 &&
                document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          );
          check("only one adapter GET before activation", reads, 1);
          await picture(panel, "empty");
          if (scene === "catalog") {
            check(
              "registration uses existing route",
              await action.getAttribute("href"),
              "/platform-admin/providers",
            );
            check("no ineffective clear button", await panel.getByRole("button").count(), 0);
            await page.keyboard.press("Enter");
            await expect(page.locator(".provider-registry")).toBeVisible();
            check(
              "registration link reaches P46",
              new URL(page.url()).pathname,
              "/platform-admin/providers",
            );
          } else {
            check(
              "no registration action for filtered results",
              await panel.getByRole("link").count(),
              0,
            );
            await page.keyboard.press("Enter");
            await expect(center.locator(".adapter-toolbar > span")).toHaveText("2 个结果");
            check("reset restores search", await input.inputValue(), "");
            check(
              "reset restores five selectors",
              await selects.evaluateAll((els) => els.map((el) => el.value)),
              ["all", "all", "all", "all", "attention"],
            );
            check("empty panel disappears", await panel.count(), 0);
            check(
              "reset focus target",
              await page.evaluate(() =>
                document.activeElement?.matches(".adapter-search input")
                  ? "search"
                  : document.activeElement?.tagName,
              ),
              mode === "review" ? "search" : "BODY",
            );
            await picture(center.locator(".adapter-toolbar"), "reset");
            await input.fill("不存在的来源");
            const toolbarReset = center.locator(".adapter-reset");
            await toolbarReset.focus();
            await page.keyboard.press("Enter");
            await expect(center.locator(".adapter-toolbar > span")).toHaveText("2 个结果");
            check(
              "toolbar reset keeps its own focus",
              await toolbarReset.evaluate((el) => document.activeElement === el),
            );
          }
          check("no extra adapter GET", reads, 1);
          check(
            "no write requests",
            requests.filter((req) => !req.key.startsWith("GET ")).length,
            0,
          );
          check(
            "no request bodies",
            requests.every((req) => req.body === null),
          );
          check("no unexpected network", unexpected, []);
          check("no runtime errors", errors, []);
          runs.push({ mode, width, scene, checks, requests });
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
          kind: "P47-EMPTY-REVIEW-r1",
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
            "Actual Vue baseline and isolated review. Only empty copy/classes/CSS plus local post-reset focus wrapper differ. Existing reset, six filter values, APIs and permissions unchanged. Local empty array/original M03 fixtures; no real API/probe/registration writes or deployment. Not full-page or a11y acceptance.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P47 空态审核</title><style>body{font:16px/1.7 sans-serif;margin:24px}img{max-width:100%}article{margin:32px 0}</style><h1>P47 空态 · 独立审核稿</h1><p>实际Vue、本地测试数据；生产未改。baseline保留原状，review为待审提案。普通空目录与筛选无结果分开；清除筛选焦点修复仅在预览。</p>' +
        screenshots
          .map(
            (s) =>
              `<article><h2>${s.mode} / ${s.width} / ${s.scene} / ${s.suffix}</h2><img loading="lazy" alt="${s.scene} ${s.suffix}" src="${s.file}"></article>`,
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((n, r) => n + r.checks.length, 0),
      screenshots: screenshots.length,
      sources: sources.size,
      ports,
    }),
  );
} finally {
  await browser?.close();
  await server?.close();
}
