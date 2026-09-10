import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as reservePort } from "node:net";
import { chromium } from "playwright";
import { createServer } from "vite";
import ts from "typescript";

// Mount the actual route. Reuse only declarations and setup from the existing isolated fixture.
const repo = process.cwd();
assert.ok(process.argv.slice(2).every((arg) => ["--smoke", "--capture"].includes(arg)));
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(!(capture && smoke));
const fixtureFile = "tests/e2e/m06-01-organization-admin.spec.ts";
const fixture = await readFile(fixtureFile, "utf8");
const ast = ts.createSourceFile(fixtureFile, fixture, ts.ScriptTarget.Latest, true);
const declarations = ast.statements.filter(
  (node) =>
    ts.isVariableStatement(node) || (ts.isFunctionDeclaration(node) && node.name?.text === "setup"),
);
assert.equal(declarations.filter((node) => ts.isFunctionDeclaration(node)).length, 1);
const fixtureCode = ts.transpileModule(declarations.map((node) => node.getText(ast)).join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const { setup, env } = new Function(`${fixtureCode}\nreturn {setup,env};`)();
const relative = "output/playwright/p31-approved-controls-review";
const root = path.join(repo, relative);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const sources = [
  fixtureFile,
  "scripts/verify-ui-phase2-roles-vue-controls.mjs",
  "apps/web/src/components/OrganizationRolePanel.vue",
  "apps/web/src/components/OrganizationAdminCenter.vue",
  "apps/web/src/components/AuditedReasonDialog.vue",
  "apps/web/src/use-audited-reason.ts",
  "apps/web/src/use-modal-dialog.ts",
  "apps/web/src/organization-admin.css",
  "apps/web/src/design/roles-tokens.css",
  "apps/web/src/main.ts",
  "apps/web/src/styles.css",
  "apps/web/src/accessibility.css",
  "apps/web/src/design/tokens.css",
  "apps/web/src/signal-ledger.css",
  "apps/web/src/responsive-baselines.css",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (file) => [
      file,
      hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")),
    ]),
  ),
);
if (capture) await mkdir(root, { recursive: true });
if (!capture && !smoke) {
  const saved = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(saved.sourceHashes, sourceHashes);
  assert.equal(saved.screenshots.length, 22);
  for (const shot of saved.screenshots) {
    assert.match(shot.file, /^(1440|390)-[a-z-]+\.png$/u);
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
  }
}
const portProbe = reservePort();
await new Promise((resolve, reject) => {
  portProbe.once("error", reject);
  portProbe.listen(0, "127.0.0.1", resolve);
});
const localPort = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
const server = await createServer({
  configFile: path.join(repo, "apps/web/vite.config.ts"),
  server: { host: "127.0.0.1", port: localPort, strictPort: true, open: false },
});
let browser;
const checks = [],
  screenshots = [];
