import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildProfitDesignData } from "./lib/ui-phase2-profit-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/profit-direction-c",
  root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const capture = process.argv.includes("--capture");
const sources = ["index.html", "data.js", "profit.js", "profit.css"]
  .map((f) => `${relative}/${f}`)
  .concat([
    "design-plans/ui-phase-2-2026-09-07/design/account-direction-c/study.css",
    "apps/web/src/components/OpportunityWorkspace.vue",
    "apps/web/src/components/OpportunityProfitPanel.vue",
    "apps/web/src/components/OpportunityCostReviewQueue.vue",
    "apps/web/src/components/opportunity-workspace-forms.ts",
    "apps/web/src/components/opportunity-workspace-types.ts",
    "apps/web/src/components/opportunity-workspace-presentation.ts",
    "apps/api/src/profit-service.ts",
    "apps/api/src/profit-routes.ts",
    "apps/api/src/mysql-profit-repository.ts",
    "apps/worker/src/automatic-selection-evaluation-worker.ts",
    "tests/e2e/m04-04-profit.spec.ts",
    "scripts/lib/ui-phase2-profit-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-profit-c.mjs",
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
const data = await buildProfitDesignData(repo),
  sandbox = { window: {} };
vm.runInNewContext(texts[`${relative}/data.js`], sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.PROFIT_C_DATA)), data);
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
      await page.waitForFunction(() => Boolean(window.PROFIT_C));
      const scene = async (name) => {
          await page.evaluate((n) => window.PROFIT_C.scene(n), name);
          await page.evaluate(() => document.fonts.ready);
        },
        state = () => page.evaluate(() => window.PROFIT_C.state()),
        idle = () => page.waitForFunction(() => !window.PROFIT_C.state().busy);
      const names = await page.evaluate(() => Object.keys(window.PROFIT_C.scenes));
      assert.equal(names.length, 50);
      for (const name of names) {
        await scene(name);
        await checkPrototypeMetrics(page);
        assert.equal(await page.locator("dialog").count(), 0);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${width}/${name}`,
        );
        assert.deepEqual(errors, [], name);
        const file = `${width}-${name}.png`;
        expected.push(file);
        if (capture) {
          const image = await page.screenshot({
            path: path.join(root, file),
            fullPage: true,
            animations: "disabled",
          });
          screenshots.push({ file, scene: name, width, sha256: hash(image) });
        }
      }
      await scene("snapshot");
      assert.equal(await page.locator(".component").count(), 7);
      assert.match(await page.locator(".net").innerText(), /69.4/);
      await page.locator(".component summary").nth(1).click();
      assert.match(await page.locator(".component").nth(1).innerText(), /000000000446/);
      await page.locator('a[href="/sourcing/cost-rules"]').click();
      assert.equal((await state()).navigation, "/sourcing/cost-rules");
      for (const name of ["missing", "no-run", "missing-component"]) {
        await scene(name);
        assert.equal(await page.locator(".result-strip").count(), 0);
        assert.match(await page.locator(".banner").innerText(), /不.*零/);
      }
      await scene("zero");
      assert.match(await page.locator(".net").innerText(), /0 USD/);
      await scene("loss");
      assert.match(await page.locator(".net").innerText(), /-8 USD/);
      await scene("no-currency");
      assert.match(await page.locator(".net").innerText(), /币种未提供/);
      await scene("form");
      assert.equal(await page.locator("#cost-form input,#cost-form select").count(), 9);
      assert.equal(await page.locator("#observed_at").inputValue(), "2026-08-08T20:00");
      assert.equal(await page.locator("#save-cost").isDisabled(), true);
      for (const [input_type, name] of Object.entries({
        sale_price: "sale",
        purchase_price: "purchase",
        logistics: "logistics",
      })) {
        await scene(name);
        const before = (await state()).analysis;
        await page.locator("#save-cost").click();
        await idle();
        assert.deepEqual((await state()).lastIntent, data.intents[input_type]);
        assert.deepEqual((await state()).analysis.latest_run, before.latest_run);
        assert.deepEqual((await state()).analysis.current_inputs, before.current_inputs);
        assert.equal((await state()).reads, 1);
        assert.equal((await state()).form.source_ref_id, data.form.source_ref_id);
        assert.equal((await state()).analysis.cost_input_reviews[0].input_type, input_type);
        assert.equal((await state()).analysis.cost_input_reviews[0].status, "pending");
      }
      await scene("form-failed");
      await page.locator("#save-cost").click();
      await idle();
      assert.equal((await state()).intents.length, 1);
      assert.equal((await state()).reads, 0);
      assert.equal(await page.locator("#source_ref_id").inputValue(), data.form.source_ref_id);
      await page.locator("#save-cost").click();
      await idle();
      assert.equal((await state()).reads, 1);
      await scene("invalid-zero");
      await page.locator("#save-cost").click();
      await idle();
      assert.equal((await state()).reads, 0);
      assert.equal(await page.locator("#amount_value").getAttribute("aria-invalid"), "true");
      for (const name of ["purchase", "logistics"]) {
        await scene(name);
        await page.locator("#amount_value").fill("0");
        await page.locator("#save-cost").click();
        await idle();
        assert.equal((await state()).reads, 1);
        assert.equal((await state()).lastIntent.body.amount_value, 0);
      }
      await scene("invalid-time");
      await page.locator("#save-cost").click();
      await idle();
      assert.equal((await state()).errorField, "observed_at");
      assert.equal((await state()).reads, 0);
      for (const name of ["reviewers-loading", "reviewers-error", "reviewers-empty"]) {
        await scene(name);
        assert.equal(await page.locator("#save-cost").isDisabled(), true);
        assert.equal(await page.locator("#reviewer_id").isDisabled(), true);
      }
      await scene("reviewers-error");
      const draft = (await state()).form;
      await page.locator("#retry-reviewers").click();
      assert.deepEqual((await state()).form, draft);
      assert.deepEqual((await state()).lastIntent, {
        method: "GET",
        path: "/cost-input-reviewers",
      });
      assert.equal((await state()).intents.length, 0);
      await page.locator("#reviewer_id").selectOption(data.form.reviewer_id);
      assert.equal(await page.locator("#save-cost").isDisabled(), false);
      for (const decision of ["approved", "rejected"]) {
        await scene("reviews");
        await page.locator(`[data-begin="${decision}"]`).click();
        assert.equal(await page.locator("#review-reason").inputValue(), "");
        await page.locator("#review-reason").fill("  一  ");
        assert.equal(await page.locator("#save-review").isDisabled(), true);
        await page.locator("#review-reason").fill("草稿");
        await page.locator("#cancel-review").click();
        assert.equal((await state()).intents.length, 0);
        assert.equal(
          await page
            .locator(`[data-begin="${decision}"]`)
            .evaluate((n) => n === document.activeElement),
          true,
        );
        await page.locator(`[data-begin="${decision}"]`).click();
        assert.equal(await page.locator("#review-reason").inputValue(), "");
        await scene(`${decision}-failed`);
        await page.locator("#save-review").click();
        await idle();
        assert.equal((await state()).review.reason, data.reason);
        assert.equal((await state()).reads, 0);
        assert.equal((await state()).intents.length, 1);
        await page.locator("#save-review").click();
        await idle();
        assert.deepEqual((await state()).lastIntent, data.reviewIntents[decision]);
        assert.equal((await state()).analysis.cost_input_reviews[0].status, decision);
        assert.equal((await state()).review.id, "");
        assert.deepEqual((await state()).analysis.latest_run, data.facts.analysis.latest_run);
        assert.equal(
          (await state()).analysis.current_inputs.length,
          decision === "approved" ? 1 : 0,
        );
      }
      await scene("overdue");
      assert.equal(await page.locator('[data-begin="approved"]').isEnabled(), true);
      await page.locator('[data-begin="rejected"]').click();
      await page.locator("#review-reason").fill(data.reason);
      await page.locator("#save-review").click();
      await idle();
      assert.equal((await state()).analysis.cost_input_reviews[0].status, "rejected");
      for (const name of ["other-reviewer", "permissions-lost", "done-approved", "done-rejected"]) {
        await scene(name);
        assert.equal(await page.locator("[data-begin]").count(), 0);
      }
      for (const name of ["form-busy", "approved-busy", "rejected-busy"]) {
        await scene(name);
        assert.equal(await page.locator("#work").getAttribute("aria-busy"), "true");
        assert.equal(await page.locator("#sections button:enabled").count(), 0);
      }
      await scene("queue-failed");
      await page.locator("#queue").click();
      await idle();
      assert.equal((await state()).reads, 0);
      assert.equal((await state()).intents.length, 1);
      await page.locator("#queue").click();
      await idle();
      assert.deepEqual((await state()).lastIntent, data.queueIntent);
      assert.equal((await state()).queueStatus, "queued");
      assert.deepEqual((await state()).analysis.latest_run, data.facts.analysis.latest_run);
      await scene("queue-no-rule");
      await page.locator("#queue").click();
      await idle();
      assert.equal((await state()).reads, 0);
      assert.deepEqual((await state()).analysis.latest_run, data.facts.analysis.latest_run);
      await scene("readonly");
      assert.equal(await page.locator("#queue").count(), 0);
      await page.locator('[data-section="form"]').click();
      assert.equal(await page.locator("#cost-form").count(), 0);
      await scene("sale");
      await page.locator("#source_ref_id").fill("保留草稿");
      await page.locator('[data-section="snapshot"]').click();
      await page.locator('[data-section="form"]').click();
      assert.equal(await page.locator("#source_ref_id").inputValue(), "保留草稿");
      await scene("read-error");
      assert.equal(await page.locator(".result-strip").count(), 0);
      await page.locator("#retry-main").click();
      assert.equal((await state()).state, "ready");
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      console.log(
        `profit_c width=${width} scenes=${names.length} source-bodies/review/zero/time/recovery/immutable-snapshot passed; HTTP=0 storage=0 dialogs=0`,
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
    previous.screenshots.map((v) => v.file),
    expected,
  );
assert.deepEqual(
  (await readdir(root)).filter((f) => f.endsWith(".png")).sort(),
  [...expected].sort(),
);
