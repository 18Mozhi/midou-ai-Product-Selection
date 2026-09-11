import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { buildAcceptanceDesignData } from "./lib/ui-phase2-1688-acceptance-design-data.mjs";
import {
  acceptanceRobustnessContract,
  previewAlibaba1688AcceptanceRobustness,
} from "./lib/ui-phase2-1688-acceptance-robustness-preview.mjs";

assert.ok(process.argv.slice(2).every((argument) => argument === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p49-acceptance-robustness-review",
  component = "apps/web/src/components/Alibaba1688AcceptanceCenter.vue",
  fixture = "tests/e2e/m03-07-provider-sources.spec.ts",
  styles = [
    "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-page-preview.css",
    "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-read-states-preview.css",
    "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-actions-preview.css",
    "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-robustness-preview.css",
  ],
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  source = await read(component),
  replacement = previewAlibaba1688AcceptanceRobustness(source),
  { data: acceptanceData } = await buildAcceptanceDesignData(process.cwd()),
  clone = (value) => JSON.parse(JSON.stringify(value));

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
  longOwner = "跨境采集与固定样本复核联合责任组／华南业务连续性值守与异常回放复核负责人",
  longQuery = "超长关键词稳健性检查".repeat(12).slice(0, 200),
  longPending =
    "请先完成有效登录档案续期、真实业务采集运行、验证码状态复核以及当前解析器版本固定样本回放审批，再由责任人逐项确认证据时间与适用范围。",
  longParser =
    "1688-browser-contract-v3-review-candidate-with-long-compatible-parser-identifier-2026-09-12",
  longData = clone(acceptanceData.original),
  invalidData = clone(acceptanceData.original);

longData.owner_label = longOwner;
longData.pending_reasons = [
  longPending,
  "当前结论仅针对本次隔离评审数据，不代表线上来源已经启用、真实运行已经完成或审批已经生效。",
  "当组织、工作区或关键词较长时，仍需完整保留字段语义、键盘焦点与恢复动作。",
];
longData.gates = longData.gates.map((gate, index) => ({
  ...gate,
  reason: `${gate.reason}；长内容补充 ${index + 1}：${longPending}`,
}));
longData.coverage_matrix.parser_version = longParser;
longData.coverage_matrix.rows = longData.coverage_matrix.rows.map((row) => ({
  ...row,
  reason: `${row.reason}；这是用于验证连续中文、英文标识与技术字段在窄屏和缩放下都不会横向溢出的长说明。`,
  contract: `${row.contract}-with-a-very-long-contract-identifier-that-must-wrap-safely`,
}));
longData.latest_run.error_code =
  "provider_browser_acceptance_result_requires_manual_review_after_dependency_recovery";

invalidData.overall = "setup_required";
invalidData.source_status = "disabled";
invalidData.gates = invalidData.gates.map((gate, index) => ({
  ...gate,
  state: index === 1 ? "blocked" : "pending",
  reason:
    index === 1
      ? "最近一次真实运行被验证码阻断，当前不能据此确认可用于生产。"
      : "当前还没有足够证据，保留待核对状态。",
}));
invalidData.pending_reasons = [
  "先恢复有效登录档案并完成一次真实业务采集运行。",
  "验证码阻断解除后重新读取检查结果。",
  "用当前解析器版本完成固定样本回放并取得审批。",
];
invalidData.coverage_matrix.rows = invalidData.coverage_matrix.rows.map((row, index) => ({
  ...row,
  state: ["invalid", "not_observed", "not_exercised"][index],
  reason: [
    "观测结果无效，不能作为启用门禁证据。",
    "尚未观测到详情链路结果。",
    "本次没有执行分页链路。",
  ][index],
  observed_count: index === 0 ? 1 : 0,
}));
invalidData.latest_run = {
  ...invalidData.latest_run,
  status: "failed",
  error_code:
    "captcha_challenge_interrupted_browser_acceptance_and_requires_authorized_manual_recovery",
};

const widths = [390, 760, 1024, 1440],
  baseRuns = acceptanceRobustnessContract.themes.flatMap((theme) =>
    acceptanceRobustnessContract.densities.flatMap((density) =>
      widths.map((width) => ({
        kind: "theme-density",
        theme,
        density,
        width,
        height: width <= 760 ? 980 : 1080,
        fixture: "authoritative-original",
      })),
    ),
  ),
  longRuns = widths.map((width) => ({
    kind: "long-content",
    theme: "deep-ocean",
    density: "standard",
    width,
    height: width <= 760 ? 980 : 1080,
    fixture: "synthetic-long-content",
  })),
  invalidRuns = widths.map((width) => ({
    kind: "invalid-content",
    theme: "cloud-white",
    density: "compact",
    width,
    height: width <= 760 ? 980 : 1080,
    fixture: "synthetic-invalid-content",
  })),
  zoomRuns = [1024, 1440].map((width) => ({
    kind: "component-css-zoom-200",
    theme: "aurora-purple",
    density: "standard",
    width,
    height: 1080,
    fixture: "authoritative-original",
    zoom: true,
  })),
  narrowRuns = acceptanceRobustnessContract.themes.map((theme) => ({
    kind: "smallest-width",
    theme,
    density: "compact",
    width: acceptanceRobustnessContract.smallestWidth,
    height: 900,
    fixture: "authoritative-original",
  })),
  landscapeRuns = acceptanceRobustnessContract.themes.map((theme) => ({
    kind: "mobile-landscape",
    theme,
    density: "compact",
    width: 844,
    height: 390,
    fixture: "authoritative-original",
  })),
  matrix = [...baseRuns, ...longRuns, ...invalidRuns, ...zoomRuns, ...narrowRuns, ...landscapeRuns],
  loadedSources = new Set([
    component,
    fixture,
    ...styles,
    "apps/web/src/design/tokens.css",
    "apps/web/src/design/theme.ts",
    "scripts/lib/ui-phase2-1688-acceptance-design-data.mjs",
    "scripts/lib/ui-phase2-1688-acceptance-page-preview.mjs",
    "scripts/lib/ui-phase2-1688-acceptance-read-states-preview.mjs",
    "scripts/lib/ui-phase2-1688-acceptance-actions-preview.mjs",
    "scripts/lib/ui-phase2-1688-acceptance-robustness-preview.mjs",
    "scripts/verify-ui-phase2-1688-acceptance-robustness.mjs",
    "apps/web/index.html",
    "apps/web/vite.config.ts",
  ]),
  runs = [],
  screenshots = [],
  ports = [];

assert.equal(matrix.length, 40, "P49 robustness matrix size");

let browser, server;
try {
  browser = await chromium.launch();
  if (capture) {
    await rm(output, { recursive: true, force: true });
    await mkdir(output, { recursive: true });
  }
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
        name: "p49-acceptance-robustness-review-only",
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
          const links = styles
            .map(
              (file) =>
                `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
            )
            .join("");
          return html
            .replace(
              "<body>",
              '<body class="p49-acceptance-review p49-acceptance-read-review p49-acceptance-actions-review p49-acceptance-robustness-review">',
            )
            .replace("</head>", `${links}</head>`);
        },
      },
    ],
  });
  await server.listen();
  console.log(`P49 acceptance robustness ${origin}`);

  for (const scenario of matrix) {
    const context = await browser.newContext({
      viewport: { width: scenario.width, height: scenario.height },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
      hasTouch: true,
    });
    try {
      const page = await context.newPage(),
        requests = [],
        unexpected = [],
        pageErrors = [],
        consoleErrors = [],
        checks = [],
        check = (name, actual, expected = true) => {
          assert.deepEqual(
            actual,
            expected,
            `${scenario.kind}/${scenario.theme}/${scenario.density}/${scenario.width}:${name}`,
          );
          checks.push({ name, actual });
        },
        fixtureData =
          scenario.fixture === "synthetic-long-content"
            ? longData
            : scenario.fixture === "synthetic-invalid-content"
              ? invalidData
              : acceptanceData.original,
        slug = `${scenario.kind}-${scenario.theme}-${scenario.density}-${scenario.width}x${scenario.height}`,
        picture = async (suffix = "full") => {
          if (!capture) return;
          const file = `${slug}-${suffix}.png`,
            bytes = await page.screenshot({ fullPage: true, animations: "disabled" });
          await writeFile(`${output}/${file}`, bytes);
          screenshots.push({
            file,
            kind: scenario.kind,
            fixture: scenario.fixture,
            theme: scenario.theme,
            density: scenario.density,
            width: scenario.width,
            height: scenario.height,
            suffix,
            sha256: hash(bytes),
            pixelWidth: bytes.readUInt32BE(16),
            pixelHeight: bytes.readUInt32BE(20),
          });
        };

      page.on("pageerror", (error) => pageErrors.push(error.message));
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
        requests.push(key);
        if (url.pathname.endsWith("/me/navigation"))
          return route.fulfill({ json: { data: navigation, request_id: "p49-navigation" } });
        if (url.pathname.endsWith("/auth/session-status"))
          return route.fulfill({ json: { data: { authenticated: true } } });
        if (url.pathname.endsWith("/org/memberships"))
          return route.fulfill({
            json: {
              data: acceptanceData.organizations.map((organization) => ({
                ...organization,
                name:
                  scenario.fixture === "synthetic-long-content"
                    ? `${organization.name}／跨境经营与合规复核联合组织长名称`
                    : organization.name,
              })),
              request_id: "p49-organizations",
            },
          });
        if (url.pathname.includes("/workspaces"))
          return route.fulfill({
            json: {
              data: acceptanceData.workspaces.map((workspace) => ({
                ...workspace,
                name:
                  scenario.fixture === "synthetic-long-content"
                    ? `${workspace.name}／登录态与固定样本联合验收工作区长名称`
                    : workspace.name,
              })),
              request_id: "p49-workspaces",
            },
          });
        return route.fulfill({
          json: { data: fixtureData, request_id: `p49-robustness-${scenario.kind}` },
        });
      });

      await page.goto(origin + "/platform-admin/providers/sources/1688-acceptance");
      await page.locator("html").evaluate((html, current) => {
        html.dataset.theme = current.theme;
        html.dataset.density = current.density;
        html.style.colorScheme = "light";
        if (current.zoom) html.dataset.p49Zoom = "200";
        else delete html.dataset.p49Zoom;
      }, scenario);

      const root = page.locator(".p49-robustness"),
        form = root.locator(".p49-action"),
        organization = form.getByLabel("组织", { exact: true }),
        workspace = form.getByLabel("工作区", { exact: true }),
        query = form.getByLabel("验收关键词"),
        submit = form.locator('button[type="submit"]');
      await expect(root).toBeVisible();
      await expect(root.getByRole("heading", { name: "1688 启用检查" })).toBeVisible();
      await expect(organization).toHaveValue(acceptanceData.organizations[0].id);
      await expect(workspace).toHaveValue(acceptanceData.workspaces[0].id);
      await page.locator("html").evaluate((html, current) => {
        html.dataset.theme = current.theme;
        html.dataset.density = current.density;
        html.style.colorScheme = "light";
        if (current.zoom) html.dataset.p49Zoom = "200";
        else delete html.dataset.p49Zoom;
      }, scenario);
      if (scenario.fixture === "synthetic-long-content") {
        await query.fill(longQuery);
        await expect(query).toHaveValue(longQuery);
        await expect(root.getByText(longOwner, { exact: true })).toBeVisible();
        await expect(root.getByText(longPending, { exact: true })).toBeVisible();
        await expect(root.getByText(longParser, { exact: true })).toBeVisible();
      }
      if (scenario.fixture === "synthetic-invalid-content") {
        await expect(root.getByRole("heading", { name: "尚未满足启用条件" })).toBeVisible();
        await expect(root.getByText("已阻断", { exact: true })).toBeVisible();
        await expect(
          root.getByText(invalidData.latest_run.error_code, { exact: true }),
        ).toBeVisible();
      }

      const metrics = await root.evaluate((element) => {
        const html = document.documentElement,
          body = document.body,
          bodyPanel = element.querySelector(".p49-acceptance__body"),
          verdict = element.querySelector(".acceptance-1688__verdict"),
          rootRect = element.getBoundingClientRect(),
          interactive = [...element.querySelectorAll("button, a, summary")].filter(
            (node) => node instanceof HTMLElement && node.offsetParent !== null,
          ),
          textClipping = interactive.map((node) => ({
            text: node.textContent?.trim() ?? "",
            horizontal: node.scrollWidth > node.clientWidth + 1,
            vertical: node.scrollHeight > node.clientHeight + 1,
          })),
          touchHeights = interactive.map((node) => ({
            text: node.textContent?.trim() ?? "",
            height: Math.round(node.getBoundingClientRect().height * 100) / 100,
          })),
          rootStyle = getComputedStyle(element),
          htmlStyle = getComputedStyle(html),
          panelStyle = getComputedStyle(bodyPanel),
          verdictStyle = getComputedStyle(verdict);
        return {
          theme: html.dataset.theme,
          density: html.dataset.density,
          zoom: html.dataset.p49Zoom ?? "none",
          colorScheme: html.style.colorScheme,
          bodyClass: body.className,
          documentFits: html.scrollWidth <= window.innerWidth + 1,
          documentScrollWidth: html.scrollWidth,
          viewportWidth: window.innerWidth,
          rootFits: element.scrollWidth <= element.clientWidth + 1,
          rootRect: {
            left: rootRect.left,
            right: rootRect.right,
            width: rootRect.width,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          },
          textClipping,
          touchHeights,
          tokenInfo: htmlStyle.getPropertyValue("--so-info").trim(),
          tokenPanel: htmlStyle.getPropertyValue("--so-panel").trim(),
          rootText: rootStyle.color,
          panelBackground: panelStyle.backgroundColor,
          htmlDensityPadding: htmlStyle.getPropertyValue("--so-density-padding").trim(),
          densityPadding: panelStyle.getPropertyValue("--so-density-padding").trim(),
          panelPadding: panelStyle.paddingTop,
          verdictBackground: verdictStyle.backgroundImage,
          rootColumns: getComputedStyle(element.querySelector(".p49-acceptance__layout"))
            .gridTemplateColumns,
          layoutGap: getComputedStyle(element.querySelector(".p49-acceptance__layout")).gap,
          verdictPadding: verdictStyle.paddingTop,
        };
      });

      check("theme applied", metrics.theme, scenario.theme);
      check("density applied", metrics.density, scenario.density);
      check("light-only theme mode", metrics.colorScheme, "light");
      check(
        "robustness review body scope",
        metrics.bodyClass.includes("p49-acceptance-robustness-review"),
      );
      check("semantic info token resolved", /^#[0-9a-f]{6}$/i.test(metrics.tokenInfo));
      check("semantic panel token resolved", /^#[0-9a-f]{6}$/i.test(metrics.tokenPanel));
      check("density token resolves", /^\d+(\.\d+)?px$/.test(metrics.htmlDensityPadding));
      check("document has no horizontal overflow", metrics.documentFits);
      check("review root has no horizontal overflow", metrics.rootFits);
      check(
        "interactive labels are not clipped",
        metrics.textClipping.filter((item) => item.horizontal || item.vertical),
        [],
      );
      check(
        "coarse pointer targets are at least 44px",
        metrics.touchHeights.every((item) => item.height >= 44),
      );
      check("verdict uses themed gradient", metrics.verdictBackground !== "none");
      check("no unknown network", unexpected, []);
      check(
        "GET-only review",
        requests.some((key) => !key.startsWith("GET ")),
        false,
      );
      check("no page runtime errors", pageErrors, []);
      check("no console errors", consoleErrors, []);
      if (scenario.zoom) check("component CSS zoom marker", metrics.zoom, "200");
      else check("component CSS zoom absent", metrics.zoom, "none");
      if (scenario.width <= 760)
        check("narrow layout is single column", metrics.rootColumns.trim().split(/\s+/).length, 1);

      await picture();
      if (
        (scenario.kind === "long-content" && scenario.width === 390) ||
        (scenario.kind === "invalid-content" && scenario.width === 1440)
      ) {
        await root.getByText("技术详情", { exact: true }).click();
        await expect(root.getByText(fixtureData.provider_id, { exact: false })).toBeVisible();
        await picture("technical-details");
      }
      runs.push({ ...scenario, metrics, requestCount: requests.length, checks });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server?.close();
}

const themeColors = Object.fromEntries(
  acceptanceRobustnessContract.themes.map((theme) => {
    const run = runs.find(
      (candidate) =>
        candidate.kind === "theme-density" &&
        candidate.theme === theme &&
        candidate.density === "standard" &&
        candidate.width === 1440,
    );
    assert.ok(run, `theme evidence ${theme}`);
    return [theme, { info: run.metrics.tokenInfo, panel: run.metrics.tokenPanel }];
  }),
);
assert.equal(new Set(Object.values(themeColors).map((value) => value.info)).size, 3);
assert.equal(new Set(Object.values(themeColors).map((value) => value.panel)).size, 3);
for (const theme of acceptanceRobustnessContract.themes) {
  const pairs = acceptanceRobustnessContract.densities.map((density) => {
    const run = runs.find(
      (candidate) =>
        candidate.kind === "theme-density" &&
        candidate.theme === theme &&
        candidate.density === density &&
        candidate.width === 1440,
    );
    assert.ok(run, `${theme}/${density} density evidence`);
    return run.metrics.htmlDensityPadding;
  });
  assert.equal(new Set(pairs).size, 2, `${theme} density tokens must differ`);
}

if (capture) {
  const sourceHashes = Object.fromEntries(
      await Promise.all(
        [...loadedSources].sort().map(async (file) => [file, hash(await read(file))]),
      ),
    ),
    evidence = {
      kind: "P49-ACCEPTANCE-ROBUSTNESS-REVIEW-r1",
      generatedAt: new Date().toISOString(),
      reviewOnly: true,
      productionChanged: false,
      deployed: false,
      themeBoundary:
        "Verified the repository's three current paper/light themes (deep-ocean, aurora-purple, cloud-white) and two densities. The repository exposes no dark theme, so dark mode is not claimed.",
      fixtureNotice:
        "The base/theme/density/narrow/landscape/zoom runs use the authoritative E2E acceptance fixture. Long and invalid content are explicitly synthetic review fixtures built from the same response shape; they are not production facts.",
      zoomBoundary:
        "The 200% stress uses CSS zoom on the isolated component at 1024px and 1440px. It is not browser UI zoom, OS text scaling, or assistive-technology certification.",
      behaviorBoundary:
        "Every run is GET-only against intercepted local routes. No acceptance POST, source enable/disable, database write, permission mutation, credential access, external request, or deployment was performed.",
      deviceBoundary:
        "Chromium emulation covered 320px, 390px, 760px, 844x390 landscape, 1024px and 1440px. Real phone/tablet hardware and Firefox, Safari, and Edge remain unverified.",
      layoutMechanicalScan: {
        status: "not_run",
        reason:
          "The optional external scanner remains outside this deterministic local review batch.",
        substituteChecks: [
          "Vue SFC compile",
          "PostCSS parse and selector isolation",
          "three actual theme tokens and two density tokens",
          "document and component horizontal overflow",
          "interactive label clipping",
          "44px coarse-pointer controls",
          "320px and 844x390 landscape",
          "synthetic long and invalid content",
          "component CSS zoom 200%",
          "GET-only network allowlist and zero runtime errors",
        ],
      },
      contract: acceptanceRobustnessContract,
      themeColors,
      matrixCount: matrix.length,
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
        `<article><a href="${shot.file}"><img src="${shot.file}" alt="${shot.kind} ${shot.theme} ${shot.density} ${shot.width}x${shot.height}"></a><h2>${shot.kind}</h2><p>${shot.theme} · ${shot.density} · ${shot.width}×${shot.height} · ${shot.fixture}${shot.suffix === "full" ? "" : ` · ${shot.suffix}`}</p></article>`,
    )
    .join("\n");
  await writeFile(
    `${output}/index.html`,
    [
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width">',
      "<title>P49 稳健性评审</title>",
      "<style>",
      "body{margin:0;padding:24px;background:#eef2f7;color:#172033;font-family:system-ui,sans-serif}",
      "header{max-width:1440px;margin:auto auto 24px}",
      "main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:20px;max-width:1440px;margin:auto}",
      "article{background:white;padding:12px;border-radius:10px;box-shadow:0 8px 24px #173b6920}",
      "img{width:100%;height:520px;object-fit:cover;object-position:top;border:1px solid #dbe2ed}",
      "h1{margin:.2em 0}h2{font-size:16px;margin:10px 0 4px}p{color:#60708a;margin:0}",
      "</style>",
      "<header><p>P49 / review only</p><h1>1688 启用检查稳健性</h1>",
      "<p>真实 Vue 路由；三种现有浅色纸张主题、两种密度、极端内容与组件级缩放。",
      "长内容和失败内容为明确标注的本地评审夹具。</p></header>",
      `<main>${cards}</main></html>`,
    ].join(""),
  );
}

console.log(
  `P49 robustness passed: ${runs.length} runs, ${runs.reduce((sum, run) => sum + run.checks.length, 0)} checks, ${screenshots.length} screenshots`,
);
