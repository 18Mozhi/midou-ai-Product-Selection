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
  previewProviderSourcesStates,
  sourceStateCopy,
} from "./lib/ui-phase2-provider-sources-states-preview.mjs";

assert.ok(process.argv.slice(2).every((argument) => argument === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p48-source-states-review",
  component = "apps/web/src/components/ProviderSourceCenter.vue",
  pageCss = "design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-page-preview.css",
  stateCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-states-preview.css",
  fixture = "tests/e2e/m03-07-provider-sources.spec.ts",
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  source = await read(component),
  replacement = previewProviderSourcesStates(source),
  scenes = [
    { name: "loading", kind: "loading", status: null, attempts: 1 },
    { name: "empty", kind: "empty", status: 200, attempts: 1 },
    { name: "expired", kind: "expired", status: 401, attempts: 1 },
    { name: "forbidden", kind: "forbidden", status: 403, attempts: 1 },
    {
      name: "rate-limited",
      kind: "blocked",
      status: 429,
      attempts: 3,
      actionHint: "请求较为频繁，请稍后重新加载来源目录。",
    },
    {
      name: "dependency",
      kind: "blocked",
      status: 503,
      attempts: 3,
      actionHint: "依赖服务暂时不可用，请稍后重新加载来源目录。",
    },
    {
      name: "error",
      kind: "error",
      status: 500,
      attempts: 1,
      actionHint: "来源目录读取失败，请稍后重新加载。",
    },
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
    stateCss,
    fixture,
    "scripts/lib/ui-phase2-provider-sources-states-preview.mjs",
    "scripts/verify-ui-phase2-provider-sources-states.mjs",
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
        name: "p48-source-states-review-only",
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
          const styles = [pageCss, stateCss]
            .map(
              (file) =>
                `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
            )
            .join("");
          return html
            .replace("<body>", '<body class="p48-source-page-review p48-source-state-review">')
            .replace("</head>", `${styles}</head>`);
        },
      },
    ],
  });
  await server.listen();
  console.log(`P48 source states ${origin}`);
  for (const width of [390, 760, 1024, 1440])
    for (const scene of scenes) {
      const context = await browser.newContext({
        viewport: { width, height: width <= 760 ? 1000 : 1200 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
      let releaseLoading;
      try {
        const page = await context.newPage(),
          requests = [],
          unexpected = [],
          errors = [],
          checks = [];
        let reads = 0,
          recovering = false;
        const loadingGate = new Promise((resolve) => (releaseLoading = resolve)),
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
          if (recovering)
            return route.fulfill({
              json: { data: data.sources, request_id: `p48-${scene.name}-recovered` },
            });
          if (scene.name === "loading") {
            await loadingGate;
            return route.fulfill({
              json: { data: data.sources, request_id: "p48-loading-complete" },
            });
          }
          if (scene.name === "empty")
            return route.fulfill({ json: { data: [], request_id: "p48-empty-1" } });
          return route.fulfill({
            status: scene.status,
            json: {
              error: {
                code: `p48_${scene.name.replaceAll("-", "_")}`,
                message: "来源目录请求未完成",
                action_hint:
                  scene.actionHint ??
                  (scene.kind === "expired"
                    ? "请重新登录后继续。"
                    : "当前账号还没有来源管理权限。"),
              },
              request_id: `p48-${scene.name}-${reads}`,
              trace_id: `p48-${scene.name}-${reads}`,
            },
          });
        });
        await page.goto(origin + "/platform-admin/providers/sources");
        const center = page.locator(".source-center"),
          host = center.locator(".p48-source-state-host"),
          panel = center.locator(".p48-source-state-panel"),
          primary = panel.locator(".p48-source-state-primary"),
          pageHeading = center.locator(".source-guide h2");
        await expect(panel).toHaveAttribute("data-kind", scene.kind);
        await expect(host).toHaveAttribute("aria-live", "polite");
        await expect(panel.getByRole("heading")).toHaveText(sourceStateCopy[scene.kind].title);
        await expect(panel.locator(".p48-source-state-eyebrow")).toHaveText(
          sourceStateCopy[scene.kind].eyebrow,
        );
        if (scene.kind === "blocked" || scene.kind === "error")
          await expect(panel.locator(".p48-source-state-description")).toHaveText(scene.actionHint);
        else
          await expect(panel.locator(".p48-source-state-description")).toHaveText(
            sourceStateCopy[scene.kind].description,
          );
        check("safe initial attempts", reads, scene.attempts);
        check(
          "state hides irrelevant directory chrome",
          await center
            .locator(
              ":is(.source-guide-actions, .source-metrics, .source-help, .source-filter):visible",
            )
            .count(),
          0,
        );
        check(
          "no duplicated global message",
          await center.locator(".source-message:visible").count(),
          0,
        );
        check(
          "loading busy truth",
          await panel.getAttribute("aria-busy"),
          String(scene.kind === "loading"),
        );
        check("one state heading", await panel.getByRole("heading").count(), 1);
        if (scene.kind === "loading") {
          check("loading has no fabricated action", await primary.count(), 0);
          check("loading has no request ID", await panel.locator("code").count(), 0);
          await picture(panel, "state");
          releaseLoading();
          await expect(center.locator(".source-list article")).toHaveCount(20);
          check("loading completes with original GET", reads, 1);
        } else {
          await expect(primary).toHaveText(scene.kind === "expired" ? "重新登录" : "重新加载目录");
          check("one visible recovery action", await primary.count(), 1);
          check(
            "recovery action44",
            await primary.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              return rect.width >= 44 && rect.height >= 44;
            }),
          );
          const details = panel.locator(".p48-source-state-technical");
          await expect(details).toBeVisible();
          await expect(details).not.toHaveAttribute("open", "");
          await expect(details.locator("code")).toHaveText(`p48-${scene.name}-${scene.attempts}`);
          await primary.focus();
          await expect(primary).toBeFocused();
          await picture(panel, "state");
          if (width === 390) {
            await details.locator("summary").click();
            await expect(details).toHaveAttribute("open", "");
            await picture(panel, "technical");
            await details.locator("summary").click();
          }
          if (scene.kind === "expired") {
            await primary.focus();
            await page.keyboard.press("Enter");
            await expect(page.locator(".identity-page[data-mode='login']")).toBeVisible();
            check("expired reaches verified login route", new URL(page.url()).pathname, "/login");
            check("expired adds no source GET", reads, scene.attempts);
          } else {
            recovering = true;
            await primary.focus();
            await page.keyboard.press("Enter");
            await expect(center.locator(".source-list article")).toHaveCount(20);
            await expect(pageHeading).toBeFocused();
            check("one explicit recovery GET", reads, scene.attempts + 1);
            check(
              "recovery restores full result count",
              await center.locator(".source-result-count").textContent(),
              "找到 146 个来源",
            );
          }
        }
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
        runs.push({ width, scene: scene.name, kind: scene.kind, checks, requests });
      } finally {
        releaseLoading?.();
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
  kind: "P48-SOURCE-STATES-REVIEW-r1",
  reviewOnly: true,
  processesClosed: true,
  ports,
  runs,
  screenshots,
  sourceHashes,
  boundary:
    "Actual App/current ProviderSourceCenter with exact review-only state template transform and P48 CSS. Seven first-load scenes preserve current HTTP-to-state mapping, safe GET retry counts,146-row recovery and verified /login route. No production/API/permission/write/external/deploy change; no real RBAC,MySQL,dependency or production verification.",
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P48 来源目录状态审核</title><style>body{margin:0;padding:24px;background:#e9eef5;color:#142a46;font-family:sans-serif}main{display:grid;gap:24px}article{padding:16px;background:white;border:1px solid #cfd9e7}h1,h2{margin:0 0 12px}h2{font-size:16px}img{display:block;max-width:100%;height:auto;border:1px solid #d8e0eb}</style><main><h1>P48 来源目录状态审核</h1>${screenshots.map((shot) => `<article><h2>${shot.width} · ${shot.scene} · ${shot.suffix}</h2><img src="${shot.file}" alt="${shot.width} ${shot.scene} ${shot.suffix}"></article>`).join("")}</main></html>`,
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
