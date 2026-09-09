import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { verifyAppearanceSource } from "./verify-ui-phase2-appearance-source.mjs";

const root = "design-plans/ui-phase-2-2026-09-07/design/appearance-direction-c";
const capture = process.argv.includes("--capture");
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const sourcePaths = [
  "apps/web/src/components/ThemeStudio.vue",
  "apps/web/src/design/theme.ts",
  "apps/api/src/ui-preference-routes.ts",
  "packages/preferences/src/index.ts",
  "design-plans/ui-phase-2-2026-09-07/DIRECTION-DECISION-C.md",
  "design-plans/ui-phase-2-2026-09-07/design/theme-direction-c/README.md",
  "scripts/verify-ui-phase2-appearance-source.mjs",
  "scripts/verify-ui-phase2-appearance-c.mjs",
  ...["index.html", "appearance.css", "appearance.js"].map((f) => root + "/" + f),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sourcePaths.map(async (f) => [f, hash((await readFile(f, "utf8")).replaceAll("\r\n", "\n"))]),
  ),
);
const sourceProof = await verifyAppearanceSource();
let old;
if (!capture) {
  old = JSON.parse(await readFile(root + "/evidence.json", "utf8"));
  assert.deepEqual(old.sourceHashes, sourceHashes);
  for (const s of old.screenshots)
    assert.equal(hash(await readFile(root + "/" + s.file)), s.sha256);
}
const browser = await chromium.launch({ headless: true }),
  errors = [],
  http = [],
  screenshots = [],
  checks = [],
  actionIds = new Set();
