import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildPersonalDesignData } from "./lib/ui-phase2-personal-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/personal-direction-c",
  root = path.join(repo, relative);
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture"),
  hash = (value) => createHash("sha256").update(value).digest("hex");
const sources = ["index.html", "data.js", "personal.css", "personal.js"]
  .map((file) => `${relative}/${file}`)
  .concat([
    "design-plans/ui-phase-2-2026-09-07/design/account-direction-c/study.css",
    "apps/web/src/components/AccountShell.vue",
    "apps/web/src/components/PersonalCenter.vue",
    "apps/web/src/router.ts",
    "apps/web/src/App.vue",
    "apps/api/src/personal-center-routes.ts",
    "config/route-catalog.json",
    "tests/e2e/ui-phase2-account-contracts.spec.ts",
    "scripts/lib/ui-phase2-personal-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-personal-c.mjs",
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
const data = await buildPersonalDesignData(repo),
  sandbox = { window: {} };
vm.runInNewContext(texts[`${relative}/data.js`], sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.PERSONAL_DESIGN_DATA)), data);
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
      context = await browser.newContext({ viewport, locale: "zh-CN", reducedMotion: "reduce" });
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
          page.evaluate((value) => window.PERSONAL_DESIGN_REVIEW.showScene(value), name),
        info = () => page.evaluate(() => window.PERSONAL_DESIGN_DIAGNOSTICS());
      const scenes = await page.evaluate(() => window.PERSONAL_DESIGN_REVIEW.scenes);
      assert.equal(scenes.length, 12);
      for (const name of scenes) {
        await scene(name);
        const metrics = await checkPrototypeMetrics(page);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.deepEqual(
          await page.locator("#sections a[data-section]").evaluateAll((nodes) =>
            nodes.map((node) => ({
              label: node.querySelector("span:last-child").textContent,
              href: node.getAttribute("href"),
            })),
          ),
          data.sections.map((section) => ({
            label: section.label,
            href: `/me?section=${section.key}`,
          })),
        );
        assert.equal(await page.locator('#sections [aria-current="page"]').count(), 1);
        if (["permissions", "security", "notifications", "assets"].includes(name))
          assert.equal(await page.locator("#deferred").isVisible(), true);
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
            scope: ["permissions", "security", "notifications", "assets"].includes(name)
              ? "navigation-only-not-business-section"
              : "profile-and-shell-proposal",
            viewport,
            fullPage: true,
            approval: "pending",
            metrics,
            sha256: hash(await readFile(path.join(root, file))),
          });
        }
      }
      await scene("profile");
      assert.equal(await page.locator("#email").isDisabled(), true);
      assert.deepEqual(
        await page
          .locator("#profile-form [name]")
          .evaluateAll((nodes) => nodes.map((node) => node.name)),
        Object.keys(data.form),
      );
      await page.locator('[name="display_name"]').fill("");
      await page.locator("#save").click();
      assert.equal((await info()).lastRequest, null);
      await page.locator('[name="display_name"]').fill("隔离成员新名称");
      await page.locator("#save").click();
      assert.deepEqual((await info()).lastRequest, {
        method: "PATCH",
        path: "/me/profile",
        body: {
          username: "member.test",
          display_name: "隔离成员新名称",
          avatar_url: "",
          phone: "",
          locale: "zh-CN",
          timezone: "Asia/Shanghai",
          reason: "更新个人资料",
          expected_version: 3,
        },
      });
      await page.locator("#save").click();
      assert.equal((await info()).lastRequest.body.expected_version, 4);
      await scene("profile-save-failed");
      await page.locator("#save").click();
      assert.equal((await info()).profile.version, 3);
      assert.equal(await page.locator('[name="display_name"]').inputValue(), "隔离成员新名称");
      await scene("profile-partial");
      await page.locator("#save").click();
      assert.equal((await info()).lastRequest.method, "PATCH");
      await scene("profile");
      await page.locator('[name="display_name"]').fill("未保存草稿");
      for (const section of data.sections) {
        await page.locator(`[data-section="${section.key}"]`).click();
        assert.equal((await info()).current, section.key);
      }
      await page.locator('[data-section="profile"]').click();
      assert.equal(await page.locator('[name="display_name"]').inputValue(), "未保存草稿");
      await page.locator("#refresh").click();
      await page.waitForFunction(() => window.PERSONAL_DESIGN_DIAGNOSTICS().state === "ready");
      assert.equal(await page.locator('[name="display_name"]').inputValue(), "隔离成员");
      for (const value of [null, "unknown", ["security", "assets"]]) {
        await page.evaluate(
          (requested) => window.PERSONAL_DESIGN_REVIEW.navigateSection(requested),
          value,
        );
        assert.equal((await info()).current, "profile");
      }
      await scene("profile-error");
      await page.locator("#retry").click();
      await page.waitForFunction(() => window.PERSONAL_DESIGN_DIAGNOSTICS().state === "ready");
      for (const selector of [".brand", ".topbar a:last-child", ".appearance", ".breadcrumb a"]) {
        const href = await page.locator(selector).getAttribute("href");
        await page.locator(selector).click();
        assert.equal((await info()).destination, href);
      }
      if (width === 390)
        assert.equal(
          await page
            .locator("#sections a span:last-child")
            .evaluateAll((nodes) => nodes.every((node) => node.getClientRects().length > 0)),
          true,
        );
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      console.log(
        `personal_c width=${width} scenes=12 source/forms/version/route/fallback passed HTTP=0 storage=0`,
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
    `${JSON.stringify({ version: "PERSONAL-C-profile-r1", approval: "pending", kind: "account-shell-profile-proposal", capturedAt: new Date().toISOString(), sourceHashes, boundary: "24 images; four non-profile sections are navigation-only explicitly deferred, not complete P11. Serial local form simulation does not prove real API, save races, 12s timeout, authorization or persistence.", screenshots }, null, 2)}\n`,
  );
else
  assert.deepEqual(
    previous.screenshots.map((shot) => shot.file),
    expectedFiles,
  );
