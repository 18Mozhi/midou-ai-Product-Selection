import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { build } from "esbuild";
import { parse, compileScript } from "@vue/compiler-sfc";
import { dirname } from "node:path";
import { chromium } from "playwright";

test("real Vue administrator panel explicitly confirms metadata-only cookie binding", async () => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-amazon-session-ui-"));
  let browser, server;
  console.log("owned_ui_temp=" + root);
  const assets = [
    {
      id: "old",
      provider_id: "amazon",
      name: "原匿名档案",
      kind: "browser_profile",
      status: "active",
      version: 1,
      expires_at: null,
    },
    {
      id: "cookie",
      provider_id: "amazon",
      name: "管理员 Amazon Cookie",
      kind: "cookie_bundle",
      status: "active",
      version: 1,
      expires_at: null,
    },
    {
      id: "expired",
      provider_id: "amazon",
      name: "已过期",
      kind: "cookie_bundle",
      status: "active",
      version: 1,
      expires_at: "2000-01-01T00:00:00Z",
    },
  ];
  let current = {
    profile_id: "profile",
    profile_version: 1,
    provider_id: "amazon",
    asset_id: "old",
    asset_version: 1,
    asset_name: "原匿名档案",
    mode: "anonymous",
    available: true,
    expires_at: null,
  };
  const writes = [];
  try {
    const styles = [];
    const bundle = await build({
      stdin: {
        contents: `import {createApp} from 'vue';import Component from './apps/web/src/components/AmazonCookieSessionControl.vue';createApp(Component,{apiBaseUrl:location.origin+'/api/v1',assets:${JSON.stringify(assets)},busy:false}).mount('#app')`,
        resolveDir: resolve("."),
        sourcefile: "owned-session-entry.ts",
        loader: "ts",
      },
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
      logLevel: "silent",
      plugins: [
        {
          name: "owned-real-vue-source",
          setup(b) {
            b.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
              const source = await readFile(path, "utf8"),
                { descriptor } = parse(source, { filename: path });
              styles.push(...descriptor.styles.map((s) => s.content));
              return {
                contents: compileScript(descriptor, { id: "owned-session", inlineTemplate: true })
                  .content,
                loader: "ts",
                resolveDir: dirname(path),
              };
            });
          },
        },
      ],
    });
    const javascript = bundle.outputFiles[0].text;
    server = createServer((req, res) => {
      if (req.url === "/__owned-app.js") {
        res.setHeader("content-type", "text/javascript");
        res.end(javascript);
        return;
      }
      if (req.url !== "/__owned_amazon_session.html") {
        res.writeHead(404).end();
        return;
      }
      res.setHeader("content-type", "text/html");
      res.end(
        `<style>${styles.join("\n")}</style><div id="app"></div><script type="module" src="/__owned-app.js"></script>`,
      );
    });
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    const port = server.address().port;
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/v1/platform/amazon-session", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        assert.deepEqual(body, {
          asset_id: "cookie",
          expected_asset_version: 1,
          expected_profile_version: 1,
        });
        assert.ok((await route.request().allHeaders())["idempotency-key"]);
        writes.push(body);
        current = {
          ...current,
          profile_version: 2,
          asset_id: "cookie",
          asset_name: "管理员 Amazon Cookie",
          mode: "administrator_cookie",
        };
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: current, request_id: "owned", trace_id: "owned" }),
      });
    });
    await page.goto(`http://127.0.0.1:${port}/__owned_amazon_session.html`);
    try {
      await page.getByText(/当前：\s*项目匿名会话/).waitFor();
    } catch (e) {
      throw new Error(
        JSON.stringify({
          reason: e.message,
          errors,
          body: (await page.locator("body").innerText()).slice(0, 600),
        }),
      );
    }
    assert.equal(await page.getByRole("option", { name: "已过期", exact: false }).count(), 0);
    await page.getByLabel("采集使用的凭证").selectOption("cookie");
    await page.getByRole("button", { name: "切换采集会话", exact: true }).click();
    assert.equal(writes.length, 0, "selection alone does not mutate configuration");
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "确认切换", exact: true })
      .click();
    await page.getByText(/当前：\s*管理员登录 Cookie/).waitFor();
    assert.equal(writes.length, 1);
    assert.deepEqual(errors, []);
    assert.match(await page.locator("body").textContent(), /不会据此解除熔断/);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const box = await page.getByLabel("采集使用的凭证").boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width);
    }
  } finally {
    await browser?.close();
    if (server) {
      server.closeAllConnections();
      await new Promise((done) => server.close(done));
    }
    await rm(root, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
  }
});
