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
  previewAdapterRefreshFailure,
  refreshFailureCopy,
} from "./lib/ui-phase2-adapter-refresh-failure-preview.mjs";

assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture");
const output = "output/playwright/p47-refresh-failure-review";
const component = "apps/web/src/components/ProviderAdapterCenter.vue";
const css =
  "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-refresh-failure-preview.css";
const fixture = "tests/e2e/m03-03-provider-adapter.spec.ts";
const read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const source = await read(component),
  replacement = previewAdapterRefreshFailure(source);
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
const cases = [
  { name: "conflict", status: 409, attempts: 1, hint: "请稍后重新读取最新状态。" },
  { name: "forbidden", status: 403, attempts: 1, hint: "当前账号不能读取最新状态。" },
  { name: "dependency", status: 503, attempts: 3, hint: "依赖恢复后可以重新读取。" },
];
const sources = new Set([
  component,
  css,
  fixture,
  "scripts/lib/ui-phase2-adapter-refresh-failure-preview.mjs",
  "scripts/verify-ui-phase2-provider-adapter-refresh-failure.mjs",
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
                name: "p47-refresh-failure-review-only",
                enforce: "pre",
                transform(text, id) {
                  if (id.replaceAll("\\", "/") !== path.resolve(component).replaceAll("\\", "/"))
                    return null;
                  assert.equal(text.replaceAll("\r\n", "\n"), source);
                  return { code: replacement, map: null };
                },
                transformIndexHtml(html) {
                  return html
                    .replace("<body>", '<body class="p47-refresh-failure-review">')
                    .replace(
                      "</head>",
                      `<link rel="stylesheet" href="/@fs/${path.resolve(css).replaceAll("\\", "/")}"></head>`,
                    );
                },
              },
            ],
    });
    await server.listen();
    console.log(`P47 refresh failure ${mode} ${origin}`);
    for (const width of [390, 760, 1440])
      for (const scene of cases) {
        const context = await browser.newContext({
          viewport: { width, height: 1200 },
          locale: "zh-CN",
          timezoneId: "Asia/Shanghai",
          reducedMotion: "reduce",
        });
        let releaseRetry;
        try {
          const page = await context.newPage(),
            requests = [],
            unexpected = [],
            errors = [],
            checks = [];
          let reads = 0,
            failureAttempts = 0,
            retrying = false;
          const retryGate = new Promise((resolve) => (releaseRetry = resolve));
          const check = (name, actual, expected = true) => {
            assert.deepEqual(actual, expected, `${mode}/${width}/${scene.name}:${name}`);
            checks.push({ name, actual });
          };
          const picture = async (locator, suffix) => {
            if (!capture) return;
            const file = `${mode}-${width}-${scene.name}-${suffix}.png`,
              bytes = await locator.screenshot({ animations: "disabled" });
            await writeFile(`${output}/${file}`, bytes);
            screenshots.push({
              file,
              mode,
              width,
              scene: scene.name,
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
            if (reads === 1)
              return route.fulfill({ json: { data: data.items, request_id: "initial-success" } });
            if (retrying) {
              await retryGate;
              return route.fulfill({ json: { data: data.items, request_id: "retry-success" } });
            }
            failureAttempts++;
            return route.fulfill({
              status: scene.status,
              json: {
                error: {
                  code: `refresh_${scene.name}`,
                  message: "本地刷新失败样例",
                  action_hint: scene.hint,
                },
                request_id: `refresh-${scene.name}-${failureAttempts}`,
              },
            });
          });
          await page.goto(origin + "/platform-admin/providers/adapters");
          const center = page.locator(".adapter-center"),
            input = center.locator(".adapter-search input"),
            topRefresh = center.locator(".adapter-heading-actions button");
          await expect(center.locator(".adapter-toolbar > span")).toHaveText("2 个结果");
          await input.fill("公开趋势");
          await expect(center.locator(".adapter-toolbar > span")).toHaveText("1 个结果");
          await topRefresh.click();
          await expect(topRefresh).toBeEnabled();
          check("safe retry attempts", failureAttempts, scene.attempts);
          check(
            "old metrics retained",
            await center.locator(".adapter-metrics strong").allTextContents(),
            ["2", "1", "1", "1"],
          );
          check("search retained", await input.inputValue(), "公开趋势");
          check(
            "filtered snapshot retained",
            await center.locator(".adapter-toolbar > span").textContent(),
            "1 个结果",
          );
          const notice =
            mode === "review"
              ? center.locator(".adapter-refresh-failure")
              : center.locator(".adapter-message");
          await expect(notice).toBeVisible();
          await expect(notice).toContainText(scene.hint);
          check("single failure notice", await notice.count(), 1);
          check("status semantics", await notice.getAttribute("role"), "status");
          if (mode === "review") {
            await expect(notice.locator("small")).toHaveText(refreshFailureCopy.eyebrow);
            await expect(notice.getByRole("heading")).toHaveText(refreshFailureCopy.title);
            await expect(notice.locator("p")).toHaveText(refreshFailureCopy.description);
            check("atomic composed message", await notice.getAttribute("aria-atomic"), "true");
            check(
              "notice appears before retained directory",
              await notice.evaluate((el) =>
                Boolean(
                  el.compareDocumentPosition(document.querySelector(".responsive-data-view")) &
                  Node.DOCUMENT_POSITION_FOLLOWING,
                ),
              ),
            );
            check(
              "legacy bottom message suppressed",
              await center.locator(".adapter-message").count(),
              0,
            );
          }
          const details = notice.locator("details"),
            expectedTrace = `refresh-${scene.name}-${scene.attempts}`;
          await expect(details.locator("code")).toHaveText(expectedTrace);
          check("trace closed initially", await details.getAttribute("open"), null);
          check(
            "no horizontal overflow",
            await notice.evaluate(
              (el) =>
                el.scrollWidth <= el.clientWidth + 1 &&
                document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          );
          await page.evaluate(() => document.fonts.ready);
          await picture(notice, "failure");
          const summary = details.locator("summary");
          await summary.focus();
          await page.keyboard.press("Enter");
          await expect(details).toHaveAttribute("open", "");
          await expect(summary).toBeFocused();
          check(
            "trace summary 44px",
            await summary.evaluate((el) => el.getBoundingClientRect().height >= 44),
          );
          await picture(notice, "trace");
          const retryAction =
            mode === "review"
              ? notice.getByRole("button", { name: "重新刷新", exact: true })
              : topRefresh;
          await retryAction.focus();
          await expect(retryAction).toBeFocused();
          check(
            "retry action 44px",
            await retryAction.evaluate((el) => {
              const r = el.getBoundingClientRect();
              return r.width >= 44 && r.height >= 44;
            }),
          );
          retrying = true;
          await page.keyboard.press("Enter");
          await expect(topRefresh).toBeDisabled();
          await expect(topRefresh).toHaveText("刷新中…");
          const retryFocus =
            mode === "review" ? center.locator(".adapter-heading") : page.locator("body");
          await expect(retryFocus).toBeFocused();
          check(
            "retry focus target",
            await page.evaluate(() =>
              document.activeElement?.matches(".adapter-heading")
                ? "heading"
                : document.activeElement?.tagName,
            ),
            mode === "review" ? "heading" : "BODY",
          );
          check("failure notice removed while retrying", await notice.count(), 0);
          check(
            "retained snapshot remains during retry",
            await center.locator(".adapter-toolbar > span").textContent(),
            "1 个结果",
          );
          await picture(center.locator(".adapter-heading"), "retry-pending");
          releaseRetry();
          await expect(topRefresh).toBeEnabled();
          await expect(center.locator(".adapter-message")).toContainText(
            "已刷新 2 个来源适配器状态",
          );
          check(
            "retry settlement keeps chosen focus",
            await retryFocus.evaluate((el) => document.activeElement === el),
          );
          check(
            "successful retry clears failure composition",
            await center.locator(".adapter-refresh-failure").count(),
            0,
          );
          check("one explicit retry GET", reads, 1 + scene.attempts + 1);
          check("no write requests", requests.filter((r) => !r.key.startsWith("GET ")).length, 0);
          check(
            "no request bodies",
            requests.every((r) => r.body === null),
          );
          check("no unexpected network", unexpected, []);
          check("no runtime errors", errors, []);
          runs.push({ mode, width, scene: scene.name, checks, requests });
        } finally {
          releaseRetry?.();
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
          kind: "P47-REFRESH-FAILURE-REVIEW-r1",
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
            "Actual App and original list data. Review-only notice state/classification/template/retry-focus wrapper/CSS; APIs, filters, retry rules and stored data unchanged. Local409/403/503 then explicit successful retry; no real API/probe/write/deploy. Not production, timeout, full a11y or page acceptance.",
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      `${output}/index.html`,
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P47 刷新失败审核</title><style>body{font:16px/1.7 sans-serif;margin:24px}img{max-width:100%}article{margin:32px 0}</style><h1>P47 刷新失败保留旧目录 · 独立审核稿</h1><p>实际Vue，本地409/403/503和随后成功重试。提案将失败放在筛选后、目录前；生产未改。图片不代表真实权限、依赖或整页验收。</p>' +
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
