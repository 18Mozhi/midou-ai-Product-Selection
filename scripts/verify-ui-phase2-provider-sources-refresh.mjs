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
  previewProviderSourcesRefresh,
  refreshCopy,
} from "./lib/ui-phase2-provider-sources-refresh-preview.mjs";

assert.ok(process.argv.slice(2).every((argument) => argument === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p48-source-refresh-review",
  component = "apps/web/src/components/ProviderSourceCenter.vue",
  pageCss = "design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-page-preview.css",
  refreshCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-refresh-preview.css",
  fixture = "tests/e2e/m03-07-provider-sources.spec.ts",
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  source = await read(component),
  replacement = previewProviderSourcesRefresh(source),
  scenes = [
    { name: "success", outcome: "success", attempts: 1 },
    {
      name: "rate-limited",
      outcome: "failure",
      status: 429,
      kind: "blocked",
      attempts: 3,
      actionHint: "请求较为频繁，请稍后重新加载来源目录。",
    },
    {
      name: "dependency",
      outcome: "failure",
      status: 503,
      kind: "blocked",
      attempts: 3,
      actionHint: "依赖服务暂时不可用，请稍后重新加载来源目录。",
    },
    {
      name: "error",
      outcome: "failure",
      status: 500,
      kind: "error",
      attempts: 1,
      actionHint: "来源目录更新失败，请稍后重新加载。",
    },
    { name: "timeout", outcome: "timeout", kind: "blocked", attempts: 1 },
  ];

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
    ["org", "ws", "navigation", "automatic", "setup", "manual", "sources"]
      .map(declarationSource)
      .join("\n") + '\nglobalThis.data={navigation:navigation("platform_admin"),sources};',
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  box,
);
const data = JSON.parse(JSON.stringify(box.data)),
  sources = new Set([
    component,
    pageCss,
    refreshCss,
    fixture,
    "scripts/lib/ui-phase2-provider-sources-refresh-preview.mjs",
    "scripts/verify-ui-phase2-provider-sources-refresh.mjs",
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
        name: "p48-source-refresh-review-only",
        enforce: "pre",
        transform(text, id) {
          const bare = id.split("?", 1)[0];
          if (path.isAbsolute(bare)) {
            const relative = path.relative(process.cwd(), bare).replaceAll("\\", "/");
            if (
              !relative.includes("/node_modules/") &&
              (relative.startsWith("apps/") || relative.startsWith("packages/"))
            )
              sources.add(relative);
          }
          if (bare.replaceAll("\\", "/") !== path.resolve(component).replaceAll("\\", "/"))
            return null;
          assert.equal(text.replaceAll("\r\n", "\n"), source);
          return { code: replacement, map: null };
        },
        transformIndexHtml(html) {
          const styles = [pageCss, refreshCss]
            .map(
              (file) =>
                `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
            )
            .join("");
          return html
            .replace("<body>", '<body class="p48-source-page-review p48-source-refresh-review">')
            .replace("</head>", `${styles}</head>`);
        },
      },
    ],
  });
  await server.listen();
  console.log(`P48 source refresh ${origin}`);
  for (const width of [390, 760, 1024, 1440])
    for (const scene of scenes) {
      const context = await browser.newContext({
        viewport: { width, height: width <= 760 ? 1100 : 1400 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
      let releaseRefresh;
      try {
        const page = await context.newPage(),
          requests = [],
          unexpected = [],
          errors = [],
          checks = [];
        let reads = 0,
          refreshReleased = false,
          recovering = false;
        const refreshGate = new Promise((resolve) => (releaseRefresh = resolve)),
          check = (name, actual, expected = true) => {
            assert.deepEqual(actual, expected, `${width}/${scene.name}:${name}`);
            checks.push({ name, actual });
          },
          picture = async (locator, suffix) => {
            if (!capture) return;
            if (width <= 760) {
              await locator.evaluate((element) => {
                const top = window.scrollY + element.getBoundingClientRect().top - 60;
                window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
              });
              await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
            }
            const file = `${width}-${scene.name}-${suffix}.png`,
              bytes = await locator.screenshot({ animations: "disabled" });
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
        await page.clock.install({ time: new Date("2026-09-11T06:00:00Z") });
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
          if (
            ![
              "GET /api/v1/me/navigation",
              "GET /api/v1/auth/session-status",
              "GET /api/v1/platform/provider-sources",
            ].includes(key)
          ) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, body: request.postData() });
          if (url.pathname.endsWith("/me/navigation"))
            return route.fulfill({ json: { data: data.navigation, request_id: "p48-nav" } });
          if (url.pathname.endsWith("/auth/session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          reads++;
          if (reads === 1 || recovering)
            return route.fulfill({
              json: {
                data: data.sources,
                request_id: recovering ? `p48-${scene.name}-recovered` : "p48-initial",
              },
            });
          if (!refreshReleased) await refreshGate;
          if (scene.outcome === "timeout") {
            try {
              return await route.abort("timedout");
            } catch {
              return undefined;
            }
          }
          if (scene.outcome === "success")
            return route.fulfill({
              json: { data: data.sources, request_id: "p48-refresh-success" },
            });
          return route.fulfill({
            status: scene.status,
            json: {
              error: {
                code: `p48_refresh_${scene.name.replaceAll("-", "_")}`,
                message: "来源目录更新未完成",
                action_hint: scene.actionHint,
              },
              request_id: `p48-${scene.name}-${reads}`,
              trace_id: `p48-${scene.name}-${reads}`,
            },
          });
        });
        await page.goto(origin + "/platform-admin/providers/sources");
        const center = page.locator(".source-center"),
          records = center.locator(".source-list article"),
          headerRefresh = center.locator(".source-guide-actions > button"),
          host = center.locator(".p48-source-refresh-host"),
          feedback = center.locator(".p48-source-refresh-feedback"),
          pageHeading = center.locator(".source-guide h2");
        await expect(records).toHaveCount(20);
        await expect(center.locator(".source-result-count")).toHaveText("找到 146 个来源");
        check("initial catalog GET", reads, 1);
        await headerRefresh.focus();
        await page.keyboard.press("Enter");
        await expect(feedback).toHaveAttribute("data-kind", "refreshing");
        await expect(feedback.getByRole("heading")).toHaveText(refreshCopy.refreshing.title);
        await expect(feedback.locator(".p48-source-refresh-description")).toContainText(
          "上次成功加载的 146 个来源",
        );
        await expect(headerRefresh).toBeDisabled();
        await expect(headerRefresh).toHaveText("刷新中…");
        await expect(pageHeading).toBeFocused();
        check("pending keeps20 records", await records.count(), 20);
        check(
          "pending keeps146 result count",
          await center.locator(".source-result-count").textContent(),
          "找到 146 个来源",
        );
        check("pending has no stale request ID", await feedback.locator("code").count(), 0);
        check("pending starts one refresh GET", reads, 2);
        if (scene.outcome === "success") await picture(feedback, "refreshing");

        if (scene.outcome === "timeout") {
          await page.clock.runFor(12_000);
          refreshReleased = true;
          releaseRefresh();
        } else {
          refreshReleased = true;
          releaseRefresh();
        }

        if (scene.outcome === "success") {
          await expect(feedback).toHaveAttribute("data-kind", "success");
          await expect(feedback.getByRole("heading")).toHaveText(refreshCopy.success.title);
          await expect(feedback.locator(".p48-source-refresh-description")).toHaveText(
            "已刷新 146 个来源频道。",
          );
          await expect(feedback.locator(".p48-source-refresh-technical code")).toHaveText(
            "p48-refresh-success",
          );
          check(
            "success hides duplicate global message",
            await center.locator(".source-message:visible").count(),
            0,
          );
          await expect(pageHeading).toBeFocused();
          check("success uses one refresh GET", reads, 2);
          check("success keeps20 records", await records.count(), 20);
          await picture(feedback, "success");
        } else {
          await expect(feedback).toHaveAttribute("data-kind", "failed");
          await expect(feedback).toHaveAttribute("data-failure-kind", scene.kind);
          await expect(feedback.getByRole("heading")).toHaveText(refreshCopy[scene.kind].title);
          const expectedMessage =
            scene.outcome === "timeout"
              ? "刷新超时，已保留上一次成功加载的来源目录。"
              : `${scene.actionHint} 已保留上一次成功加载的来源目录。`;
          await expect(feedback.locator(".p48-source-refresh-description")).toHaveText(
            expectedMessage,
          );
          check("failure keeps20 records", await records.count(), 20);
          check(
            "failure keeps146 result count",
            await center.locator(".source-result-count").textContent(),
            "找到 146 个来源",
          );
          check(
            "failure hides duplicate global message",
            await center.locator(".source-message:visible").count(),
            0,
          );
          check("failure hides duplicate header refresh", await headerRefresh.isVisible(), false);
          const primary = feedback.locator(".p48-source-refresh-primary"),
            technical = feedback.locator(".p48-source-refresh-technical");
          await expect(primary).toHaveText("重新加载目录");
          await expect(primary).toBeFocused();
          check(
            "failure action44",
            await primary.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              return rect.width >= 44 && rect.height >= 44;
            }),
          );
          if (scene.outcome === "timeout")
            check("timeout has no stale request ID", await technical.count(), 0);
          else {
            await expect(technical.locator("code")).toHaveText(
              `p48-${scene.name}-${1 + scene.attempts}`,
            );
            if (width === 390) {
              await technical.locator("summary").click();
              await expect(technical).toHaveAttribute("open", "");
              await picture(feedback, "technical");
              await technical.locator("summary").click();
              await primary.focus();
            }
          }
          await picture(feedback, "failed");
          recovering = true;
          await primary.focus();
          await page.keyboard.press("Enter");
          await expect(feedback).toHaveAttribute("data-kind", "success");
          await expect(pageHeading).toBeFocused();
          await expect(records).toHaveCount(20);
          check("failure attempts follow current safe retry", reads, 1 + scene.attempts + 1);
          check(
            "recovery restores146 result count",
            await center.locator(".source-result-count").textContent(),
            "找到 146 个来源",
          );
        }
        await expect(host).toHaveAttribute("aria-live", "polite");
        check(
          "no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        check(
          "no write requests",
          requests.filter((entry) => !entry.key.startsWith("GET ")).length,
          0,
        );
        check(
          "no request bodies",
          requests.every((entry) => entry.body === null),
        );
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        runs.push({ width, scene: scene.name, outcome: scene.outcome, checks, requests });
      } finally {
        releaseRefresh?.();
        await context.close();
      }
    }
} finally {
  if (server) await server.close();
  if (browser) await browser.close();
}

const sourceHashes = {};
for (const file of [...sources].sort()) sourceHashes[file] = hash(await read(file));
const evidence = {
  kind: "P48-SOURCE-REFRESH-REVIEW-r1",
  reviewOnly: true,
  processesClosed: true,
  ports,
  runs,
  screenshots,
  sourceHashes,
  boundary:
    "Actual App/current ProviderSourceCenter with exact review-only refresh ownership/template transform and P48 CSS. Initial authoritative146-row directory remains visible during safe refresh and non-access failure;429/503 retry counts,500,12s abort,success and explicit recovery are local responses.401/403 preserve policy is intentionally unchanged and excluded pending a security decision. No production/API/permission/write/external/deploy change.",
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P48 来源目录刷新审核</title><style>body{margin:0;padding:24px;background:#e9eef5;color:#142a46;font-family:sans-serif}main{display:grid;gap:24px}article{padding:16px;background:white;border:1px solid #cfd9e7}h1,h2{margin:0 0 12px}h2{font-size:16px}img{display:block;max-width:100%;height:auto;border:1px solid #d8e0eb}</style><main><h1>P48 来源目录刷新审核</h1>${screenshots.map((shot) => `<article><h2>${shot.width} · ${shot.scene} · ${shot.suffix}</h2><img src="${shot.file}" alt="${shot.width} ${shot.scene} ${shot.suffix}"></article>`).join("")}</main></html>`,
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
