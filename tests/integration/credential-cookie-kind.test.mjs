import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createServer } from "node:http";
import { build } from "esbuild";
import { parse, compileScript } from "@vue/compiler-sfc";
import { chromium } from "playwright";

test("real credential form creates an internal cookie_bundle and explicitly binds it", async () => {
  const writes = [],
    bindings = [],
    errors = [];
  const provider = "00000000-0000-4000-8000-000000000101";
  const assets = [
    {
      id: "old",
      provider_id: provider,
      name: "原匿名档案",
      kind: "browser_profile",
      status: "active",
      version: 1,
      key_version: "v1",
      fingerprint: "owned",
      expires_at: null,
      rotated_at: null,
      updated_at: new Date().toISOString(),
    },
  ];
  let session = {
    profile_id: "profile",
    profile_version: 1,
    provider_id: provider,
    asset_id: "old",
    asset_version: 1,
    asset_name: "原匿名档案",
    mode: "anonymous",
    available: true,
    expires_at: null,
  };
  let server, browser;
  try {
    const bundle = await build({
      stdin: {
        contents:
          "import {createApp} from 'vue';import C from './apps/web/src/components/CredentialAssetCenter.vue';createApp(C,{apiBaseUrl:location.origin+'/api/v1'}).mount('#app')",
        resolveDir: resolve("."),
        loader: "ts",
      },
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
      logLevel: "silent",
      loader: { ".css": "empty" },
      plugins: [
        {
          name: "owned-credential-form",
          setup(b) {
            b.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
              const selected =
                path.endsWith("CredentialAssetCenter.vue") &&
                process.env.SCOUTOPS_OWNED_CREDENTIAL_SOURCE
                  ? process.env.SCOUTOPS_OWNED_CREDENTIAL_SOURCE
                  : path;
              const { descriptor } = parse(await readFile(selected, "utf8"), { filename: path });
              return {
                contents: compileScript(descriptor, { id: "owned-form", inlineTemplate: true })
                  .content,
                loader: "ts",
                resolveDir: dirname(path),
              };
            });
          },
        },
      ],
    });
    server = createServer((req, res) => {
      if (req.url === "/app.js") {
        res.setHeader("content-type", "text/javascript");
        res.end(bundle.outputFiles[0].text);
      } else if (req.url === "/") {
        res.setHeader("content-type", "text/html");
        res.end('<div id="app"></div><script type="module" src="/app.js"></script>');
      } else res.writeHead(404).end();
    });
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      let data;
      if (path.endsWith("/credential-provider-options"))
        data = [
          {
            id: provider,
            code: "amazon_product",
            name: "Amazon 商品页面",
            target_url: "https://www.amazon.com",
            access_mode: "public_page",
          },
        ];
      else if (path.endsWith("/crawler-profiles")) data = [];
      else if (path.endsWith("/amazon-session")) {
        if (request.method() === "POST") {
          const body = request.postDataJSON();
          bindings.push(body);
          session = {
            ...session,
            profile_version: 2,
            asset_id: "cookie",
            asset_name: "受控Cookie",
            mode: "administrator_cookie",
          };
        }
        data = session;
      } else if (path.endsWith("/credential-assets")) {
        if (request.method() === "POST") {
          const body = request.postDataJSON();
          writes.push({ kind: body.kind, provider_id: body.provider_id, name: body.name });
          if (body.kind !== "cookie_bundle") {
            await route.fulfill({
              status: 400,
              contentType: "application/json",
              body: JSON.stringify({
                error: {
                  code: "credential_input_invalid",
                  message: "凭证类型不合法",
                  action_hint: "使用内部类型值。",
                },
                request_id: "owned",
                trace_id: "owned",
              }),
            });
            return;
          }
          const item = { ...assets[0], id: "cookie", kind: body.kind, name: body.name };
          assets.push(item);
          data = item;
        } else data = assets;
      } else throw Error("unexpected owned route");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data, request_id: "owned", trace_id: "owned" }),
      });
    });
    await page.goto("http://127.0.0.1:" + server.address().port + "/");
    await page.getByRole("button", { name: "新建凭证资产", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "创建凭证资产" });
    await dialog.getByLabel(/^所属来源/).selectOption(provider);
    await dialog.getByLabel(/^类型/).selectOption({ label: "登录状态" });
    await dialog.getByLabel("名称", { exact: true }).fill("受控Cookie");
    await dialog
      .getByLabel("需要加密保存的内容", { exact: true })
      .fill("OWNED-NOT-A-REAL-CREDENTIAL");
    await dialog.getByRole("button", { name: "加密保存", exact: true }).click();
    await page.waitForFunction(
      () =>
        !document.querySelector('[role="dialog"]') ||
        document.querySelector('[role="status"]')?.textContent.includes("类型"),
    );
    assert.equal(writes.length, 1);
    assert.equal(
      writes[0].kind,
      "cookie_bundle",
      "wire value must remain internal enum, not localized display text",
    );
    assert.equal(writes[0].provider_id, provider);
    await page.locator(".amazon-session-control select").selectOption("cookie");
    await page.getByRole("button", { name: "切换采集会话", exact: true }).click();
    assert.equal(bindings.length, 0);
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "确认切换", exact: true })
      .click();
    await page.getByText(/当前：\s*管理员登录 Cookie/).waitFor();
    assert.deepEqual(bindings, [
      { asset_id: "cookie", expected_asset_version: 1, expected_profile_version: 1 },
    ]);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    if (server) {
      server.closeAllConnections();
      await new Promise((done) => server.close(done));
    }
  }
});
