import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { buildProfitDesignData } from "./lib/ui-phase2-profit-design-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "design-plans/ui-phase-2-2026-09-07/design";
const relative = `${base}/detail-cost-context-direction-c`,
  root = path.join(repo, relative);
const args = process.argv.slice(2);
assert.ok(args.every((v) => ["--capture", "--smoke"].includes(v)));
const capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
assert.ok(!(capture && smoke));
const read = (file) => readFile(path.join(repo, file), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const data = await buildProfitDesignData(repo);
const original = JSON.parse(await read(`${base}/profit-direction-c/evidence.json`));
for (const [file, expected] of Object.entries(original.sourceHashes))
  assert.equal(hash((await read(file)).replaceAll("\r\n", "\n")), expected, file);
const paths = [
  ...Object.keys(original.sourceHashes),
  `${base}/profit-direction-c/evidence.json`,
  ...["index.html", "context.js", "context.css"].map((f) => `${relative}/${f}`),
  "apps/web/src/components/OpportunityDecisionPanel.vue",
  "scripts/verify-ui-phase2-detail-cost-context-c.mjs",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(paths.map(async (f) => [f, hash((await read(f)).replaceAll("\r\n", "\n"))])),
);
assert.equal(data.facts.detail.recommendation_status, "observe");
assert.equal(data.facts.detail.risk_level, "unknown");
assert.equal(data.facts.detail.quality_gates, undefined);
assert.equal(data.facts.analysis.current_inputs.length, 0);
assert.equal(data.facts.analysis.cost_input_reviews.length, 1);
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await read(`${relative}/evidence.json`));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, s.file))), s.sha256);
}
const screenshots = [],
  expected = [],
  checks = [];
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
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.route(/^https?:/, (r) => {
        requests.push(r.request().url());
        return r.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => !!window.DETAIL_COST_CONTEXT_C);
      assert.deepEqual(await page.evaluate(() => window.PROFIT_C_DATA), data);
      const scene = (n) => page.evaluate((key) => window.DETAIL_COST_CONTEXT_C.scene(key), n);
      const state = () => page.evaluate(() => window.PROFIT_C.state());
      const select = (key) => page.evaluate((k) => window.DETAIL_COST_CONTEXT_C.select(k), key);
      const shot = async (name, fullPage = true) => {
        const metrics = await checkPrototypeMetrics(page);
        const layout = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          duplicates: [...document.querySelectorAll("[id]")]
            .map((n) => n.id)
            .filter((id, i, all) => all.indexOf(id) !== i),
          visibleCurrent: [...document.querySelectorAll('[aria-current="page"]')].filter(
            (n) => n.getClientRects().length,
          ).length,
        }));
        assert.equal(layout.overflow, false, name);
        assert.deepEqual(layout.duplicates, []);
        assert.ok(layout.visibleCurrent <= 1);
        assert.equal(await page.locator("dialog").count(), 0, "Inline cost forms are not modals");
        const file = `${width}-${name}.png`;
        expected.push(file);
        if (capture) {
          await page.screenshot({
            path: path.join(root, file),
            fullPage,
            animations: "disabled",
          });
          screenshots.push({
            file,
            scene: name,
            viewport,
            fullPage,
            approval: "pending",
            metrics,
            sha256: hash(await readFile(path.join(root, file))),
          });
        }
      };
      const names = await page.evaluate(() => Object.keys(window.DETAIL_COST_CONTEXT_C.scenes));
      assert.equal(names.length, 20);
      for (const name of names) {
        if (smoke && !["overview", "form-failed", "approved-edited"].includes(name)) continue;
        await scene(name);
        const s = await state();
        assert.equal(s.detail.id, data.facts.detail.id);
        assert.deepEqual(s.analysis.latest_run, data.facts.analysis.latest_run);
        assert.deepEqual(s.analysis.current_inputs, []);
        if (s.busy) assert.equal(await select("overview"), false);
        await shot(name);
      }
      // Same opportunity, immutable financial snapshot; costs never manufacture recommendation.
      await scene("overview");
      assert.match(await page.locator("#context-overview").textContent(), /观察，不代表建议采纳/);
      assert.equal(await page.getByRole("button", { name: /^(采纳|继续观察|驳回)$/ }).count(), 0);
      const titleBox = await page.locator("#context-title").boundingBox();
      assert.ok(titleBox.y + titleBox.height < viewport.height);
      for (const key of ["inputs", "reviews", "form", "snapshot"]) {
        if (width === 390) await page.locator("#context-directory summary").click();
        await page.locator(`#sections [data-section="${key}"]`).click();
        assert.equal(await page.evaluate(() => window.DETAIL_COST_CONTEXT_C.active()), key);
        assert.equal(await page.locator("#work").isVisible(), true);
      }
      await select("overview");
      await page.getByRole("button", { name: "核对分项依据" }).click();
      assert.equal(await page.locator("#work").isVisible(), true);
      const detail = page.locator(".component").nth(1);
      await detail.locator("summary").click();
      assert.match(await detail.locator(".provenance").textContent(), /40 CNY/);
      await select("overview");
      await select("snapshot");
      assert.equal(await detail.evaluate((n) => n.open), true);
      await shot("continuity-source-open");
      await scene("form-failed");
      const source = page.locator("#source_ref_id");
      await source.fill("同一机会的长来源草稿：" + "核对报价。".repeat(25));
      const draft = (await state()).form,
        originalError = (await state()).error;
      assert.equal(Object.keys(draft).length, 9);
      await select("overview");
      assert.match(await page.locator("#context-notice").textContent(), /草稿保留/);
      assert.ok((await page.locator("#context-notice").textContent()).includes(originalError));
      await shot("continuity-error-overview");
      await select("form");
      assert.deepEqual((await state()).form, draft);
      assert.equal((await state()).error, originalError);
      assert.equal(await source.inputValue(), draft.source_ref_id);
      await shot("continuity-cost-draft");
      const accessibleControl = async (control) => {
        await control.scrollIntoViewIfNeeded();
        assert.equal(
          await control.evaluate((n) => {
            const r = n.getBoundingClientRect();
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return (
              r.top >= 0 &&
              r.bottom <= innerHeight + 1 &&
              r.left >= 0 &&
              r.right <= innerWidth + 1 &&
              (n === hit || n.contains(hit))
            );
          }),
          true,
        );
      };
      assert.deepEqual(
        await page.locator("#cost-form [name]").evaluateAll((nodes) => nodes.map((n) => n.name)),
        Object.keys(draft),
      );
      for (const key of Object.keys(draft)) {
        const control = page.locator(`#cost-form [name="${key}"]`);
        assert.equal(await control.inputValue(), String(draft[key]));
        await accessibleControl(control);
      }
      await accessibleControl(page.locator("#save-cost"));
      await shot("continuity-cost-footer", false);
      await scene("approved-edited");
      await page.locator("#review-reason").fill("核对指定的这一笔成本，待审核意见。");
      const review = (await state()).review;
      await select("overview");
      await select("reviews");
      assert.deepEqual((await state()).review, review);
      assert.equal(await page.locator("#review-reason").inputValue(), review.reason);
      await shot("continuity-review-reason");
      await accessibleControl(page.locator("#save-review"));
      await shot("continuity-review-footer", false);
      // Native controls remain operable; this is an inline form, not a focus-trapped dialog.
      await page.locator("#cancel-review").click();
      assert.equal(await page.locator("#review-form").count(), 0);
      assert.equal(
        await page.locator('[data-begin="approved"]').evaluate((n) => n === document.activeElement),
        true,
      );
      await scene("overview");
      await page.locator("#context-tech summary").focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("#context-tech").evaluate((n) => n.open), true);
      assert.equal(await page.locator("#context-id").textContent(), data.facts.detail.id);
      for (const reflow of [700, 701, 768, 1024]) {
        await page.setViewportSize({ width: reflow, height: 900 });
        await scene("overview");
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
          false,
        );
      }
      assert.deepEqual((await state()).intents, []);
      assert.deepEqual(await page.evaluate(() => window.PROFIT_C_DATA), data);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      checks.push({
        width,
        originalSubjectOnly: true,
        immutableRun: true,
        gatesNotInvented: true,
        costDraftFields: 9,
        nineFieldsAndFootersHitTested: true,
        directoryPhysicalClicks: true,
        costErrorRoundTrip: true,
        reviewReasonRoundTrip: true,
        sourceDisclosureRoundTrip: true,
        inlineNotModal: true,
        reflow: [700, 701, 768, 1024],
        HTTP: 0,
        storage: 0,
        runtimeAcceptance: false,
      });
      console.log(
        `detail_cost_context width=${width} scenes/drafts/inline-focus/unchanged-facts passed HTTP=0 storage=0`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture) {
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        version: "DETAIL-COST-CONTEXT-C-r1",
        approval: "pending",
        kind: "additive-single-subject-cost-composition",
        sourceHashes,
        checks,
        boundary:
          "Opportunity444 original cost fixture only. No adoption eligibility invented, no701/424 data. Two cost inline forms, no added modal. Not full ten-section detail, populated current input, full permissions, Vue/API/SQL/production or approval.",
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    path.join(root, "gallery.html"),
    [
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P18 有利润的观察机会待审图册</title>',
      '<style>body{font:16px "Microsoft YaHei",sans-serif;margin:24px;background:#edf1f6;color:#202c3d}img{max-width:100%;height:auto}figure{margin:32px 0}</style>',
      '<h1>P18 结论与成本连续稿 · 待审核</h1><p>同一历史隔离机会，无采纳权限，无跨样本事实合并。</p><a href="index.html">打开交互提案</a>',
      ...screenshots.map(
        (s) =>
          `<figure><figcaption>${s.scene} · ${s.viewport.width}</figcaption><img loading="lazy" src="${s.file}" alt="${s.scene}"></figure>`,
      ),
      "</html>",
    ].join("\n"),
  );
} else if (!smoke) {
  assert.deepEqual(
    previous.screenshots.map((s) => s.file),
    expected,
  );
  assert.deepEqual(previous.checks, checks);
}
