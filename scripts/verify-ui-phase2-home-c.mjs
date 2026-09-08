import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildHomeDesignData } from "./lib/ui-phase2-home-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/home-direction-c",
  root = path.join(repo, relative);
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture"),
  hash = (value) => createHash("sha256").update(value).digest("hex");
const sources = ["index.html", "data.js", "home.js", "home.css"]
  .map((file) => `${relative}/${file}`)
  .concat([
    "design-plans/ui-phase-2-2026-09-07/design/account-direction-c/study.css",
    "apps/web/src/components/HomeDashboard.vue",
    "apps/web/src/components/HomeAutomationOverview.vue",
    "apps/web/src/components/UiStatePanel.vue",
    "apps/api/src/home-dashboard-service.ts",
    "apps/api/src/home-dashboard-routes.ts",
    "apps/api/src/mysql-home-dashboard-repository.ts",
    "apps/api/src/trend-routes.ts",
    "apps/api/src/trend-service.ts",
    "config/route-catalog.json",
    "scripts/lib/ui-phase2-home-design-data.mjs",
    "scripts/lib/ui-phase2-prototype-metrics.mjs",
    "scripts/verify-ui-phase2-home-c.mjs",
  ]);
const texts = Object.fromEntries(
  await Promise.all(
    sources.map(async (file) => [
      file,
      (await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n"),
    ]),
  ),
);
const sourceHashes = Object.fromEntries(
  Object.entries(texts).map(([file, text]) => [file, hash(text)]),
);
const data = await buildHomeDesignData(repo),
  sandbox = { window: {} };
assert.ok(
  data.summary.automatic_selection.candidate_count >=
    data.summary.automatic_selection.recommended_count +
      data.summary.automatic_selection.rule_candidate_count +
      data.summary.automatic_selection.awaiting_evidence_count,
  "The synthetic sample must not contain fewer candidates than its three displayed stages",
);
vm.runInNewContext(texts[`${relative}/data.js`], sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.HOME_C_DATA)), data);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
const screenshots = [],
  expected = [],
  browser = await chromium.launch({ headless: true });
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
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (e) => {
        if (e.type() === "error") errors.push(e.text());
      });
      await page.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.evaluate(() => document.fonts.ready);
      const scene = (name) => page.evaluate((n) => window.HOME_C_REVIEW.showScene(n), name);
      const info = () => page.evaluate(() => window.HOME_C_DIAGNOSTICS());
      const idle = () => page.waitForFunction(() => !window.HOME_C_DIAGNOSTICS().busy);
      const scenes = await page.evaluate(() => window.HOME_C_REVIEW.scenes);
      assert.equal(scenes.length, 32);
      for (const name of scenes) {
        await scene(name);
        const metrics = await checkPrototypeMetrics(page);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          name,
        );
        assert.equal(await page.locator("dialog,[role=dialog]").count(), 0);
        const tiny = await page.locator("a,summary").evaluateAll((nodes) =>
          nodes
            .filter((n) => n.getClientRects().length)
            .filter((n) => {
              const r = n.getBoundingClientRect();
              return r.width < 43.9 || r.height < 43.9;
            })
            .map((n) => n.textContent),
        );
        assert.deepEqual(tiny, [], name);
        if (name === "unknown-selection") {
          assert.equal(await page.locator("#automation,#rule-form,.queue-link").count(), 0);
          assert.equal(await page.locator("#unknown-selection").isVisible(), true);
        }
        if (name.startsWith("rules-"))
          assert.equal(await page.locator("#rule-form,[data-toggle],[data-resume]").count(), 0);
        if (name.startsWith("readonly"))
          assert.equal(await page.locator("#rule-form,[data-toggle],[data-resume]").count(), 0);
        if (
          [
            "loading",
            "error",
            "expired",
            "forbidden",
            "rate-limited",
            "blocked",
            "setup-saved-read-failed",
          ].includes(name)
        )
          assert.equal(await page.locator("#automation,#rule-form,#decisions").count(), 0);
        if (name === "no-score") assert.equal(await page.locator(".score").count(), 0);
        if (name === "running" && width === 390) {
          const r = await page.locator(".queue-link").first().boundingBox();
          assert.ok(
            r.y + r.height <= viewport.height,
            "First recommendation within mobile fold, standalone work surface only",
          );
        }
        const file = `${width}-${name}.png`;
        expected.push(file);
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
      await scene("running");
      const expectedCounters = [
        "/opportunities?view=recommended",
        "/opportunities?view=rule_candidates",
        "/opportunities?view=evidence_pending",
        "/trends?section=rules",
      ];
      assert.deepEqual(
        await page
          .locator(".facts a")
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href"))),
        expectedCounters,
      );
      assert.deepEqual(await page.locator(".facts strong").allTextContents(), ["4", "5", "8", "3"]);
      const expectedWork = [
        ...data.summary.actions.filter((v) => v.source_module !== "opportunity"),
        ...data.summary.health,
      ];
      assert.deepEqual(
        await page
          .locator(".work-link")
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href"))),
        expectedWork.map((v) => v.route),
      );
      assert.deepEqual(
        await page
          .locator(".queue-link")
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href"))),
        data.summary.automatic_selection.recommended_items.map((v) => v.route),
      );
      for (const href of [
        ...expectedCounters,
        "/opportunities",
        "/opportunities/start",
        ...expectedWork.map((v) => v.route),
        ...data.summary.automatic_selection.recommended_items.map((v) => v.route),
      ]) {
        await page.locator(`a[href="${href}"]`).first().click();
        assert.equal((await info()).lastRoute, href);
      }
      for (const id of ["runtime", "truth"]) {
        await page.locator(`#${id} summary`).focus();
        await page.keyboard.press("Enter");
        assert.equal(await page.locator(`#${id}`).getAttribute("open"), "");
        await page.keyboard.press("Enter");
        assert.equal(await page.locator(`#${id}`).getAttribute("open"), null);
      }
      assert.equal(
        (await info()).lastIntent,
        null,
        "Details and links do not make business requests",
      );
      await scene("candidates");
      assert.equal(await page.locator(".quiet-empty a").getAttribute("href"), expectedCounters[1]);
      await scene("collecting");
      assert.equal(await page.locator(".quiet-empty a").getAttribute("href"), expectedCounters[2]);
      await scene("quiet");
      assert.equal(await page.locator(".quiet-empty a,.work-link,.queue-link").count(), 0);
      await scene("not-configured");
      assert.deepEqual(
        await page
          .locator("#rule-form input,#rule-form select")
          .evaluateAll((nodes) => nodes.map((n) => n.name).sort()),
        Object.keys(data.form).sort(),
      );
      await page.locator("#rule-form button").click();
      assert.equal((await info()).lastIntent, null);
      for (const name of ["include_keywords", "negative_keywords", "category", "name"])
        assert.equal(
          await page.locator(`[name="${name}"]`).getAttribute("maxlength"),
          String({ include_keywords: 500, negative_keywords: 500, category: 80, name: 120 }[name]),
        );
      await scene("setup-invalid");
      await page.locator("#rule-form button").click();
      assert.equal((await info()).lastIntent, null);
      assert.equal(
        await page.locator("#include_keywords").evaluate((n) => n === document.activeElement),
        true,
      );
      await scene("setup-edited");
      await page.locator("[data-toggle]").click();
      await page.locator("[data-toggle]").click();
      assert.equal(
        await page.locator("#include_keywords").inputValue(),
        data.edited.include_keywords,
      );
      for (const test of data.createCases) {
        await scene("setup-edited");
        await page.locator('[name="market"]').selectOption(test.form.market);
        await page.locator("#rule-form button").click();
        assert.equal((await info()).busy, true);
        assert.equal(await page.locator("[data-toggle]").isDisabled(), true);
        await idle();
        assert.deepEqual((await info()).lastIntent, test.result.calls[0]);
        assert.equal((await info()).open, false);
        assert.equal((await info()).form.include_keywords, test.form.include_keywords);
      }
      await scene("setup-failed");
      await page.locator("#rule-form button").click();
      await idle();
      assert.equal((await info()).open, true);
      assert.deepEqual((await info()).form, data.edited);
      await scene("paused");
      await page.locator("[data-resume]").click();
      await idle();
      assert.deepEqual((await info()).lastIntent, data.resume.calls[0]);
      assert.equal((await info()).rules[1].status, "paused");
      assert.equal((await info()).rules[0].status, "enabled");
      await scene("resume-failed");
      await page.locator("[data-resume]").click();
      await idle();
      assert.deepEqual((await info()).rules, data.paused);
      for (const name of [
        "rules-failed",
        "unknown-selection",
        "error",
        "expired",
        "forbidden",
        "rate-limited",
        "blocked",
        "setup-saved-read-failed",
      ]) {
        await scene(name);
        if (name === "expired" || name === "forbidden") {
          const href = name === "expired" ? "/login" : "/select-context";
          await page.locator(`a[href="${href}"]`).click();
          assert.equal((await info()).lastRoute, href);
        }
        await page.locator("[data-reload]").click();
        await page.waitForFunction(() => window.HOME_C_DIAGNOSTICS().readState === "ready");
        assert.deepEqual((await info()).lastIntent, {
          method: "GET",
          paths: ["/me/home-dashboard", "/trends/monitoring-rules"],
        });
        if (name === "setup-saved-read-failed")
          assert.match((await info()).message, /创建请求已成功/);
      }
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      console.log(
        `home_c width=${width} scenes=32 source-payloads=10 resume-first/links/unknown/read-states passed HTTP=0 storage=0; source read gaps remain unfixed`,
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
    `${JSON.stringify({ version: "HOME-C-r1", approval: "pending", capturedAt: new Date().toISOString(), sourceHashes, sourceKnownGaps: data.gaps, boundary: "64 permanent proposal images. Synthetic rows ordered by actual HomeDashboardService; actual extracted Vue create/resume payloads and read gaps evaluated without HTTP. Not actual Vue rendering, SQL/RBAC, crawler execution, cache/concurrency, full shared shell or production acceptance.", screenshots }, null, 2)}\n`,
  );
else
  assert.deepEqual(
    previous.screenshots.map((s) => s.file),
    expected,
  );
