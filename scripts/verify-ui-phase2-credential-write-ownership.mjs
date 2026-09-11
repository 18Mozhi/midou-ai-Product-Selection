import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";

assert.ok(process.argv.slice(2).every((argument) => argument === "--capture"));
const capture = process.argv.includes("--capture"),
  output = "output/playwright/p50-credential-write-ownership-review",
  component = "apps/web/src/components/CredentialAssetCenter.vue",
  confirmDialog = "apps/web/src/components/ConfirmDialog.vue",
  credentialCss = "apps/web/src/credential-assets.css",
  confirmCss = "apps/web/src/styles/onboarding-navigation.css",
  signalLedgerCss = "apps/web/src/signal-ledger.css",
  reviewCss =
    "design-plans/ui-phase-2-2026-09-07/implementation/credential-assets-page-preview.css",
  fixture = "tests/e2e/m03-02-credential-assets.spec.ts",
  read = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  widths = [390, 760, 1024, 1440],
  states = [
    "detached-create-pending",
    "detached-create-success",
    "detached-rotate-unknown",
    "detached-profile-conflict",
    "profile-current-conflict",
    "revoke-pending",
    "revoke-conflict",
  ];

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
  createdAsset = {
    ...data.asset,
    id: "00000000-0000-4000-8000-000000000806",
    name: "离页后已确认资产",
    kind: "api_key",
    version: 1,
  },
  sources = new Set([
    component,
    confirmDialog,
    credentialCss,
    confirmCss,
    signalLedgerCss,
    reviewCss,
    fixture,
    "scripts/verify-ui-phase2-credential-write-ownership.mjs",
    "apps/web/index.html",
    "apps/web/vite.config.ts",
  ]),
  runs = [],
  screenshots = [],
  ports = [];

