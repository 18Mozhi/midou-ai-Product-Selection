import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
if (process.argv.length > 2) throw new Error("No arguments are supported");
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.join(repo, "design-plans/ui-phase-2-2026-09-07/design");
execFileSync(
  process.execPath,
  [path.join(repo, "scripts/capture-ui-phase2-representative-directions.mjs"), "--check"],
  { cwd: repo, stdio: "inherit" },
);
const text = await readFile(path.join(root, "representative-directions/evidence-data.js"), "utf8");
assert.ok(!text.includes("<"));
const evidence = JSON.parse(/^window\.SCOUTOPS_DESIGN_DIRECTIONS = (.*);\s*$/s.exec(text)[1]);
assert.deepEqual(
  evidence,
  JSON.parse(await readFile(path.join(root, "representative-directions/evidence.json"), "utf8")),
);
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.route(/^https?:/, (route) => {
      requests.push(route.request().url());
      return route.abort();
    });
    await page.goto(pathToFileURL(path.join(root, "representative-design-review.html")).href);
    assert.equal(await page.locator("#scene option").count(), 19);
    for (const shot of evidence.screenshots) {
      await page.locator("#direction").selectOption(shot.direction);
      await page.locator("#width").selectOption(String(shot.viewport.width));
      await page.locator("#scene").selectOption(`${shot.surface}/${shot.state}`);
      await page.waitForFunction((file) => {
        const image = document.getElementById("design-image");
        return (
          image.getAttribute("src") === `representative-directions/${file}` &&
          image.complete &&
          image.naturalWidth > 0
        );
      }, shot.file);
      assert.equal(
        await page.locator("#original").getAttribute("href"),
        `representative-directions/${shot.file}`,
      );
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(
  "ui_phase2_representative_design_review_verified images=76 viewerWidths=1440,390 errors=0 network=0",
);
