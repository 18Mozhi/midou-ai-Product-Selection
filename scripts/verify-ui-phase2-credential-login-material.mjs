import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { previewCredentialLoginMaterial } from "./lib/ui-phase2-credential-login-material-preview.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.every(
    (arg) => arg === "--capture" || ["--suite=boundary", "--suite=lifecycle"].includes(arg),
  ),
);
const capture = args.includes("--capture"),
  suite = args.includes("--suite=lifecycle")
    ? "lifecycle"
    : args.includes("--suite=boundary")
      ? "boundary"
      : "core",
  output =
    suite === "core"
      ? "output/playwright/p50-credential-login-material-review"
      : suite === "boundary"
        ? "output/playwright/p50-credential-login-boundary-review"
        : "output/playwright/p50-credential-login-lifecycle-review",
  component = "apps/web/src/components/CredentialAssetCenter.vue",
  pageCss = "design-plans/ui-phase-2-2026-09-07/implementation/credential-assets-page-preview.css",
  materialCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/credential-login-material-preview.css",
  fixture = "tests/e2e/m03-02-credential-assets.spec.ts",
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  widths = [390, 760, 1024, 1440],
  states = {
    core: [
      "cookie-ready",
      "cookie-invalid",
      "browser-pending",
      "browser-success",
      "browser-empty",
      "archive-ready",
    ],
    boundary: [
      "cookie-oversize",
      "archive-invalid",
      "archive-oversize",
      "helper-unavailable",
      "helper-timeout",
      "source-switch",
    ],
    lifecycle: [
      "source-cleared",
      "file-late-ignored",
      "helper-late-ignored",
      "saving-asset",
      "asset-unknown",
      "profile-unknown",
      "profile-rejected",
    ],
  }[suite];

const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true),
  declarations = [];
function visit(node) {
  if (ts.isVariableDeclaration(node)) declarations.push(node);
  ts.forEachChild(node, visit);
}
visit(ast);
const sourceFor = (name) => {
    const matches = declarations.filter((node) => node.name.getText(ast) === name);
    assert.equal(matches.length, 1, `fixture declaration ${name}`);
    return `const ${name}=${matches[0].initializer.getText(ast)};`;
  },
  box = {};
