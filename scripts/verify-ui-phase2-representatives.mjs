import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

if (process.argv.length > 2) throw new Error("No arguments are supported");
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.join(repo, "design-plans/ui-phase-2-2026-09-07");
for (const script of ["build-ui-phase2-inventory.mjs", "build-ui-phase2-representative-review.mjs"])
  execFileSync(process.execPath, [path.join(repo, "scripts", script), "--check"], {
    cwd: repo,
    stdio: "inherit",
  });
const data = await readFile(path.join(root, "representative-review-data.js"), "utf8");
assert.ok(!data.includes("<"));
const records = JSON.parse(/^window\.SCOUTOPS_REPRESENTATIVES = (.*);\s*$/s.exec(data)[1]);
assert.equal(records.shots.length, 36);
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    const network = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.route(/^https?:/, (route) => {
      network.push(route.request().url());
      return route.abort();
    });
    await page.goto(pathToFileURL(path.join(root, "representative-review.html")).href);
    for (const shot of records.shots) {
      await page.locator("#page-choice").selectOption(shot.pageId);
      await page.locator("#width-choice").selectOption(String(shot.viewport.width));
      await page.locator("#state-choice").selectOption(shot.state);
      await page.waitForFunction((file) => {
        const image = document.getElementById("shot-image");
        return image.getAttribute("src") === file && image.complete && image.naturalWidth > 0;
      }, shot.file);
      await page.waitForFunction(() =>
        document.getElementById("shot-status").textContent.includes("截图已加载"),
      );
      assert.equal(
        (await page.locator("#shot-status").textContent()).includes("已发现横向溢出"),
        shot.pageOverflow,
      );
      assert.equal(
        await page.locator("#spec-link").getAttribute("href"),
        `page-specs/${shot.pageId}.md`,
      );
      assert.equal(await page.locator("#image-link").getAttribute("href"), shot.file);
      assert.equal(await page.locator("#assertions li").count(), shot.assertions.length);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    assert.ok(
      await page
        .locator("select")
        .evaluateAll((nodes) => nodes.every((node) => node.getBoundingClientRect().height >= 44)),
    );
    await page.locator("#page-choice").focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page.locator("#width-choice").evaluate((node) => node === document.activeElement),
      true,
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(network, []);
    results.push({
      viewport,
      loadedShots: 36,
      consoleErrors: 0,
      horizontalOverflow: false,
      externalRequests: 0,
    });
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`ui_phase2_representative_gallery_verified ${JSON.stringify(results)}`);
