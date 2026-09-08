import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildPersonalSectionsData } from "./lib/ui-phase2-personal-sections-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/personal-sections-direction-c",
  root = path.join(repo, relative);
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture"),
  hash = (value) => createHash("sha256").update(value).digest("hex");
const sources = ["index.html", "data.js", "sections.js", "sections.css"]
  .map((file) => `${relative}/${file}`)
  .concat([
    "design-plans/ui-phase-2-2026-09-07/design/account-direction-c/study.css",
    "design-plans/ui-phase-2-2026-09-07/design/personal-direction-c/personal.css",
    "apps/web/src/components/PersonalCenter.vue",
    "apps/web/src/components/AccountShell.vue",
    "apps/api/src/auth-routes.ts",
    "apps/api/src/mysql-auth-repository.ts",
    "packages/auth/src/index.ts",
    "apps/api/src/notification-routes.ts",
    "apps/api/src/notification-service.ts",
    "apps/api/src/personal-center-routes.ts",
    "apps/api/src/mysql-personal-center-repository.ts",
    "config/route-catalog.json",
    "tests/e2e/ui-phase2-account-contracts.spec.ts",
    "scripts/lib/ui-phase2-personal-design-data.mjs",
    "scripts/lib/ui-phase2-personal-sections-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-personal-sections-c.mjs",
  ]);
