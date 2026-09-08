import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildInsightsDesignData } from "./lib/ui-phase2-insights-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  relative = "design-plans/ui-phase-2-2026-09-07/design/insights-direction-c",
  root = path.join(repo, relative);
const hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const capture = process.argv.includes("--capture");
const sources = ["index.html", "data.js", "insights.js", "insights.css"]
  .map((f) => `${relative}/${f}`)
  .concat([
    "apps/web/src/components/OpportunityWorkspace.vue",
    "apps/web/src/components/OpportunityDetailInsights.vue",
    "apps/web/src/components/opportunity-workspace-types.ts",
    "apps/web/src/components/opportunity-workspace-presentation.ts",
    "apps/api/src/competitor-routes.ts",
    "apps/api/src/scoring-routes.ts",
    "apps/api/src/sourcing-routes.ts",
    "tests/e2e/m04-03-scoring.spec.ts",
    "tests/e2e/m04-05-competitors.spec.ts",
    "scripts/lib/ui-phase2-insights-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-insights-c.mjs",
  ]);
const texts = Object.fromEntries(
  await Promise.all(
    sources.map(async (f) => [
      f,
      (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n"),
    ]),
  ),
);
const sourceHashes = Object.fromEntries(Object.entries(texts).map(([f, text]) => [f, hash(text)]));
const data = await buildInsightsDesignData(repo),
  sandbox = { window: {} };
vm.runInNewContext(texts[`${relative}/data.js`], sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.INSIGHTS_C_DATA)), data);
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
      await page.waitForFunction(() => window.INSIGHTS_C?.state());
      const scene = async (name) => {
        await page.evaluate((n) => window.INSIGHTS_C.scene(n), name);
        await page.evaluate(() => document.fonts.ready);
      };
      const state = () => page.evaluate(() => window.INSIGHTS_C.state());
      const idle = () => page.waitForFunction(() => !window.INSIGHTS_C.state().busy);
      const names = await page.evaluate(() => Object.keys(window.INSIGHTS_C.scenes));
      assert.equal(names.length, 41);
      for (const name of names) {
        await scene(name);
        await checkPrototypeMetrics(page);
        assert.equal(await page.locator("dialog").count(), 0);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${width}/${name}`,
        );
        assert.deepEqual(errors, []);
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
      await scene("score");
      assert.equal(await page.locator(".score-row").count(), 3);
      assert.equal(await page.locator(".score-value").innerText(), "80.2");
      await page.locator(".score-row summary").first().focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.locator(".score-row").first().getAttribute("open"), "");
      assert.match(await page.locator(".reveal").first().innerText(), /000000000435/);
      await scene("score-zero");
      assert.equal(await page.locator(".score-value").innerText(), "0");
      await scene("score-missing");
      assert.match(await page.locator(".score-row").nth(2).innerText(), /缺失/);
      await scene("score-no-run");
      assert.equal(await page.locator(".score-row").count(), 0);
      assert.equal(await page.locator(".score-value").innerText(), "—");
      await scene("score-readonly");
      assert.equal(await page.locator('[data-action="score"]').count(), 0);
      for (const name of ["market", "market-empty", "market-missing"]) {
        await scene(name);
        assert.equal(await page.locator("canvas,svg").count(), 0);
        assert.match(await page.locator(".body").innerText(), /机会关联证据总数/);
        assert.match(await page.locator(".body").innerText(), /不能推导/);
      }
      for (const name of ["risk", "risk-low-missing", "risk-high", "risk-covered"]) {
        await scene(name);
        assert.equal(await page.locator(".risk-reading>div").count(), 2);
        assert.match(await page.locator(".body").innerText(), /未提供逐项风险评估事实/);
      }
      await scene("competition");
      assert.match(await page.locator(".snapshot").innerText(), /26.99 USD/);
      assert.equal(await page.locator('a[href^="https:"]').count(), 0);
      await scene("competition-null");
      assert.match(await page.locator(".snapshot").innerText(), /价格缺失/);
      assert.doesNotMatch(await page.locator(".snapshot").innerText(), /\b0\b/);
      await scene("competition-zero");
      assert.equal(
        await page
          .locator(".snapshot strong")
          .allTextContents()
          .then((v) => v.join("|")),
        "0 USD|0|0",
      );
      await scene("competition-no-snapshot");
      assert.equal(await page.locator(".snapshot").count(), 0);
      await scene("competition-no-access");
      assert.equal(await page.locator(".competitor,[data-action]").count(), 0);
      for (const name of [
        "competition-loading",
        "competition-error",
        "overview-loading",
        "overview-error",
      ]) {
        await scene(name);
        assert.equal(await page.locator(".number,.snapshot,.competitor").count(), 0);
      }
      await scene("competition-error");
      await page.locator("#retry-downstream").click();
      assert.deepEqual((await state()).lastRead, ["/competitors", "/sourcing/searches"]);
      assert.equal((await state()).intents.length, 0);
      assert.equal((await state()).readState, "ready");
      for (const name of ["overview-comp-only", "overview-supplier-only", "overview-no-access"]) {
        await scene(name);
        assert.equal(await page.locator(".access").count(), name === "overview-no-access" ? 2 : 1);
        assert.equal(
          await page.locator("[data-action]").count(),
          name === "overview-no-access" ? 0 : 1,
        );
      }
      for (const key of ["competitor", "supplier", "score"]) {
        await scene(key === "score" ? "score" : "overview");
        const before = await state();
        await page.evaluate(() => window.INSIGHTS_C.failNext());
        await page.locator(`[data-action="${key}"]`).click();
        await idle();
        assert.equal((await state()).outcome, "failed");
        assert.equal((await state()).reads, 0);
        assert.deepEqual((await state()).intents[0], data.intents[key]);
        await page.locator(`[data-action="${key}"]`).click();
        await idle();
        const after = await state();
        assert.equal(after.outcome, "queued");
        assert.equal(after.reads, key === "score" ? 1 : 0);
        assert.deepEqual(after.downstream, before.downstream);
        assert.deepEqual(after.detail, before.detail);
        assert.equal(after.intents.length, 2);
        await scene(`${key}-busy`);
        assert.equal(await page.locator("[data-action]:enabled,[data-section]:enabled").count(), 0);
      }
      await scene("score-reload-error");
      assert.equal(await page.locator('[data-action="score"]').isDisabled(), true);
      const before = (await state()).detail;
      await page.locator("#retry-score-read").click();
      assert.equal((await state()).intents.length, 0);
      assert.equal((await state()).outcome, "queued");
      assert.deepEqual((await state()).detail, before);
      await scene("write-unknown");
      assert.equal(await page.locator("[data-action]:enabled").count(), 0);
      await page.locator('a[href="/tasks"]').click();
      assert.equal((await state()).navigation, "/tasks");
      await scene("market");
      await page.locator(".body a").click();
      assert.equal(
        (await state()).navigation,
        `/opportunities/${data.facts.detail.id}?tab=evidence`,
      );
      if (width === 390) {
        await page.locator(".directory summary").click();
        await page.locator('[data-section="risk"]').click();
        assert.equal((await state()).section, "risk");
        assert.equal(await page.locator(".directory details").getAttribute("open"), null);
      }
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      console.log(
        `insights_c width=${width} scenes=${names.length} source/filter/payload/queue/unknown/permission/zero/keyboard/recovery passed; HTTP=0 storage=0 dialogs=0`,
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
