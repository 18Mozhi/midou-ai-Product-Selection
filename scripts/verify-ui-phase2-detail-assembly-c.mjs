import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";
import { buildDetailAssemblyData } from "./lib/ui-phase2-detail-assembly-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/detail-assembly-direction-c";
const root = path.join(repo, relative);
const hash = (v) => createHash("sha256").update(v).digest("hex");
assert.ok(process.argv.slice(2).every((v) => v === "--capture"));
const capture = process.argv.includes("--capture");
const dependencyManifest =
  "design-plans/ui-phase-2-2026-09-07/design/review-direction-c/evidence.json";
const dependencies = JSON.parse(await readFile(path.join(repo, dependencyManifest), "utf8"));
const files = [
  ...new Set([
    ...["index.html", "data.js", "assembly.js", "assembly.css"].map((f) => `${relative}/${f}`),
    dependencyManifest,
    ...Object.keys(dependencies.sourceHashes).filter((f) => /^(apps|tests|scripts\/lib)\//.test(f)),
    "scripts/lib/ui-phase2-detail-assembly-data.mjs",
    "scripts/verify-ui-phase2-detail-assembly-c.mjs",
  ]),
];
const texts = Object.fromEntries(
  await Promise.all(
    files.map(async (f) => [
      f,
      (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n"),
    ]),
  ),
);
const sourceHashes = Object.fromEntries(Object.entries(texts).map(([f, t]) => [f, hash(t)]));
const data = await buildDetailAssemblyData(repo),
  sandbox = { window: {} };
vm.runInNewContext(texts[`${relative}/data.js`], sandbox);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.DETAIL_ASSEMBLY_C_DATA)), data);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots) {
    assert.match(shot.file, /^[A-Za-z0-9_.-]+\.png$/);
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
  }
}
const screenshots = [],
  expected = [],
  reports = [];
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
      const entry = pathToFileURL(path.join(root, "index.html"));
      entry.searchParams.set("from", "/tasks?view=mine");
      entry.searchParams.set("retained", "yes");
      entry.searchParams.set("tab", "ai");
      await page.goto(entry.href);
      await page.waitForFunction(() => window.DETAIL_ASSEMBLY_C?.state());
      const state = () => page.evaluate(() => window.DETAIL_ASSEMBLY_C.state());
      const scene = async (name) => {
        await page.evaluate((n) => window.DETAIL_ASSEMBLY_C.scene(n), name);
        await page.evaluate(() => document.fonts.ready);
      };
      const idle = () => page.waitForFunction(() => !window.DETAIL_ASSEMBLY_C.state().busy);
      const tab = async (key) => {
        if (width <= 700 && !(await page.locator("#directory").evaluate((n) => n.open)))
          await page.locator("#directory>summary").click();
        await page.locator(`[data-tab="${key}"]`).click();
      };
      assert.equal((await state()).tab, "ai", "deep link initializes actual section");
      const names = await page.evaluate(() => Object.keys(window.DETAIL_ASSEMBLY_C.scenes));
      assert.equal(names.length, 24);
      for (const name of names) {
        await scene(name);
        await checkPrototypeMetrics(page);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          `${width}/${name}`,
        );
        const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((n) => n.id));
        assert.equal(new Set(ids).size, ids.length, "unique IDs");
        const modal = Boolean(await page.locator("dialog[open]").count());
        const file = `${width}-${name}.png`;
        expected.push(file);
        if (capture) {
          const image = await page.screenshot({
            path: path.join(root, file),
            fullPage: !modal,
            animations: "disabled",
          });
          screenshots.push({ file, scene: name, width, modal, sha256: hash(image) });
        }
      }
      await scene("overview");
      const historyLength = await page.evaluate(() => history.length);
      for (const [key] of data.tabs) {
        await tab(key);
        assert.equal((await state()).tab, key);
        const url = new URL(page.url());
        assert.equal(url.searchParams.get("tab"), key === "overview" ? null : key);
        assert.equal(url.searchParams.get("from"), "/tasks?view=mine");
        assert.equal(url.searchParams.get("retained"), "yes");
        assert.equal(await page.evaluate(() => history.length), historyLength, "replace, not push");
        assert.equal(await page.locator("[aria-current=page]").count(), 1);
        assert.equal(
          await page.locator("#section-title").evaluate((n) => n === document.activeElement),
          true,
        );
        assert.equal(await page.locator("#identity-title").innerText(), data.facts.detail.name);
      }
      await page.locator("#return").click();
      assert.equal((await state()).returnIntent, "/tasks?view=mine");
      await scene("evidence");
      assert.match(await page.locator("main").innerText(), /汇总为 1，但数组为空/);
      for (const key of ["lineage", "feedback"]) {
        await scene(key);
        assert.match(await page.locator("main").innerText(), /未提供/);
      }
      await scene("competition");
      assert.equal(await page.locator("main [data-write]").count(), 0);
      await scene("profit");
      assert.match(await page.locator("main").innerText(), /不能生成可靠 ROI/);
      assert.equal(await page.locator("main [data-write]").count(), 0);
      await scene("feedback");
      await page.locator("#toggle-feedback").click();
      assert.equal(await page.locator("#feedback-form [name]").count(), 11);
      for (const [key, value] of Object.entries(data.feedbackExample))
        if (key !== "observed_at") await page.locator(`[name="${key}"]`).fill(String(value));
      const draft = (await state()).form;
      await tab("risk");
      await tab("feedback");
      assert.deepEqual((await state()).form, draft);
      assert.equal(await page.locator("#f-notes").inputValue(), data.feedbackExample.notes);
      await page.locator("#submit-feedback").click();
      await idle();
      assert.deepEqual((await state()).intents, [data.feedbackIntent]);
      assert.equal((await state()).operation.status, "intent");
      assert.deepEqual((await state()).form, draft, "intent-only never pretends response success");
      await page.locator("#f-returned_units").fill("101");
      await page.locator("#submit-feedback").click();
      assert.equal((await state()).intents.length, 1);
      assert.match(await page.locator("#feedback-error").innerText(), /不能超过/);
      for (const [name, kind] of [
        ["observe-dialog", "observe"],
        ["reject-dialog", "reject"],
        ["approve-dialog", "approved"],
        ["ai-reject-dialog", "rejected"],
      ]) {
        await scene(name);
        const before = (await state()).intents.length;
        await page.locator("#reason").fill(" ");
        assert.equal(await page.locator("#submit-reason").isDisabled(), true);
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.equal((await state()).intents.length, before);
        await scene(name);
        await page.evaluate(() => window.DETAIL_ASSEMBLY_C.outcome("error"));
        await page.locator("#submit-reason").click();
        await idle();
        const expectedIntent = data.decisions[kind] || data.reviewIntents[kind];
        assert.deepEqual((await state()).intents, [expectedIntent]);
        assert.equal(await page.locator("dialog[open]").count(), 1);
        assert.equal(
          await page.locator("#reason").inputValue(),
          kind === "observe" || kind === "reject" ? data.reason : data.reviewReason,
        );
        await page.locator("#submit-reason").click();
        await idle();
        assert.equal((await state()).intents.length, 2);
        assert.equal(await page.locator("dialog[open]").count(), 0);
      }
      // Real user trigger: native dialog focus, cancellation and restoring the original enabled button.
      await scene("ai");
      await page.locator("#approved").click();
      assert.equal(
        await page.locator("#reason").evaluate((n) => n === document.activeElement),
        true,
      );
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab");
        assert.equal(
          await page.evaluate(() =>
            document.querySelector("dialog").contains(document.activeElement),
          ),
          true,
        );
      }
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator("#approved").evaluate((n) => n === document.activeElement),
        true,
      );
      await scene("decision-failure");
      await page.locator("#reason").fill("失败后补充的原因也必须保留");
      await page.locator("#close-reason").click();
      await page.locator("#restore-reason").click();
      assert.equal(await page.locator("#reason").inputValue(), "失败后补充的原因也必须保留");
      await page.keyboard.press("Escape");
      // Complete a held write after leaving its origin: no section or focus hijack, recover original reason.
      await scene("approve-dialog");
      await page.evaluate(() => {
        window.DETAIL_ASSEMBLY_C.hold(true);
        window.DETAIL_ASSEMBLY_C.outcome("error");
      });
      await page.locator("#submit-reason").click();
      assert.equal((await state()).busy, true);
      await page.locator("#close-reason").click();
      await tab("feedback");
      await page.locator("#toggle-feedback").click();
      await page.locator("#f-notes").fill("处理中切区输入仍保留");
      await page.evaluate(() => window.DETAIL_ASSEMBLY_C.finish());
      assert.equal((await state()).tab, "feedback");
      assert.equal(
        await page.locator("#f-notes").evaluate((n) => n === document.activeElement),
        true,
      );
      assert.equal(await page.locator("#f-notes").inputValue(), "处理中切区输入仍保留");
      await page.locator("#restore-reason").click();
      assert.equal((await state()).tab, "ai");
      assert.equal(await page.locator("#reason").inputValue(), data.reviewReason);
      await page.keyboard.press("Escape");
      await scene("ai");
      await page.evaluate(() => {
        window.DETAIL_ASSEMBLY_C.hold(true);
        window.DETAIL_ASSEMBLY_C.outcome("unknown");
      });
      await page.locator("#queue-ai").click();
      await tab("feedback");
      await page.locator("#toggle-feedback").click();
      await page.evaluate(() => window.DETAIL_ASSEMBLY_C.finish());
      assert.equal((await state()).locked, true);
      assert.equal(await page.locator("[data-write]:enabled").count(), 0);
      assert.deepEqual((await state()).intents, [data.reviewIntents.queue]);
      await tab("ai");
      assert.equal(
        await page.locator("#ai-summary").innerText(),
        data.facts.analyses[0].result.content.summary,
      );
      assert.equal(await page.locator("[data-write]:enabled").count(), 0);
      // A callback from a reset scenario must be ignored, not attached to the new scenario.
      await scene("ai");
      await page.locator("#queue-ai").click();
      await scene("feedback");
      await page.waitForTimeout(250);
      assert.equal((await state()).operation, null);
      assert.deepEqual((await state()).intents, []);
      await scene("ai-read-error");
      assert.equal(await page.locator("#approved,#rejected").count(), 0);
      await page.locator("#retry-ai").click();
      assert.equal((await state()).aiRead, "ready");
      await scene("forbidden");
      assert.equal(await page.locator("main [data-write]").count(), 0);
      await scene("readonly");
      assert.equal(await page.locator("main [data-write]").count(), 0);
      await scene("main-read-error");
      await page.locator("#retry-main").click();
      assert.equal((await state()).scope, "ready");
      assert.deepEqual(
        await page.evaluate(() => window.DETAIL_ASSEMBLY_C_DATA.facts),
        data.facts,
        "facts never rewritten",
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(
        await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
        { local: 0, session: 0 },
      );
      reports.push({
        width,
        scenes: names.length,
        httpRequests: 0,
        consoleErrors: 0,
        storageEntries: 0,
        sections: 10,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
assert.deepEqual(
  (await readdir(root)).filter((f) => f.endsWith(".png")).sort(),
  [...expected].sort(),
);
if (capture)
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        version: data.version,
        approval: "pending",
        sourceHashes,
        screenshots,
        reports,
        boundary: data.boundary,
      },
      null,
      2,
    ) + "\n",
  );
else
  assert.deepEqual(
    previous.screenshots.map((s) => s.file),
    expected,
  );
console.log(JSON.stringify({ result: "passed", capture, screenshots: expected.length, reports }));
