import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/account-direction-c";
const root = path.join(repo, relative);
const args = process.argv.slice(2);
assert.ok(args.length === 1 && ["--capture", "--check"].includes(args[0]));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const sources = [
  `${relative}/index.html`,
  `${relative}/study.css`,
  `${relative}/study.js`,
  "scripts/verify-ui-phase2-account-direction.mjs",
  "apps/web/src/components/PlatformAccountCenter.vue",
  "apps/web/src/components/PlatformAccountDialogs.vue",
  "apps/web/src/components/PlatformUserRecords.vue",
  "apps/web/src/components/PlatformUserDetailDialog.vue",
  "apps/web/src/components/PlatformUserMembershipForm.vue",
  "apps/web/src/use-platform-user-detail.ts",
  "apps/api/src/platform-account-routes.ts",
  "apps/api/src/platform-account-service.ts",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (file) => [
      file,
      hash((await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n")),
    ]),
  ),
);
const scenes = [
  "directory",
  "detail",
  "create",
  "create-error",
  "reason",
  "password",
  "membership",
  "empty",
];
const viewports = [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
];
const manifestPath = path.join(root, "evidence.json");
if (args[0] === "--check") {
  const data = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(data.kind, "design-study");
  assert.equal(data.approval, "pending-user-review");
  assert.equal(data.production, false);
  assert.deepEqual(data.sourceHashes, sourceHashes);
  const expected = viewports.flatMap((viewport) =>
    [...scenes, "detail-access"].map((scene) => `${viewport.width}-${scene}.png`),
  );
  assert.deepEqual(data.screenshots.map((shot) => shot.file).sort(), expected.sort());
  for (const shot of data.screenshots) {
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
    assert.equal(shot.pageId, "P43");
  }
  console.log(
    "ui_phase2_account_direction_checked images=18 sourceAndImageHashes=passed approval=pending",
  );
  process.exit(0);
}

const screenshots = [];
const checks = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport,
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      const errors = [],
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
      const capture = async (scene) => {
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${viewport.width}/${scene} overflow`,
        );
        const targets = await page.evaluate(() =>
          [...document.querySelectorAll("button,input,select,textarea,summary")]
            .filter((element) => element.checkVisibility())
            .map((element) => ({
              tag: element.tagName,
              text: element.textContent?.trim().slice(0, 35),
              width: element.getBoundingClientRect().width,
              height: element.getBoundingClientRect().height,
            })),
        );
        assert.ok(
          targets.every((target) => target.width >= 44 && target.height >= 44),
          JSON.stringify(targets.filter((target) => target.width < 44 || target.height < 44)),
        );
        const file = `${viewport.width}-${scene}.png`;
        const fullPage = (await page.locator("dialog[open]").count()) === 0;
        await page.screenshot({ path: path.join(root, file), fullPage, animations: "disabled" });
        screenshots.push({
          file,
          pageId: "P43",
          caseId: `study-P43-${scene}`,
          scene,
          viewport,
          sha256: hash(await readFile(path.join(root, file))),
        });
      };
      for (const scene of scenes) {
        await page.locator("#scene").selectOption(scene);
        if (scene === "create-error") assert.ok(await page.locator("#create-error").isVisible());
        if (scene === "empty") assert.equal(await page.locator("#records tr").count(), 0);
        await capture(scene);
        // Review controls are outside modals; close them through keyboard before the next scene.
        while (await page.locator("dialog[open]").count()) await page.keyboard.press("Escape");
      }
      await page.locator("#scene").selectOption("detail");
      await page.locator("#sessions-revoke").scrollIntoViewIfNeeded();
      await capture("detail-access");
      await page.keyboard.press("Escape");

      await page.locator("#scene").selectOption("directory");
      await page.locator("#query").fill("yu.zhou");
      await page.locator("#filter-form button[type=submit]").click();
      assert.equal(await page.locator("#records tr").count(), 1);
      assert.equal(await page.locator("#total").textContent(), "8");
      await page.locator("#filter-reset").click();
      assert.equal(await page.locator("#records tr").count(), 8);
      const rowButton = page.locator("#records button").first();
      await rowButton.click();
      assert.equal(await page.locator("#detail-email").textContent(), "lin.chen@example.test");
      await page.locator("#toggle-user").click();
      assert.equal(
        await page.locator("#reason").evaluate((element) => element === document.activeElement),
        true,
      );
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      assert.ok(
        await page.evaluate(() => document.activeElement.closest("dialog")?.id === "reason-dialog"),
      );
      await page.locator("#reason-form button[type=submit]").focus();
      await page.keyboard.press("Tab");
      assert.equal(
        await page
          .getByRole("button", { name: "关闭原因确认", exact: true })
          .evaluate((element) => element === document.activeElement),
        true,
      );
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await page
          .locator("#reason-form button[type=submit]")
          .evaluate((element) => element === document.activeElement),
        true,
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await page
          .locator("#toggle-user")
          .evaluate((element) => element === document.activeElement),
        true,
      );
      await page.keyboard.press("Escape");
      assert.equal(await rowButton.evaluate((element) => element === document.activeElement), true);

      await page.locator("#create-open").click();
      await page.locator("#create-form button[type=submit]").click();
      assert.equal(
        await page.locator("#create-email").evaluate((element) => element.validity.valueMissing),
        true,
      );
      await page.locator("#create-email").fill("new@example.test");
      await page.locator("#create-password").fill("short");
      await page.locator("#create-form button[type=submit]").click();
      assert.ok(
        await page.locator("#create-password").evaluate((element) => element.validity.tooShort),
      );
      await page.locator("#create-password").fill("Study-only-12345");
      await page.locator("#create-organization").selectOption("org-b");
      assert.ok(await page.locator("#create-org-role-label").isVisible());
      await page.locator("#create-form button[type=submit]").click();
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.match(await page.locator("#notice").textContent(), /没有创建账号/);
      assert.equal(await page.locator("#records tr").count(), 8);
      assert.equal(await page.locator("#create-password").inputValue(), "");
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      checks.push({
        viewport,
        fonts: await page.evaluate(() => ({
          body: getComputedStyle(document.body).fontFamily,
          identity: getComputedStyle(document.querySelector(".person strong")).fontFamily,
        })),
        cases: [
          "scenes-render",
          "no-page-overflow",
          "44px-targets",
          "filter-reset",
          "global-total-stable",
          "detail-identity",
          "nested-modal-focus-return-and-loop",
          "required-email",
          "password-length",
          "conditional-org-role",
          "no-real-create",
          "password-not-retained-after-demo-success",
        ],
        errors,
        externalRequests: requests,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
await writeFile(
  manifestPath,
  `${JSON.stringify({ schemaVersion: 1, direction: "C-clear-directory", kind: "design-study", approval: "pending-user-review", production: false, data: "synthetic-local-only", sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(), capturedAt: new Date().toISOString(), browser: browser.version(), platform: process.platform, sourceHashes, screenshots, checks }, null, 2)}\n`,
);
console.log(
  "ui_phase2_account_direction_captured images=18 viewports=1440,390 errors=0 externalRequests=0 approval=pending",
);
