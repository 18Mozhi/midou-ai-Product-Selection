import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { buildDetailAssemblyData } from "./lib/ui-phase2-detail-assembly-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/detail-adaptive-direction-c";
const root = path.join(repo, relative);
const parent = "design-plans/ui-phase-2-2026-09-07/design/detail-assembly-direction-c";
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const parentEvidence = JSON.parse(await readFile(path.join(repo, parent, "evidence.json"), "utf8"));
const sources = [
  ...new Set([
    ...Object.keys(parentEvidence.sourceHashes),
    `${parent}/evidence.json`,
    ...["index.html", "adaptive.css", "adaptive.js"].map((file) => `${relative}/${file}`),
    "scripts/verify-ui-phase2-detail-adaptive-c.mjs",
  ]),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sources.map(async (file) => [
      file,
      hash((await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n")),
    ]),
  ),
);
const data = await buildDetailAssemblyData(repo);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
async function checkContrast(page) {
  const result = await page.evaluate(() => {
    const rgb = (value) => value.match(/[\d.]+/g)?.map(Number);
    const luminance = (color) =>
      color
        .slice(0, 3)
        .map((n) => n / 255)
        .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
        .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
    const scope = document.querySelector("dialog[open]") || document.body;
    const checked = [];
    for (const node of scope.querySelectorAll("*")) {
      if (!node.checkVisibility() || ["SCRIPT", "STYLE", "OPTION"].includes(node.tagName)) continue;
      if (
        ![...node.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) &&
        !node.matches("input,textarea,select")
      )
        continue;
      const style = getComputedStyle(node),
        foreground = rgb(style.color);
      let ancestor = node,
        background;
      while (ancestor) {
        const color = rgb(getComputedStyle(ancestor).backgroundColor);
        if (color && (color.length === 3 || color[3] === 1)) {
          background = color;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      if (!background) throw new Error("No opaque background in proposal");
      const a = luminance(foreground),
        b = luminance(background);
      checked.push({
        text: (node.id || node.textContent).trim().slice(0, 45),
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      });
    }
    return {
      checked: checked.length,
      minimum: Math.min(...checked.map((x) => x.ratio)),
      violations: checked.filter((x) => x.ratio < 4.5),
    };
  });
  assert.ok(result.checked > 0);
  assert.deepEqual(
    result.violations,
    [],
    "Opaque prototype text contrast >=4.5; not a full accessibility audit",
  );
  return result;
}
const controls = [
  ["return", "overview", "#return"],
  ["tab", "directory-open", '[data-tab="ai"]'],
  ["jump", "risk", '[data-jump="evidence"]'],
  ["queue-ai", "ai", "#queue-ai"],
  ["retry-ai", "ai-read-error", "#retry-ai"],
  ["retry-main", "main-read-error", "#retry-main"],
  ["toggle-feedback", "feedback", "#toggle-feedback"],
  ["submit-reason", "observe-dialog", "#submit-reason"],
  ["cancel-reason", "observe-dialog", "#cancel-reason"],
  ["close-reason", "observe-dialog", "#close-reason"],
];
const screenshots = [],
  expected = [],
  reports = [];
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
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      await page.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      const entry = pathToFileURL(path.join(root, "index.html"));
      entry.searchParams.set("from", "/tasks?view=mine");
      entry.searchParams.set("tab", "ai");
      await page.goto(entry.href);
      assert.deepEqual(await page.evaluate(() => window.DETAIL_ASSEMBLY_C_DATA), data);
      const state = () => page.evaluate(() => window.DETAIL_ASSEMBLY_C.state());
      const show = async (name) => {
        await page.evaluate((n) => window.DETAIL_ADAPTIVE_REVIEW.show(n), name);
        await page.evaluate(() => document.fonts.ready);
      };
      const shot = async (name) => {
        const metrics = await checkPrototypeMetrics(page),
          contrast = await checkContrast(page);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          name,
        );
        const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((n) => n.id));
        assert.equal(ids.length, new Set(ids).size);
        const modal = (await page.locator("dialog[open]").count()) > 0;
        const file = `${width}-${name}.png`;
        expected.push(file);
        if (capture) {
          const buffer = await page.screenshot({
            path: path.join(root, file),
            fullPage: !modal,
            animations: "disabled",
          });
          screenshots.push({
            file,
            scene: name,
            viewport,
            modal,
            fullPage: !modal,
            approval: "pending",
            metrics,
            contrast,
            sha256: hash(buffer),
          });
        }
      };
      assert.equal((await state()).tab, "ai");
      const scenes = await page.evaluate(() => window.DETAIL_ADAPTIVE_REVIEW.scenes);
      for (const scene of scenes) {
        await show(scene);
        await shot(scene);
        if (scene.endsWith("--busy")) {
          assert.equal((await state()).busy, true);
          assert.equal(await page.locator("#submit-reason").isDisabled(), true);
          assert.equal(await page.locator("#reason").getAttribute("readonly"), "");
          assert.equal(await page.locator("#reason-form").getAttribute("aria-busy"), "true");
          assert.equal(await page.locator("#finish-preview").isDisabled(), false);
        }
        if (scene === "pending-elsewhere")
          assert.equal(await page.locator("#finish-preview").isDisabled(), true);
        if (scene.endsWith("--disabled"))
          assert.equal(await page.locator("#submit-reason").isDisabled(), true);
        if (scene.endsWith("--unknown")) assert.equal((await state()).locked, true);
        if (scene === "feedback-busy") {
          assert.equal((await state()).busy, true);
          assert.equal(await page.locator("#submit-feedback").isDisabled(), true);
          assert.equal(await page.locator("#work").getAttribute("aria-busy"), "true");
          assert.equal((await state()).intents.length, 1);
        }
        if (scene === "feedback-invalid") {
          assert.equal((await state()).intents.length, 0);
          assert.match(await page.locator("#feedback-error").innerText(), /退货量不能超过/);
          assert.equal(
            await page.locator("#f-returned_units").evaluate((node) => node.validity.valid),
            false,
          );
        }
        if (scene === "feedback-long") {
          assert.equal((await page.locator("#f-source_ref").inputValue()).length, 255);
          assert.equal((await page.locator("#f-notes").inputValue()).length, 1000);
        }
        if (scene.endsWith("--long-error")) {
          assert.equal(
            await page.locator("#reason").inputValue(),
            await page.evaluate(() => window.DETAIL_ADAPTIVE_REVIEW.longReason),
          );
          await page.locator("#cancel-reason").scrollIntoViewIfNeeded();
          await shot(`${scene}-footer`);
          for (const selector of ["#cancel-reason", "#submit-reason"])
            assert.equal(
              await page.locator(selector).evaluate((node) => {
                const r = node.getBoundingClientRect();
                return (
                  r.top >= 0 &&
                  r.bottom <= innerHeight &&
                  node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
                );
              }),
              true,
              "long dialog footer action visible and unobscured",
            );
          await page.locator("#cancel-reason").click();
          await page.locator("#restore-reason").click();
          assert.equal(
            await page.locator("#reason").inputValue(),
            await page.evaluate(() => window.DETAIL_ADAPTIVE_REVIEW.longReason),
          );
        }
      }
      for (const theme of ["light", "dark", "contrast"])
        for (const density of ["comfortable", "compact"]) {
          await page.locator("#theme").selectOption(theme);
          await page.locator("#density").selectOption(density);
          for (const scene of [
            ...data.tabs.map(([key]) => key),
            "observe-dialog",
            "reject-dialog",
            "approve-dialog",
            "ai-reject-dialog",
            "feedback-long",
          ]) {
            await show(scene);
            await shot(`${scene}-${theme}-${density}`);
            if (await page.locator("dialog[open]").count()) await page.keyboard.press("Escape");
          }
        }
      await page.locator("#theme").selectOption("light");
      await page.locator("#density").selectOption("comfortable");
      for (const [key, scene, selector] of controls) {
        for (const visual of ["hover", "focus", "pressed"]) {
          await show(scene);
          const target = page.locator(selector);
          await target.scrollIntoViewIfNeeded();
          await target.hover();
          if (visual === "focus") {
            await page.mouse.move(0, 0);
            await page.keyboard.press("Tab");
            await target.focus();
            assert.equal(await target.evaluate((node) => node.matches(":focus-visible")), true);
          }
          if (visual === "pressed") {
            await page.mouse.down();
            assert.equal(await target.evaluate((node) => node.matches(":active")), true);
          }
          await shot(`control-${key}-${visual}`);
          if (visual === "pressed") {
            await page.mouse.move(0, 0);
            await page.mouse.up();
          }
        }
      }
      await show("feedback-long");
      const draft = (await state()).form,
        initialHistory = await page.evaluate(() => history.length);
      for (const [key] of data.tabs) {
        if (width < 701 && !(await page.locator("#directory").evaluate((node) => node.open)))
          await page.locator("#directory>summary").click();
        await page.locator(`[data-tab="${key}"]`).click();
        assert.equal((await state()).tab, key);
        assert.deepEqual((await state()).form, draft);
        assert.equal(new URL(page.url()).searchParams.get("from"), "/tasks?view=mine");
        assert.equal(await page.evaluate(() => history.length), initialHistory);
      }
      for (const name of [
        "observe-dialog",
        "reject-dialog",
        "approve-dialog",
        "ai-reject-dialog",
      ]) {
        await show(name);
        for (const key of ["Tab", "Shift+Tab"])
          for (let i = 0; i < 7; i++) {
            await page.keyboard.press(key);
            assert.equal(
              await page.evaluate(() =>
                document.querySelector("dialog").contains(document.activeElement),
              ),
              true,
            );
          }
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("dialog[open]").count(), 0);
      }
      for (const narrow of [768, 1024, 700, 701, 720]) {
        await page.setViewportSize({ width: narrow, height: 1000 });
        for (const scene of ["overview", "feedback-long", "observe-dialog--long-error"]) {
          await show(scene);
          await checkPrototypeMetrics(page);
          await checkContrast(page);
          assert.ok(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          );
        }
      }
      assert.deepEqual(await page.evaluate(() => window.DETAIL_ASSEMBLY_C_DATA.facts), data.facts);
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(await context.cookies(), []);
      reports.push({
        width,
        baseScenes: scenes.length,
        httpRequests: 0,
        errors: 0,
        storage: 0,
        factsUnchanged: true,
      });
      console.log(
        `detail_adaptive_c width=${width} themes/density/long-dialog/contrast/controls/drafts passed`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
assert.deepEqual(
  (await readdir(root)).filter((file) => file.endsWith(".png")).sort(),
  [...expected].sort(),
);
if (capture) {
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        version: "DETAIL-ADAPTIVE-C-r1",
        approval: "pending",
        kind: "P18-adaptive-extension-of-single-opportunity-proposal",
        sourceHashes,
        reports,
        controls,
        boundary:
          "Same unchanged opportunity701, no invented populated cost/evidence/permissions. Four available reason variants only; adopt remains absent. Opaque text contrast not complete accessibility. No browser zoom, live Vue/router/HTTP/SQL/production acceptance.",
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    path.join(root, "gallery.html"),
    [
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P18 自适应图集</title>',
      "<style>body{font:16px sans-serif;background:#edf1f6;margin:24px}img{max-width:100%;height:auto}figure{margin:32px 0}</style>",
      `<h1>P18 自适应图集 · ${screenshots.length} 图 · 待审</h1><a href="index.html">打开交互稿</a>`,
      ...screenshots.map(
        (shot) =>
          `<figure><figcaption>${shot.viewport.width} / ${shot.scene}</figcaption><img loading="lazy" src="${shot.file}" alt="${shot.scene}" /></figure>`,
      ),
      "</html>",
    ].join("\n"),
  );
} else
  assert.deepEqual(
    previous.screenshots.map((shot) => shot.file),
    expected,
  );
