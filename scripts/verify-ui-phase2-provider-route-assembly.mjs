import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer as reservePort } from "node:net";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { providerPagePreview } from "./lib/ui-phase2-provider-page-preview.mjs";

const capture = process.argv.includes("--capture");
const keyboardTrap = process.argv.includes("--keyboard-trap");
assert.ok(process.argv.slice(2).every((v) => ["--capture", "--keyboard-trap"].includes(v)));
const output =
  "output/playwright/" +
  (keyboardTrap ? "p46-editor-keyboard-implementation" : "p46-route-assembly-review");
const read = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const registry = "apps/web/src/components/ProviderRegistry.vue";
const original = await read(registry),
  preview = providerPagePreview(original);
assert.ok(
  keyboardTrap ||
    hash(original) === "ec671e2cf8c1d55f88d97df05d7a14849235961b4e4f66f838ca0cf6fb76971f",
  "Original assembly is historical; use --keyboard-trap for current source, do not overwrite approved evidence",
);
const fixture = "tests/e2e/m03-01-provider-registry.spec.ts";
const ast = ts.createSourceFile(fixture, await read(fixture), ts.ScriptTarget.Latest, true);
const declarations = ast.statements
  .filter(ts.isVariableStatement)
  .flatMap((n) => [...n.declarationList.declarations]);
const box = {};
vm.runInNewContext(
  ["definition", "blockedDefinition", "definitions", "navigation"]
    .map((name) => {
      const found = declarations.filter((n) => n.name.getText(ast) === name);
      assert.equal(found.length, 1);
      return "const " + name + "=" + found[0].initializer.getText(ast) + ";";
    })
    .join("\n") + "globalThis.data={definition,definitions,navigation};",
  box,
);
const data = JSON.parse(JSON.stringify(box.data));
const styles = [
  "provider-page-preview.css",
  "provider-editor-preview.css",
  "provider-detail-preview.css",
  "provider-route-assembly-preview.css",
].map((f) => "design-plans/ui-phase-2-2026-09-07/implementation/" + f);
const sources = new Set([
  registry,
  fixture,
  ...styles,
  "apps/web/index.html",
  "apps/web/vite.config.ts",
  "scripts/verify-ui-phase2-provider-route-assembly.mjs",
  "scripts/lib/ui-phase2-provider-page-preview.mjs",
]);
const probe = reservePort();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const server = await createServer({
  configFile: path.resolve("apps/web/vite.config.ts"),
  logLevel: "error",
  define: { "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1") },
  server: { host: "127.0.0.1", port, strictPort: true, open: false, proxy: {}, hmr: false },
  plugins: [
    {
      name: "p46-full-route-review",
      enforce: "pre",
      transform(source, id) {
        if (id.replaceAll("\\", "/") !== path.resolve(registry).replaceAll("\\", "/")) return null;
        assert.equal(source.replaceAll("\r\n", "\n"), original);
        return { code: preview, map: null };
      },
      transformIndexHtml(html) {
        assert.ok(html.includes('src="/src/main.ts"'));
        return html
          .replace(
            "<body>",
            '<body class="p46-route-review p46-page-review p46-editor-review p46-detail-review"><p class="assembly-disclaimer">P46 审核预览 · 测试数据 · 未上线</p>',
          )
          .replace(
            "</head>",
            styles
              .map(
                (f) =>
                  '<link rel="stylesheet" href="/@fs/' +
                  path.resolve(f).replaceAll("\\", "/") +
                  '">',
              )
              .join("\n") + "</head>",
          );
      },
    },
  ],
});
const checks = [],
  screenshots = [],
  observations = [];