let scenes;
async function layout(page, label) {
  const data = await page.evaluate(() => {
    const visible = (n) => n.getClientRects().length && getComputedStyle(n).visibility !== "hidden";
    return [...document.querySelectorAll("#app button,#app a,#app summary")]
      .filter(visible)
      .map((n) => ({
        text: n.textContent.trim().slice(0, 30),
        font: parseFloat(getComputedStyle(n).fontSize),
        width: n.getBoundingClientRect().width,
        height: n.getBoundingClientRect().height,
      }))
      .filter((n) => n.font < 16 || n.width < 43.9 || n.height < 43.9);
  });
  assert.deepEqual(data, [], label + " touch/font");
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    label + " overflow",
  );
  const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((n) => n.id));
  assert.equal(ids.length, new Set(ids).size);
  assert.equal(await page.locator("dialog").count(), 0);
}
async function shot(page, width, id) {
  const file = `${width}-${id}.png`;
  if (capture) {
    await page.screenshot({ path: root + "/" + file, fullPage: true, animations: "disabled" });
    screenshots.push({
      file,
      pageId: "P10",
      scene: id,
      width,
      sha256: hash(await readFile(root + "/" + file)),
    });
  } else
    assert.ok(
      old.screenshots.some((s) => s.file === file),
      file,
    );
}
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
      locale: "zh-CN",
    });
    try {
      await context.route(/^https?:/, (r) => {
        http.push(r.request().url());
        return r.abort();
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(pathToFileURL(path.resolve(root, "index.html")).href);
      await page.evaluate(() => document.body.classList.add("capture"));
      scenes = await page.evaluate(() => window.appearanceReview.scenes);
      const scene = async (id) => {
        await page.evaluate((v) => window.appearanceReview.choose(v), id);
        await layout(page, `${width}:${id}`);
      };
      for (const s of scenes) {
        await scene(s.id);
        for (const id of await page
          .locator("[data-action]")
          .evaluateAll((nodes) => nodes.map((n) => n.dataset.action)))
          actionIds.add(id);
        await shot(page, width, s.id);
      }
      await scene("deep-ocean-standard");
      const themeGroup = page.getByRole("radiogroup", { name: "界面主题" }),
        densityGroup = page.getByRole("radiogroup", { name: "页面密度" });
      await themeGroup.getByRole("radio").first().focus();
      for (const [key, expected] of [
        ["ArrowRight", "aurora-purple"],
        ["End", "cloud-white"],
        ["ArrowRight", "deep-ocean"],
        ["ArrowLeft", "cloud-white"],
        ["Home", "deep-ocean"],
      ]) {
        await page.keyboard.press(key);
        assert.equal(
          (await page.evaluate(() => window.appearanceReview.current())).theme,
          expected,
        );
        assert.equal(await themeGroup.locator('[tabindex="0"]').count(), 1);
        assert.equal(await page.evaluate(() => document.activeElement.dataset.value), expected);
      }
      await densityGroup.getByRole("radio").first().focus();
      await page.keyboard.press("ArrowDown");
      assert.equal(
        (await page.evaluate(() => window.appearanceReview.current())).density,
        "compact",
      );
      assert.equal(
        await page.getByRole("button", { name: "保存主题", exact: true }).isDisabled(),
        true,
      );
      await themeGroup.getByRole("radio").nth(1).click();
      await page.getByRole("button", { name: "撤销预览" }).click();
      assert.equal(
        (await page.evaluate(() => window.appearanceReview.current())).density,
        "compact",
      );
      checks.push(
        `${width}: radio arrows/wrap/Home/End and one-tab-stop; density-only disables save; restore preserves density`,
      );
      await scene("dirty");
      await page.evaluate(() => window.appearanceReview.resetEvents());
      const during = await page.evaluate(() => {
        document.querySelector('[data-action="TH-SAVE"]').click();
        document.querySelector('[data-action="TH-RESTORE"]').click();
        document.querySelector('[data-value="cloud-white"]').click();
        return {
          state: window.appearanceReview.current(),
          disabled: [
            ...document.querySelectorAll(
              '[role="radio"], [data-action="TH-SAVE"], [data-action="TH-RESTORE"]',
            ),
          ].every((el) => el.disabled),
        };
      });
      assert.equal(during.state.status, "saving");
      assert.equal(during.disabled, true);
      assert.equal(during.state.theme, "aurora-purple");
      await page.waitForFunction(() => window.appearanceReview.current().status === "saved");
      const events = await page.evaluate(() => window.appearanceReview.events());
      assert.equal(events.length, 1);
      assert.deepEqual(events[0].body, { theme: "aurora-purple", expected_version: 1 });
      assert.equal(
        await page.getByRole("button", { name: "保存主题", exact: true }).isDisabled(),
        true,
      );
      await scene("saved-different");
      assert.match(await page.locator(".notice").innerText(), /仍有差异/);
      assert.equal(
        await page.getByRole("button", { name: "保存主题", exact: true }).isDisabled(),
        false,
      );
      await scene("conflict");
      await page.getByRole("button", { name: "刷新偏好" }).click();
      await page.waitForFunction(() => window.appearanceReview.current().status === "ready");
      assert.equal((await page.evaluate(() => window.appearanceReview.current())).version, 2);
      await themeGroup.getByRole("radio").first().click();
      await page.getByRole("button", { name: "保存主题", exact: true }).click();
      await page.waitForFunction(() => window.appearanceReview.current().status === "saved");
      assert.equal(
        (await page.evaluate(() => window.appearanceReview.events())).at(-1).body.expected_version,
        2,
      );
      checks.push(
        `${width}: proposed busy lock, exact inert PUT, saved+dirty distinction, conflict GET then explicit new-version save`,
      );
      for (const [id, action, target] of [
        ["expired", "AC-LOGIN", "/login"],
        ["scope", "AC-CONTEXT", "/select-context"],
        ["default", "AC-PROFILE", "/me"],
        ["default", "AC-MFA", "/security/mfa"],
        ["default", "TH-ROUTE", "/settings/theme"],
        ["default", "AC-ROOT", "/"],
      ]) {
        await scene(id);
        await page.locator(`[data-action="${action}"]`).click();
        assert.equal(
          (await page.evaluate(() => window.appearanceReview.events())).at(-1).route,
          target,
        );
      }
      for (const id of ["rate-limited", "service-error"]) {
        await scene(id);
        assert.equal(await page.locator('[data-action="AC-CONTEXT"]').count(), 0);
      }
      checks.push(
        `${width}: six route targets; rate/network failures do not imply missing workspace`,
      );
      const selectors = [
        ['[data-action="TH-PREVIEW"][data-value="deep-ocean"]', "theme-blue"],
        ['[data-action="TH-PREVIEW"][data-value="aurora-purple"]', "theme-mist"],
        ['[data-action="TH-PREVIEW"][data-value="cloud-white"]', "theme-white"],
        ['[data-action="TH-DENSITY"][data-value="standard"]', "density-standard"],
        ['[data-action="TH-DENSITY"][data-value="compact"]', "density-compact"],
        ['[data-action="TH-SAVE"]', "save"],
        ['[data-action="TH-RESTORE"]', "restore"],
      ];
      for (const [selector, key] of selectors) {
        await scene("dirty");
        const control = page.locator(selector);
        await control.hover();
        await shot(page, width, key + "-hover");
        await control.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        // Unselected radios are roving-tabindex=-1; switch to keyboard modality then focus the exact radio.
        await control.focus();
        assert.notEqual(await control.evaluate((el) => getComputedStyle(el).outlineStyle), "none");
        await shot(page, width, key + "-focus");
        const rect = await control.boundingBox();
        await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
        await page.mouse.down();
        await shot(page, width, key + "-pressed");
        await page.mouse.move(1, 1);
        await page.mouse.up();
      }
      for (const testWidth of [360, 768, 820, 821, 1024, 1920]) {
        await page.setViewportSize({ width: testWidth, height: 1000 });
        for (const s of scenes.slice(0, 6)) await scene(s.id);
      }
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => (document.documentElement.style.zoom = "2"));
      for (const id of ["dirty", "conflict", "cloud-white-compact"]) await scene(id);
      await page.evaluate(() => (document.documentElement.style.zoom = ""));
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      checks.push(
        `${width}: seven controls hover/focus/pressed; three themes/two densities at eight widths plus 200% zoom; 16px/44px; no dialogs or storage`,
      );
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(http, []);
  if (capture) {
    await writeFile(
      root + "/evidence.json",
      JSON.stringify(
        {
          proposal: "APPEARANCE-C-r1",
          kind: "page-proposal",
          approval: "pending-user-review",
          sourceHashes,
          sourceProof,
          scenes: scenes.length,
          checks,
          actionIds: [...actionIds].sort(),
          screenshots,
          errors,
          httpRequests: 0,
        },
        null,
        2,
      ) + "\n",
    );
    const gallery =
      `正式图${screenshots.length}张，${scenes.length}个整页场景，另含七控件的悬停/焦点/按下状态。\n\n| 场景 | 桌面 | 手机 |\n| --- | --- | --- |\n` +
      scenes
        .map((s) => `| ${s.label} | [1440](1440-${s.id}.png) | [390](390-${s.id}.png) |`)
        .join("\n") +
      "\n\n控件图：\n\n" +
      screenshots
        .filter((s) => /-(hover|focus|pressed)\.png$/.test(s.file))
        .map((s) => `- [${s.file}](${s.file})`)
        .join("\n");
    await writeFile(
      root + "/README.md",
      (await readFile(root + "/README.md", "utf8")).replace(
        /<!-- GALLERY:START -->[\s\S]*?<!-- GALLERY:END -->/,
        `<!-- GALLERY:START -->\n${gallery}\n<!-- GALLERY:END -->`,
      ),
    );
  }
  const images = capture ? screenshots : old.screenshots;
  assert.deepEqual(
    (await readdir(root)).filter((f) => f.endsWith(".png")).sort(),
    images.map((s) => s.file).sort(),
  );
  console.log(
    JSON.stringify({
      mode: capture ? "capture" : "verify",
      scenes: scenes.length,
      pngs: images.length,
      sourceGroups: sourceProof.count,
      actions: actionIds.size,
      errors,
      http: http.length,
    }),
  );
} finally {
  await browser.close();
}
