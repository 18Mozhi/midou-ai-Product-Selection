import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildReviewDesignData } from "./lib/ui-phase2-review-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/review-direction-c",
  root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const capture = process.argv.includes("--capture");
const sources = ["index.html", "data.js", "review.js", "review.css"]
  .map((f) => `${relative}/${f}`)
  .concat([
    "design-plans/ui-phase-2-2026-09-07/design/insights-direction-c/insights.css",
    "apps/web/src/components/OpportunityWorkspace.vue",
    "apps/web/src/components/OpportunityAiPanel.vue",
    "apps/web/src/components/OpportunityLineagePanel.vue",
    "apps/web/src/components/OpportunityFeedbackPanel.vue",
    "apps/web/src/components/opportunity-workspace-forms.ts",
    "apps/web/src/components/opportunity-workspace-types.ts",
    "apps/web/src/components/opportunity-workspace-presentation.ts",
    "apps/web/src/components/AuditedReasonDialog.vue",
    "apps/web/src/use-audited-reason.ts",
    "apps/api/src/opportunity-service.ts",
    "apps/api/src/mysql-opportunity-repository.ts",
    "apps/api/src/opportunity-routes.ts",
    "apps/api/src/ai-analysis-service.ts",
    "apps/api/src/ai-analysis-routes.ts",
    "apps/api/src/mysql-ai-analysis-repository.ts",
    "apps/worker/src/ai-analysis-worker.ts",
    "tests/e2e/m04-07-ai-analysis.spec.ts",
    "tests/m04-02/business-lineage.test.mjs",
    "tests/m04-02/operating-feedback.test.mjs",
    "scripts/lib/ui-phase2-review-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-review-c.mjs",
  ]);