const collectLoadedSource = {
  name: "p50-credential-write-source-collector",
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
let browser;
let server;
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
        name: "p50-credential-write-review-only",
        transformIndexHtml(html) {
          return html
            .replace("<body>", '<body class="p50-credential-page-review">')
            .replace(
              "</head>",
              `<link rel="stylesheet" href="/@fs/${path.resolve(reviewCss).replaceAll("\\", "/")}"></head>`,
            );
        },
      },
    ],
  });
  await server.listen();
  console.log(`P50 credential write ownership ${origin}`);
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
        let releaseWrite = () => {},
          writeStarted = false,
          assetReads = 0;
        const writeGate = new Promise((resolve) => {
          releaseWrite = resolve;
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
          },
          waitForWrite = async () => {
            await expect.poll(() => writeStarted).toBe(true);
          },
          leaveAndReturn = async () => {
            const link = page
              .getByRole("navigation", { name: "平台管理后台导航", exact: true })
              .locator('a[href="/platform-admin"]');
            await link.evaluate((element) => element.click());
            await expect(page).toHaveURL(/\/platform-admin$/);
            await page.goBack();
            await expect(page).toHaveURL(/\/platform-admin\/credentials$/);
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
          const allowed = [
            "GET /api/v1/me/navigation",
            "GET /api/v1/auth/session-status",
            "GET /api/v1/platform/credential-assets",
            "GET /api/v1/platform/crawler-profiles",
            "GET /api/v1/platform/credential-provider-options",
            "GET /api/v1/platform/dashboard",
            "POST /api/v1/platform/credential-assets",
            `POST /api/v1/platform/credential-assets/${data.asset.id}/rotate`,
            `POST /api/v1/platform/credential-assets/${data.asset.id}/revoke`,
            "POST /api/v1/platform/crawler-profiles",
          ];
          if (!allowed.includes(key)) {
            unexpected.push(key);
            return route.abort();
          }
          requests.push({
            key,
            body: request.postData(),
            idempotencyKey: request.headers()["idempotency-key"] ?? null,
          });
          if (request.method() === "POST") {
            writeStarted = true;
            const waits = [
              "detached-create-pending",
              "detached-create-success",
              "detached-rotate-unknown",
              "detached-profile-conflict",
              "revoke-pending",
            ];
            if (waits.includes(state)) await writeGate;
            if (state === "detached-rotate-unknown") return route.abort("failed");
            if (["detached-profile-conflict", "profile-current-conflict"].includes(state))
              return route.fulfill({
                status: 409,
                json: {
                  error: {
                    code: "crawler_profile_version_conflict",
                    message: "档案引用冲突",
                    action_hint: "档案引用冲突，请重新读取后重试。",
                  },
                  request_id: "p50-write-profile-conflict",
                },
              });
            if (["revoke-pending", "revoke-conflict"].includes(state))
              return route.fulfill({
                status: 409,
                json: {
                  error: {
                    code: "credential_version_conflict",
                    message: "凭证版本冲突",
                    action_hint: "凭证版本已经变化，请重新读取后再撤销。",
                  },
                  request_id: "p50-write-revoke-conflict",
                },
              });
            return route.fulfill({
              status: 201,
              json: { data: createdAsset, request_id: "p50-write-created" },
            });
          }
          if (url.pathname.endsWith("/me/navigation"))
            return route.fulfill({ json: { data: data.navigation, request_id: "p50-write-nav" } });
          if (url.pathname.endsWith("/auth/session-status"))
            return route.fulfill({ json: { data: { authenticated: true } } });
          if (url.pathname.endsWith("/dashboard"))
            return route.fulfill({
              json: {
                data: {
                  window: "24h",
                  summary: {
                    active_organizations: 0,
                    active_users: 0,
                    enabled_providers: 0,
                    storage_bytes: 0,
                  },
                  queues: [],
                  alerts: [],
                  provider_health: [],
                },
                request_id: "p50-write-dashboard",
              },
            });
          if (url.pathname.endsWith("/credential-assets")) {
            assetReads += 1;
            return route.fulfill({
              json: {
                data:
                  state === "detached-create-success" && assetReads > 1
                    ? [data.asset, createdAsset]
                    : [data.asset],
                request_id: `p50-write-assets-${assetReads}`,
              },
            });
          }
          if (url.pathname.endsWith("/crawler-profiles"))
            return route.fulfill({
              json: { data: [data.profile], request_id: "p50-write-profiles" },
            });
          return route.fulfill({
            json: {
              data: [data.provider, data.secondProvider],
              request_id: "p50-write-providers",
            },
          });
        });
        await page.goto(`${origin}/platform-admin/credentials`);
        const center = page.locator(".credential-center");
        await expect(
          center.getByRole("heading", { name: data.asset.name, exact: true }),
        ).toBeVisible();

        if (state.startsWith("detached-create")) {
          await center.getByRole("button", { name: "新建凭证资产", exact: true }).click();
          const editor = page.getByRole("dialog", { name: "创建凭证资产" });
          await editor.getByLabel("名称").fill(createdAsset.name);
          await editor.getByLabel("需要加密保存的内容").fill("p50-hidden-create-secret");
          await editor.getByRole("button", { name: "加密保存", exact: true }).click();
          await waitForWrite();
          await leaveAndReturn();
          check(
            "mutation controls locked while detached write is pending",
            await center.getByRole("button", { name: "配置网页登录", exact: true }).isDisabled(),
          );
          if (state === "detached-create-pending") {
            await expect(center.getByRole("status")).toContainText(
              "凭证资产保存仍在等待服务器响应",
            );
            check(
              "pending notice is informational",
              await center.getByRole("status").getAttribute("data-tone"),
              "info",
            );
            await picture();
            releaseWrite();
            await expect(
              center.getByRole("button", { name: "配置网页登录", exact: true }),
            ).toBeEnabled();
          } else {
            releaseWrite();
            await expect(
              center.getByRole("heading", { name: createdAsset.name, exact: true }),
            ).toBeVisible();
            await expect(center.getByRole("status")).toContainText("凭证资产保存已完成");
            check("confirmed write refreshes facts once", assetReads, 2);
            await picture();
          }
        } else if (state === "detached-rotate-unknown") {
          await center.getByRole("button", { name: "更新资料", exact: true }).click();
          const editor = page.getByRole("dialog", { name: `轮换 ${data.asset.name}` });
          await editor.getByLabel("需要加密保存的内容").fill("p50-hidden-rotate-secret");
          await editor.getByRole("button", { name: "确认轮换", exact: true }).click();
          await waitForWrite();
          await leaveAndReturn();
          releaseWrite();
          await expect(center.getByRole("status")).toContainText("凭证资料轮换结果暂时无法确认");
          await expect(center.getByRole("status")).toContainText("请核对后再操作");
          check("unknown write rereads facts once", assetReads, 2);
          await page.evaluate(() => window.scrollTo(0, 0));
          await picture();
        } else if (["detached-profile-conflict", "profile-current-conflict"].includes(state)) {
          await center.getByRole("button", { name: "关联运行档案", exact: true }).click();
          const editor = page.getByRole("dialog", { name: "创建浏览器档案引用" });
          await editor.getByLabel("内部标识").fill("review_profile");
          await editor.getByLabel("名称").fill("审核档案引用");
          await editor.getByRole("button", { name: "保存档案引用", exact: true }).click();
          await waitForWrite();
          if (state === "detached-profile-conflict") {
            await leaveAndReturn();
            releaseWrite();
            await expect(center.getByRole("status")).toContainText(
              "档案引用冲突，请重新读取后重试。",
            );
            await expect(center.getByRole("status")).toContainText("p50-write-profile-conflict");
            check("known detached failure does not reread facts", assetReads, 1);
          } else {
            await expect(editor.getByRole("status")).toContainText(
              "档案引用冲突，请重新读取后重试。",
            );
            await expect(editor.getByRole("status")).toContainText("p50-write-profile-conflict");
            check("profile editor remains open after failure", await editor.isVisible());
          }
          await picture();
        } else {
          await center.getByRole("button", { name: "撤销", exact: true }).click();
          const dialog = page.getByRole("alertdialog");
          await dialog.getByRole("checkbox").check();
          await dialog.getByPlaceholder("确认撤销").fill("确认撤销");
          await dialog.getByRole("button", { name: "撤销资产", exact: true }).click();
          await waitForWrite();
          if (state === "revoke-pending") {
            check(
              "revoke cancel locked",
              await dialog.getByRole("button", { name: "取消", exact: true }).isDisabled(),
            );
            check(
              "revoke confirmation locked",
              await dialog.getByRole("button", { name: "正在撤销…", exact: true }).isDisabled(),
            );
            await picture();
            releaseWrite();
          }
          await expect(dialog).toContainText("凭证版本已经变化，请重新读取后再撤销。");
          await expect(dialog).toContainText("p50-write-revoke-conflict");
          check("revoke dialog remains for a retry decision", await dialog.isVisible());
          if (state === "revoke-conflict") await picture();
        }

        const writes = requests.filter((request) => request.key.startsWith("POST "));
        check("one isolated write", writes.length, 1);
        check("write has a body", Boolean(writes[0]?.body));
        check("write has an idempotency key", Boolean(writes[0]?.idempotencyKey));
        const body = JSON.parse(writes[0].body);
        if (state.startsWith("detached-create")) {
          check("create targets the selected provider", body.provider_id, data.provider.id);
          check("create preserves the submitted name", body.name, createdAsset.name);
        } else if (state === "detached-rotate-unknown") {
          check("rotate preserves optimistic version", body.expected_version, data.asset.version);
          check(
            "rotate targets the submitted secret encoding",
            body.secret_payload.encoding,
            "utf8",
          );
        } else if (state.includes("profile")) {
          check("profile preserves credential reference", body.credential_asset_id, data.asset.id);
          check("profile preserves disabled default", body.status, "disabled");
        } else {
          check("revoke preserves optimistic version", body.expected_version, data.asset.version);
          check("revoke preserves fixed reason", body.reason, "平台安全管理员确认撤销");
        }
        check(
          "secret values never render",
          await page.evaluate(() =>
            ["p50-hidden-create-secret", "p50-hidden-rotate-secret"].every(
              (value) => !document.body.textContent.includes(value),
            ),
          ),
        );
        check(
          "no secret persistence",
          await page.evaluate(() => {
            const persisted = [
              ...Object.keys(localStorage).map((key) => `${key}:${localStorage.getItem(key)}`),
              ...Object.keys(sessionStorage).map((key) => `${key}:${sessionStorage.getItem(key)}`),
              document.cookie,
            ].join("\n");
            return (
              !persisted.includes("p50-hidden-create-secret") &&
              !persisted.includes("p50-hidden-rotate-secret")
            );
          }),
        );
        check("no browser cookies created", (await context.cookies()).length, 0);
        check(
          "no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        );
        check("no unexpected network", unexpected, []);
        check("no runtime errors", errors, []);
        runs.push({ width, state, checks, requests });
      } finally {
        await context.close();
      }
    }
  }
  for (const module of server.moduleGraph.idToModuleMap.values()) {
    const file = module.file && path.relative(process.cwd(), module.file).replaceAll("\\", "/");
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
  kind: "P50-CREDENTIAL-WRITE-OWNERSHIP-IMPLEMENTATION-r1",
  generatedAt: new Date().toISOString(),
  reviewOnly: true,
  productionChanged: true,
  deployed: false,
  processesClosed: true,
  states,
  ports,
  runs,
  screenshots,
  sourceHashes,
  requestBoundary:
    "All credential, profile and navigation facts are authoritative M03-02 fixtures. Every POST is intercepted inside the isolated browser and checked for its original path, body and idempotency header. No real credential, helper, API write, encryption, database or production system is accessed.",
  implementationBoundary:
    "Production Vue now keeps generic credential writes running without cancellation or replay, scopes modal feedback to the initiating page/editor/target, locks mutation controls while a prior write is pending, and reconciles detached success or unknown outcomes through a fresh read. C-direction styling remains review-only; real persistence, permissions, audit and deployment are not claimed.",
};
if (capture) {
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  const cards = screenshots
    .map(
      (shot) =>
        `<article><h2>${shot.width}px · ${shot.state}</h2><a href="${shot.file}"><img src="${shot.file}" alt="${shot.width}px ${shot.state}"></a></article>`,
    )
    .join("");
  await writeFile(
    `${output}/index.html`,
    [
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      "<title>P50 通用写入归属评审</title>",
      "<style>body{margin:0;padding:24px;background:#e9eef5;color:#142a46;font-family:sans-serif}",
      "main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,390px),1fr));gap:24px}",
      "article{padding:14px;background:white;border:1px solid #cfd9e7}h1{grid-column:1/-1}",
      "h1,h2{margin:0 0 12px}h2{font-size:15px}img{display:block;width:100%;height:auto;border:1px solid #d8e0eb}</style>",
      `<main><h1>P50 通用写入归属 · ${states.length} 种实际 Vue 状态</h1>`,
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
