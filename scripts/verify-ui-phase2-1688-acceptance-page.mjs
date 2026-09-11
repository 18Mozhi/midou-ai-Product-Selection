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
  acceptancePageCopy,
  previewAlibaba1688AcceptanceCenter,
} from "./lib/ui-phase2-1688-acceptance-page-preview.mjs";

assert.ok(process.argv.slice(2).every((argument) => argument === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p49-acceptance-page-review",
  component = "apps/web/src/components/Alibaba1688AcceptanceCenter.vue",
  previewCss = "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-page-preview.css",
  fixture = "tests/e2e/m03-07-provider-sources.spec.ts",
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  source = await read(component),
  replacement = previewAlibaba1688AcceptanceCenter(source),
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
  passGate = (gate) => ({
    ...gate,
    state: "passed",
    evidence_at: gate.evidence_at ?? "2026-09-11T08:20:00.000Z",
    reason:
      gate.key === "login"
        ? "当前有效浏览器档案已完成一次登录态运行。"
        : gate.key === "captcha"
          ? "最近登录态运行未被验证码阻断。"
          : "当前解析器版本已完成真实样本回放和第二人审批。",
  }),
  allPassed = {
    ...acceptanceData.original,
    gates: acceptanceData.original.gates.map(passGate),
    pending_reasons: [],
    coverage_matrix: {
      ...acceptanceData.original.coverage_matrix,
      rows: acceptanceData.original.coverage_matrix.rows.map((row) =>
        row.key === "pagination"
          ? {
              ...row,
              state: "covered",
              observed_count: 4,
              reason: "真实浏览器作业已完成 4 页翻页覆盖。",
            }
          : row,
      ),
    },
  },
  scenes = [
    {
      name: "authoritative-2-of-3",
      fixtureKind: "authoritative-e2e-fixture",
      value: acceptanceData.original,
      title: "尚未满足启用条件",
    },
    {
      name: "authoritative-all-pending",
      fixtureKind: "authoritative-e2e-fixture",
      value: acceptanceData.pending,
      title: "尚未满足启用条件",
    },
    {
      name: "synthetic-ready-for-enable",
      fixtureKind: "synthetic-review-fixture",
      value: { ...allPassed, source_status: "disabled", overall: "ready_for_enable" },
      title: "门禁已通过，等待负责人启用",
    },
    {
      name: "synthetic-production-ready",
      fixtureKind: "synthetic-review-fixture",
      value: { ...allPassed, source_status: "enabled", overall: "production_ready" },
      title: "来源已启用",
    },
  ],
  widths = [390, 760, 1024, 1440],
  loadedSources = new Set([
    component,
    previewCss,
    fixture,
    "scripts/lib/ui-phase2-1688-acceptance-design-data.mjs",
    "scripts/lib/ui-phase2-1688-acceptance-page-preview.mjs",
    "scripts/verify-ui-phase2-1688-acceptance-page.mjs",
    "apps/web/index.html",
    "apps/web/vite.config.ts",
  ]),
  screenshots = [],
  runs = [],
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
        name: "p49-acceptance-page-review-only",
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
          return html
            .replace("<body>", '<body class="p49-acceptance-review">')
            .replace(
              "</head>",
              `<link rel="stylesheet" href="/@fs/${path.resolve(previewCss).replaceAll("\\", "/")}"></head>`,
            );
        },
      },
    ],
  });
  await server.listen();
  console.log(`P49 acceptance page ${origin}`);

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
          checks = [],
          check = (name, actual, expected = true) => {
            assert.deepEqual(actual, expected, `${width}/${scene.name}:${name}`);
            checks.push({ name, actual });
          };
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
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
          if (url.pathname.endsWith("/1688-acceptance"))
            return route.fulfill({ json: { data: scene.value, request_id: `p49-${scene.name}` } });
          if (url.pathname.endsWith("/org/memberships"))
            return route.fulfill({
              json: { data: acceptanceData.organizations, request_id: "p49-organizations" },
            });
          return route.fulfill({
            json: { data: acceptanceData.workspaces, request_id: "p49-workspaces" },
          });
        });

        await page.goto(origin + "/platform-admin/providers/sources/1688-acceptance");
        const root = page.locator(".p49-acceptance"),
          verdict = root.locator(".acceptance-1688__verdict"),
          form = root.locator(".acceptance-1688__start"),
          heading = root.getByRole("heading", { name: scene.title });
        await expect(root).toBeVisible();
        await heading.scrollIntoViewIfNeeded();
        check(
          "verdict heading rendered",
          await heading.evaluate((node) => {
            const rect = node.getBoundingClientRect(),
              style = getComputedStyle(node);
            return rect.width > 0 && rect.height > 0 && style.visibility === "visible";
          }),
        );
        await expect(root.getByText(acceptancePageCopy.privacy)).toHaveCount(1);
        await expect(root.getByText(acceptancePageCopy.independence)).toHaveCount(1);
        await expect(root.getByText(acceptancePageCopy.coverage)).toHaveCount(1);
        check(
          "source state label",
          await verdict.locator("dd").nth(0).innerText(),
          { draft: "草稿", disabled: "已停用", enabled: "已启用" }[scene.value.source_status],
        );
        check(
          "passed gate count",
          await verdict.locator("dd").nth(1).innerText(),
          `${scene.value.gates.filter((gate) => gate.state === "passed").length} / 3`,
        );
        check("three gate rows", await root.locator(".acceptance-1688__gates article").count(), 3);
        check(
          "three independent coverage rows",
          await root.locator(".acceptance-1688__matrix article").count(),
          3,
        );
        check("section reading order", await root.locator("main section h3").allTextContents(), [
          "逐项核对三类证据",
          scene.value.pending_reasons.length ? "先处理当前未通过项" : "门禁已全部通过",
          "发起一次真实登录验收",
          "搜索、详情与翻页矩阵",
          scene.value.latest_run ? "运行成功" : "尚无运行",
        ]);
        await expect(form.getByLabel("组织", { exact: true })).toHaveValue(
          acceptanceData.organizations[0].id,
        );
        await expect(form.getByLabel("工作区", { exact: true })).toHaveValue(
          acceptanceData.workspaces[0].id,
        );
        await expect(form.getByLabel("验收关键词")).toHaveAttribute("maxlength", "200");
        const runButton = form.getByRole("button", { name: "发起登录验收运行" });
        await expect(runButton).toBeDisabled();
        await form.getByLabel("验收关键词").fill("桌面灯");
        await expect(runButton).toBeEnabled();
        await form.getByLabel("验收关键词").focus();
        check(
          "query keyboard focus visible",
          await form
            .getByLabel("验收关键词")
            .evaluate((node) => getComputedStyle(node).outlineStyle !== "none"),
        );
        check(
          "next action links exact",
          await root.locator(".acceptance-1688__actions nav a").evaluateAll((links) =>
            links.map((link) => ({
              text: link.textContent?.trim(),
              href: link.getAttribute("href"),
            })),
          ),
          [
            {
              text: "配置或续期登录档案",
              href: `/platform-admin/credentials?provider_id=${scene.value.provider_id}&mode=login`,
            },
            {
              text: "定位 1688 固定样本",
              href: `/platform-admin/providers/sources?provider_id=${scene.value.provider_id}`,
            },
          ],
        );
        check(
          "no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        );
        check(
          "44px representative controls",
          await Promise.all(
            [
              root.getByRole("button", { name: "刷新检查结果" }),
              form.getByLabel("组织", { exact: true }),
              form.getByLabel("工作区", { exact: true }),
              form.getByLabel("验收关键词"),
              runButton,
              root.getByRole("link", { name: "配置或续期登录档案" }),
            ].map(async (locator) => {
              const bounds = await locator.boundingBox();
              return Boolean(bounds && bounds.height >= 44);
            }),
          ),
          [true, true, true, true, true, true],
        );
        const layoutColumns = await root
          .locator(".p49-acceptance__layout")
          .evaluate(
            (node) => getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean).length,
          );
        check("responsive layout columns", layoutColumns, width <= 760 ? 1 : 2);
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
        const screenshotFile = `${width}-${scene.name}.png`;
        if (capture) {
          const bytes = await page.screenshot({ fullPage: true, animations: "disabled" });
          await writeFile(`${output}/${screenshotFile}`, bytes);
          screenshots.push({
            file: screenshotFile,
            width,
            scene: scene.name,
            fixtureKind: scene.fixtureKind,
            sha256: hash(bytes),
            pixelWidth: bytes.readUInt32BE(16),
            pixelHeight: bytes.readUInt32BE(20),
          });
        }
        runs.push({
          width,
          scene: scene.name,
          fixtureKind: scene.fixtureKind,
          requestCount: requests.length,
          checks,
        });
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
      kind: "P49-ACCEPTANCE-PAGE-REVIEW-r1",
      generatedAt: new Date().toISOString(),
      reviewOnly: true,
      productionChanged: false,
      deployed: false,
      fixtureNotice:
        "The 2-of-3 and all-pending scenes are parsed from authoritative E2E fixtures. Ready-for-enable and production-ready are synthetic review fixtures derived from the same contract and are labeled as such.",
      behaviorBoundary:
        "GET-only layout review. No acceptance POST, enable/disable action, polling, database write, permission mutation, or deployment was performed.",
      layoutMechanicalScan: {
        status: "not_run",
        reason:
          "The optional first-use external scanner did not finish initialization and was stopped.",
        substituteChecks: [
          "Vue SFC compile",
          "PostCSS parse and isolation",
          "four responsive widths",
          "document overflow",
          "44px representative targets",
          "keyboard-visible focus",
          "DOM reading order",
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
        `<article><a href="${shot.file}"><img src="${shot.file}" alt="${shot.width} ${shot.scene}"></a><h2>${shot.scene}</h2><p>${shot.width}px · ${shot.fixtureKind}</p></article>`,
    )
    .join("\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>P49 1688 启用检查评审</title><style>body{margin:0;padding:24px;background:#eef2f7;color:#172033;font-family:system-ui,sans-serif}header{max-width:1440px;margin:auto auto 24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:20px;max-width:1440px;margin:auto}article{background:white;padding:12px;border-radius:10px;box-shadow:0 8px 24px #173b6920}img{width:100%;height:520px;object-fit:cover;object-position:top;border:1px solid #dbe2ed}h1{margin:.2em 0}h2{font-size:16px;margin:10px 0 4px}p{color:#60708a;margin:0}</style><header><p>P49 / review only</p><h1>1688 启用检查 C 方向实际 Vue 图</h1><p>原始 2/3 与全待验收来自 E2E；其余为明确标注的评审样例。点击查看完整长图。</p></header><main>${cards}</main></html>`,
  );
}

console.log(
  `P49 acceptance review passed: ${runs.length} runs, ${runs.reduce((sum, run) => sum + run.checks.length, 0)} checks, ${screenshots.length} screenshots`,
);