let browser;
try {
  await server.listen();
  const origin = "http://127.0.0.1:" + port;
  console.log("p46_route_host " + origin);
  browser = await chromium.launch();
  if (capture) await mkdir(output, { recursive: true });
  for (const width of [390, 760, 761, 840, 841, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    const page = await context.newPage(),
      requests = [],
      unexpected = [],
      errors = [],
      focus = [];
    let readStatus = 200,
      navStatus = 200,
      releaseWrite;
    const check = (name, actual, expected = true) => {
      assert.deepEqual(actual, expected, width + ":" + name);
      checks.push({ width, name, actual });
    };
    try {
      await page.clock.install({ time: new Date("2026-09-11T04:00:00Z") });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", async (route) => {
        const request = route.request(),
          url = new URL(request.url()),
          method = request.method();
        if (url.origin !== origin) {
          unexpected.push("external request");
          return route.abort();
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        const key = method + " " + url.pathname;
        if (
          ![
            "GET /api/v1/auth/session-status",
            "GET /api/v1/me/navigation",
            "GET /api/v1/platform/providers",
            "GET /api/v1/platform/provider-adapters",
            "PUT /api/v1/platform/providers/" + data.definition.id,
          ].includes(key)
        ) {
          unexpected.push(key);
          return route.abort();
        }
        const record = {
          method,
          path: url.pathname,
          query: url.search,
          body: method === "PUT" ? request.postDataJSON() : null,
        };
        requests.push(record);
        if (method === "PUT") {
          record.idempotencyPresent = !!request.headers()["idempotency-key"];
          await new Promise((r) => {
            releaseWrite = r;
          });
          record.status = 409;
          return route.fulfill({
            status: 409,
            json: {
              error: {
                code: "provider_version_conflict",
                message: "版本冲突",
                action_hint: "请重新核对来源版本。",
              },
              request_id: "assembly-conflict",
              trace_id: "assembly",
            },
          });
        }
        const status = url.pathname.endsWith("/navigation")
          ? navStatus
          : url.pathname.endsWith("/providers")
            ? readStatus
            : 200;
        record.status = status;
        let payload = url.pathname.endsWith("/session-status")
          ? { authenticated: true }
          : url.pathname.endsWith("/navigation")
            ? data.navigation
            : url.pathname.endsWith("/providers")
              ? data.definitions
              : [];
        return route.fulfill({
          status,
          json:
            status === 200
              ? { data: payload, request_id: "assembly-read", trace_id: "assembly" }
              : {
                  error: {
                    code: status === 403 ? "authorization_denied" : "dependency_unavailable",
                    message: "本地审核样例失败",
                    action_hint: "重新读取后核对当前状态。",
                  },
                  request_id: "assembly-read-error",
                  trace_id: "assembly",
                },
        });
      });
      const settle = async () => {
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => document.fonts.ready);
        await page.clock.runFor(120);
      };
      const shot = async (state, selector = null, fullPage = false) => {
        await settle();
        if (selector)
          await page
            .locator(selector)
            .first()
            .evaluate((n) => n.scrollIntoView({ block: "start", behavior: "instant" }));
        else await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.clock.runFor(120);
        check(
          state + " no horizontal overflow",
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (!capture) return;
        const bytes = await page.screenshot({ fullPage, animations: "disabled" }),
          file = width + "-" + state + ".png";
        await writeFile(output + "/" + file, bytes);
        screenshots.push({
          width,
          state,
          file,
          fullPage,
          height: bytes.readUInt32BE(20),
          sha256: hash(bytes),
        });
      };
      const providerReads = () =>
        requests.filter((r) => r.path === "/api/v1/platform/providers" && r.method === "GET")
          .length;
      const recordButton = () =>
        width <= 760
          ? page
              .locator(".responsive-data-view__mobile article > button")
              .filter({ hasText: "公开趋势 RSS" })
          : page
              .locator(".responsive-data-view__desktop tr")
              .filter({ hasText: "公开趋势 RSS" })
              .getByRole("button", { name: "编辑", exact: true });
      const editor = () => page.locator(".provider-editor");
      const keyboardBoundary = async (label) => {
        if (!keyboardTrap) return;
        const focusable = editor().locator(
          "button,input,select,textarea,a[href],summary,[tabindex]",
        );
        const indices = await focusable.evaluateAll((nodes) =>
          nodes.flatMap((n, i) =>
            n.tabIndex >= 0 &&
            !n.matches(":disabled") &&
            !n.closest("[inert]") &&
            n.checkVisibility({ visibilityProperty: true })
              ? [i]
              : [],
          ),
        );
        assert.ok(indices.length > 1);
        const first = focusable.nth(indices[0]),
          last = focusable.nth(indices.at(-1));
        await last.focus();
        await page.keyboard.press("Tab");
        check(label + " forward wraps", await first.evaluate((n) => n === document.activeElement));
        await page.keyboard.press("Shift+Tab");
        check(label + " reverse wraps", await last.evaluate((n) => n === document.activeElement));
        await first.focus();
        await page.keyboard.press("Tab");
        check(
          label + " middle moves normally",
          await focusable.nth(indices[1]).evaluate((n) => n === document.activeElement),
        );
      };
      const close = async () => {
        await page.getByRole("button", { name: "关闭来源设置编辑", exact: true }).click();
        await expect(editor()).toHaveCount(0);
        await settle();
      };
      await page.goto(origin + "/platform-admin/providers?keep=p46-route");
      await expect(page.locator('.role-shell[data-state="ready"]')).toBeVisible();
      await expect(page.locator(".provider-list-tools")).toBeVisible();
      check("actual title", await page.title(), "来源设置 · 智能选品");
      check(
        "platform scope",
        await page.locator(".role-shell").getAttribute("data-shell"),
        "platform_admin",
      );
      check("provider initial GET", providerReads(), 1);
      check(
        "overview count",
        await page.locator(".provider-overview strong").first().innerText(),
        "25",
      );
      await shot("page-top");
      check(
        "page title remains one line",
        await page.locator(".role-page-title h1").evaluate((n) => {
          const line = parseFloat(getComputedStyle(n).lineHeight);
          return n.getBoundingClientRect().height <= line + 1;
        }),
      );
      await shot("page-full", null, true);
      await shot("records", ".responsive-data-view");
      if (width <= 840) {
        await page.getByRole("button", { name: "打开导航菜单", exact: true }).click();
        await expect(page.locator(".role-sidebar.is-open")).toBeVisible();
        await shot("shell-navigation");
        check(
          "menu below topbar",
          await page.evaluate(
            () =>
              document.querySelector(".role-sidebar").getBoundingClientRect().top >=
              document.querySelector(".role-topbar").getBoundingClientRect().bottom,
          ),
        );
        check(
          "menu toggle unobscured",
          await page.locator(".role-menu-toggle").evaluate((n) => {
            const r = n.getBoundingClientRect();
            return n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          }),
        );
        await page.getByRole("button", { name: "打开导航菜单", exact: true }).click();
      }
      await page.locator(".provider-hero > button").click();
      await expect(editor()).toBeVisible();
      await settle();
      check(
        "create initial focus",
        await page
          .locator(".provider-fields input")
          .first()
          .evaluate((n) => n === document.activeElement),
      );
      await shot("create-step1", ".provider-editor > header");
      await keyboardBoundary("create step1");
      await page.getByRole("button", { name: "下一步", exact: true }).click();
      check(
        "invalid first step retained",
        await page.locator('.provider-editor-steps [aria-current="step"]').innerText(),
        "1\n基本信息",
      );
      await shot("create-validation", ".provider-fields");
      await page.locator(".provider-fields input").first().fill("route_review_source");
      await page.getByRole("textbox", { name: /^名称/ }).fill("整页联动审核来源");
      await page.getByRole("textbox", { name: /^目标 URL/ }).fill("https://example.test/feed");
      for (const [step, name] of [
        [2, "范围与字段"],
        [3, "执行策略"],
        [4, "合规与发布"],
      ]) {
        await page.getByRole("button", { name: step + " " + name, exact: true }).click();
        await shot("create-step" + step, ".provider-fields");
        await keyboardBoundary("create step" + step);
      }
      // Record the real keyboard boundary; an escaping focus is a gap, not a pass.
      await editor().locator('button[type="submit"]').focus();
      await page.keyboard.press("Tab");
      focus.push({
        case: "editor-last-tab",
        inside: await page.evaluate(() => !!document.activeElement?.closest(".provider-editor")),
        target: await page.evaluate(() => ({
          tag: document.activeElement?.tagName,
          label: document.activeElement?.getAttribute("aria-label"),
        })),
      });
      if (keyboardTrap) check("editor Tab remains inside", focus.at(-1).inside);
      await close();
      check(
        "create close returns trigger",
        await page.locator(".provider-hero > button").evaluate((n) => n === document.activeElement),
      );
      await page.getByRole("searchbox", { name: "搜索", exact: true }).fill("待复核公开来源");
      check(
        "filtered global count",
        await page.locator(".provider-list-heading span").innerText(),
        "共 25 条，当前筛选 1 条",
      );
      await shot("filtered-record", ".provider-list-tools");
      await page.getByRole("button", { name: "重置", exact: true }).click();
      await recordButton().click();
      if (width <= 760) {
        await expect(page.locator(".responsive-data-view__drawer")).toBeVisible();
        check("detail makes App inert", await page.locator("#app").evaluate((n) => n.inert));
        await shot("detail", ".responsive-data-view__drawer");
        await page
          .locator(".responsive-data-view__drawer")
          .getByText("技术详情", { exact: true })
          .click();
        await shot("detail-technical", ".responsive-data-view__details > details");
        await page
          .locator(".responsive-data-view__drawer")
          .getByRole("button", { name: "编辑来源", exact: true })
          .click();
        check(
          "detail closed before editing",
          await page.locator(".responsive-data-view__drawer").count(),
          0,
        );
        check(
          "App interactive after handoff",
          await page.locator("#app").evaluate((n) => n.inert),
          false,
        );
      }
      await expect(editor()).toBeVisible();
      await shot("edit-step1", ".provider-editor > header");
      await keyboardBoundary("edit step1");
      await page.getByRole("button", { name: "4 合规与发布", exact: true }).click();
      await editor().locator('button[type="submit"]').click();
      for (let i = 0; i < 500 && !releaseWrite; i++) await new Promise((r) => setTimeout(r, 10));
      assert.ok(releaseWrite, "write latch");
      // No networkidle while the explicitly held write is in flight.
      await page.evaluate(() => document.fonts.ready);
      await page.clock.runFor(120);
      check(
        "edit write button disabled",
        await editor().locator('button[type="submit"]').isDisabled(),
      );
      await keyboardBoundary("pending save skips disabled submit");
      releaseWrite();
      releaseWrite = null;
      await settle();
      check("edit conflict keeps editor", await editor().count(), 1);
      await expect(page.locator(".provider-editor-message")).toContainText("请重新核对来源版本。");
      await shot("edit-conflict", ".provider-editor-message");
      await keyboardBoundary("conflict with collapsed technical details");
      if (keyboardTrap) {
        await page.locator(".provider-editor-message summary").click();
        await keyboardBoundary("conflict with expanded technical details");
        await page.keyboard.press("Escape");
        await expect(editor()).toHaveCount(0);
        await settle();
        check(
          "Escape returns record",
          await recordButton().evaluate((n) => n === document.activeElement),
        );
      } else {
        await close();
      }
      check(
        "edit close returns record",
        await recordButton().evaluate((n) => n === document.activeElement),
      );
      check("local interactions no reread", providerReads(), 1);
      await page
        .locator('.provider-runtime-tabs a[href="/platform-admin/providers/adapters"]')
        .click();
      await expect(page.locator(".adapter-center")).toBeVisible();
      check("actual P47 route", new URL(page.url()).pathname, "/platform-admin/providers/adapters");
      await page.goBack();
      await expect(page.locator(".provider-list-tools")).toBeVisible();
      await settle();
      observations.push({
        width,
        case: "real-route-return",
        providerReads: providerReads(),
        query: new URL(page.url()).search,
      });
      await shot("route-return", ".provider-hero");
      readStatus = 500;
      await page.locator(".provider-list-heading > button").click();
      await settle();
      await expect(page.locator('.provider-feedback[data-tone="warning"]')).toBeVisible();
      await shot("refresh-failed", ".provider-feedback[data-tone=warning]");
      readStatus = 200;
      await page.locator(".provider-feedback[data-tone=warning] button").click();
      await settle();
      check(
        "retry clears read failure",
        await page.locator(".provider-feedback[data-tone=warning]").count(),
        0,
      );
      await shot("refresh-recovered", ".provider-list-tools");
      navStatus = 403;
      const before = providerReads();
      await page.reload();
      await settle();
      await expect(page.locator('.role-shell[data-state="forbidden"]')).toBeVisible();
      check(
        "denied navigation does not mount provider",
        await page.locator(".provider-registry").count(),
        0,
      );
      check("denied navigation no provider GET", providerReads(), before);
      await shot("navigation-denied");
      navStatus = 200;
      await page.reload();
      await expect(page.locator(".provider-list-tools")).toBeVisible();
      await settle();
      await shot("direct-recovered");
      check("no page errors", errors, []);
      check("no unexpected requests", unexpected, []);
      observations.push({ width, case: "network-and-focus", requests, focus });
      console.log("passed full route " + width);
    } finally {
      releaseWrite?.();
      await context.close();
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
  const sourceHashes = Object.fromEntries(
    await Promise.all([...sources].sort().map(async (f) => [f, hash(await read(f))])),
  );
  await browser.close();
  browser = null;
  await server.close();
  if (capture) {
    await writeFile(
      output + "/evidence.json",
      JSON.stringify(
        {
          kind: keyboardTrap
            ? "P46-EDITOR-KEYBOARD-IMPLEMENTATION-r1"
            : "P46-REAL-ROUTE-C-ASSEMBLY-r1",
          sourceHashes,
          transformedRegistryHash: hash(preview),
          scope: keyboardTrap
            ? "Actual App/NavigationShell/KeepAlive with current Registry Tab handler and fallback tabindex; original form/save/contracts unchanged. C CSS remains review-only. Six-width forward/reverse/interior traversal, disabled submit and technical details, Escape return; local intercepted GET/rejected PUT only. Not production, real auth/persistence or complete modal/all-state acceptance."
            : "Actual index/main/router/App/NavigationShell and ProviderRuntimeSurface. Review-only CSS and two existing presentation replacements in Registry; no script or runtime contract edits. Supplied navigation/session/provider/adapters GET and rejected PUT only, no real auth or persistence. Full frontend route replay is not production, full RBAC, complete modal or all-state acceptance.",
          checks,
          screenshots,
          observations,
          processesClosed: true,
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      output + "/index.html",
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P46真实路由整体审核</title><style>body{font:16px/1.6 sans-serif;margin:24px}img{max-width:100%}article{margin-bottom:40px}</style><h1>P46 真实前端入口 · C 整体联动审核</h1><p>本地接口样例，未上线。结构批准范围见对应审核文档；键盘回放不等于完整模态通过。</p>' +
        screenshots
          .map(
            (s) =>
              "<article><h2>" +
              s.width +
              " · " +
              s.state +
              '</h2><img loading="lazy" src="' +
              s.file +
              '"></article>',
          )
          .join("\n"),
    );
  }
  console.log(
    JSON.stringify({ checks: checks.length, images: screenshots.length, sources: sources.size }),
  );
} finally {
  await browser?.close();
  await server.close();
}
