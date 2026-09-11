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
  parserSamplesCopy,
  previewProviderParserSampleDialog,
  previewProviderParserSampleReview,
  previewProviderParserSamplesParent,
} from "./lib/ui-phase2-provider-parser-samples-preview.mjs";

assert.ok(process.argv.slice(2).every((argument) => argument === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p48-parser-samples-review",
  parentComponent = "apps/web/src/components/ProviderSourceCenter.vue",
  dialogComponent = "apps/web/src/components/ProviderParserSampleDialog.vue",
  reviewComponent = "apps/web/src/components/ProviderParserSampleReview.vue",
  pageCss = "design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-page-preview.css",
  sampleCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-parser-samples-preview.css",
  fixture = "tests/e2e/m03-07-provider-sources.spec.ts",
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  parentSource = await read(parentComponent),
  dialogSource = await read(dialogComponent),
  reviewSource = await read(reviewComponent),
  parentReplacement = previewProviderParserSamplesParent(parentSource),
  dialogReplacement = previewProviderParserSampleDialog(dialogSource),
  reviewReplacement = previewProviderParserSampleReview(reviewSource);

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
    ["navigation", "setup"].map(declarationSource).join("\n") +
      "\nglobalThis.data={navigation:navigation('platform_admin'),setup};",
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  box,
);
const fixtureData = JSON.parse(JSON.stringify(box.data)),
  provider = { ...fixtureData.setup[2], code: "1688_search", name: "1688 搜索" },
  sampleId = "30000000-0000-4000-8000-000000000001",
  sample = {
    id: sampleId,
    name: "1688 搜索真实样本",
    baseline_parser_version: "1688.search.v1",
    last_replay_status: "passed",
    last_replay_at: "2026-08-22T12:00:00.000Z",
    review_status: "pending",
    reviewed_by: null,
    review_reason: null,
    reviewed_at: null,
    review_version: 1,
    created_by: "30000000-0000-4000-8000-000000000002",
    can_review: true,
    created_at: "2026-08-22T11:00:00.000Z",
  },
  candidate = {
    browser_job_id: "browser-job-test-fixture-001",
    captured_at: "2026-09-10T06:30:00.000Z",
    item_count: 36,
    parser_version: "1688.search.v2-test-fixture",
  },
  scenes = [
    { name: "loading", loading: true, samples: [], candidates: [] },
    { name: "pending-review", samples: [sample], candidates: [] },
    { name: "candidate", samples: [], candidates: [candidate] },
    { name: "empty", samples: [], candidates: [] },
    { name: "self-review", samples: [{ ...sample, can_review: false }], candidates: [] },
    {
      name: "approved",
      samples: [
        {
          ...sample,
          review_status: "approved",
          review_reason: "字段基线与真实页面一致",
          reviewed_by: "另一位来源管理员",
          reviewed_at: "2026-08-22T12:10:00.000Z",
          review_version: 2,
          can_review: false,
        },
      ],
      candidates: [],
    },
    {
      name: "rejected",
      samples: [
        {
          ...sample,
          last_replay_status: "changed",
          review_status: "rejected",
          review_reason: "页面字段已变化，请从新的真实作业重新固定",
          reviewed_by: "另一位来源管理员",
          reviewed_at: "2026-09-10T07:00:00.000Z",
          review_version: 2,
          can_review: false,
        },
      ],
      candidates: [],
    },
    {
      name: "replay-passed",
      samples: [
        { ...sample, review_status: "approved", review_reason: "独立复核通过", can_review: false },
      ],
      candidates: [],
      latestReplay: { status: "passed", diff: [], error_code: null },
    },
    {
      name: "replay-changed",
      samples: [{ ...sample, last_replay_status: "changed" }],
      candidates: [],
      latestReplay: {
        status: "changed",
        diff: [
          { path: "$[0].fields.title", before: "便携式桌面支架", after: "折叠便携桌面支架" },
          { path: "$[0].fields.price", before: "18.80", after: "19.90" },
        ],
        error_code: null,
      },
    },
    {
      name: "replay-failed",
      samples: [{ ...sample, last_replay_status: "failed" }],
      candidates: [],
      latestReplay: {
        status: "failed",
        diff: [],
        error_code: "parser_contract_mismatch",
      },
    },
  ],
  loadedSources = new Set([
    parentComponent,
    dialogComponent,
    reviewComponent,
    pageCss,
    sampleCss,
    fixture,
    "scripts/lib/ui-phase2-provider-parser-samples-preview.mjs",
    "scripts/verify-ui-phase2-provider-parser-samples.mjs",
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
        name: "p48-parser-samples-review-only",
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
          if (normalized === path.resolve(dialogComponent).replaceAll("\\", "/")) {
            assert.equal(text.replaceAll("\r\n", "\n"), dialogSource);
            return { code: dialogReplacement, map: null };
          }
          if (normalized === path.resolve(parentComponent).replaceAll("\\", "/")) {
            assert.equal(text.replaceAll("\r\n", "\n"), parentSource);
            return { code: parentReplacement, map: null };
          }
          if (normalized === path.resolve(reviewComponent).replaceAll("\\", "/")) {
            assert.equal(text.replaceAll("\r\n", "\n"), reviewSource);
            return { code: reviewReplacement, map: null };
          }
          return null;
        },
        transformIndexHtml(html) {
          const styles = [pageCss, sampleCss]
            .map(
              (file) =>
                `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
            )
            .join("");
          return html
            .replace("<body>", '<body class="p48-source-page-review p48-parser-samples-review">')
            .replace("</head>", `${styles}</head>`);
        },
      },
    ],
  });
  await server.listen();
  console.log(`P48 parser samples ${origin}`);

  for (const width of [390, 760, 1024, 1440])
    for (const scene of scenes) {
      const context = await browser.newContext({
        viewport: { width, height: width <= 760 ? 1040 : 1100 },
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
          },
          picture = async (suffix) => {
            if (!capture) return;
            const file = `${width}-${scene.name}-${suffix}.png`,
              bytes = await page.screenshot({ animations: "disabled" });
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
        let releaseSamples;
        page.on("pageerror", (error) => errors.push(error.message));
        await page.addInitScript((latestReplay) => {
          globalThis.__P48_PARSER_SAMPLE_REPLAY__ = latestReplay;
        }, scene.latestReplay ?? null);
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
            "GET /api/v1/platform/provider-sources",
          ];
          if (!allowed.includes(key) && !key.endsWith("/parser-samples")) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, body: request.postData() });
          if (url.pathname.endsWith("/me/navigation"))
            return route.fulfill({ json: { data: fixtureData.navigation, request_id: "p48-nav" } });
          if (url.pathname.endsWith("/auth/session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          if (url.pathname.endsWith("/provider-sources"))
            return route.fulfill({ json: { data: [provider], request_id: "p48-sources" } });
          if (scene.loading)
            await new Promise((resolve) => {
              releaseSamples = resolve;
            });
          return route.fulfill({
            json: {
              data: { candidates: scene.candidates, samples: scene.samples },
              request_id: `p48-${scene.name}`,
            },
          });
        });

        await page.goto(origin + "/platform-admin/providers/sources");
        const trigger = page.getByRole("button", { name: "固定样本回放" }),
          center = page.locator(".source-center");
        await expect(trigger).toBeVisible();
        await trigger.focus();
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog", { name: `固定样本 · ${provider.name}` }),
          heading = dialog.getByRole("heading", { name: `固定样本 · ${provider.name}` });
        await expect(dialog).toBeVisible();
        await expect(heading).toBeFocused();
        check("dialog title focused", true);
        check("background inert", (await center.locator(":scope > [inert]").count()) > 0);
        await expect(dialog).toHaveAttribute("aria-modal", "true");
        await expect(dialog).toHaveAttribute("aria-describedby", "parser-sample-description");
        await expect(dialog.getByText(parserSamplesCopy.description)).toBeVisible();
        await expect(dialog.getByText(parserSamplesCopy.gateNote)).toBeVisible();
        for (const gate of ["真实浏览器作业", "当前解析器回放", "独立复核"])
          await expect(dialog.getByText(gate, { exact: true })).toBeVisible();

        if (scene.loading) {
          await expect(dialog.getByRole("heading", { name: "正在读取固定样本" })).toBeVisible();
          await expect(dialog.locator('[aria-busy="true"]')).toBeVisible();
          check(
            "sample content hidden",
            await dialog.locator(".p48-parser-samples-section").count(),
            0,
          );
          releaseSamples?.();
          await expect(dialog.locator('[aria-busy="true"]')).toHaveCount(0);
        } else if (scene.name === "candidate") {
          await expect(dialog.getByText("36 条真实结果")).toBeVisible();
          await expect(dialog.getByRole("button", { name: "固定为样本" })).toBeEnabled();
          check(
            "raw browser job id hidden",
            await dialog.getByText(candidate.browser_job_id).count(),
            0,
          );
          await dialog.getByText("技术详情").first().click();
          await expect(dialog.getByText(`解析器：${candidate.parser_version}`)).toBeVisible();
        } else if (scene.name === "empty") {
          await expect(dialog.getByText("暂无合格候选作业")).toBeVisible();
          await expect(dialog.getByText("还没有固定样本")).toBeVisible();
        } else {
          await expect(dialog.getByText("1688 搜索真实样本")).toBeVisible();
          await expect(dialog.getByRole("button", { name: "运行差异回放" })).toBeEnabled();
          check("raw creator id hidden", await dialog.getByText(sample.created_by).count(), 0);
          if (
            scene.name === "pending-review" ||
            scene.name === "replay-changed" ||
            scene.name === "replay-failed"
          ) {
            const reason = dialog.getByLabel("复核原因");
            await expect(reason).toHaveAttribute("minlength", "2");
            await expect(reason).toHaveAttribute("maxlength", "1000");
            await expect(reason).toHaveAttribute("required", "");
            await expect(reason).toHaveAttribute(
              "aria-describedby",
              `sample-review-help-${sampleId}`,
            );
            await reason.fill("短");
            await expect(dialog.getByRole("button", { name: "审批通过" })).toBeDisabled();
            await expect(dialog.getByRole("button", { name: "驳回样本" })).toBeDisabled();
            await reason.fill("依据");
            await expect(dialog.getByRole("button", { name: "审批通过" })).toBeEnabled();
            await expect(dialog.getByRole("button", { name: "驳回样本" })).toBeEnabled();
          }
          if (scene.name === "self-review") {
            await expect(
              dialog.getByText("创建人不能审批自己的样本，需要另一管理员处理。"),
            ).toBeVisible();
            check("self-review input hidden", await dialog.getByLabel("复核原因").count(), 0);
            check(
              "self-review actions hidden",
              await dialog.getByRole("button", { name: "审批通过" }).count(),
              0,
            );
          }
          if (scene.name === "approved") {
            await expect(dialog.getByText("审批通过", { exact: true })).toBeVisible();
            await expect(dialog.getByText("字段基线与真实页面一致")).toBeVisible();
          }
          if (scene.name === "rejected") {
            await expect(dialog.getByText("已驳回", { exact: true })).toBeVisible();
            await expect(
              dialog.getByText("页面字段已变化，请从新的真实作业重新固定"),
            ).toBeVisible();
            await expect(dialog.getByText("已驳回，需要新样本")).toBeVisible();
          }
          if (scene.latestReplay) {
            await expect(dialog.getByText("本次回放", { exact: true })).toBeVisible();
            await expect(
              dialog.getByRole("heading", {
                name:
                  scene.latestReplay.status === "passed"
                    ? "一致通过"
                    : scene.latestReplay.status === "changed"
                      ? "发现差异"
                      : "解析失败",
              }),
            ).toBeVisible();
          }
          if (scene.name === "replay-changed") {
            await expect(dialog.getByText("$[0].fields.title")).toBeVisible();
            await expect(dialog.getByText("折叠便携桌面支架")).toBeVisible();
          }
          if (scene.name === "replay-failed") {
            await dialog.getByText("技术详情").first().click();
            await expect(dialog.getByText("parser_contract_mismatch")).toBeVisible();
          }
        }

        check(
          "no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        );
        const close = dialog.getByRole("button", { name: "关闭", exact: true }),
          closeIcon = dialog.getByRole("button", { name: `关闭 ${provider.name} 固定样本` }),
          representative = [closeIcon, close];
        if (!scene.loading && scene.name === "candidate")
          representative.push(dialog.getByRole("button", { name: "固定为样本" }));
        if (!scene.loading && !["candidate", "empty"].includes(scene.name))
          representative.push(dialog.getByRole("button", { name: "运行差异回放" }));
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
        await heading.evaluate((element) => element.focus({ preventScroll: true }));
        await page.evaluate(() => window.scrollTo(0, 0));
        await dialog.locator(".p48-parser-samples-panel").evaluate((panel) => {
          panel.scrollTop = 0;
        });
        await picture("top");
        if (
          width <= 760 &&
          ["candidate", "pending-review", "replay-changed"].includes(scene.name)
        ) {
          await dialog.locator(".p48-parser-samples-panel").evaluate((panel) => {
            panel.scrollTop = panel.scrollHeight;
          });
          await picture("detail-bottom");
        }

        await closeIcon.focus();
        await page.keyboard.press("Shift+Tab");
        await expect(close).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(closeIcon).toBeFocused();
        check("tab loop stays in dialog", true);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
        check("escape restores trigger", true);
        check("background inert cleared", await center.locator(":scope > [inert]").count(), 0);
        check(
          "one source GET",
          requests.filter((request) => request.key.endsWith("provider-sources")).length,
          1,
        );
        check(
          "one parser-samples GET",
          requests.filter((request) => request.key.endsWith("/parser-samples")).length,
          1,
        );
        check(
          "no write requests",
          requests.filter((request) => !request.key.startsWith("GET ")).length,
          0,
        );
        check(
          "no request bodies",
          requests.every((request) => request.body == null),
        );
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        runs.push({
          width,
          scene: scene.name,
          fixtureKind: "synthetic-review-fixture",
          checks,
          requests,
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
  const sourceHashes = {};
  for (const file of [...loadedSources].sort()) sourceHashes[file] = hash(await read(file));
  const evidence = {
    kind: "P48-PARSER-SAMPLES-REVIEW-r1",
    generatedAt: new Date().toISOString(),
    reviewOnly: true,
    fixtureNotice:
      "All provider, candidate, sample, review, and replay values are synthetic review fixtures.",
    productionChanged: false,
    deployed: false,
    processesClosed: true,
    ports,
    runs,
    screenshots,
    sourceHashes,
  };
  await writeFile(`${output}/evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  const cards = screenshots
    .map(
      (shot) =>
        `<figure><img src="${shot.file}" alt="${shot.width}px ${shot.scene} ${shot.suffix}"><figcaption>${shot.width}px · ${shot.scene} · ${shot.suffix}</figcaption></figure>`,
    )
    .join("\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P48 固定样本评审</title><style>body{margin:0;padding:24px;background:#e9eef6;color:#172033;font:14px system-ui}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}figure{margin:0;padding:12px;border-radius:16px;background:white;box-shadow:0 8px 24px #18243b1f}img{display:block;width:100%;height:auto;border-radius:10px}figcaption{padding-top:10px}</style><h1>P48 固定样本 / 回放 / 独立复核 · 实际 Vue r1</h1><p>全部数据均为本地合成评审样例，不代表生产采集、回放或审批结果。</p><main>${cards}</main></html>`,
  );
  console.log(
    JSON.stringify({
      runs: runs.length,
      checks: runs.reduce((sum, run) => sum + run.checks.length, 0),
      screenshots: screenshots.length,
      sourceHashes: Object.keys(sourceHashes).length,
    }),
  );
}
