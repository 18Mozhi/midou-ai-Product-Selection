import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { buildAcceptanceDesignData } from "./lib/ui-phase2-1688-acceptance-design-data.mjs";
import {
  acceptanceReadStateCopy,
  previewAlibaba1688AcceptanceReadStates,
} from "./lib/ui-phase2-1688-acceptance-read-states-preview.mjs";

assert.ok(process.argv.slice(2).every((argument) => argument === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p49-acceptance-read-states-review",
  component = "apps/web/src/components/Alibaba1688AcceptanceCenter.vue",
  pageCss = "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-page-preview.css",
  stateCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-read-states-preview.css",
  fixture = "tests/e2e/m03-07-provider-sources.spec.ts",
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  source = await read(component),
  replacement = previewAlibaba1688AcceptanceReadStates(source),
  { data: acceptanceData } = await buildAcceptanceDesignData(process.cwd());

const fixtureAst = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true),
  declarations = [];
function visit(node) {
  if (ts.isVariableDeclaration(node)) declarations.push(node);
  ts.forEachChild(node, visit);
}
visit(fixtureAst);
const navigationDeclaration = declarations.filter(
  (node) => node.name.getText(fixtureAst) === "navigation",
);
assert.equal(navigationDeclaration.length, 1, "one navigation fixture");
const fixtureBox = {};
vm.runInNewContext(
  ts.transpileModule(
    `const navigation=${navigationDeclaration[0].initializer.getText(fixtureAst)};globalThis.value=navigation("platform_admin");`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  fixtureBox,
);
const navigation = JSON.parse(JSON.stringify(fixtureBox.value)),
  scenes = [
    { name: "initial-loading", mode: "loading", headline: acceptanceReadStateCopy.loading },
    { name: "service-unavailable", mode: "error", headline: acceptanceReadStateCopy.error },
    {
      name: "permission-unavailable",
      mode: "forbidden",
      headline: acceptanceReadStateCopy.forbidden,
    },
    { name: "session-expired", mode: "expired", headline: acceptanceReadStateCopy.expired },
    { name: "refresh-in-progress", mode: "refreshing", headline: "尚未满足启用条件" },
    { name: "refresh-failed-preserved", mode: "preserved", headline: "尚未满足启用条件" },
  ],
  widths = [390, 760, 1024, 1440],
  errorPayload = (status) => ({
    error: {
      code:
        status === 401
          ? "session_expired"
          : status === 403
            ? "permission_denied"
            : "dependency_unavailable",
      message:
        status === 401
          ? "登录状态已失效"
          : status === 403
            ? "当前账号没有读取启用条件的权限"
            : "启用检查服务暂不可用",
      action_hint:
        status === 401
          ? "请重新登录后继续。"
          : status === 403
            ? "如需查看，请联系平台管理员调整权限。"
            : "请稍后重新读取。",
    },
    request_id: `p49-read-${status}`,
    trace_id: `p49-read-${status}`,
  }),
  loadedSources = new Set([
    component,
    pageCss,
    stateCss,
    fixture,
    "scripts/lib/ui-phase2-1688-acceptance-design-data.mjs",
    "scripts/lib/ui-phase2-1688-acceptance-page-preview.mjs",
    "scripts/lib/ui-phase2-1688-acceptance-read-states-preview.mjs",
    "scripts/verify-ui-phase2-1688-acceptance-read-states.mjs",
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
        name: "p49-acceptance-read-states-review-only",
        enforce: "pre",
        transform(text, id) {
          if (id.includes("?")) return null;
          const bare = id.split("?", 1)[0],
            normalized = bare.replaceAll("\\", "/");
          if (path.isAbsolute(bare)) {
            const relative = path.relative(process.cwd(), bare).replaceAll("\\", "/");
            if (
              !relative.includes("/node_modules/") &&
              (relative.startsWith("apps/") || relative.startsWith("packages/"))
            )
              loadedSources.add(relative);
          }
          if (normalized !== path.resolve(component).replaceAll("\\", "/")) return null;
          assert.equal(text.replaceAll("\r\n", "\n"), source);
          return { code: replacement, map: null };
        },
        transformIndexHtml(html) {
          const links = [pageCss, stateCss]
            .map(
              (file) =>
                `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
            )
            .join("");
          return html
            .replace("<body>", '<body class="p49-acceptance-review p49-acceptance-read-review">')
            .replace("</head>", `${links}</head>`);
        },
      },
    ],
  });
  await server.listen();
  console.log(`P49 acceptance read states ${origin}`);

  for (const width of widths)
    for (const scene of scenes) {
      const context = await browser.newContext({
        viewport: { width, height: width <= 760 ? 980 : 1080 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage(),
          requests = [],
          unexpected = [],
          errors = [],
          consoleErrors = [],
          checks = [],
          check = (name, actual, expected = true) => {
            assert.deepEqual(actual, expected, `${width}/${scene.name}:${name}`);
            checks.push({ name, actual });
          },
          picture = async (suffix = "full") => {
            if (!capture) return;
            const file = `${width}-${scene.name}-${suffix}.png`,
              bytes = await page.screenshot({ fullPage: true, animations: "disabled" });
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
        let acceptanceReads = 0,
          releaseRead;
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });
        await page.route("**/*", async (route) => {
          const request = route.request(),
            url = new URL(request.url()),
            key = `${request.method()} ${url.pathname}`;
          if (url.origin !== origin) {
            unexpected.push(`external ${key}`);
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          const allowed = [
            "GET /api/v1/me/navigation",
            "GET /api/v1/auth/session-status",
            "GET /api/v1/platform/provider-sources/1688-acceptance",
            "GET /api/v1/org/memberships",
            `GET /api/v1/org/${acceptanceData.organizations[0].id}/workspaces`,
          ];
          if (!allowed.includes(key)) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, body: request.postData() });
          if (url.pathname.endsWith("/me/navigation"))
            return route.fulfill({ json: { data: navigation, request_id: "p49-navigation" } });
          if (url.pathname.endsWith("/auth/session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          if (url.pathname.endsWith("/org/memberships"))
            return route.fulfill({
              json: { data: acceptanceData.organizations, request_id: "p49-organizations" },
            });
          if (url.pathname.includes("/workspaces"))
            return route.fulfill({
              json: { data: acceptanceData.workspaces, request_id: "p49-workspaces" },
            });
          acceptanceReads += 1;
          if (scene.mode === "loading" || (scene.mode === "refreshing" && acceptanceReads > 1))
            await new Promise((resolve) => {
              releaseRead = resolve;
            });
          if (scene.mode === "error" || (scene.mode === "preserved" && acceptanceReads > 1))
            return route.fulfill({ status: 503, json: errorPayload(503) });
          if (scene.mode === "forbidden")
            return route.fulfill({ status: 403, json: errorPayload(403) });
          if (scene.mode === "expired")
            return route.fulfill({ status: 401, json: errorPayload(401) });
          return route.fulfill({
            json: { data: acceptanceData.original, request_id: `p49-${scene.name}` },
          });
        });

        await page.goto(origin + "/platform-admin/providers/sources/1688-acceptance");
        const root = page.locator(".p49-acceptance"),
          refresh = root.locator(".acceptance-1688__refresh button");
        await expect(root).toBeVisible();
        if (scene.mode === "refreshing" || scene.mode === "preserved") {
          await expect(root.getByRole("heading", { name: scene.headline })).toHaveCount(1);
          await refresh.click();
          if (scene.mode === "refreshing") {
            await expect(refresh).toBeDisabled();
            await expect(refresh).toHaveText("刷新中…");
            await expect(root).toHaveAttribute("aria-busy", "true");
            check(
              "old verdict retained while refreshing",
              await root.getByText("2 / 3").count(),
              1,
            );
          } else {
            await expect(root.getByText(acceptanceReadStateCopy.preserved)).toBeVisible();
            await expect(root.getByRole("button", { name: "重新刷新" })).toBeVisible();
            check("old verdict retained after failure", await root.getByText("2 / 3").count(), 1);
            check("preserved state ready", await root.getAttribute("data-state"), "ready");
          }
        } else {
          const heading = root.getByRole("heading", { name: scene.headline });
          await expect(heading).toBeVisible();
          check("initial view state", await root.getAttribute("data-state"), scene.mode);
          if (scene.mode === "loading") {
            await expect(
              root.getByText("正在读取登录态、验证码和字段解析三项真实证据。"),
            ).toBeVisible();
            await expect(refresh).toBeDisabled();
            check(
              "no recovery action while loading",
              await root.locator(".p49-read__state > a,.p49-read__state > button").count(),
              0,
            );
          } else {
            const details = root.getByText("查看服务提示");
            await expect(details).toBeVisible();
            check(
              "service hint collapsed by default",
              await details.locator("xpath=..").getAttribute("open"),
              null,
            );
            if (scene.mode === "error")
              await expect(root.getByRole("button", { name: "重新读取" })).toBeVisible();
            if (scene.mode === "forbidden") {
              await expect(
                root.getByText(
                  "当前账号还没有查看此页面的权限，可以返回平台概览继续处理其他工作。",
                ),
              ).toBeVisible();
              await expect(root.getByRole("link", { name: "返回平台概览" })).toHaveAttribute(
                "href",
                "/platform-admin",
              );
            }
            if (scene.mode === "expired")
              await expect(root.getByRole("link", { name: "重新登录" })).toHaveAttribute(
                "href",
                "/login",
              );
          }
        }

        const representative = [refresh];
        if (scene.mode === "error")
          representative.push(root.getByRole("button", { name: "重新读取" }));
        if (scene.mode === "forbidden")
          representative.push(root.getByRole("link", { name: "返回平台概览" }));
        if (scene.mode === "expired")
          representative.push(root.getByRole("link", { name: "重新登录" }));
        if (scene.mode === "preserved")
          representative.push(root.getByRole("button", { name: "重新刷新" }));
        check(
          "44px representative controls",
          await Promise.all(
            representative.map(async (locator) => {
              const bounds = await locator.boundingBox();
              return Boolean(bounds && bounds.height >= 44);
            }),
          ),
          representative.map(() => true),
        );
        check(
          "no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        );
        const expectedAcceptanceReads =
          scene.mode === "error"
            ? 3
            : scene.mode === "preserved"
              ? 4
              : scene.mode === "refreshing"
                ? 2
                : 1;
        check("expected acceptance GET count", acceptanceReads, expectedAcceptanceReads);
        check(
          "no write requests",
          requests.filter((request) => request.key.split(" ")[0] !== "GET").length,
          0,
        );
        check(
          "no request bodies",
          requests.every((request) => request.body === null),
        );
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        const expectedHttpErrors =
          scene.mode === "error"
            ? 3
            : scene.mode === "preserved"
              ? 3
              : ["forbidden", "expired"].includes(scene.mode)
                ? 1
                : 0;
        check("expected HTTP console errors", consoleErrors.length, expectedHttpErrors);
        check(
          "console errors are expected HTTP responses",
          consoleErrors.every((message) => message.includes("Failed to load resource")),
        );
        await picture();
        if (width === 390 && ["error", "forbidden", "expired"].includes(scene.mode)) {
          await root.getByText("查看服务提示").click();
          await expect(root.locator(".p49-read__state details")).toHaveAttribute("open", "");
          await expect(root.getByText(/关联编号：p49-read-/)).toBeVisible();
          await picture("service-details");
        }
        runs.push({
          width,
          scene: scene.name,
          mode: scene.mode,
          requestCount: requests.length,
          checks,
        });
        releaseRead?.();
      } finally {
        await context.close();
      }
    }
} finally {
  await browser?.close();
  await server?.close();
}

if (capture) {
  const sourceHashes = Object.fromEntries(
      await Promise.all(
        [...loadedSources].sort().map(async (file) => [file, hash(await read(file))]),
      ),
    ),
    evidence = {
      kind: "P49-ACCEPTANCE-READ-STATES-REVIEW-r1",
      generatedAt: new Date().toISOString(),
      reviewOnly: true,
      productionChanged: false,
      deployed: false,
      fixtureNotice:
        "The preserved verdict uses the authoritative E2E acceptance fixture. Error responses and access states are synthetic review fixtures following the actual ApiClientError envelope and retry behavior.",
      behaviorBoundary:
        "GET-only state review. No acceptance POST, enable/disable action, polling, database write, permission mutation, credential access, or deployment was performed.",
      layoutMechanicalScan: {
        status: "not_run",
        reason:
          "The optional first-use external scanner did not finish initialization and was stopped in the preceding batch.",
        substituteChecks: [
          "Vue SFC compile",
          "PostCSS parse and isolation",
          "four responsive widths",
          "document overflow",
          "44px representative targets",
          "state and recovery semantics",
          "collapsed service detail",
          "safe GET retry counts",
        ],
      },
      widths,
      runs,
      screenshots,
      sourceHashes,
      ports,
      processesClosed: true,
    };
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  const cards = screenshots
    .map(
      (shot) =>
        `<article><a href="${shot.file}"><img src="${shot.file}" alt="${shot.width} ${shot.scene} ${shot.suffix}"></a><h2>${shot.scene}</h2><p>${shot.width}px · ${shot.suffix}</p></article>`,
    )
    .join("\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>P49 读取状态评审</title><style>body{margin:0;padding:24px;background:#eef2f7;color:#172033;font-family:system-ui,sans-serif}header{max-width:1440px;margin:auto auto 24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:20px;max-width:1440px;margin:auto}article{background:white;padding:12px;border-radius:10px;box-shadow:0 8px 24px #173b6920}img{width:100%;height:520px;object-fit:cover;object-position:top;border:1px solid #dbe2ed}h1{margin:.2em 0}h2{font-size:16px;margin:10px 0 4px}p{color:#60708a;margin:0}</style><header><p>P49 / review only</p><h1>1688 启用检查读取与访问状态</h1><p>真实 Vue 路由；错误与访问结果为明确标注的本地评审夹具。点击查看完整长图。</p></header><main>${cards}</main></html>`,
  );
}

console.log(
  `P49 read states passed: ${runs.length} runs, ${runs.reduce((sum, run) => sum + run.checks.length, 0)} checks, ${screenshots.length} screenshots`,
);
