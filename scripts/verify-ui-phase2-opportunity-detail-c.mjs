import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildOpportunityDetailDesignData } from "./lib/ui-phase2-opportunity-detail-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/opportunity-detail-direction-c",
  root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const capture = process.argv.includes("--capture");
const sources = ["index.html", "data.js", "detail.js", "detail.css"]
  .map((f) => `${relative}/${f}`)
  .concat([
    "design-plans/ui-phase-2-2026-09-07/design/account-direction-c/study.css",
    "apps/web/src/components/OpportunityWorkspace.vue",
    "apps/web/src/components/OpportunityDecisionPanel.vue",
    "apps/web/src/components/OpportunityEvidencePanel.vue",
    "apps/web/src/components/OpportunityWorkspaceDialogs.vue",
    "apps/web/src/components/opportunity-decision-presentation.ts",
    "apps/web/src/components/opportunity-workspace-presentation.ts",
    "apps/web/src/components/opportunity-workspace-types.ts",
    "apps/api/src/opportunity-service.ts",
    "apps/api/src/opportunity-routes.ts",
    "apps/api/src/mysql-opportunity-repository.ts",
    "tests/e2e/ui-phase2-opportunity-contracts.spec.ts",
    "tests/e2e/m04-02-opportunities.spec.ts",
    "scripts/lib/ui-phase2-opportunity-detail-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-opportunity-detail-c.mjs",
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
const data = await buildOpportunityDetailDesignData(repo),
  sandbox = { window: {} };
vm.runInNewContext(texts[`${relative}/data.js`], sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.OP_DETAIL_C_DATA)), data);
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
      await page.waitForFunction(() => Boolean(window.OP_DETAIL_C));
      const scene = async (name) => {
          await page.evaluate((n) => window.OP_DETAIL_C.scene(n), name);
          await page.evaluate(() => document.fonts.ready);
        },
        state = () => page.evaluate(() => window.OP_DETAIL_C.state()),
        idle = () => page.waitForFunction(() => !window.OP_DETAIL_C.state().busy);
      const names = await page.evaluate(() => Object.keys(window.OP_DETAIL_C.scenes));
      assert.equal(names.length, 51);
      for (const name of names) {
        await scene(name);
        await checkPrototypeMetrics(page);
        assert.deepEqual(errors, [], name);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${width}/${name}`,
        );
        assert.deepEqual(
          await page.evaluate(() => {
            const ids = [...document.querySelectorAll("[id]")].map((n) => n.id);
            return ids.filter((id, i) => ids.indexOf(id) !== i);
          }),
          [],
        );
        const modal = await page.locator("dialog[open]").count(),
          file = `${width}-${name}.png`;
        expected.push(file);
        if (capture) {
          const image = await page.screenshot({
            path: path.join(root, file),
            fullPage: !modal,
            animations: "disabled",
          });
          screenshots.push({ file, scene: name, width, sha256: hash(image) });
        }
      }
      for (const name of [
        "collecting",
        "candidate",
        "gate-summary-pending",
        ...Object.keys(data.gateLabels).map((k) => `missing-${k}`),
      ]) {
        await scene(name);
        assert.equal(await page.locator('[data-action="adopt"]').count(), 0);
      }
      await scene("readonly");
      assert.equal(await page.locator('[data-action="observe"]').count(), 0);
      assert.equal(await page.locator('[data-action="adopt"]').count(), 0);
      await scene("early");
      await page.locator('[data-action="observe"]').click();
      assert.equal(await page.locator("#reason").inputValue(), "");
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator('[data-action="observe"]').evaluate((n) => n === document.activeElement),
        true,
      );
      for (const action of ["adopt", "observe", "reject"]) {
        await scene("recommended");
        await page.locator(`[data-action="${action}"]`).click();
        await page.locator("#save").click();
        assert.equal((await state()).intents.length, 0);
        await page.locator("#reason").fill("   ");
        await page.locator("#save").click();
        assert.equal((await state()).intents.length, 0);
        assert.equal(await page.locator("#reason").getAttribute("aria-invalid"), "true");
        await page.locator("#reason").fill("暂存原因");
        await page.keyboard.press("Escape");
        await page.locator(`[data-action="${action}"]`).click();
        assert.equal(await page.locator("#reason").inputValue(), "");
        await page.locator("[data-close]").first().focus();
        await page.keyboard.press("Shift+Tab");
        assert.equal(
          await page.locator("#save").evaluate((n) => n === document.activeElement),
          true,
        );
        await page.keyboard.press("Tab");
        assert.equal(
          await page
            .locator("[data-close]")
            .first()
            .evaluate((n) => n === document.activeElement),
          true,
        );
        await scene(`${action}-failed`);
        await page.locator("#save").click();
        await idle();
        assert.equal((await state()).reason, data.decisionIntents[action].body.reason);
        assert.equal(await page.locator("dialog[open]").count(), 1);
        assert.equal((await state()).intents.length, 1);
        await page.locator("#save").click();
        await idle();
        assert.deepEqual((await state()).lastIntent, data.decisionIntents[action]);
        assert.equal((await state()).reads, 1);
        assert.equal((await state()).detail.decisions[0].action, action);
        assert.equal(
          (await state()).detail.overall_score,
          data.historical.recommendedBase.overall_score,
        );
        assert.equal((await state()).detail.version, 4);
        assert.equal(await page.locator("dialog[open]").count(), 0);
        await scene(`${action}-busy`);
        assert.equal(await page.locator("#save").isDisabled(), true);
        assert.equal(await page.locator("#reason").getAttribute("readonly"), "");
      }
      await scene("observe-edited");
      await page.locator("#save").click();
      await page.locator("[data-close]").first().click();
      assert.equal(await page.locator("dialog[open]").count(), 0);
      await idle();
      assert.equal((await state()).intents.length, 1);
      assert.equal((await state()).detail.decision_status, "observing");
      for (const name of ["decision-conflict", "decision-unknown"]) {
        await scene(name);
        assert.equal(await page.locator("#save").isDisabled(), true);
        assert.equal((await state()).intents.length, 0);
      }
      await scene("evidence-20");
      assert.equal(await page.locator(".evidence-row").count(), 20);
      await page.locator('[data-action="more"]').click();
      assert.equal(await page.locator(".evidence-row").count(), 40);
      await page.locator('[data-action="more"]').click();
      assert.equal(await page.locator(".evidence-row").count(), 41);
      assert.equal(await page.locator('[data-action="more"]').count(), 0);
      await page.locator('[data-action="collapse"]').click();
      assert.equal(await page.locator(".evidence-row").count(), 20);
      await scene("evidence-41");
      await page.evaluate(() => window.OP_DETAIL_C.replaceEvidence());
      assert.equal((await state()).visible, 20);
      await scene("evidence-41");
      await page.evaluate(() => window.OP_DETAIL_C.changeOpportunity());
      assert.equal((await state()).visible, 20);
      await scene("evidence");
      const source = page.locator("[data-source]").first();
      assert.equal(await source.getAttribute("href"), data.historical.evidence[0].canonical_url);
      assert.equal(await source.getAttribute("rel"), "noopener noreferrer");
      assert.equal(await source.getAttribute("target"), "_blank");
      await source.click();
      assert.equal((await state()).intents.length, 0);
      await scene("blockers");
      await page.locator('[data-action="create-task"]').click();
      await idle();
      assert.deepEqual((await state()).lastIntent, data.taskIntent);
      assert.deepEqual((await state()).navigation, data.taskNavigation);
      await scene("progress");
      assert.equal(
        await page.locator("[data-local]").first().getAttribute("href"),
        `/tasks?task=${data.taskId}`,
      );
      await scene("redecision");
      await page.locator("#redecision").click();
      assert.equal(
        await page.locator("#decision-actions").evaluate((n) => n === document.activeElement),
        true,
      );
      for (const [key] of [
        ...data.labels.opportunityPrimaryTabs,
        ...data.labels.opportunitySecondaryTabs,
      ]) {
        await scene("recommended");
        if (width === 390) await page.locator("#directory-label").click();
        await page.locator(`[data-tab="${key}"]`).click();
        assert.equal((await state()).tab, key);
        assert.equal((await state()).navigation.query.from, "/opportunities");
        assert.equal((await state()).navigation.query.tab, key === "overview" ? undefined : key);
        assert.equal((await state()).navigation.replace, true);
      }
      await scene("profit-error");
      assert.equal(await page.locator(".identity").count(), 0);
      await page.locator('[data-action="retry"]').click();
      assert.equal((await state()).reads, 1);
      assert.equal((await state()).status, "ready");
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      console.log(
        `opportunity_detail_c width=${width} scenes=${names.length} gates/three-dialogs/payloads/evidence41/navigation/focus passed; HTTP=0 storage=0`,
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