vm.runInNewContext(
  ts.transpileModule(
    ["provider", "secondProvider", "asset", "profile", "navigation"].map(sourceFor).join("\n") +
      "\nglobalThis.data={provider,secondProvider,asset,profile,navigation};",
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  box,
);
const data = JSON.parse(JSON.stringify(box.data)),
  sources = new Set([
    component,
    pageCss,
    materialCss,
    fixture,
    "scripts/lib/ui-phase2-credential-login-material-preview.mjs",
    "scripts/verify-ui-phase2-credential-login-material.mjs",
    "apps/web/index.html",
    "apps/web/vite.config.ts",
  ]),
  runs = [],
  screenshots = [],
  ports = [];
const collectLoadedSource = {
  name: "p50-credential-material-source-collector",
  enforce: "pre",
  transform(_code, id) {
    const bare = id.split("?", 1)[0];
    if (!path.isAbsolute(bare)) return null;
    const relative = path.relative(process.cwd(), bare).replaceAll("\\", "/");
    if (
      !relative.includes("/node_modules/") &&
      (relative.startsWith("apps/") || relative.startsWith("packages/"))
    )
      sources.add(relative);
    return null;
  },
};

const reservation = reservePort();
await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
ports.push(port);
const origin = `http://127.0.0.1:${port}`;
let browser, server;
try {
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  server = await createServer({
    configFile: path.resolve("apps/web/vite.config.ts"),
    logLevel: "error",
    define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
    server: { host: "127.0.0.1", port, strictPort: true, proxy: {}, hmr: false },
    plugins: [
      collectLoadedSource,
      {
        name: "p50-credential-material-review-only",
        enforce: "pre",
        transform(code, id) {
          const bare = id.split("?", 1)[0];
          if (path.resolve(bare) !== path.resolve(component)) return null;
          return { code: previewCredentialLoginMaterial(code), map: null };
        },
        transformIndexHtml(html) {
          return html
            .replace(
              "<body>",
              '<body class="p50-credential-page-review p50-credential-material-review">',
            )
            .replace(
              "</head>",
              `<link rel="stylesheet" href="/@fs/${path.resolve(pageCss).replaceAll("\\", "/")}"><link rel="stylesheet" href="/@fs/${path.resolve(materialCss).replaceAll("\\", "/")}"></head>`,
            );
        },
      },
    ],
  });
  await server.listen();
  console.log(`P50 credential material ${origin}`);
  for (const width of widths) {
    for (const state of states) {
      const context = await browser.newContext({
        viewport: { width, height: width <= 760 ? 1000 : 1100 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
      try {
        const page = await context.newPage(),
          requests = [],
          unexpected = [],
          errors = [],
          checks = [];
        let releaseAssetWrite = () => {},
          assetWriteStarted = false,
          screenshotTaken = false;
        const assetWriteGate = new Promise((resolve) => {
          releaseAssetWrite = resolve;
        });
        const check = (name, actual, expected = true) => {
            assert.deepEqual(actual, expected, `${width}/${state}:${name}`);
            checks.push({ name, actual });
          },
          picture = async () => {
            if (!capture) return;
            const file = `${width}-${state}.png`,
              bytes = await page.screenshot({ animations: "disabled", caret: "hide" });
            await writeFile(`${output}/${file}`, bytes);
            screenshots.push({
              file,
              width,
              state,
              sha256: hash(bytes),
              pixelWidth: bytes.readUInt32BE(16),
              pixelHeight: bytes.readUInt32BE(20),
            });
            screenshotTaken = true;
          };
        await page.addInitScript((reviewState) => {
          window.__p50BridgeRequests = [];
          window.addEventListener("message", (event) => {
            if (event.data?.type === "SCOUTOPS_BROWSER_BRIDGE_REQUEST")
              window.__p50BridgeRequests.push(event.data);
          });
          if (reviewState !== "file-late-ignored") return;
          const original = File.prototype.text;
          Object.defineProperty(File.prototype, "text", {
            configurable: true,
            value() {
              if (this.name !== "late.cookies") return original.call(this);
              return new Promise((resolve, reject) => {
                window.__p50PendingFile = true;
                window.__p50ResolveFile = () => original.call(this).then(resolve, reject);
              });
            },
          });
        }, state);
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
          const allowedGet = [
              "GET /api/v1/me/navigation",
              "GET /api/v1/auth/session-status",
              "GET /api/v1/platform/credential-assets",
              "GET /api/v1/platform/crawler-profiles",
              "GET /api/v1/platform/credential-provider-options",
            ],
            allowedPost = [
              "POST /api/v1/platform/credential-assets",
              "POST /api/v1/platform/crawler-profiles",
            ];
          if (!allowedGet.includes(key) && !(suite === "lifecycle" && allowedPost.includes(key))) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({
            key,
            body: request.postData(),
            idempotencyKey: request.headers()["idempotency-key"] ?? null,
          });
          if (key === "POST /api/v1/platform/credential-assets") {
            assetWriteStarted = true;
            if (state === "saving-asset") {
              await assetWriteGate;
              return route.fulfill({
                status: 503,
                json: {
                  error: { code: "dependency_unavailable", message: "隔离写入失败" },
                  request_id: "p50-saving-release",
                },
              });
            }
            if (state === "asset-unknown") return route.abort("failed");
            return route.fulfill({
              status: 201,
              json: {
                data: {
                  ...data.asset,
                  name: `${data.provider.name} Cookie登录档案`,
                  kind: "cookie_bundle",
                  version: 1,
                },
                request_id: "p50-lifecycle-asset",
              },
            });
          }
          if (key === "POST /api/v1/platform/crawler-profiles") {
            if (state === "profile-unknown") return route.abort("failed");
            if (state === "profile-rejected")
              return route.fulfill({
                status: 503,
                json: {
                  error: { code: "dependency_unavailable", message: "隔离档案创建失败" },
                  request_id: "p50-profile-rejected",
                },
              });
            return route.fulfill({
              status: 201,
              json: { data: data.profile, request_id: "p50-lifecycle-profile" },
            });
          }
          if (url.pathname.endsWith("/me/navigation"))
            return route.fulfill({ json: { data: data.navigation, request_id: "p50-nav" } });
          if (url.pathname.endsWith("/auth/session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          if (url.pathname.endsWith("/credential-assets"))
            return route.fulfill({ json: { data: [data.asset], request_id: "p50-assets" } });
          if (url.pathname.endsWith("/crawler-profiles"))
            return route.fulfill({ json: { data: [data.profile], request_id: "p50-profiles" } });
          return route.fulfill({
            json: {
              data: [data.provider, data.secondProvider],
              request_id: "p50-providers",
            },
          });
        });
        if (state === "helper-timeout")
          await page.clock.install({ time: new Date("2026-09-11T06:00:00Z") });
        await page.goto(
          `${origin}/platform-admin/credentials?provider_id=${data.provider.id}&mode=login`,
        );
        const editor = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" }),
          source = editor.getByLabel("需要登录的来源"),
          mode = editor.getByLabel("导入方式"),
          save = editor.locator(":scope > footer button").last(),
          cancel = editor.getByRole("button", { name: "取消", exact: true });
        await expect(editor).toBeVisible();
        await expect(source.locator("option:checked")).toHaveText(data.provider.name);
        check(
          "initial source identity",
          await editor.locator(".login-provider-status strong").innerText(),
          data.provider.name,
        );

        if (state === "cookie-ready") {
          await editor.locator('input[type="file"]').setInputFiles({
            name: "review.cookies",
            mimeType: "text/plain",
            buffer: Buffer.from(
              JSON.stringify([
                {
                  name: "session",
                  value: "p50-hidden-cookie-material",
                  domain: "example.test",
                  path: "/",
                },
              ]),
            ),
          });
          await expect(editor.getByText(/已读取导入材料：review\.cookies/)).toBeVisible();
          check("selected mode", await mode.inputValue(), "cookie_file");
          check("save enabled", await save.isEnabled());
        } else if (state === "cookie-invalid") {
          await editor.locator('input[type="file"]').setInputFiles({
            name: "review.csv",
            mimeType: "text/csv",
            buffer: Buffer.from("review-only"),
          });
          await expect(editor.getByRole("status")).toHaveText(
            "Cookie 请上传 .json、.txt 或 .cookies 文件。",
          );
          check("selected mode", await mode.inputValue(), "cookie_file");
          check("save remains disabled", await save.isDisabled());
        } else if (state === "cookie-oversize") {
          await editor.locator('input[type="file"]').setInputFiles({
            name: "oversize.cookies",
            mimeType: "text/plain",
            buffer: Buffer.alloc(2_000_001, "x"),
          });
          await expect(editor.getByRole("status")).toHaveText("Cookie 文件不能超过 2 兆字节。");
          check("selected mode", await mode.inputValue(), "cookie_file");
          check("save remains disabled", await save.isDisabled());
        } else if (
          [
            "browser-pending",
            "browser-success",
            "browser-empty",
            "helper-unavailable",
            "helper-timeout",
          ].includes(state)
        ) {
          await mode.selectOption("browser");
          const readButton = editor.getByRole("button", {
            name: "从当前浏览器读取 Cookie",
            exact: true,
          });
          await readButton.click();
          await expect.poll(() => page.evaluate(() => window.__p50BridgeRequests.length)).toBe(1);
          if (state === "browser-pending") {
            await expect(editor.getByRole("button", { name: "读取中…" })).toBeDisabled();
            await expect(editor).toHaveAttribute("aria-busy", "true");
            check("source locked while reading", await source.isDisabled());
            check("mode locked while reading", await mode.isDisabled());
            check(
              "cancel remains available",
              await editor.getByRole("button", { name: "取消", exact: true }).isEnabled(),
            );
            check("save remains disabled", await save.isDisabled());
          } else if (state === "helper-timeout") {
            await page.clock.fastForward(15_001);
            await expect(editor).toHaveAttribute("aria-busy", "false");
            await expect(editor.getByRole("status")).toContainText("15 秒内没有收到浏览器助手响应");
            await expect(editor.getByRole("status")).toContainText("改用 Cookie 文件上传");
            check("source unlocked after timeout", await source.isEnabled());
            check("mode unlocked after timeout", await mode.isEnabled());
            check("save remains disabled", await save.isDisabled());
          } else {
            await page.evaluate((resultState) => {
              const request = window.__p50BridgeRequests[0];
              window.postMessage(
                resultState === "browser-success"
                  ? {
                      type: "SCOUTOPS_BROWSER_BRIDGE_RESULT",
                      request_id: request.request_id,
                      ok: true,
                      data: {
                        cookies: [
                          { name: "a", value: "p50-hidden-browser-a" },
                          { name: "b", value: "p50-hidden-browser-b" },
                        ],
                      },
                    }
                  : {
                      type: "SCOUTOPS_BROWSER_BRIDGE_RESULT",
                      request_id: request.request_id,
                      ok: false,
                      error:
                        resultState === "browser-empty"
                          ? "browser_cookie_empty"
                          : "browser_permission_denied",
                    },
                location.origin,
              );
            }, state);
            await expect(editor).toHaveAttribute("aria-busy", "false");
            await expect(source).toBeEnabled();
            await expect(mode).toBeEnabled();
            if (state === "browser-success") {
              await expect(editor.getByRole("status")).toContainText("已读取 2 条 Cookie");
              check("save enabled", await save.isEnabled());
            } else if (state === "browser-empty") {
              await expect(editor.getByRole("status")).toContainText(
                "当前浏览器没有这个来源可用的 Cookie",
              );
              check("save remains disabled", await save.isDisabled());
            } else {
              await expect(editor.getByRole("status")).toContainText("浏览器助手没有返回可用材料");
              await expect(editor.getByRole("status")).toContainText("检查当前来源权限");
              check("save remains disabled", await save.isDisabled());
            }
          }
          check("selected mode", await mode.inputValue(), "browser");
        } else if (state === "archive-ready") {
          await mode.selectOption("archive");
          await editor.locator('input[type="file"]').setInputFiles({
            name: "review-profile.tar.gz",
            mimeType: "application/gzip",
            buffer: Buffer.from("p50-hidden-archive-material"),
          });
          await expect(editor.getByText(/已读取导入材料：review-profile\.tar\.gz/)).toBeVisible();
          check("selected mode", await mode.inputValue(), "archive");
          check("save enabled", await save.isEnabled());
        } else if (state === "archive-invalid") {
          await mode.selectOption("archive");
          await editor.locator('input[type="file"]').setInputFiles({
            name: "review-profile.zip",
            mimeType: "application/zip",
            buffer: Buffer.from("review-only"),
          });
          await expect(editor.getByRole("status")).toHaveText(
            "完整浏览器档案请选择 .tar.gz 文件。",
          );
          check("selected mode", await mode.inputValue(), "archive");
          check("save remains disabled", await save.isDisabled());
        } else if (state === "archive-oversize") {
          await mode.selectOption("archive");
          await editor.locator('input[type="file"]').setInputFiles({
            name: "oversize-profile.tar.gz",
            mimeType: "application/gzip",
            buffer: Buffer.alloc(6_000_001, "x"),
          });
          await expect(editor.getByRole("status")).toHaveText(
            "浏览器档案压缩后不能超过 6 兆字节。",
          );
          check("selected mode", await mode.inputValue(), "archive");
          check("save remains disabled", await save.isDisabled());
        } else if (state === "source-switch") {
          await source.selectOption({ label: data.secondProvider.name });
          await expect(editor.locator(".login-provider-status strong")).toHaveText(
            data.secondProvider.name,
          );
          check("selected mode", await mode.inputValue(), "cookie_file");
          check(
            "source identity changed",
            await source.locator("option:checked").innerText(),
            data.secondProvider.name,
          );
          check("save remains disabled", await save.isDisabled());
        } else if (state === "source-cleared") {
          await editor.locator('input[type="file"]').setInputFiles({
            name: "source-bound.cookies",
            mimeType: "text/plain",
            buffer: Buffer.from(
              '[{"name":"source-bound","value":"p50-hidden-source-bound","domain":"example.test"}]',
            ),
          });
          await expect(save).toBeEnabled();
          await source.selectOption({ label: data.secondProvider.name });
          await expect(editor.locator(".archive-picker small")).toContainText("请选择 Cookie");
          await expect(editor.getByRole("status")).toContainText("来源或导入方式已变化");
          check(
            "source identity changed",
            await source.locator("option:checked").innerText(),
            data.secondProvider.name,
          );
          check("prepared material cleared", await save.isDisabled());
        } else if (state === "file-late-ignored") {
          await editor.locator('input[type="file"]').setInputFiles({
            name: "late.cookies",
            mimeType: "text/plain",
            buffer: Buffer.from(
              '[{"name":"late","value":"p50-hidden-late-file","domain":"example.test"}]',
            ),
          });
          await expect.poll(() => page.evaluate(() => Boolean(window.__p50PendingFile))).toBe(true);
          await cancel.click();
          await page.getByRole("button", { name: "配置网页登录", exact: true }).click();
          const reopened = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
          await reopened
            .getByLabel("需要登录的来源")
            .selectOption({ label: data.secondProvider.name });
          await page.evaluate(() => window.__p50ResolveFile());
          await expect(reopened.locator(".archive-picker small")).toContainText("请选择 Cookie");
          check(
            "late file result ignored",
            await reopened.locator(":scope > footer button").last().isDisabled(),
          );
          check(
            "reopened source identity",
            await reopened.getByLabel("需要登录的来源").locator("option:checked").innerText(),
            data.secondProvider.name,
          );
        } else if (state === "helper-late-ignored") {
          await mode.selectOption("browser");
          await editor
            .getByRole("button", { name: "从当前浏览器读取 Cookie", exact: true })
            .click();
          await expect.poll(() => page.evaluate(() => window.__p50BridgeRequests.length)).toBe(1);
          await cancel.click();
          await page.getByRole("button", { name: "配置网页登录", exact: true }).click();
          const reopened = page.getByRole("dialog", { name: "导入已经登录的浏览器档案" });
          await reopened
            .getByLabel("需要登录的来源")
            .selectOption({ label: data.secondProvider.name });
          await reopened.getByLabel("导入方式").selectOption("browser");
          await page.evaluate(() => {
            const request = window.__p50BridgeRequests[0];
            window.postMessage(
              {
                type: "SCOUTOPS_BROWSER_BRIDGE_RESULT",
                request_id: request.request_id,
                ok: true,
                data: { cookies: [{ name: "late", value: "p50-hidden-late-helper" }] },
              },
              location.origin,
            );
          });
          check(
            "late helper result ignored",
            await reopened.locator(":scope > footer button").last().isDisabled(),
          );
          check(
            "reopened source identity",
            await reopened.getByLabel("需要登录的来源").locator("option:checked").innerText(),
            data.secondProvider.name,
          );
        } else if (
          ["saving-asset", "asset-unknown", "profile-unknown", "profile-rejected"].includes(state)
        ) {
          await editor.locator('input[type="file"]').setInputFiles({
            name: `${state}.cookies`,
            mimeType: "text/plain",
            buffer: Buffer.from(
              `[{"name":"${state}","value":"p50-hidden-${state}","domain":"example.test"}]`,
            ),
          });
          await save.click();
          if (state === "saving-asset") {
            await expect.poll(() => assetWriteStarted).toBe(true);
            await expect(save).toHaveText("正在保存凭证资产…");
            check(
              "header close locked while saving",
              await editor.getByRole("button", { name: "关闭", exact: true }).isDisabled(),
            );
            check("cancel locked while saving", await cancel.isDisabled());
            check("source locked while saving", await source.isDisabled());
            check("mode locked while saving", await mode.isDisabled());
            await page.evaluate(() => document.fonts.ready);
            await picture();
            releaseAssetWrite();
            await expect(editor.getByRole("status")).toContainText("请求未完成，请稍后重试");
          } else if (state === "asset-unknown") {
            await expect(editor.getByRole("status")).toContainText("凭证资产写入结果暂时无法确认");
            await expect(editor.getByRole("status")).toContainText("不要重新导入或重复提交");
            check("unknown asset resubmit locked", await save.isDisabled());
          } else if (state === "profile-unknown") {
            await expect(editor.getByRole("status")).toContainText("加密档案已保存");
            await expect(editor.getByRole("status")).toContainText(
              "运行档案的写入结果暂时无法确认",
            );
            check("unknown profile resubmit locked", await save.isDisabled());
          } else {
            await expect(editor.getByRole("status")).toContainText("运行档案未创建");
            await expect(editor.getByRole("status")).toContainText("关联运行档案");
            check("rejected profile resubmit locked", await save.isDisabled());
          }
        }

        check(
          "three credential data GETs",
          requests.filter(
            (request) =>
              request.key.startsWith("GET ") && request.key.includes("/api/v1/platform/"),
          ).length,
          3,
        );
        check(
          "all network requests are GET without bodies",
          requests
            .filter((request) => request.key.startsWith("GET "))
            .every((request) => request.body === null),
        );
        if (suite === "lifecycle") {
          const writes = requests.filter((request) => request.key.startsWith("POST ")),
            expectedWrites = ["profile-unknown", "profile-rejected"].includes(state)
              ? 2
              : ["saving-asset", "asset-unknown"].includes(state)
                ? 1
                : 0;
          check("expected isolated writes", writes.length, expectedWrites);
          check(
            "writes carry bodies and idempotency keys",
            writes.every((request) => Boolean(request.body && request.idempotencyKey)),
          );
        }
        check(
          "material values never render",
          await page.evaluate(() =>
            [
              "p50-hidden-cookie-material",
              "p50-hidden-browser-a",
              "p50-hidden-browser-b",
              "p50-hidden-archive-material",
              "p50-hidden-source-bound",
              "p50-hidden-late-file",
              "p50-hidden-late-helper",
              "p50-hidden-saving-asset",
              "p50-hidden-asset-unknown",
              "p50-hidden-profile-unknown",
              "p50-hidden-profile-rejected",
            ].every((value) => !document.body.textContent.includes(value)),
          ),
        );
        check(
          "no material persistence",
          await page.evaluate(() => {
            const persisted = [
              ...Object.keys(localStorage).map((key) => `${key}:${localStorage.getItem(key)}`),
              ...Object.keys(sessionStorage).map((key) => `${key}:${sessionStorage.getItem(key)}`),
              document.cookie,
            ].join("\n");
            return [
              "p50-hidden-cookie-material",
              "p50-hidden-browser-a",
              "p50-hidden-browser-b",
              "p50-hidden-archive-material",
              "p50-hidden-source-bound",
              "p50-hidden-late-file",
              "p50-hidden-late-helper",
              "p50-hidden-saving-asset",
              "p50-hidden-asset-unknown",
              "p50-hidden-profile-unknown",
              "p50-hidden-profile-rejected",
            ].every((value) => !persisted.includes(value));
          }),
        );
        check("no browser cookies created", (await context.cookies()).length, 0);
        for (const [name, control] of [
          ["source", source],
          ["mode", mode],
          ["cancel", cancel],
          ["save", save],
        ])
          check(
            `target44 ${name}`,
            await control.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              return rect.width >= 44 && rect.height >= 44;
            }),
          );
        check(
          "no horizontal overflow",
          await editor.evaluate(
            (element) =>
              element.scrollWidth <= element.clientWidth + 1 &&
              document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
        );
        check(
          "footer actions remain in viewport",
          await editor.locator(":scope > footer").evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight + 1;
          }),
        );
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        await page.evaluate(() => document.fonts.ready);
        if (!screenshotTaken) await picture();
        runs.push({ width, state, checks, requests });
      } finally {
        await context.close();
      }
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
} finally {
  if (server) await server.close();
  if (browser) await browser.close();
}

await new Promise((resolve) => setTimeout(resolve, 50));
const sourceHashes = {};
for (const file of [...sources].sort()) {
  try {
    sourceHashes[file] = hash(await read(file));
  } catch {}
}
const evidence = {
  kind:
    suite === "core"
      ? "P50-CREDENTIAL-LOGIN-MATERIAL-REVIEW-r1"
      : suite === "boundary"
        ? "P50-CREDENTIAL-LOGIN-BOUNDARY-REVIEW-r1"
        : "P50-CREDENTIAL-LOGIN-LIFECYCLE-IMPLEMENTATION-r1",
  generatedAt: new Date().toISOString(),
  reviewOnly: true,
  productionChanged: suite === "lifecycle",
  deployed: false,
  processesClosed: true,
  states,
  ports,
  runs,
  screenshots,
  sourceHashes,
  materialBoundary:
    suite === "core"
      ? "All file contents and browser-helper cookies are synthetic in-memory review values. Screenshots expose filenames/counts and feedback only. No save action, external page, real helper, API write, encryption, database or production credential is used."
      : suite === "boundary"
        ? "Oversize and invalid files are synthetic local buffers; helper denial and timeout are locally delivered or clock-driven. No file content is rendered or persisted and no save action, external page, real helper, API write, encryption, database or production credential is used."
        : "All lifecycle files and browser-helper values are synthetic and local. POST requests are intercepted in the isolated browser and never reach a backend, encryption service, database or production. Screenshots expose only filenames and status feedback; material values are neither rendered nor persisted.",
  proposalBoundary:
    suite === "core"
      ? "This is a visual review batch for the material-reading states. Production lifecycle ownership and post-close cleanup are now covered separately by the lifecycle implementation evidence; this batch does not claim real helper, API, database or production verification."
      : suite === "boundary"
        ? "This visual boundary review preserves the exact 2,000,000 and 6,000,000 byte limits and extension allowlists, distinguishes the 15-second helper timeout from helper denial, and keeps recovery choices visible. Production lifecycle ownership is covered separately; real helper, API, database and production verification are not claimed."
        : "The production Vue component now binds file and helper results to the active editor/source/mode generation, clears prepared material on context change, locks close/cancel/source/mode during writes, and fails closed when either write outcome is unknown. C-direction styling remains a review-only transform. KeepAlive deactivation, real browser-helper, backend encryption, database writes and production deployment are not claimed.",
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  const cards = screenshots
    .map(
      (shot) =>
        `<article><h2>${shot.width}px · ${shot.state}</h2><a href="${shot.file}"><img src="${shot.file}" alt="${shot.width}px ${shot.state}"></a></article>`,
    )
    .join("");
  const galleryKind = suite === "core" ? "状态" : suite === "boundary" ? "边界" : "生命周期";
  await writeFile(
    `${output}/index.html`,
    [
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      `<title>P50 登录材料${galleryKind}评审</title>`,
      "<style>body{margin:0;padding:24px;background:#e9eef5;color:#142a46;font-family:sans-serif}",
      "main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,390px),1fr));gap:24px}",
      "article{padding:14px;background:white;border:1px solid #cfd9e7}h1{grid-column:1/-1}",
      "h1,h2{margin:0 0 12px}h2{font-size:15px}img{display:block;width:100%;height:auto;border:1px solid #d8e0eb}</style>",
      `<main><h1>P50 登录材料 · ${states.length} 种实际 Vue ${galleryKind}</h1>`,
      cards,
      "</main></html>",
    ].join(""),
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
