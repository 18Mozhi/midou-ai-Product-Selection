import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildJourneyDesignData } from "./lib/ui-phase2-journey-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/journey-direction-c",
  root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const capture = process.argv.includes("--capture");
const sources = ["index.html", "data.js", "journey.js", "journey.css"]
  .map((v) => `${relative}/${v}`)
  .concat([
    "design-plans/ui-phase-2-2026-09-07/design/account-direction-c/study.css",
    "apps/web/src/components/SelectionJourney.vue",
    "apps/api/src/selection-journey-service.ts",
    "apps/api/src/selection-journey-routes.ts",
    "apps/api/src/mysql-selection-journey-repository.ts",
    "tests/e2e/ui-phase2-journey-contracts.spec.ts",
    "tests/e2e/ui-phase2-journey-reads.spec.ts",
    "scripts/lib/ui-phase2-journey-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-journey-c.mjs",
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
const data = await buildJourneyDesignData(repo),
  sandbox = { window: {} };
vm.runInNewContext(texts[`${relative}/data.js`], sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.JOURNEY_C_DATA)), data);
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
      await page.route(/^https?:/, (route) => route.abort());
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => Boolean(window.JOURNEY_C));
      const state = () => page.evaluate(() => window.JOURNEY_C.state()),
        scene = async (name) => {
          await page.evaluate((n) => window.JOURNEY_C.scene(n), name);
          await page.evaluate(() => document.fonts.ready);
        },
        idle = () =>
          page.waitForFunction(
            () => !window.JOURNEY_C.state().busy && !window.JOURNEY_C.state().reading,
          );
      const names = await page.evaluate(() => Object.keys(window.JOURNEY_C.scenes));
      assert.equal(names.length, 48);
      for (const name of names) {
        await scene(name);
        await checkPrototypeMetrics(page);
        assert.deepEqual(errors, [], name);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${width}/${name}`,
        );
        assert.equal(await page.locator("dialog").count(), 0);
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
      for (const [kind, value] of Object.entries(data.values)) {
        await scene(kind === "product_url" ? "url" : kind);
        await page.locator('#create-form [type="submit"]').click();
        assert.equal((await state()).intents.length, 0);
        if (kind === "asin") {
          await page.locator('[name="input_value"]').fill("short");
          await page.locator('#create-form [type="submit"]').click();
          assert.equal((await state()).intents.length, 0);
        }
        await page.locator('[name="input_value"]').fill(value);
        await page.locator('#create-form [type="submit"]').click();
        await idle();
        assert.deepEqual((await state()).lastIntent, data.createIntents[kind]);
        assert.equal((await state()).journey.state, "accepted");
        assert.equal((await state()).savedId, data.sample.id);
        assert.equal(await page.locator("#decision-form").count(), 0);
        await page.locator("#advance").click();
        assert.equal((await state()).journey.state, "result_ready");
        assert.equal((await state()).selected, "");
        assert.equal((await state()).journey.input_value, value.trim());
      }
      await scene("keyword-edited");
      await page.locator('[name="kind"][value="asin"]').check();
      assert.equal((await state()).form.input_value, data.values.keyword);
      for (const bad of data.urlErrors) {
        await scene("url");
        await page.locator('[name="input_value"]').fill(bad.input_value);
        await page.locator('#create-form [type="submit"]').click();
        await idle();
        assert.equal((await state()).journey, null);
        assert.equal((await state()).form.input_value, bad.input_value);
        assert.equal((await state()).error, "error");
      }
      await scene("create-failed");
      await page.locator('#create-form [type="submit"]').click();
      await idle();
      assert.equal((await state()).journey, null);
      assert.equal((await state()).savedId, null);
      await page.locator('#create-form [type="submit"]').click();
      await idle();
      assert.equal((await state()).journey.state, "accepted");
      assert.equal((await state()).intents.length, 2);
      for (const name of ["restoring", "read-busy"]) {
        await scene(name);
        assert.equal(await page.locator('form [type="submit"]').isDisabled(), true);
        assert.equal(await page.locator("#work").getAttribute("aria-busy"), "true");
      }
      await scene("restore-failed");
      await page.locator('[data-action="retry"]').click();
      await idle();
      assert.deepEqual((await state()).lastIntent, {
        method: "GET",
        path: `/selection-journeys/${data.sample.id}`,
      });
      assert.equal((await state()).error, "");
      assert.equal((await state()).intents.length, 0);
      await scene("results");
      await page.locator('[name="candidate"]').nth(1).check();
      const selected = (await state()).selected;
      const source = page.locator('a[data-source="true"]').first();
      assert.equal(await source.getAttribute("target"), "_blank");
      assert.equal(await source.getAttribute("rel"), "noopener noreferrer");
      await source.click();
      assert.equal((await state()).selected, selected);
      assert.equal((await state()).intents.length, 0);
      await scene("single-result");
      assert.equal((await state()).selected, data.sample.results[1].raw_evidence_id);
      await scene("first-result");
      assert.equal((await state()).selected, data.sample.results[0].raw_evidence_id);
      assert.equal(await page.locator(".candidate").count(), 1);
      await scene("twenty-results");
      assert.equal(await page.locator(".candidate").count(), 20);
      assert.equal((await state()).journey.available_result_count, 28);
      for (const action of ["observe", "reject"]) {
        await scene(`${action}-edited`);
        await page.locator('#decision-form [type="submit"]').click();
        await idle();
        assert.deepEqual((await state()).lastIntent, data.decisionIntents[action]);
        assert.equal((await state()).savedId, null);
        assert.equal((await state()).journey.opportunity_id, null);
        assert.equal(
          (await state()).journey.verification_task_id,
          "00000000-0000-4000-8000-000000007630",
        );
        assert.equal(
          await page.locator('a[href^="/tasks/"]').getAttribute("href"),
          "/tasks/00000000-0000-4000-8000-000000007630",
        );
        await scene(`${action}-failed`);
        await page.locator('#decision-form [type="submit"]').click();
        await idle();
        assert.equal((await state()).decision.reason, "  核对来源后继续验证  ");
        assert.equal((await state()).error, "error");
        await page.locator('#decision-form [type="submit"]').click();
        await idle();
        assert.equal((await state()).error, "");
        assert.equal((await state()).journey.state, "decided");
        assert.equal((await state()).decision.reason, "");
      }
      await scene("observe-edited");
      await page.locator('[name="reason"]').fill("   ");
      await page.locator('#decision-form [type="submit"]').click();
      assert.equal((await state()).intents.length, 0);
      assert.equal(await page.locator('[name="reason"]').getAttribute("aria-invalid"), "true");
      await scene("adoption-pending");
      assert.equal(await page.locator('[name="decision"][value="adopt"]').isDisabled(), true);
      assert.match(await page.locator("#decision-form").innerText(), /不代表生产已禁用/);
      await scene("deadline-running");
      assert.equal(await page.locator('#decision-form [type="submit"]').isDisabled(), true);
      await scene("running-evidence");
      assert.equal(await page.locator("#decision-form").count(), 0);
      assert.equal(await page.locator(".candidate").count(), 2);
      await scene("reject-edited");
      await page.locator('[data-action="reset"]').click();
      assert.equal((await state()).journey, null);
      assert.equal((await state()).decision.action, "observe");
      assert.equal((await state()).decision.reason, "");
      assert.equal((await state()).intents.length, 0);
      await scene("observe-busy");
      assert.equal(await page.locator('[data-action="reset"]').isDisabled(), true);
      await scene("decided-no-links");
      assert.equal(await page.locator('a[href^="/tasks/"]').count(), 0);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      console.log(
        `journey_c width=${width} scenes=${names.length} source-inputs/observe/reject/results/recovery/reset passed; adoption pending, HTTP=0 storage=0`,
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
    `${JSON.stringify({ version: data.version, approval: "pending", capturedAt: new Date().toISOString(), sourceHashes, knownGaps: data.knownGaps, boundary: "48 scenes at two widths; zero business dialogs. Adoption is explicitly withheld pending business direction. Source execution confirms success leaves prior error state and reset retains decision draft, neither fixed in Vue. Isolated advance/recovery use no HTTP, real localStorage, polling or backend tasks; no production/DB/authorization acceptance.", screenshots }, null, 2)}\n`,
  );
else
  assert.deepEqual(
    previous.screenshots.map((v) => v.file),
    expected,
  );
