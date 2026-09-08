import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/task-direction-c-forms";
const root = path.join(repo, relative);
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const textHash = async (file) =>
  hash((await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n"));
const fixtureFile = "design-plans/ui-phase-2-2026-09-07/design/task-concept-data.js";
const fixtureText = await readFile(path.join(repo, fixtureFile), "utf8");
const fixture = JSON.parse(
  fixtureText.slice(fixtureText.indexOf("{"), fixtureText.lastIndexOf("}") + 1),
);
assert.equal(await textHash(fixture.fixturePath), fixture.fixtureSha256);
const sources = [
  `${relative}/index.html`,
  `${relative}/forms.css`,
  `${relative}/forms.js`,
  fixtureFile,
  fixture.fixturePath,
  "design-plans/ui-phase-2-2026-09-07/design/account-direction-c/study.css",
  "apps/web/src/components/TaskWorkspace.vue",
  "apps/web/src/components/TaskDetailPanel.vue",
  "apps/web/src/components/TaskBatchActions.vue",
  "scripts/verify-ui-phase2-task-c-forms.mjs",
  "scripts/lib/ui-phase2-prototype-metrics.mjs",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(sources.map(async (file) => [file, await textHash(file)])),
);
const forms = {
  create: ["title", "description", "priority", "due_at"],
  edit: ["title", "description", "priority", "due_at"],
  delete: ["reason"],
  pause: ["reason"],
  cancel: ["reason"],
  delay: ["due_at", "reason"],
  transfer: ["assignee_id", "reason"],
  progress: ["progress_percent", "progress_note"],
  "batch-pause": ["reason"],
  "batch-resume": [],
  "batch-delay": ["due_at", "reason"],
  "batch-transfer": ["assignee_id", "reason"],
  "batch-cancel": ["reason"],
};
const states = ["loading", "error", "not_found", "forbidden", "expired", "rate_limited"];
const scenes = ["board", ...Object.keys(forms), "progress-error", "progress-busy", ...states];
if (!capture) {
  const prior = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(prior.sourceHashes, sourceHashes, "Source drift; review before recapture");
  assert.deepEqual(
    prior.screenshots.map((shot) => shot.file),
    [1440, 390].flatMap((width) => scenes.map((scene) => `${width}-${scene}.png`)),
  );
  for (const shot of prior.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
const screenshots = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const viewport = { width, height: width === 390 ? 844 : 1000 };
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
      page.on("console", (event) => {
        if (event.type() === "error") errors.push(event.text());
      });
      await page.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.evaluate(() => document.fonts.ready);
      const dialog = page.locator("#action-dialog");
      assert.equal(await page.locator("[data-action]").count(), 13);
      for (const scene of scenes) {
        await page.locator("#scene").selectOption(scene);
        const action = scene.startsWith("progress-") ? "progress" : scene;
        const isDialog = Boolean(forms[action]);
        assert.equal(await dialog.evaluate((node) => node.open), isDialog);
        if (isDialog) {
          assert.deepEqual(
            await page
              .locator("#fields [name]")
              .evaluateAll((nodes) => nodes.map((node) => node.name)),
            forms[action],
          );
          for (const name of forms[action]) {
            const input = page.locator(`#${name}`);
            const optional =
              ["description", "priority"].includes(name) ||
              (name === "due_at" && ["create", "edit"].includes(action));
            assert.equal(await input.evaluate((node) => node.required), !optional);
            if (["title", "description", "reason", "progress_note"].includes(name))
              assert.equal(
                await input.getAttribute("maxlength"),
                String(name === "title" ? 200 : name === "description" ? 5000 : 500),
              );
          }
          if (action === "create") {
            assert.equal(await page.locator("#title").inputValue(), "");
            assert.equal(await page.locator("#priority").inputValue(), "normal");
          }
          if (action === "edit") {
            assert.equal(await page.locator("#title").inputValue(), fixture.task.title);
            assert.equal(await page.locator("#due_at").inputValue(), "2026-08-09T18:00");
          }
          if (action === "progress") {
            assert.equal(await page.locator("#progress_percent").inputValue(), "35");
            assert.equal(
              await page.locator("#progress_note").inputValue(),
              fixture.task.progress_note,
            );
          }
          if (action.startsWith("batch-"))
            assert.deepEqual(
              await page.locator("#impact dd").allTextContents(),
              action === "batch-resume" ? ["1 项", "0 项", "1 项"] : ["1 项", "1 项", "0 项"],
            );
          assert.equal(
            await page.locator("#submit").isDisabled(),
            scene === "progress-busy" || action === "batch-resume",
          );
          assert.equal(await page.locator("#form-error").isVisible(), scene === "progress-error");
          const bounds = await dialog.boundingBox();
          assert.ok(
            bounds &&
              bounds.x >= 0 &&
              bounds.y >= 0 &&
              bounds.x + bounds.width <= width &&
              bounds.y + bounds.height <= viewport.height,
          );
          // Long forms may scroll inside the dialog; footer actions never leave the viewport.
          const footer = await page.locator(".dialog-footer").boundingBox();
          assert.ok(footer.y + footer.height <= viewport.height);
        } else await page.evaluate(() => window.scrollTo(0, 0));
        const metrics = await checkPrototypeMetrics(page);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
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
            viewport,
            fullPage: !isDialog,
            sha256: hash(await readFile(path.join(root, file))),
            metrics,
          });
        }
        if (isDialog) {
          await page.locator("#close").focus();
          await page.keyboard.press("Shift+Tab");
          const last = (await page.locator("#submit").isDisabled()) ? "cancel" : "submit";
          assert.equal(await page.evaluate(() => document.activeElement.id), last);
          await page.keyboard.press("Tab");
          assert.equal(await page.evaluate(() => document.activeElement.id), "close");
          await page.keyboard.press("Escape");
          assert.equal(await dialog.evaluate((node) => node.open), false);
          assert.equal(await page.evaluate(() => document.activeElement.id), "scene");
        } else if (states.includes(scene) && scene !== "loading") {
          await page.locator("#reload").click();
          assert.match(await page.locator("#review-note").textContent(), /不代表服务已恢复/);
        }
      }
      await page.locator("#scene").selectOption("board");
      for (const action of Object.keys(forms)) {
        await page.locator(`[data-action="${action}"]`).click();
        assert.equal(await dialog.evaluate((node) => node.open), true);
        if (action !== "batch-resume") {
          if (action === "edit") await page.locator("#title").fill("");
          if (action === "progress") await page.locator("#progress_percent").fill("101");
          await page.locator("#submit").click();
          assert.equal(
            await dialog.evaluate((node) => node.open),
            true,
            `${action} invalid values must not submit`,
          );
          if (action === "progress") {
            await page.locator("#progress_percent").fill("45");
            await page.locator("#progress_note").fill("隔离输入校验演示");
          }
          if (["create", "edit"].includes(action))
            await page.locator("#title").fill("隔离表单演示，不写入任务");
          if (forms[action].includes("reason"))
            await page.locator("#reason").fill("隔离表单演示，不写入审计");
          if (action === "batch-delay") await page.locator("#due_at").fill("2026-08-09T18:00");
          if (action === "batch-transfer")
            await page.locator("#assignee_id").selectOption(fixture.task.assignee_id);
          await page.locator("#submit").click();
          assert.equal(await dialog.evaluate((node) => node.open), false);
          assert.match(await page.locator("#review-note").textContent(), /未请求 API/);
        } else await page.locator("#cancel").click();
        assert.equal(await page.evaluate(() => document.activeElement.dataset.action), action);
      }
      assert.deepEqual(await page.evaluate(() => window.SCOUTOPS_TASK_CONCEPT.task), fixture.task);
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      assert.deepEqual(await context.storageState(), { cookies: [], origins: [] });
      console.log(
        `task_c_forms width=${width} scenes=${scenes.length} forms=13 fields/eligibility/focus/validation=passed HTTP=0 errors=0`,
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
        version: "TASK-C-forms-r2",
        kind: "formal-design-proposal-not-vue-not-production",
        pageApproval: "pending-user-review",
        capturedAt: new Date().toISOString(),
        browser: browser.version(),
        sourceHashes,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
