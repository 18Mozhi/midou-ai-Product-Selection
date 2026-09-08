import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { loadThemeDesignSource, probeThemeWriteGaps } from "./lib/ui-phase2-theme-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/theme-direction-c",
  root = path.join(repo, relative);
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture"),
  hash = (value) => createHash("sha256").update(value).digest("hex");
const sources = ["index.html", "theme.js", "theme.css"]
  .map((file) => `${relative}/${file}`)
  .concat([
    "design-plans/ui-phase-2-2026-09-07/design/account-direction-c/study.css",
    "apps/web/src/design/theme.ts",
    "apps/web/src/use-navigation-shell-theme.ts",
    "apps/web/src/components/NavigationShell.vue",
    "apps/web/src/api-client.ts",
    "apps/api/src/ui-preference-routes.ts",
    "packages/preferences/src/index.ts",
    "scripts/lib/ui-phase2-theme-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-theme-c.mjs",
  ]);
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (file) => [
      file,
      hash((await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n")),
    ]),
  ),
);
const { data, makeController } = await loadThemeDesignSource(repo);
const knownGap = await probeThemeWriteGaps(makeController);
// Execute real current composable in an isolated DOM/cache adapter, without HTTP.
for (const theme of data.themeIds) {
  const calls = [];
  const controller = makeController(async (url, options) => {
    calls.push({ url, options });
    return { data: { theme: options?.body.theme || "deep-ocean", version: options ? 2 : 1 } };
  });
  await controller.loadThemePreference();
  await controller.chooseTheme(theme);
  assert.equal(controller.activeTheme.value, theme);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1])), {
    url: "/me/ui-preferences",
    options: { method: "PUT", body: { theme, expected_version: 1 } },
  });
  await controller.chooseTheme("cloud-white", false);
  assert.equal(calls.length, 2, "Platform choice performs no preference request");
  assert.equal(controller.themeNotice.value, data.notices[1]);
}
const failedCalls = [];
const failedController = makeController(async (url, options) => {
  failedCalls.push({ url, options });
  throw new Error("isolated failure");
});
await failedController.loadThemePreference();
assert.equal(failedController.themeNotice.value, "");
await failedController.loadThemePreference(true);
assert.equal(failedController.themeNotice.value, data.notices[0]);
await failedController.chooseTheme("aurora-purple");
assert.equal(failedCalls.at(-1).options.body.expected_version, 0);
assert.equal(failedController.themeNotice.value, data.notices[4]);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  assert.deepEqual(previous.sourceData, data);
  assert.deepEqual(previous.knownGap, knownGap);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
const screenshots = [],
  expectedFiles = [],
  browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const viewport = { width, height: width === 390 ? 844 : 1000 };
    const context = await browser.newContext({
      viewport,
      locale: "zh-CN",
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
      assert.deepEqual(
        await page.evaluate(() => window.THEME_DESIGN_REVIEW.options.map((option) => option.id)),
        data.themeIds,
      );
      assert.deepEqual(await page.evaluate(() => window.THEME_DESIGN_REVIEW.notices), data.notices);
      const scene = (name) =>
        page.evaluate((value) => window.THEME_DESIGN_REVIEW.showScene(value), name);
      const info = () => page.evaluate(() => window.THEME_DESIGN_DIAGNOSTICS());
      const scenes = await page.evaluate(() => window.THEME_DESIGN_REVIEW.scenes);
      assert.equal(scenes.length, 18);
      for (const name of scenes) {
        await scene(name);
        await page.evaluate(() => scrollTo(0, 0));
        const metrics = await checkPrototypeMetrics(page);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (name.endsWith("open")) {
          assert.equal(await page.locator('#theme-options [aria-pressed="true"]').count(), 1);
          assert.equal(
            await page.locator("#theme-panel").getAttribute("role"),
            null,
            "Non-modal named section, not invented dialog",
          );
        }
        if (name.startsWith("failed")) assert.equal((await info()).notice, data.notices[4]);
        if (name === "read-failed-silent")
          assert.equal(await page.locator("#notice").isVisible(), false);
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
      for (const shell of ["member", "organization", "platform"]) {
        for (const theme of data.themeIds) {
          await scene(`${shell}-open`);
          await page.locator(`[data-id="${theme}"]`).click();
          await page.waitForFunction(() => !window.THEME_DESIGN_DIAGNOSTICS().busy);
          assert.equal((await info()).active, theme);
          assert.equal(await page.locator("#theme-toggle").getAttribute("aria-expanded"), "false");
          const calls = (await info()).requests;
          if (shell === "platform") assert.deepEqual(calls, []);
          else
            assert.deepEqual(calls, [
              { method: "PUT", path: "/me/ui-preferences", body: { theme, expected_version: 1 } },
            ]);
        }
      }
      for (const code of [401, 403, 409, 429, 500, 503]) {
        await scene(`failed-${code}`);
        await page.locator("#theme-toggle").click();
        await page.locator('[data-id="aurora-purple"]').click();
        await page.waitForFunction(() => !window.THEME_DESIGN_DIAGNOSTICS().busy);
        assert.equal((await info()).active, "deep-ocean");
        assert.equal((await info()).notice, data.notices[4]);
      }
      for (const name of ["read-before-save", "read-failed-silent"]) {
        await scene(name);
        await page.locator('[data-id="aurora-purple"]').click();
        await page.waitForFunction(() => !window.THEME_DESIGN_DIAGNOSTICS().busy);
        const calls = (await info()).requests;
        assert.equal(calls[0].method, "GET");
        assert.equal(calls[1].body.expected_version, name === "read-before-save" ? 1 : 0);
      }
      await scene("member-open");
      await page.locator('[data-id="aurora-purple"]').focus();
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator("#theme-toggle").evaluate((node) => node === document.activeElement),
        true,
      );
      await page.locator("#theme-toggle").click();
      await page.locator("#close-panel").click();
      assert.equal(await page.locator("#theme-toggle").getAttribute("aria-expanded"), "false");
      await page.locator("#theme-toggle").click();
      await page.locator("#more-settings").focus();
      await page.keyboard.press("Tab");
      assert.equal(
        await page.locator("#theme-panel").isVisible(),
        false,
        "Tab is not trapped in non-modal panel",
      );
      await page.locator("#theme-toggle").click();
      await page.locator(".review-board > h1").click();
      assert.equal(await page.locator("#theme-panel").isVisible(), false);
      await page.locator("#theme-toggle").click();
      await page.locator("#more-settings").click();
      assert.match(await page.locator("#destination").textContent(), /\/settings\/theme/);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      console.log(
        `theme_c width=${width} scenes=18 choices/rollback/scope/nonmodal passed HTTP=0 storage=0 known-race=unfixed`,
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
    `${JSON.stringify({ version: "THEME-C-r1", kind: "proposal-not-vue-not-production", approval: "pending", sourceHashes, sourceData: data, knownGap, capturedAt: new Date().toISOString(), boundary: "Three proposed C palettes and names retain compatible IDs. Local demo is serial, no cache writes or HTTP. Known write race reproduced against current composable and explicitly not fixed; not UI2-SH03 full acceptance.", screenshots }, null, 2)}\n`,
  );
else
  assert.deepEqual(
    previous.screenshots.map((shot) => shot.file),
    expectedFiles,
  );
