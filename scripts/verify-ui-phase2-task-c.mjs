import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/task-direction-c";
const root = path.join(repo, relative);
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const digest = (value) => createHash("sha256").update(value).digest("hex");
const textHash = async (file) =>
  digest((await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n"));
const conceptSource = await readFile(path.join(root, "../task-concept-data.js"), "utf8");
const concept = JSON.parse(
  conceptSource.slice(conceptSource.indexOf("{"), conceptSource.lastIndexOf("}") + 1),
);
assert.equal(
  await textHash(concept.fixturePath),
  concept.fixtureSha256,
  "Task fixture changed; recheck design facts before capture",
);
const sourceFiles = [
  `${relative}/index.html`,
  `${relative}/tasks.css`,
  `${relative}/tasks.js`,
  "design-plans/ui-phase-2-2026-09-07/design/account-direction-c/study.css",
  "design-plans/ui-phase-2-2026-09-07/design/task-concept-data.js",
  concept.fixturePath,
  "apps/web/src/components/TaskWorkspace.vue",
  "apps/web/src/components/TaskListPanel.vue",
  "apps/web/src/components/TaskDetailPanel.vue",
  "apps/web/src/components/TaskBatchActions.vue",
  "scripts/verify-ui-phase2-task-c.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(sourceFiles.map(async (file) => [file, await textHash(file)])),
);
const scenes = [
  "list",
  "detail",
  "progress",
  "progress-error",
  "progress-busy",
  "empty",
  "readonly",
  "more",
];
const screenshots = [];
if (!capture) {
  const prior = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(
    prior.sourceHashes,
    sourceHashes,
    "Source changed; review and recapture deliverables",
  );
  assert.equal(prior.screenshots.length, 16);
  for (const shot of prior.screenshots) {
    assert.match(
      shot.file,
      /^(1440|390)-(list|detail|progress|progress-error|progress-busy|empty|readonly|more)\.png$/,
    );
    assert.equal(digest(await readFile(path.join(root, shot.file))), shot.sha256);
  }
}
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      const errors = [],
        requests = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (event) => {
        if (event.type() === "error") errors.push(event.text());
      });
      await page.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator("#task-title").textContent(), concept.task.title);
      for (const scene of scenes) {
        await page.locator("#scene").selectOption(scene);
        await page.evaluate(() => document.fonts.ready);
        const isDialog = scene.startsWith("progress");
        assert.equal(
          await page.locator("#progress-dialog").evaluate((node) => node.open),
          isDialog,
        );
        if (isDialog) {
          assert.equal(
            await page.locator("#progress-value").inputValue(),
            String(concept.task.progress_percent),
          );
          assert.equal(
            await page.locator("#progress-note-input").inputValue(),
            concept.task.progress_note,
          );
          assert.equal(
            await page.locator("#submit-progress").isDisabled(),
            scene === "progress-busy",
          );
          assert.equal(await page.locator("#submit-error").isVisible(), scene === "progress-error");
        }
        if (scene === "readonly") {
          assert.equal(await page.locator("#actions").isVisible(), false);
          assert.equal(await page.locator("#comment-form").isVisible(), false);
          assert.equal(await page.locator("#readonly-note").isVisible(), true);
        }
        if (isDialog) {
          const bounds = await page.locator("#progress-dialog").boundingBox();
          assert.ok(
            bounds && bounds.y >= 0 && bounds.y + bounds.height <= (width === 390 ? 844 : 1000),
            "Dialog remains within the actual viewport",
          );
        } else await page.evaluate(() => window.scrollTo(0, 0));
        if (scene === "list" && width === 390) {
          const titleBounds = await page.locator("#task-title").boundingBox();
          assert.ok(
            titleBounds && titleBounds.y + titleBounds.height < 844,
            "Mobile first task title appears within the first viewport",
          );
        }
        const metrics = await checkPrototypeMetrics(page);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
          `${width}/${scene} overflow`,
        );
        if (capture) {
          const file = `${width}-${scene}.png`;
          await page.screenshot({
            path: path.join(root, file),
            fullPage: !isDialog,
            animations: "disabled",
          });
          screenshots.push({
            file,
            scene,
            pageId: ["list", "empty"].includes(scene) ? "P23" : "P24",
            viewport: { width, height: width === 390 ? 844 : 1000 },
            fullPage: !isDialog,
            sha256: digest(await readFile(path.join(root, file))),
            metrics,
          });
        }
        if (isDialog) await page.keyboard.press("Escape");
      }
      await page.locator("#scene").selectOption("list");
      if (width === 390) await page.locator("#filter-disclosure > summary").click();
      await page.locator("#query").fill("不存在");
      await page.getByRole("button", { name: "应用", exact: true }).click();
      assert.equal(await page.locator("#empty").isVisible(), true);
      await page.locator("#empty-reset").click();
      await page.locator("#selected").check();
      assert.equal(await page.locator("#batch").isVisible(), true);
      await page.locator("#clear").click();
      assert.equal(await page.locator("#selected").isChecked(), false);
      await page.locator("#open-detail").click();
      await page.locator("#open-progress").click();
      const focusIs = (id) =>
        page.evaluate((target) => document.activeElement === document.getElementById(target), id);
      assert.equal(await focusIs("progress-value"), true);
      await page.locator("#close-progress").focus();
      await page.keyboard.press("Shift+Tab");
      assert.equal(await focusIs("submit-progress"), true);
      await page.keyboard.press("Tab");
      assert.equal(await focusIs("close-progress"), true);
      await page.locator("#progress-value").fill("101");
      await page.locator("#submit-progress").click();
      assert.equal(
        await page.locator("#progress-value").evaluate((node) => node.validity.rangeOverflow),
        true,
      );
      assert.equal(await page.locator("#progress-dialog").evaluate((node) => node.open), true);
      await page.keyboard.press("Escape");
      assert.equal(await focusIs("open-progress"), true);
      await page.locator("#open-progress").click();
      await page.locator("#progress-value").fill("45");
      await page.locator("#submit-progress").click();
      assert.equal(await page.locator("#progress-dialog").evaluate((node) => node.open), false);
      assert.match(await page.locator("#review-note").textContent(), /未请求 API/);
      assert.equal(
        await page.evaluate(() => window.SCOUTOPS_TASK_CONCEPT.task.progress_percent),
        35,
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      assert.deepEqual(await context.storageState(), { cookies: [], origins: [] });
      console.log(
        `task_c width=${width} scenes=8 metrics/filters/selection/modal/validation=passed network=0 errors=0`,
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
    JSON.stringify(
      {
        version: "TASK-C-r1",
        kind: "formal-design-proposal-not-vue-not-production",
        directionDecision: "../../DIRECTION-DECISION-C.md",
        pageApproval: "pending-user-review",
        capturedAt: new Date().toISOString(),
        platform: process.platform,
        browser: browser.version(),
        sourceHashes,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