const texts = Object.fromEntries(
    await Promise.all(
      sources.map(async (f) => [
        f,
        (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n"),
      ]),
    ),
  ),
  sourceHashes = Object.fromEntries(Object.entries(texts).map(([f, t]) => [f, hash(t)]));
const data = await buildReviewDesignData(repo),
  sandbox = { window: {} };
vm.runInNewContext(texts[`${relative}/data.js`], sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.REVIEW_C_DATA)), data);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
const browser = await chromium.launch({ headless: true }),
  screenshots = [],
  expected = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (e) => {
        if (e.type() === "error") errors.push(e.text());
      });
      page.on("request", (r) => {
        if (/^https?:/.test(r.url())) requests.push(r.url());
      });
      await page.route(/^https?:/, (r) => r.abort());
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => window.REVIEW_C?.state());
      const scene = async (name) => {
          await page.evaluate((n) => window.REVIEW_C.scene(n), name);
          await page.evaluate(() => document.fonts.ready);
        },
        state = () => page.evaluate(() => window.REVIEW_C.state()),
        idle = () => page.waitForFunction(() => !window.REVIEW_C.state().busy);
      const names = await page.evaluate(() => Object.keys(window.REVIEW_C.scenes));
      assert.equal(names.length, 51);
      for (const name of names) {
        await scene(name);
        await checkPrototypeMetrics(page);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${width}/${name}`,
        );
        assert.deepEqual(errors, [], name);
        const modal = await page.locator("dialog[open]").count();
        const file = `${width}-${name}.png`;
        expected.push(file);
        if (capture) {
          const image = await page.screenshot({
            path: path.join(root, file),
            fullPage: !modal,
            animations: "disabled",
          });
          screenshots.push({
            file,
            scene: name,
            width,
            modal: Boolean(modal),
            sha256: hash(image),
          });
        }
      }
      await scene("ai");
      assert.equal(
        await page.locator(".ai-summary").innerText(),
        data.facts.analyses[0].result.content.summary,
      );
      await page.locator(".trace-detail summary").click();
      assert.match(await page.locator(".trace-detail").innerText(), /a{64}/);
      for (const name of ["ai-readonly", "ai-approved", "ai-rejected", "ai-stale-error"]) {
        await scene(name);
        assert.equal(await page.locator("[data-review]:enabled").count(), 0);
      }
      await scene("ai-stale-error");
      assert.equal(await page.locator(".ai-summary").count(), 1);
      assert.match(await page.locator(".body").innerText(), /上次读取的旧记录/);
      await page.locator("#retry-ai").click();
      assert.equal((await state()).readState, "ready");
      assert.equal((await state()).lastRead, `/opportunities/${data.facts.detail.id}/ai-analyses`);
      assert.equal((await state()).intents.length, 0);
      for (const name of ["ai-loading", "ai-error", "ai-malformed", "ai-empty"]) {
        await scene(name);
        assert.equal(await page.locator(".ai-summary").count(), 0);
      }
      for (const name of ["ai-queued", "ai-leased", "ai-retry", "ai-terminal", "ai-dead-letter"]) {
        await scene(name);
        assert.equal(await page.locator(".ai-summary,[data-review]").count(), 0);
      }
      await scene("ai-multiple");
      assert.equal(await page.locator(".record-list button").count(), 2);
      await page.locator('[data-record="1"]').click();
      assert.equal(await page.locator(".ai-summary").count(), 1);
      for (const outcome of ["approved", "rejected"]) {
        await scene("ai");
        const trigger = page.locator(`[data-review="${outcome}"]`);
        await trigger.click();
        assert.equal(await page.locator("#review-reason").inputValue(), "");
        await page.locator("#review-reason").fill(" 一 ");
        assert.equal(await page.locator("#save-review").isDisabled(), true);
        await page.locator("#review-reason").fill(data.reason);
        await page.locator("#save-review").focus();
        await page.keyboard.press("Tab");
        assert.equal(
          await page.locator("#close-review").evaluate((n) => n === document.activeElement),
          true,
        );
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await page.locator("#save-review").evaluate((n) => n === document.activeElement),
          true,
        );
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.equal(await trigger.evaluate((n) => n === document.activeElement), true);
        assert.equal((await state()).intents.length, 0);
        await trigger.click();
        assert.equal(await page.locator("#review-reason").inputValue(), "");
        await page.locator("#review-reason").fill(data.reason);
        const content = (await state()).analyses[0].result.content;
        await page.evaluate(() => window.REVIEW_C.failNext());
        await page.locator("#save-review").click();
        await idle();
        assert.equal(await page.locator("dialog[open]").count(), 1);
        assert.equal(await page.locator("#review-reason").inputValue(), data.reason);
        assert.equal((await state()).reads, 0);
        await page.locator("#save-review").click();
        await idle();
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.equal((await state()).analyses[0].result.review_status, outcome);
        assert.deepEqual((await state()).analyses[0].result.content, content);
        assert.deepEqual((await state()).intents.at(-1), data.intents[outcome]);
        assert.equal((await state()).reads, 1);
      }
      await scene("approved-filled");
      await page.evaluate(() => window.REVIEW_C.failNext());
      // Start and close synchronously before the mock's delay; closing must not cancel.
      await page.evaluate(() => {
        document.querySelector("#review-form").requestSubmit();
        document.querySelector("#close-review").click();
      });
      await idle();
      assert.equal(await page.locator("dialog[open]").count(), 0);
      assert.equal((await state()).intents.length, 1);
      await page.locator("#restore-review").click();
      assert.equal(await page.locator("#review-reason").inputValue(), data.reason);
      await page.locator("#cancel-review").click();
      assert.equal(await page.locator("#restore-review").count(), 0);
      await page.locator('[data-review="approved"]').click();
      assert.equal(await page.locator("#review-reason").inputValue(), "");
      await scene("review-unknown");
      assert.equal(await page.locator("#save-review").isDisabled(), true);
      await scene("ai");
      const original = (await state()).analyses;
      await page.evaluate(() => window.REVIEW_C.failNext());
      await page.locator("#queue-ai").click();
      await idle();
      assert.equal((await state()).reads, 0);
      await page.locator("#queue-ai").click();
      await idle();
      assert.deepEqual((await state()).intents.at(-1), data.intents.queue);
      assert.deepEqual((await state()).analyses, original);
      assert.equal((await state()).reads, 1);
      await scene("ai-reload-error");
      assert.equal(await page.locator("#queue-ai").isDisabled(), true);
      await page.locator("#retry-load").click();
      assert.equal((await state()).intents.length, 0);
      await scene("lineage");
      assert.equal(await page.locator(".node").count(), 11);
      assert.match(await page.locator(".body").innerText(), /failed_terminal:parser_failed/);
      const route = data.lineage.nodes.find((v) => v.kind === "profit").route;
      await page.locator(`.node a[href="${route}"]`).click();
      assert.equal((await state()).navigation, route);
      await scene("lineage-age-unknown");
      assert.match(await page.locator(".ledger").innerText(), /未提供，不能当作 0 秒/);
      await scene("lineage-no-correlation");
      assert.match(await page.locator(".node").first().innerText(), /request_id: 未记录/);
      await scene("lineage-empty");
      assert.equal(await page.locator(".node").count(), 0);
      await scene("feedback");
      assert.deepEqual(await page.locator(".calibration strong").allTextContents(), [
        "5%",
        "10%",
        "-20 USD",
        "+4 天",
      ]);
      await page.locator(".fact summary").click();
      assert.match(await page.locator(".fact").innerText(), /request-feedback/);
      await scene("feedback-zero");
      assert.deepEqual(await page.locator(".calibration strong").allTextContents(), [
        "没有可比基线",
        "没有可比基线",
        "0 USD",
        "0 天",
      ]);
      await scene("feedback-incomparable");
      assert.deepEqual((await state()).feedback.calibration.profit_variance_amount, null);
      await scene("feedback-readonly");
      assert.equal(await page.locator("#open-form").count(), 0);
      if (width === 390) await page.locator(".directory summary").click();
      await page.locator('[data-section="form"]').click();
      assert.equal(await page.locator("#feedback-form").count(), 0);
      await scene("form");
      assert.equal(await page.locator("#feedback-form input,#feedback-form textarea").count(), 11);
      assert.equal(await page.locator("#source_ref").inputValue(), "");
      await scene("form-filled");
      await page.evaluate(() => window.REVIEW_C.failNext());
      await page.locator("#save-feedback").click();
      await idle();
      assert.equal((await state()).outcome, "failed");
      assert.equal(await page.locator("#source_ref").inputValue(), data.feedbackForm.source_ref);
      await page.locator("#save-feedback").click();
      await idle();
      assert.deepEqual((await state()).intents.at(-1), data.feedbackIntent);
      assert.equal((await state()).outcome, "saved");
      assert.equal(await page.locator("#source_ref").inputValue(), "");
      assert.equal(
        await page.locator("#sales_units").inputValue(),
        String(data.feedbackForm.sales_units),
      );
      assert.deepEqual((await state()).feedback, data.feedbackSubmission);
      assert.equal((await state()).feedback.facts.length, 2);
      assert.equal((await state()).feedback.facts[0].notes, data.feedbackForm.notes);
      assert.deepEqual((await state()).feedback.facts[1], data.feedbackVersions.history.facts[0]);
      await page.locator("#source_ref").fill(data.feedbackForm.source_ref);
      await page.locator("#notes").fill(data.feedbackForm.notes);
      await page.locator("#save-feedback").click();
      await idle();
      assert.equal((await state()).outcome, "intent-only");
      assert.deepEqual((await state()).feedback, data.feedbackSubmission);
      assert.equal((await state()).reads, 0);
      for (const [name, field] of [
        ["form-period", "period_end"],
        ["form-returns", "returned_units"],
      ]) {
        await scene(name);
        await page.locator("#save-feedback").click();
        assert.equal((await state()).intents.length, 0);
        assert.equal(await page.locator(`#${field}`).getAttribute("aria-invalid"), "true");
      }
      await scene("form-filled");
      await page.locator("#actual_profit_amount").fill("-20");
      await page.locator("#save-feedback").click();
      await idle();
      assert.equal((await state()).intents.at(-1).body.actual_profit_amount, -20);
      assert.equal((await state()).outcome, "intent-only");
      await scene("form-unknown");
      assert.equal(await page.locator("#save-feedback").isDisabled(), true);
      for (const name of ["form-busy", "ai-queue-busy"]) {
        await scene(name);
        assert.equal(await page.locator("[data-section]:enabled").count(), 0);
      }
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      console.log(
        `review_c width=${width} scenes=${names.length} AI/review/payload/recovery/lineage/feedback/zero/loss/keyboard passed; HTTP=0 storage=0`,
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
    `${JSON.stringify({ version: data.version, approval: "pending", capturedAt: new Date().toISOString(), sourceHashes, knownGaps: data.knownGaps, boundary: data.boundary, screenshots }, null, 2)}\n`,
  );
else
  assert.deepEqual(
    previous.screenshots.map((s) => s.file),
    expected,
  );
assert.deepEqual(
  (await readdir(root)).filter((f) => f.endsWith(".png")).sort(),
  [...expected].sort(),
);
