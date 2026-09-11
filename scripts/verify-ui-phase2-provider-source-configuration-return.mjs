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
  configurationReturnCopy,
  previewProviderSourceConfigurationReturnDialog,
  previewProviderSourceConfigurationReturnParent,
} from "./lib/ui-phase2-provider-source-configuration-return-preview.mjs";

assert.ok(process.argv.slice(2).every((argument) => argument === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p48-source-configuration-return-review",
  parentComponent = "apps/web/src/components/ProviderSourceCenter.vue",
  dialogComponent = "apps/web/src/components/ProviderSourceConfigurationDialog.vue",
  pageCss = "design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-page-preview.css",
  dialogCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-source-configuration-preview.css",
  statesCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-source-configuration-states-preview.css",
  returnCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-source-configuration-return-preview.css",
  fixture = "tests/e2e/m03-07-provider-sources.spec.ts",
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  parentSource = await read(parentComponent),
  dialogSource = await read(dialogComponent),
  parentReplacement = previewProviderSourceConfigurationReturnParent(parentSource),
  dialogReplacement = previewProviderSourceConfigurationReturnDialog(dialogSource);

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
    { name: "saved-refreshing", outcome: "saved", hold: "refresh", capture: "refreshing", final: "success" },
    { name: "saved-success", outcome: "saved", capture: "success", final: "success" },
    { name: "saved-failed", outcome: "saved", fail: "refresh", capture: "failed", final: "failed" },
    { name: "saved-retry", outcome: "saved", fail: "first-refresh", hold: "retry", capture: "refreshing", final: "success" },
    { name: "partial-success", outcome: "partial", capture: "success", final: "success" },
    { name: "partial-failed", outcome: "partial", fail: "refresh", capture: "failed", final: "failed" },
    { name: "conflict-success", outcome: "conflict", capture: "success", final: "success" },
    { name: "conflict-failed", outcome: "conflict", fail: "refresh", capture: "failed", final: "failed" },
  ],
  loadedSources = new Set([
    parentComponent,
    dialogComponent,
    pageCss,
    dialogCss,
    statesCss,
    returnCss,
    fixture,
    "scripts/lib/ui-phase2-provider-source-configuration-preview.mjs",
    "scripts/lib/ui-phase2-provider-source-configuration-states-preview.mjs",
    "scripts/lib/ui-phase2-provider-source-configuration-return-preview.mjs",
    "scripts/verify-ui-phase2-provider-source-configuration-return.mjs",
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
        name: "p48-source-configuration-return-review-only",
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
          const styles = [pageCss, dialogCss, statesCss, returnCss]
            .map(
              (file) =>
                `<link rel="stylesheet" href="/@fs/${path.resolve(file).replaceAll("\\", "/")}">`,
            )
            .join("");
          return html
            .replace(
              "<body>",
              '<body class="p48-source-page-review p48-source-configuration-review p48-source-configuration-states-review p48-source-configuration-return-review">',
            )
            .replace("</head>", `${styles}</head>`);
        },
      },
    ],
  });
  await server.listen();
  console.log(`P48 source configuration return ${origin}`);

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
          item = scene.outcome === "partial" ? structuredClone(publicSource) : structuredClone(fixtureData.setup[0]),
          requests = [],
          unexpected = [],
          errors = [],
          checks = [];
        let catalogReads = 0,
          putCount = 0,
          healthCount = 0;
        const pendingGate = new Promise((resolve) => (releasePending = resolve)),
          check = (name, actual, expected = true) => {
            assert.deepEqual(actual, expected, `${width}/${scene.name}:${name}`);
            checks.push({ name, actual });
          },
          updatedItem = () => ({
            ...item,
            provisioned: {
              ...item.provisioned,
              version: scene.outcome === "conflict" ? 5 : scene.outcome === "partial" ? 2 : 2,
              status: "disabled",
              schedule_minutes: scene.outcome === "conflict" ? 60 : item.provisioned.schedule_minutes,
            },
          }),
          fulfillError = (route, status, code, actionHint) =>
            route.fulfill({
              status,
              json: {
                error: { code, message: "来源目录读取未完成", action_hint: actionHint },
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
              state: scene.capture,
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
          if (key === "GET /api/v1/platform/provider-sources") {
            catalogReads++;
            if (catalogReads === 1)
              return route.fulfill({ json: { data: [item], request_id: `p48-${scene.name}-initial` } });
            if ((scene.hold === "refresh" && catalogReads === 2) || (scene.hold === "retry" && catalogReads === 3))
              await pendingGate;
            if (
              (scene.fail === "refresh" && catalogReads === 2) ||
              (scene.fail === "first-refresh" && catalogReads === 2)
            )
              return fulfillError(
                route,
                500,
                "provider_catalog_refresh_failed",
                "来源目录暂时无法读取，请稍后重试。",
              );
            return route.fulfill({
              json: { data: [updatedItem()], request_id: `p48-${scene.name}-refreshed-${catalogReads}` },
            });
          }
          if (request.method() === "POST") {
            healthCount++;
            return route.fulfill({
              json: {
                data: { health_status: "blocked", last_error_code: "captcha_required" },
                request_id: `p48-${scene.name}-health`,
              },
            });
          }
          putCount++;
          const body = request.postDataJSON();
          if (scene.outcome === "conflict")
            return fulfillError(
              route,
              409,
              "provider_version_conflict",
              "请重新读取最新配置后再修改。",
            );
          return route.fulfill({
            json: {
              data: { ...item.provisioned, ...body, version: Number(body.expected_version) + 1 },
              request_id: `p48-${scene.name}-put-${putCount}`,
            },
          });
        });

        await page.goto(origin + "/platform-admin/providers/sources");
        const editButton = page.getByRole("button", { name: "编辑采集设置" });
        await editButton.focus();
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog", { name: `采集设置 · ${item.name}` });
        await expect(dialog).toBeVisible();
        if (scene.outcome === "partial") {
          await dialog.getByLabel("运行状态").selectOption("enabled");
          await dialog.getByRole("button", { name: "烟测并启用" }).click();
          await expect(dialog.locator(".p48-source-configuration-save-feedback")).toHaveAttribute(
            "data-stage",
            "partial",
          );
          await dialog.getByRole("button", { name: "关闭", exact: true }).click();
        } else if (scene.outcome === "conflict") {
          await dialog.getByRole("button", { name: "保存配置" }).click();
          await expect(dialog.locator(".p48-source-configuration-save-feedback")).toHaveAttribute(
            "data-stage",
            "conflict",
          );
          await dialog.getByRole("button", { name: "关闭后重新读取", exact: true }).click();
        } else {
          await dialog.getByRole("button", { name: "保存配置" }).click();
          await expect(dialog.locator(".p48-source-configuration-save-feedback")).toHaveAttribute(
            "data-stage",
            "success",
          );
          await dialog.getByRole("button", { name: "完成", exact: true }).click();
        }
        await expect(dialog).toHaveCount(0);

        const feedback = page.locator(".p48-source-configuration-return");
        if (scene.name === "saved-retry") {
          await expect(feedback).toHaveAttribute("data-state", "failed");
          await expect(feedback.getByRole("button", { name: "重新读取来源目录" })).toBeFocused();
          await feedback.getByRole("button", { name: "重新读取来源目录" }).click();
        }
        await expect(feedback).toHaveAttribute("data-state", scene.capture);
        await expect(feedback).toHaveAttribute("data-outcome", scene.outcome);
        await expect(feedback.getByRole("heading")).toHaveText(
          configurationReturnCopy[scene.outcome][scene.capture],
        );
        check("capture state", await feedback.getAttribute("data-state"), scene.capture);
        check("return outcome", await feedback.getAttribute("data-outcome"), scene.outcome);
        check(
          "feedback busy",
          await feedback.getAttribute("aria-busy"),
          scene.capture === "refreshing" ? "true" : "false",
        );
        if (scene.capture === "failed")
          await expect(feedback.getByRole("button", { name: "重新读取来源目录" })).toBeFocused();
        else await expect(feedback.getByRole("heading")).toBeFocused();
        check("dialog closed before directory result", await page.getByRole("dialog").count(), 0);
        check("one source remains visible", await page.locator(".source-list article").count(), 1);
        check("global message suppressed", await page.locator(".source-message").count(), 0);
        check(
          "no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        );
        await picture("return");
        const technical = feedback.locator("details");
        if (width === 390 && (await technical.count())) {
          await technical.locator("summary").click();
          await picture("technical");
        }

        if (scene.hold) {
          releasePending();
          await expect(feedback).toHaveAttribute("data-state", scene.final);
        }
        check("final state", await feedback.getAttribute("data-state"), scene.final);
        if (scene.final === "success") await expect(feedback.getByRole("heading")).toBeFocused();
        const writes = requests.filter((request) => !request.key.startsWith("GET "));
        check("all writes have idempotency keys", writes.every((request) => request.idempotencyKey));
        check("catalog read count", catalogReads, scene.name === "saved-retry" ? 3 : 2);
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        check("write count", putCount + healthCount, scene.outcome === "partial" ? 2 : 1);
        if (scene.outcome === "partial") {
          check("partial has one disabled PUT", JSON.parse(writes.find((request) => request.key.startsWith("PUT ")).body).status, "disabled");
          check("partial has one health check", healthCount, 1);
        } else check("no health check", healthCount, 0);
        runs.push({ width, scene: scene.name, outcome: scene.outcome, capture: scene.capture, final: scene.final, checks, requests });
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
    kind: "P48-SOURCE-CONFIGURATION-RETURN-REVIEW-r1",
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
        `<figure><img src="${shot.file}" alt="${shot.width}px ${shot.scene} ${shot.state}"><figcaption>${shot.width}px · ${shot.scene} · ${shot.state}${shot.suffix === "technical" ? " · 技术详情" : ""}</figcaption></figure>`,
    )
    .join("\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P48 配置结果返回评审</title><style>body{margin:0;padding:24px;background:#e9eef6;color:#172033;font:14px system-ui}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}figure{margin:0;padding:12px;border-radius:16px;background:white;box-shadow:0 8px 24px #18243b1f}img{display:block;width:100%;height:auto;border-radius:10px}figcaption{padding-top:10px}</style><h1>P48 编辑采集设置 · 终态返回与目录重读 r1</h1><main>${cards}</main></html>`,
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
