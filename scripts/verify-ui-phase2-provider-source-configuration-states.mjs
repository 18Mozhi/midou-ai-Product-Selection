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
  configurationSaveCopy,
  previewProviderSourceConfigurationStatesDialog,
  previewProviderSourceConfigurationStatesParent,
} from "./lib/ui-phase2-provider-source-configuration-states-preview.mjs";

assert.ok(process.argv.slice(2).every((argument) => argument === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p48-source-configuration-states-review",
  parentComponent = "apps/web/src/components/ProviderSourceCenter.vue",
  dialogComponent = "apps/web/src/components/ProviderSourceConfigurationDialog.vue",
  pageCss = "design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-page-preview.css",
  dialogCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-source-configuration-preview.css",
  statesCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-source-configuration-states-preview.css",
  fixture = "tests/e2e/m03-07-provider-sources.spec.ts",
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  parentSource = await read(parentComponent),
  dialogSource = await read(dialogComponent),
  parentReplacement = previewProviderSourceConfigurationStatesParent(parentSource),
  dialogReplacement = previewProviderSourceConfigurationStatesDialog(dialogSource);

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
    ["navigation", "automatic", "setup"].map(declarationSource).join("\n") +
      "\nglobalThis.data={navigation:navigation('platform_admin'),automatic,setup};",
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  box,
);
const fixtureData = JSON.parse(JSON.stringify(box.data)),
  publicSource = {
    ...fixtureData.automatic[0],
    provisioned: {
      ...fixtureData.automatic[0].provisioned,
      status: "disabled",
      schedule_minutes: 15,
      timeout_ms: 20_000,
      retry_limit: 3,
      updated_at: "2026-09-11T05:00:00.000Z",
      concurrency_snapshot: { configured_limit: 1, active_subquery_count: 0 },
    },
  },
  scenes = [
    { name: "direct-saving", family: "direct", hold: "first-put", capture: "saving", final: "success" },
    { name: "direct-success", family: "direct", capture: "success", final: "success" },
    { name: "direct-failure", family: "direct", fail: "first-put", capture: "failed", final: "failed" },
    { name: "version-conflict", family: "direct", fail: "conflict", capture: "conflict", final: "conflict" },
    { name: "smoke-saving", family: "smoke", hold: "first-put", capture: "saving_disabled", final: "success" },
    { name: "smoke-testing", family: "smoke", hold: "health", capture: "smoke_testing", final: "success" },
    { name: "smoke-rejected", family: "smoke", fail: "health-result", capture: "partial", final: "partial" },
    { name: "smoke-unavailable", family: "smoke", fail: "health-request", capture: "partial", final: "partial" },
    { name: "enabling", family: "smoke", hold: "second-put", capture: "enabling", final: "success" },
    { name: "enable-failure", family: "smoke", fail: "second-put", capture: "partial", final: "partial" },
    { name: "smoke-success", family: "smoke", capture: "success", final: "success" },
  ],
  progressStages = new Set(["saving", "saving_disabled", "smoke_testing", "enabling"]),
  loadedSources = new Set([
    parentComponent,
    dialogComponent,
    pageCss,
    dialogCss,
    statesCss,
    fixture,
    "scripts/lib/ui-phase2-provider-source-configuration-preview.mjs",
    "scripts/lib/ui-phase2-provider-source-configuration-states-preview.mjs",
    "scripts/verify-ui-phase2-provider-source-configuration-states.mjs",
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
        name: "p48-source-configuration-states-review-only",
        enforce: "pre",
        transform(text, id) {
          if (id.includes("?")) return null;
          const bare = id.replaceAll("\\", "/"),
            relative = path.isAbsolute(id)
              ? path.relative(process.cwd(), id).replaceAll("\\", "/")
              : bare;
          if (
            path.isAbsolute(id) &&
            !relative.includes("/node_modules/") &&
            (relative.startsWith("apps/") || relative.startsWith("packages/"))
          )
            loadedSources.add(relative);
          if (bare === path.resolve(parentComponent).replaceAll("\\", "/")) {
            assert.equal(text.replaceAll("\r\n", "\n"), parentSource);
            return { code: parentReplacement, map: null };
          }
          if (bare === path.resolve(dialogComponent).replaceAll("\\", "/")) {
            assert.equal(text.replaceAll("\r\n", "\n"), dialogSource);
            return { code: dialogReplacement, map: null };
          }
          return null;
        },
        transformIndexHtml(html) {
          const styles = [pageCss, dialogCss, statesCss]
            .map(
              (file) =>
                `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
            )
            .join("");
          return html
            .replace(
              "<body>",
              '<body class="p48-source-page-review p48-source-configuration-review p48-source-configuration-states-review">',
            )
            .replace("</head>", `${styles}</head>`);
        },
      },
    ],
  });
  await server.listen();
  console.log(`P48 source configuration states ${origin}`);

  for (const width of [390, 760, 1024, 1440])
    for (const scene of scenes) {
      const context = await browser.newContext({
        viewport: { width, height: width <= 760 ? 1040 : 1100 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
      let releasePending;
      try {
        const page = await context.newPage(),
          item = scene.family === "smoke" ? structuredClone(publicSource) : structuredClone(fixtureData.setup[0]),
          requests = [],
          unexpected = [],
          errors = [],
          checks = [];
        let putCount = 0,
          healthCount = 0;
        const pendingGate = new Promise((resolve) => (releasePending = resolve)),
          check = (name, actual, expected = true) => {
            assert.deepEqual(actual, expected, `${width}/${scene.name}:${name}`);
            checks.push({ name, actual });
          },
          successConfiguration = (body, version) => ({
            ...item.provisioned,
            ...body,
            version,
          }),
          fulfillError = (route, status, code, actionHint) =>
            route.fulfill({
              status,
              json: {
                error: { code, message: "配置操作未完成", action_hint: actionHint },
                request_id: `p48-${scene.name}-${code}`,
                trace_id: `p48-${scene.name}-${code}`,
              },
            }),
          picture = async (suffix) => {
            if (!capture) return;
            const file = `${width}-${scene.name}-${suffix}.png`,
              bytes = await page.screenshot({ animations: "disabled" });
            await writeFile(`${output}/${file}`, bytes);
            screenshots.push({
              file,
              width,
              scene: scene.name,
              stage: scene.capture,
              suffix,
              sha256: hash(bytes),
              pixelWidth: bytes.readUInt32BE(16),
              pixelHeight: bytes.readUInt32BE(20),
            });
          };
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
          const allowed =
            [
              "GET /api/v1/me/navigation",
              "GET /api/v1/auth/session-status",
              "GET /api/v1/platform/provider-sources",
            ].includes(key) ||
            (request.method() === "PUT" && url.pathname.endsWith("/configuration")) ||
            (request.method() === "POST" && url.pathname.endsWith("/health-check"));
          if (!allowed) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({ key, body: request.postData(), idempotencyKey: request.headers()["idempotency-key"] });
          if (url.pathname.endsWith("/me/navigation"))
            return route.fulfill({ json: { data: fixtureData.navigation, request_id: "p48-nav" } });
          if (url.pathname.endsWith("/auth/session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          if (key === "GET /api/v1/platform/provider-sources")
            return route.fulfill({ json: { data: [item], request_id: `p48-${scene.name}-catalog` } });
          if (request.method() === "POST") {
            healthCount++;
            if (scene.hold === "health") await pendingGate;
            if (scene.fail === "health-request")
              return fulfillError(
                route,
                503,
                "provider_health_unavailable",
                "健康检查服务暂时不可用，请稍后重试。",
              );
            if (scene.fail === "health-result")
              return route.fulfill({
                json: {
                  data: { health_status: "blocked", last_error_code: "captcha_required" },
                  request_id: `p48-${scene.name}-health`,
                },
              });
            return route.fulfill({
              json: {
                data: { health_status: "ready", last_error_code: null },
                request_id: `p48-${scene.name}-health`,
              },
            });
          }
          putCount++;
          const body = request.postDataJSON();
          if (putCount === 1 && scene.hold === "first-put") await pendingGate;
          if (putCount === 1 && scene.fail === "first-put")
            return fulfillError(route, 500, "provider_configuration_failed", "请检查当前设置后重新保存。");
          if (putCount === 1 && scene.fail === "conflict")
            return fulfillError(route, 409, "provider_version_conflict", "请重新读取最新配置后再修改。");
          if (putCount === 2 && scene.hold === "second-put") await pendingGate;
          if (putCount === 2 && scene.fail === "second-put")
            return fulfillError(route, 409, "provider_enable_conflict", "请重新读取最新配置后再启用。");
          return route.fulfill({
            json: {
              data: successConfiguration(body, Number(body.expected_version) + 1),
              request_id: `p48-${scene.name}-put-${putCount}`,
            },
          });
        });

        await page.goto(origin + "/platform-admin/providers/sources");
        const editButton = page.getByRole("button", { name: "编辑采集设置" });
        await editButton.focus();
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog", { name: `采集设置 · ${item.name}` }),
          status = dialog.getByLabel(scene.family === "smoke" ? "运行状态" : "来源设置状态");
        await expect(dialog).toBeVisible();
        if (scene.family === "smoke") await status.selectOption("enabled");
        const initialAction = dialog.getByRole("button", {
          name: scene.family === "smoke" ? "烟测并启用" : "保存配置",
        });
        await initialAction.click();

        const feedback = dialog.locator(".p48-source-configuration-save-feedback");
        await expect(feedback).toHaveAttribute("data-stage", scene.capture);
        await expect(feedback.getByRole("heading")).toHaveText(
          scene.capture === "success" && scene.family === "smoke"
            ? "烟测通过，来源已启用"
            : configurationSaveCopy[scene.capture].title,
        );
        check("capture stage", await feedback.getAttribute("data-stage"), scene.capture);
        check(
          "feedback busy",
          await feedback.getAttribute("aria-busy"),
          progressStages.has(scene.capture) ? "true" : "false",
        );
        check(
          "fields disabled while progressing",
          await dialog.getByLabel("采集频率（分钟）").isDisabled(),
          progressStages.has(scene.capture),
        );
        if (scene.capture === "partial") {
          await expect(feedback.getByText("已保存", { exact: false }).first()).toBeVisible();
          await expect(feedback.getByText("尚未启用", { exact: false }).first()).toBeVisible();
        }
        if (["success", "partial", "failed", "conflict"].includes(scene.capture))
          await expect(feedback.getByRole("heading")).toBeFocused();
        check(
          "no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        );
        await picture("feedback");
        const technical = feedback.locator("details");
        if (width === 390 && (await technical.count())) {
          await technical.locator("summary").click();
          await picture("technical");
        }

        if (scene.hold) {
          releasePending();
          await expect(feedback).toHaveAttribute("data-stage", scene.final);
        }
        check("final stage", await feedback.getAttribute("data-stage"), scene.final);
        await expect(dialog).toBeVisible();
        check("dialog remains until acknowledged", true);
        const writeRequests = requests.filter((request) => !request.key.startsWith("GET "));
        check("all writes have idempotency keys", writeRequests.every((request) => request.idempotencyKey));
        check("one catalog GET", requests.filter((request) => request.key === "GET /api/v1/platform/provider-sources").length, 1);
        check("no catalog reread before acknowledgement", requests.filter((request) => request.key === "GET /api/v1/platform/provider-sources").length, 1);
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        if (scene.family === "smoke") {
          const puts = writeRequests.filter((request) => request.key.startsWith("PUT ")).map((request) => JSON.parse(request.body));
          if (!["smoke-rejected", "smoke-unavailable"].includes(scene.name)) {
            check("staged status order", puts.map((body) => body.status), ["disabled", "enabled"]);
            check("staged version order", puts.map((body) => body.expected_version), [1, 2]);
          } else {
            check("partial keeps one disabled write", puts.map((body) => body.status), ["disabled"]);
          }
          check("one health check", healthCount, 1);
        } else {
          check("direct write count", putCount, 1);
          check("no health check", healthCount, 0);
        }
        const terminalAction = dialog.getByRole("button", {
          name:
            scene.final === "success"
              ? "完成"
              : scene.final === "conflict"
                ? "关闭后重新读取"
                : scene.final === "partial"
                  ? "关闭"
                  : "重新保存",
          exact: true,
        });
        if (scene.final !== "failed") {
          await terminalAction.focus();
          await page.keyboard.press("Escape");
          await expect(dialog).toHaveCount(0);
          await expect(editButton).toBeFocused();
          check("escape restores trigger", true);
        }
        runs.push({ width, scene: scene.name, capture: scene.capture, final: scene.final, checks, requests });
      } finally {
        releasePending?.();
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
    kind: "P48-SOURCE-CONFIGURATION-STATES-REVIEW-r1",
    generatedAt: new Date().toISOString(),
    reviewOnly: true,
    productionChanged: false,
    deployed: false,
    mockedWritesOnly: true,
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
        `<figure><img src="${shot.file}" alt="${shot.width}px ${shot.scene} ${shot.stage}"><figcaption>${shot.width}px · ${shot.scene} · ${shot.stage}${shot.suffix === "technical" ? " · 技术详情" : ""}</figcaption></figure>`,
    )
    .join("\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P48 采集设置状态评审</title><style>body{margin:0;padding:24px;background:#e9eef6;color:#172033;font:14px system-ui}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}figure{margin:0;padding:12px;border-radius:16px;background:white;box-shadow:0 8px 24px #18243b1f}img{display:block;width:100%;height:auto;border-radius:10px}figcaption{padding-top:10px}</style><h1>P48 编辑采集设置 · 保存与烟测状态 r1</h1><main>${cards}</main></html>`,
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
