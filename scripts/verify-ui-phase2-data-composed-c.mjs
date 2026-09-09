import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { buildDataRecordsDesignData } from "./lib/ui-phase2-data-records-design-data.mjs";
import { buildDataQualityDesignData } from "./lib/ui-phase2-data-quality-design-data.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "design-plans/ui-phase-2-2026-09-07/design";
const relative = `${base}/data-composed-direction-c`,
  root = path.join(repo, relative);
assert.ok(process.argv.slice(2).every((v) => ["--capture", "--smoke"].includes(v)));
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(!(capture && smoke));
const read = (file) => readFile(path.join(repo, file), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");
execFileSync(process.execPath, ["scripts/build-ui-phase2-data-composed-c.mjs"], { cwd: repo });
const recordsData = await buildDataRecordsDesignData(repo),
  qualityData = await buildDataQualityDesignData(repo);
const sourcePaths = new Set();
for (const key of ["records", "quality"]) {
  const evidence = JSON.parse(await read(`${base}/data-${key}-direction-c/evidence.json`));
  for (const file of Object.keys(evidence.sourceHashes)) sourcePaths.add(file);
  sourcePaths.add(`${base}/data-${key}-direction-c/evidence.json`);
}
for (const file of [
  "index.html",
  "composed.js",
  "composed.css",
  "component-overrides.css",
  "records-scoped.js",
  "records-scoped.css",
  "quality-scoped.js",
  "quality-scoped.css",
  "templates.js",
])
  sourcePaths.add(`${relative}/${file}`);
sourcePaths.add("scripts/build-ui-phase2-data-composed-c.mjs");
sourcePaths.add("scripts/verify-ui-phase2-data-composed-c.mjs");
sourcePaths.add(`${base}/credential-assets-direction-c/credentials.css`);
const sourceHashes = Object.fromEntries(
  await Promise.all(
    [...sourcePaths].map(async (file) => [file, hash((await read(file)).replaceAll("\r\n", "\n"))]),
  ),
);
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await read(`${relative}/evidence.json`));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
const screenshots = [],
  expectedFiles = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const viewport = { width, height: width === 390 ? 844 : 1000 };
    const context = await browser.newContext({
      viewport,
      locale: "zh-CN",
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
      await page.waitForFunction(() => !!window.DATA_COMPOSED_C);
      assert.deepEqual(await page.evaluate(() => window.DATA_RECORDS_DATA), recordsData.data);
      assert.deepEqual(await page.evaluate(() => window.DATA_QUALITY_DATA), qualityData.data);
      const show = (s) => page.evaluate((v) => window.DATA_COMPOSED_C.scene(v), s);
      const state = (k) => page.evaluate((v) => window.DATA_COMPOSED_C.controls[v].state(), k);
      const pane = (k) => page.locator(`#${k}-pane`);
      const select = async (k) => {
        await page.locator(`[data-view="${k}"]`).click();
        assert.equal(await page.evaluate(() => window.DATA_COMPOSED_C.active()), k);
      };
      const metrics = async () => {
        const value = await page.evaluate(() => {
          const c = window.DATA_COMPOSED_C,
            root = c.roots[c.active()];
          const modal = root.querySelector("dialog[open]"),
            scopes = modal ? [modal] : [root, document.querySelector(".page-head")];
          const nodes = scopes.flatMap((s) => [...s.querySelectorAll("*")]);
          const visible = (n) =>
            n.getClientRects().length && getComputedStyle(n).visibility !== "hidden";
          const controls = nodes.filter(
            (n) =>
              n.matches("button,input,select,textarea") &&
              visible(n) &&
              !["checkbox", "hidden"].includes(n.type),
          );
          const violations = controls.flatMap((n) => {
            const r = n.getBoundingClientRect(),
              font = parseFloat(getComputedStyle(n).fontSize);
            return r.width < 43.9 || r.height < 43.9 || font < 16
              ? [{ id: n.id, width: r.width, height: r.height, font }]
              : [];
          });
          const texts = nodes.filter(
            (n) =>
              visible(n) &&
              !n.matches("style,script,option") &&
              [...n.childNodes].some((v) => v.nodeType === 3 && v.textContent.trim()),
          );
          const minText = Math.min(...texts.map((n) => parseFloat(getComputedStyle(n).fontSize)));
          const ids = [...root.querySelectorAll("[id]")].map((n) => n.id);
          const references = [
            ...root.querySelectorAll("[aria-labelledby],[aria-describedby]"),
          ].flatMap((n) =>
            ["aria-labelledby", "aria-describedby"].flatMap((a) =>
              (n.getAttribute(a) || "")
                .split(/\s+/)
                .filter(Boolean)
                .filter((id) => visible(n) && !root.getElementById(id)),
            ),
          );
          return {
            controlsChecked: controls.length,
            textNodesChecked: texts.length,
            minText,
            violations,
            duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
            references,
            overflow: document.documentElement.scrollWidth > innerWidth,
            openDialogs: Object.values(c.roots).reduce(
              (n, r) => n + r.querySelectorAll("dialog[open]").length,
              0,
            ),
          };
        });
        assert.ok(value.controlsChecked > 0 && value.minText >= 13);
        assert.deepEqual(value.violations, []);
        assert.deepEqual(value.duplicateIds, []);
        assert.deepEqual(value.references, []);
        assert.equal(value.overflow, false);
        assert.ok(value.openDialogs <= 1);
        return value;
      };
      const shot = async (name) => {
        const measure = await metrics();
        const fullPage = measure.openDialogs === 0;
        const file = `${width}-${name.replaceAll(":", "-")}.png`;
        expectedFiles.push(file);
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
            metrics: measure,
            sha256: hash(await readFile(path.join(root, file))),
          });
        }
      };
      await show("records:query-draft");
      const draft = (await state("records")).queryDraft;
      await select("quality");
      await pane("quality").locator('[data-tab="issues"]').click();
      await pane("quality").locator("[data-select]").filter({ visible: true }).first().check();
      const selected = (await state("quality")).selected;
      await pane("quality").locator("#search").fill(" 未匹配样例 ");
      await select("records");
      assert.equal((await state("records")).queryDraft, draft);
      await shot("continuity-record-draft");
      await select("quality");
      assert.deepEqual((await state("quality")).selected, selected);
      assert.equal((await state("quality")).query, " 未匹配样例 ");
      await shot("continuity-hidden-quality-selection");
      // A delayed hidden records callback must not replace the visible quality URL or snapshot.
      await show("records:scope-pending");
      const pending = (await state("records")).pending;
      await select("quality");
      const qualityBefore = await state("quality"),
        qualityUrl = page.url();
      await page.evaluate((id) => window.DATA_RECORDS_C.complete("success", id), pending.id);
      assert.equal(page.url(), qualityUrl);
      assert.deepEqual(await state("quality"), qualityBefore);
      await select("records");
      assert.equal((await state("records")).scope.entity, "suppliers");
      assert.equal(new URL(page.url()).searchParams.get("entity"), "suppliers");
      await shot("continuity-record-response");
      await show("records:export-running");
      await select("quality");
      await page.evaluate(() => window.DATA_RECORDS_C.complete("unknown"));
      await shot("continuity-hidden-export-unknown");
      await select("records");
      assert.equal(await pane("records").locator("#export-open").isDisabled(), true);
      await shot("continuity-export-unknown-return");
      // Quality's failed page read preserves both its page and the independent records draft.
      await show("quality:page-wait");
      const qualityPending = (await state("quality")).pending;
      await select("records");
      const before = await state("records"),
        recordUrl = page.url();
      await page.evaluate(
        (token) => window.DATA_QUALITY_C.complete("error", token),
        qualityPending.token,
      );
      assert.equal(page.url(), recordUrl);
      assert.deepEqual(await state("records"), before);
      await select("quality");
      assert.equal((await state("quality")).page, 1);
      await shot("continuity-quality-page-failed");
      await show("quality:page-last");
      await select("records");
      await select("quality");
      assert.equal(new URL(page.url()).searchParams.get("quality_page"), "2");
      await shot("continuity-quality-page-return");
      await show("records:export");
      assert.equal(await page.evaluate(() => window.DATA_COMPOSED_C.select("quality")), false);
      await page.keyboard.press("Escape");
      assert.equal(
        await pane("records")
          .locator("#export-open")
          .evaluate((n) => n.getRootNode().activeElement === n),
        true,
      );
      await select("quality");
      const evidenceButton = pane("quality").locator(
        width === 390 ? "#mobile-evidence-0" : "#evidence-0",
      );
      await evidenceButton.click();
      for (let i = 0; i < 9; i++) {
        await page.keyboard.press(i % 2 ? "Shift+Tab" : "Tab");
        assert.equal(
          await page.evaluate(() => {
            const r = window.DATA_COMPOSED_C.roots.quality;
            return r.querySelector("#modal").contains(r.activeElement);
          }),
          true,
        );
      }
      await page.keyboard.press("Escape");
      assert.equal(await evidenceButton.evaluate((n) => n.getRootNode().activeElement === n), true);
      await show("quality:batch-busy");
      await pane("quality").locator("#composed-outcome summary").click();
      await pane("quality").locator('[data-composed-outcome="read-failed"]').click();
      assert.match((await state("quality")).result, /写入已确认/);
      assert.match((await state("quality")).notice, /随后读取失败/);
      await page.keyboard.press("Escape");
      await select("records");
      await select("quality");
      await shot("continuity-quality-write-read-failed");
      if (!smoke) {
        for (const scene of await page.evaluate(() => Object.keys(window.DATA_COMPOSED_C.scenes))) {
          await show(scene);
          if (scene.endsWith(":hover") || scene.endsWith(":pressed")) {
            const key = scene.split(":")[0];
            const button = pane(key).locator(key === "records" ? "#export-open" : "#refresh");
            await button.hover();
            if (scene.endsWith(":pressed")) await page.mouse.down();
          }
          await shot(scene);
          if (scene.endsWith(":pressed")) {
            await page.mouse.move(0, 0);
            await page.mouse.up();
          }
        }
        for (const [scene, button] of [
          ["records:long-detail", "#record-dialog footer button"],
          ["records:export-max", "#export-submit"],
          ["quality:long-lineage", "#cancel"],
          ["quality:resolve-limit", "#preview"],
          ["quality:batch-assign-confirm", "#submit"],
        ]) {
          await show(scene);
          const target = pane(scene.split(":")[0]).locator(button).first();
          await target.scrollIntoViewIfNeeded();
          assert.equal(
            await target.evaluate((n) => {
              const r = n.getBoundingClientRect(),
                d = n.closest("dialog").getBoundingClientRect();
              return (
                r.top >= Math.max(0, d.top) &&
                r.bottom <= Math.min(innerHeight, d.bottom) &&
                n.getRootNode().elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === n
              );
            }),
            true,
          );
          await shot(`${scene}-footer`);
        }
        for (const key of ["records", "quality"]) {
          for (const visual of ["hover", "focus", "pressed"]) {
            await show(`${key}:default`);
            const button = page.locator(`[data-view="${key}"]`);
            await button.hover();
            if (visual === "focus") {
              await page.mouse.move(0, 0);
              await page.keyboard.press("Tab");
              await button.focus();
              assert.equal(await button.evaluate((n) => n.matches(":focus-visible")), true);
            }
            if (visual === "pressed") {
              await page.mouse.down();
              assert.equal(await button.evaluate((n) => n.matches(":active")), true);
            }
            await shot(`workspace-${key}-${visual}`);
            if (visual === "pressed") {
              await page.mouse.move(0, 0);
              await page.mouse.up();
            }
          }
        }
        for (const nextWidth of [768, 1024, 720]) {
          await page.setViewportSize({ width: nextWidth, height: 1000 });
          for (const s of [
            "records:default",
            "records:export",
            "quality:issues",
            "quality:lineage",
            "quality:batch-confirm",
          ]) {
            await show(s);
            await metrics();
          }
        }
      }
      assert.equal(await page.locator("iframe").count(), 0);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      console.log(
        `data_composed width=${width} isolation/draft/selection/late-response/URL/modal passed HTTP=0 storage=0`,
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
        version: "DATA-COMPOSED-C-r1",
        approval: "pending",
        kind: "persistent-scoped-components-offline-proposal",
        sourceHashes,
        boundary:
          "Same document, no iframe. No Vue mount, history traversal, deep-link restore, SQL, grant, audit, or deployment acceptance. Existing independent operation contracts remain proposals. Scoped ID uniqueness does not require globally unique IDs across shadow roots.",
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    path.join(root, "gallery.html"),
    [
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P54 同页组合图册</title>',
      "<style>body{font:16px sans-serif;margin:24px;background:#f3f6fa}img{max-width:100%;height:auto}figure{margin:32px 0}</style>",
      '<h1>P54 同页组合 · 具体页面待审</h1><a href="index.html">打开交互稿</a>',
      ...screenshots.map(
        (s) =>
          `<figure><figcaption>${s.scene} · ${s.viewport.width}</figcaption><img loading="lazy" src="${s.file}" alt="${s.scene}"></figure>`,
      ),
      "</html>",
    ].join("\n"),
  );
} else if (!smoke)
  assert.deepEqual(
    previous.screenshots.map((s) => s.file),
    expectedFiles,
  );