try {
  await server.listen();
  const address = server.httpServer.address();
  const base = `http://127.0.0.1:${address.port}`;
  console.log(`roles_vue_verifier_started ${base}`);
  browser = await chromium.launch({ headless: true });
  for (const width of smoke ? [390] : [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    let release;
    try {
      const page = await context.newPage(),
        errors = [],
        unexpected = [],
        writes = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (
          new URL(request.url()).pathname.startsWith("/api/") &&
          !["GET", "HEAD"].includes(request.method())
        )
          writes.push({
            method: request.method(),
            url: request.url(),
            body: request.postDataJSON(),
          });
      });
      await page.clock.setFixedTime(new Date("2026-08-26T10:00:00.000Z"));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin === base && !url.pathname.startsWith("/api/")) return route.continue();
        if (url.pathname === "/api/v1/me/ui-preferences")
          return route.fulfill({ json: env({ theme: "deep-ocean", version: 1 }) });
        unexpected.push(url.origin + url.pathname);
        return route.abort();
      });
      await setup(page);
      const check = async (name, predicate) => {
        const passed = await predicate();
        const diagnostic = passed
          ? ""
          : await page.locator('button[aria-pressed="true"]').evaluateAll((nodes) =>
              nodes.map((node) => {
                const style = getComputedStyle(node);
                return {
                  text: node.textContent,
                  disabled: node.disabled,
                  background: style.backgroundColor,
                  border: style.borderTopWidth,
                  weight: style.fontWeight,
                  opacity: style.opacity,
                };
              }),
            );
        assert.ok(passed, `${width}: ${name} ${JSON.stringify(diagnostic)}`);
        checks.push({ width, name });
      };
      const shot = async (scene, locator) => {
        await check(`${scene}: no document overflow`, () =>
          page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (!capture) return;
        const bytes = locator ? await locator.screenshot() : await page.screenshot();
        const file = `${width}-${scene}.png`;
        await writeFile(path.join(root, file), bytes);
        screenshots.push({ file, scene, width, sha256: hash(bytes) });
      };
      const css = (locator, property) =>
        locator.evaluate(async (node, p) => {
          await Promise.all(
            node.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
          );
          return getComputedStyle(node).getPropertyValue(p);
        }, property);
      await page.goto(`${base}/org-admin/roles`);
      await page.locator(".org-role-page").waitFor();
      const tab = page.locator(".org-role-tabs button").first();
      await tab.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await check(
        "keyboard focus matches approved blue ring",
        async () =>
          (await css(tab, "outline-color")) === "rgb(21, 62, 146)" &&
          (await css(tab, "outline-width")) === "3px" &&
          (await tab.evaluate(
            (node) => node === document.activeElement && node.matches(":focus-visible"),
          )),
      );
      await shot("keyboard-focus");
      const reset = page.locator(".org-role-matrix-filters button");
      await check(
        "native disabled reset retains gray visual",
        async () =>
          (await reset.isDisabled()) &&
          (await css(reset, "background-color")) === "rgb(230, 235, 241)" &&
          (await css(reset, "opacity")) === "1",
      );
      await reset.scrollIntoViewIfNeeded();
      await shot("disabled-reset");
      await page.getByRole("button", { name: /指定资源授权 1/ }).click();
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const hold = async (route) => {
        await gate;
        await route.fallback();
      };
      await page.route("**/api/v1/org/admin/summary", hold);
      await page.getByRole("button", { name: "刷新数据", exact: true }).click();
      const selected = page.locator('.org-grant-toolbar button[aria-pressed="true"]');
      await page.waitForFunction(
        () => document.querySelector('.org-grant-toolbar button[aria-pressed="true"]')?.disabled,
      );
      await check(
        "selected and disabled filter keeps non-color mark",
        async () =>
          (await css(selected, "border-top-width")) === "2px" &&
          (await css(selected, "font-weight")) === "700" &&
          (await css(selected, "background-color")) === "rgb(230, 235, 241)",
      );
      await selected.scrollIntoViewIfNeeded();
      await shot("selected-disabled");
      release();
      release = null;
      await page.unroute("**/api/v1/org/admin/summary", hold);
      await page.waitForFunction(
        () => !document.querySelector('.org-grant-toolbar button[aria-pressed="true"]')?.disabled,
      );
      const trigger = page.getByRole("button", { name: "撤销授权", exact: true });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "撤销指定资源授权原因" });
      const submit = dialog.getByRole("button", { name: "确认提交" });
      await check(
        "P31 revoke confirmation uses approved danger fill",
        async () => (await css(submit, "background-color")) === "rgb(155, 52, 46)",
      );
      await submit.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await check(
        "dialog keyboard focus stays visible",
        async () => (await css(submit, "outline-color")) === "rgb(21, 62, 146)",
      );
      await shot("revoke-confirm", dialog);
      await dialog.getByRole("textbox").fill(" ");
      await check(
        "disabled revoke stays native and gray",
        async () =>
          (await submit.isDisabled()) &&
          (await css(submit, "background-color")) === "rgb(230, 235, 241)",
      );
      await shot("revoke-disabled", dialog);
      await page.keyboard.press("Escape");
      await check(
        "cancel restores the actual trigger without writes",
        async () =>
          (await trigger.evaluate((node) => node === document.activeElement)) &&
          writes.length === 0,
      );
      await page.goto(`${base}/org-admin/members`);
      await page
        .locator(".org-admin-line")
        .filter({ hasText: "new@example.test" })
        .getByRole("button", { name: "撤销邀请", exact: true })
        .click();
      const other = page.getByRole("dialog", { name: "撤销邀请原因" });
      await check(
        "P30 shared dialog is outside the P31 CSS scope",
        async () =>
          (await css(other.getByRole("button", { name: "确认提交" }), "background-color")) !==
          "rgb(155, 52, 46)",
      );
      await shot("neighbor-dialog-unchanged", other);
      await page.keyboard.press("Escape");
      assert.deepEqual(writes, []);
      assert.deepEqual(unexpected, []);
      assert.deepEqual(errors, []);
      checks.push({ width, name: "no writes, unexpected HTTP or Vue errors" });

      await page.goto(`${base}/org-admin/roles`);
      await page.getByRole("button", { name: /指定资源授权 1/ }).click();
      const form = page.locator(".org-grant-mutation"),
        reason = form.getByLabel("变更原因", { exact: true }),
        expiry = form.getByLabel("新到期时间", { exact: true }),
        extend = form.getByRole("button", { name: "延长授权", exact: true });
      await reason.fill("延长核对期限");
      await check(
        "extension fields link their help and counter",
        async () =>
          (await reason.getAttribute("aria-describedby")) === "org-grant-extension-reason-help" &&
          (await page.locator("#org-grant-extension-reason-help").textContent()).includes(
            "已输入6字",
          ) &&
          (await expiry.getAttribute("aria-describedby")).includes(
            "org-grant-extension-expiry-error",
          ),
      );
      await shot("extension-default", form);
      for (const value of ["2026-09-01T17:59", "2026-09-01T18:00"]) {
        await expiry.fill(value);
        await check(
          `expiry ${value} rejects non-extension locally`,
          async () =>
            (await expiry.getAttribute("aria-invalid")) === "true" &&
            (await expiry.evaluate((node) => node.validity.rangeUnderflow)) &&
            (await page.locator("#org-grant-extension-expiry-error").textContent()).includes(
              "必须晚于当前授权",
            ),
        );
        await extend.click();
        assert.deepEqual(writes, []);
      }
      // Dismiss the native validation bubble so it cannot obscure the persistent inline error.
      await reason.focus();
      await page.keyboard.press("Escape");
      await shot("extension-not-later", form);
      await expiry.fill("2026-09-01T18:01");
      await check(
        "first selectable minute clears the linked error",
        async () =>
          (await expiry.getAttribute("aria-invalid")) === null &&
          (await expiry.evaluate((node) => node.validity.valid)) &&
          (await page.locator("#org-grant-extension-expiry-error").textContent()).trim() === "",
      );
      await shot("extension-corrected", form);
      const writeGate = new Promise((resolve) => {
        release = resolve;
      });
      await page.route("**/api/v1/org/*/resource-grants/*/expiry", async (route) => {
        await writeGate;
        await route.fulfill({
          status: 409,
          json: {
            error: {
              code: "grant_version_conflict",
              message: "隔离延期版本冲突",
              action_hint: "重新读取当前授权后再操作。",
            },
            request_id: "p31-extension-conflict",
            trace_id: "p31-extension-conflict",
          },
        });
      });
      await extend.click();
      await page.waitForFunction(
        () => document.querySelector(".org-grant-mutation button")?.disabled,
      );
      await check("extension carries the unchanged audited PATCH payload", async () => {
        assert.equal(writes.length, 1);
        assert.equal(writes[0].method, "PATCH");
        assert.ok(
          writes[0].url.endsWith("/resource-grants/00000000-0000-4000-8000-000000000625/expiry"),
        );
        assert.deepEqual(writes[0].body, {
          expected_version: 1,
          reason: "延长核对期限",
          expires_at: "2026-09-01T10:01:00.000Z",
        });
        return true;
      });
      await reason.fill("请求后继续编辑");
      await check(
        "pending extension keeps fields editable and prevents duplicate submit",
        async () =>
          (await reason.isEditable()) &&
          (await expiry.isEditable()) &&
          (await form.locator("button").first().isDisabled()),
      );
      await shot("extension-pending", form);
      release();
      release = null;
      await page.locator('.org-admin-notice[role="alert"]').waitFor();
      await check(
        "failed extension retains the later draft without a false success",
        async () =>
          (await reason.inputValue()) === "请求后继续编辑" &&
          writes.length === 1 &&
          !(await page.locator(".org-admin-notice").textContent()).includes("已更新并写入审计"),
      );
      await shot("extension-failed", page.locator(".org-admin-center"));
      assert.deepEqual(errors, []);
      assert.deepEqual(unexpected, []);
    } finally {
      release?.();
      await context.close();
    }
  }
  if (capture) {
    assert.equal(screenshots.length, 22);
    await writeFile(
      path.join(root, "evidence.json"),
      JSON.stringify(
        {
          version: "P31-approved-controls-and-extension-Vue-r2",
          boundary:
            "Actual Vue route, isolated API fixtures. Four approved styles and extension field composition; not full C layout or production acceptance. One intercepted versioned PATCH per viewport, no real writes.",
          sourceHashes,
          checks,
          screenshots,
        },
        null,
        2,
      ) + "\n",
    );
    const cards = screenshots
      .map(
        (shot) =>
          `<figure><figcaption>${shot.width} · ${shot.scene}</figcaption><a href="${shot.file}"><img loading="lazy" src="${shot.file}" alt="${shot.scene}"></a></figure>`,
      )
      .join("\n");
    await writeFile(
      path.join(root, "index.html"),
      `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P31 已批准控件 · 真实 Vue</title>
<style>body{font-family:system-ui;padding:24px;background:#edf2fa;color:#183252}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}figure{margin:0}img{width:100%}figcaption{padding:12px}</style>
<h1>P31 控件与延期字段 · 真实 Vue</h1><p>四项控件样式与延期组合。旧页面结构尚待 C 重构；隔离PATCH不代表真实授权或生产验收。桌面组合尚未获批。</p><main>${cards}</main></html>`,
    );
  }
  console.log(
    JSON.stringify({
      mode: capture ? "capture" : smoke ? "smoke" : "check",
      checks: checks.length,
      screenshots: screenshots.length,
      path: relative,
    }),
  );
} finally {
  await browser?.close();
  await server.close();
}
