import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import {
  previewAdapterLoading,
  loadingTitle,
  loadingDescription,
} from "./lib/ui-phase2-adapter-loading-preview.mjs";

assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture");
const output = "output/playwright/p47-loading-review";
const component = "apps/web/src/components/ProviderAdapterCenter.vue";
const css =
  "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-loading-preview.css";
const fixture = "tests/e2e/m03-03-provider-adapter.spec.ts";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const source = await read(component),
  replacement = previewAdapterLoading(source);
assert.equal(source.split("</script>")[0], replacement.split("</script>")[0]);
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
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  box,
);
const data = JSON.parse(JSON.stringify(box.data));
const sources = new Set([
  component,
  css,
  fixture,
  "scripts/lib/ui-phase2-adapter-loading-preview.mjs",
  "scripts/verify-ui-phase2-provider-adapter-loading.mjs",
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
                name: "p47-loading-review-only",
                enforce: "pre",
                transform(text, id) {
                  if (id.replaceAll("\\", "/") !== path.resolve(component).replaceAll("\\", "/"))
                    return null;
                  assert.equal(text.replaceAll("\r\n", "\n"), source);
                  return { code: replacement, map: null };
                },
                transformIndexHtml(html) {
                  return html
                    .replace("<body>", '<body class="p47-loading-review">')
                    .replace(
                      "</head>",
                      `<link rel="stylesheet" href="/@fs/${path.resolve(css).replaceAll("\\", "/")}"></head>`,
                    );
                },
              },
            ],
    });
    await server.listen();
    console.log(`P47 loading ${mode} ${origin}`);
    for (const width of [390, 760, 1440])
      for (const scene of ["initial", "refresh"])
        for (const outcome of ["success", "error"]) {
          const context = await browser.newContext({
            viewport: { width, height: 1200 },
            locale: "zh-CN",
            timezoneId: "Asia/Shanghai",
            reducedMotion: "reduce",
          });
          let release;
          try {
            const page = await context.newPage(),
              requests = [],
              unexpected = [],
              errors = [],
              checks = [];
            let reads = 0;
            const gate = new Promise((resolve) => {
              release = resolve;
            });
            const check = (name, actual, expected = true) => {
              assert.deepEqual(actual, expected, `${mode}/${width}/${scene}/${outcome}:${name}`);
              checks.push({ name, actual });
            };
            const picture = async (locator, suffix) => {
              if (!capture) return;
              const file = `${mode}-${width}-${scene}-${outcome}-${suffix}.png`,
                bytes = await locator.screenshot({ animations: "disabled" });
              await writeFile(`${output}/${file}`, bytes);
              screenshots.push({
                file,
                mode,
                width,
                scene,
                outcome,
                suffix,
                sha256: hash(bytes),
                pixelWidth: bytes.readUInt32BE(16),
                pixelHeight: bytes.readUInt32BE(20),
              });
            };
            await page.clock.install({ time: new Date("2026-09-11T06:00:00Z") });
            page.on("pageerror", (error) => errors.push(error.message));
            await page.route("**/*", async (route) => {
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
                return route.fulfill({ json: { data: data.navigation, request_id: "nav" } });
              if (url.pathname.endsWith("session-status"))
                return route.fulfill({ json: { data: { authenticated: true } } });
              reads++;
              if (scene === "refresh" && reads === 1)
                return route.fulfill({ json: { data: data.items, request_id: "initial" } });
              await gate;
              return outcome === "success"
                ? route.fulfill({ json: { data: data.items, request_id: "settled-read" } })
                : route.fulfill({
                    status: 409,
                    json: {
                      error: { code: "read_test_error", message: "本地测试读取失败" },
                      request_id: "settled-read",
                    },
                  });
            });
            await page.goto(origin + "/platform-admin/providers/adapters");
            const center = page.locator(".adapter-center"),
              panel = center.locator(".ui-state-panel"),
              refresh = center.locator(".adapter-heading-actions button"),
              input = center.locator(".adapter-search input");
            if (scene === "refresh") {
              await expect(center.locator(".adapter-toolbar > span")).toHaveText("2 个结果");
              await input.fill("公开趋势");
              await refresh.click();
            }
            await expect(refresh).toBeDisabled();
            await expect(refresh).toHaveText("刷新中…");
            await expect.poll(() => reads).toBe(scene === "initial" ? 1 : 2);
            check("pending disables duplicate refresh", await refresh.isDisabled());
            if (scene === "initial") {
              await expect(panel).toHaveAttribute("data-kind", "loading");
              check("busy announcement", await panel.getAttribute("aria-busy"), "true");
              check("polite announcement", await panel.getAttribute("aria-live"), "polite");
              check(
                "decorative skeleton hidden from accessibility tree",
                await panel.locator(".ui-state-skeleton").getAttribute("aria-hidden"),
                "true",
              );
              check("no loading action", await panel.getByRole("button").count(), 0);
              check(
                "no invented data while initial read pending",
                await center.locator(".adapter-metrics").count(),
                0,
              );
              if (mode === "review") {
                await expect(panel.getByRole("heading")).toHaveText(loadingTitle);
                await expect(panel).toContainText(loadingDescription);
              }
            } else {
              check(
                "refresh retains metrics",
                await center.locator(".adapter-metrics strong").allTextContents(),
                ["2", "1", "1", "1"],
              );
              check(
                "refresh retains filtered snapshot",
                await center.locator(".adapter-toolbar > span").textContent(),
                "1 个结果",
              );
              check("refresh does not replace snapshot with skeleton", await panel.count(), 0);
            }
            const region = scene === "initial" ? panel : center.locator(".adapter-heading");
            await page.evaluate(() => document.fonts.ready);
            check(
              "no horizontal overflow",
              await region.evaluate(
                (el) =>
                  el.scrollWidth <= el.clientWidth + 1 &&
                  document.documentElement.scrollWidth <= innerWidth + 1,
              ),
            );
            await picture(region, "pending");
            const focusTarget =
              scene === "initial" ? center.locator(".adapter-heading-actions a") : input;
            await focusTarget.focus();
            await expect(focusTarget).toBeFocused();
            release();
            await expect(refresh).toBeEnabled();
            check(
              "settlement preserves chosen focus",
              await focusTarget.evaluate((el) => document.activeElement === el),
            );
            if (scene === "initial" && outcome === "error") {
              await expect(panel).toHaveAttribute("data-kind", "error");
              check(
                "initial failure contains real fixture trace",
                await panel.locator("dd").textContent(),
                "settled-read",
              );
            } else {
              await expect(center.locator(".adapter-toolbar > span")).toHaveText(
                scene === "initial" ? "2 个结果" : "1 个结果",
              );
              check(
                "settled metrics reflect original fixture",
                await center.locator(".adapter-metrics strong").allTextContents(),
                ["2", "1", "1", "1"],
              );
              if (scene === "refresh") {
                check("settlement retains query", await input.inputValue(), "公开趋势");
                if (outcome === "error") {
                  await expect(center.locator(".adapter-message")).toBeVisible();
                  check(
                    "refresh failure does not discard snapshot",
                    await center.locator(".ui-state-panel").count(),
                    0,
                  );
                }
              }
            }
            await picture(
              scene === "initial" && outcome === "error"
                ? panel
                : center.locator(".adapter-heading"),
              "settled",
            );
            check("no automatic extra read", reads, scene === "initial" ? 1 : 2);
            check("no write requests", requests.filter((r) => !r.key.startsWith("GET ")).length, 0);
            check(
              "no request bodies",
              requests.every((r) => r.body === null),
            );
            check("no unexpected network", unexpected, []);
            check("no runtime errors", errors, []);
            runs.push({ mode, width, scene, outcome, checks, requests });
          } finally {
            release?.();
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
          kind: "P47-LOADING-REVIEW-r1",
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
            "Actual App, original scripts/events unchanged; two loading-only props and loading-only CSS in review. Initial/refresh pending held locally and settled success or409. Existing initial no-data and refresh retained-snapshot semantics unchanged. No real API/probe/deployment, elapsed-time/timeout/full-a11y acceptance or review of other states.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P47 读取中审核</title><style>body{font:16px/1.7 sans-serif;margin:24px}img{max-width:100%}article{margin:32px 0}</style><h1>P47 读取中 · 独立审核稿</h1><p>实际Vue，本地等待与成功/409样例。仅首次读取中区域有新构图，刷新标题保持当前C。其他状态截图用于验证，不代表批准。生产未改。</p>' +
        screenshots
          .map(
            (s) =>
              `<article><h2>${s.mode} / ${s.width} / ${s.scene} / ${s.outcome} / ${s.suffix}</h2><img loading="lazy" alt="${s.scene} ${s.suffix}" src="${s.file}"></article>`,
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