const texts = Object.fromEntries(
  await Promise.all(
    sources.map(async (file) => [
      file,
      (await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n"),
    ]),
  ),
);
const sourceHashes = Object.fromEntries(
  Object.entries(texts).map(([file, value]) => [file, hash(value)]),
);
const data = await buildPersonalSectionsData(repo),
  sandbox = { window: {} };
vm.runInNewContext(texts[`${relative}/data.js`], sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.PERSONAL_SECTIONS_DATA)), data);
assert.deepEqual(data.mailBlocked, {
  code: "mail_provider_pending",
  statusCode: 503,
  actionHint: "邮件服务尚未接入，请关闭邮件通知并使用站内通知。",
});
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
const screenshots = [],
  expectedFiles = [],
  browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const viewport = { width, height: width === 390 ? 844 : 1000 },
      context = await browser.newContext({
        viewport,
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        reducedMotion: "reduce",
      });
    try {
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.evaluate(() => document.fonts.ready);
      const scene = (name) =>
          page.evaluate((value) => window.PERSONAL_SECTIONS_REVIEW.showScene(value), name),
        info = () => page.evaluate(() => window.PERSONAL_SECTIONS_DIAGNOSTICS());
      const idle = () => page.waitForFunction(() => !window.PERSONAL_SECTIONS_DIAGNOSTICS().busy);
      const scenes = await page.evaluate(() => window.PERSONAL_SECTIONS_REVIEW.scenes);
      assert.equal(scenes.length, 31);
      for (const name of scenes) {
        await scene(name);
        const metrics = await checkPrototypeMetrics(page);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(await page.locator("dialog,[role=dialog]").count(), 0);
        if (name.endsWith("error") || name.endsWith("loading")) {
          assert.equal(await page.locator(".read-panel").isVisible(), true);
          if (name.startsWith("notifications"))
            assert.equal(await page.locator("#preferences-form").count(), 0);
          if (name.startsWith("security")) {
            assert.equal(await page.locator("#password-form").isVisible(), true);
            assert.equal(await page.locator("[data-revoke]").count(), 0);
          }
          if (name.startsWith("assets"))
            assert.equal(await page.locator(".asset-directory").count(), 0);
        }
        if (name === "permissions")
          assert.equal(await page.locator('a[href="/org-admin/tokens"]').count(), 0);
        if (name === "permissions-token")
          assert.equal(await page.locator('a[href="/org-admin/tokens"]').count(), 1);
        if (name === "permissions-fallback")
          assert.match(await page.locator("#content").textContent(), /自定义角色/);
        if (name === "security")
          assert.equal(
            await page.locator("[data-revoke]").count(),
            3,
            "Current UI exposes action even for revoked/expired; do not invent a status filter",
          );
        const targetViolations = await page.locator("a,.switch-row").evaluateAll((nodes) =>
          nodes
            .filter((node) => node.getClientRects().length)
            .filter((node) => {
              const r = node.getBoundingClientRect();
              return r.width < 44 || r.height < 44;
            })
            .map((node) => node.textContent),
        );
        assert.deepEqual(targetViolations, []);
        const file = `${width}-${name}.png`;
        expectedFiles.push(file);
        if (capture) {
          await page.screenshot({
            path: path.join(root, file),
            fullPage: true,
            animations: "disabled",
          });
          screenshots.push({
            file,
            scene: name,
            viewport,
            fullPage: true,
            approval: "pending",
            metrics,
            sha256: hash(await readFile(path.join(root, file))),
          });
        }
      }
      await scene("notifications");
      assert.deepEqual(
        await page
          .locator("#preferences-form input")
          .evaluateAll((nodes) => nodes.map((node) => node.name)),
        Object.keys(data.validated).filter((key) => key !== "expected_version"),
      );
      await page.locator('[name="task_enabled"]').uncheck();
      await page.locator("#preferences-form button").click();
      await idle();
      assert.deepEqual((await info()).lastIntent, {
        method: "PUT",
        path: "/me/notification-preferences",
        body: {
          expected_version: 7,
          in_app_enabled: true,
          email_enabled: false,
          task_enabled: false,
          approval_enabled: true,
          competitor_enabled: true,
        },
      });
      assert.equal((await info()).preferences.version, 8);
      await page.locator('[name="email_enabled"]').check();
      await page.locator("#preferences-form button").click();
      await idle();
      assert.equal((await info()).lastIntent.body.expected_version, 8);
      assert.equal((await info()).preferences.version, 8);
      assert.equal(await page.locator("#notice").textContent(), data.mailBlocked.actionHint);
      assert.equal(await page.locator('[name="email_enabled"]').isChecked(), true);
      await page.locator('[name="email_enabled"]').uncheck();
      await page.locator("#preferences-form button").click();
      await idle();
      assert.equal((await info()).preferences.version, 9);
      await scene("notifications-save-failed");
      await page.locator("#preferences-form button").click();
      await idle();
      assert.equal((await info()).preferences.version, 7);
      for (const section of ["permissions", "security", "notifications", "assets"]) {
        await scene(`${section}-error`);
        await page.locator("[data-refresh]").click();
        await page.waitForFunction(
          () => window.PERSONAL_SECTIONS_DIAGNOSTICS().readState === "ready",
        );
        assert.deepEqual((await info()).lastIntent.paths, [
          "/me/profile",
          "/me/authorization",
          "/me/sessions",
          "/me/notification-preferences",
          "/me/assets",
        ]);
      }
      await scene("security");
      await page.locator("#password-form button").click();
      assert.equal((await info()).lastIntent, null);
      for (const name of ["current_password", "new_password", "confirm_password"])
        assert.equal(await page.locator(`[name="${name}"]`).getAttribute("minlength"), "12");
      await scene("security-mismatch");
      await page.locator("#password-form button").click();
      assert.equal((await info()).lastIntent, null);
      assert.equal(
        await page.locator('[name="confirm_password"]').getAttribute("aria-invalid"),
        "true",
      );
      assert.equal(
        await page
          .locator('[name="confirm_password"]')
          .evaluate((node) => node === document.activeElement),
        true,
      );
      await page.locator('[name="confirm_password"]').fill("Preview-only-456");
      await page.locator("#password-form button").click();
      await idle();
      assert.deepEqual((await info()).lastIntent, {
        method: "POST",
        path: "/me/password",
        bodyKeys: ["current_password", "new_password"],
      });
      assert.equal((await info()).lastRoute, "/login");
      assert.equal(await page.locator('[name="new_password"]').inputValue(), "");
      await scene("security-password-failed");
      await page.locator("#password-form button").click();
      await idle();
      assert.equal((await info()).lastRoute, "");
      for (const session of data.sample.sessions) {
        await scene("security");
        await page.locator(`[data-revoke="${session.id}"]`).click();
        await idle();
        assert.deepEqual((await info()).lastIntent, {
          method: "DELETE",
          path: `/me/sessions/${session.id}`,
        });
        assert.equal((await info()).sessionIds.includes(session.id), session.status !== "active");
        if (session.status !== "active")
          assert.equal(await page.locator("#notice").textContent(), "刷新会话列表后重试。");
      }
      await scene("security-revoke-failed");
      await page.locator("[data-revoke]").first().click();
      await idle();
      assert.equal((await info()).sessionIds.length, 3);
      await scene("assets");
      const assetRoutes = [
        `/trends?topic=${data.sample.assets.followed_trends[0].id}`,
        `/opportunities/${data.sample.assets.decisions[0].opportunity_id}`,
        "/tasks",
      ];
      assert.deepEqual(
        await page
          .locator(".asset-directory a")
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href"))),
        assetRoutes,
      );
      for (const href of assetRoutes) {
        await page.locator(`a[href="${href}"]`).click();
        assert.equal((await info()).lastRoute, href);
      }
      await scene("permissions-token");
      await page.locator('a[href="/org-admin/tokens"]').click();
      assert.equal((await info()).lastRoute, "/org-admin/tokens");
      await scene("security");
      await page.locator('a[href="/security/mfa"]').click();
      assert.equal((await info()).lastRoute, "/security/mfa");
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      console.log(
        `personal_sections_c width=${width} scenes=31 preferences/backend-mail-block/password-shape/revoke/links/read-states passed HTTP=0 storage=0`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture)
  await writeFile(
    path.join(root, "evidence.json"),
    `${JSON.stringify({ version: "PERSONAL-C-sections-r2", approval: "pending", kind: "four-sections-independent-proposal", capturedAt: new Date().toISOString(), sourceHashes, mailBackendTruth: data.mailBlocked, boundary: "62 images. Explicit synthetic contract-shape records; UI2-A05 preferences but real backend mail rejection. Only active sessions can be revoked successfully. Proposed per-section unknown-data guards/busy/focus not current Vue. No actual passwords in diagnostics, HTTP, storage, auth, session revocation or mail delivery.", screenshots }, null, 2)}\n`,
  );
else
  assert.deepEqual(
    previous.screenshots.map((shot) => shot.file),
    expectedFiles,
  );
