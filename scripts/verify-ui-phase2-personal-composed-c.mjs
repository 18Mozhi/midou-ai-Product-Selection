import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { buildPersonalSectionsData } from "./lib/ui-phase2-personal-sections-data.mjs";
import { checkPrototypeMetrics } from "./lib/ui-phase2-prototype-metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/personal-composed-direction-c";
const root = path.join(repo, relative);
assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));
const capture = process.argv.includes("--capture");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const oldEvidence = JSON.parse(
  await readFile(
    path.join(
      repo,
      "design-plans/ui-phase-2-2026-09-07/design/personal-sections-direction-c/evidence.json",
    ),
    "utf8",
  ),
);
const sources = [
  ...new Set([
    ...Object.keys(oldEvidence.sourceHashes),
    ...["index.html", "composed.js", "composed.css"].map((file) => `${relative}/${file}`),
    "scripts/verify-ui-phase2-personal-composed-c.mjs",
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
const expectedData = await buildPersonalSectionsData(repo);
let previous;
if (!capture) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
}
const screenshots = [],
  expectedFiles = [];
const actionTargets = [
  ["AC-ROOT", "profile", ".brand"],
  ["AC-CONTEXT", "profile", '.identity [href="/select-context"]'],
  ["AC-SECTION", "profile", '[data-section="permissions"]'],
  ["TH-ROUTE", "profile", ".appearance"],
  ["PC-LOAD", "profile", "#refresh", "profile-refresh-busy"],
  ["PC-SAVE-PROFILE", "profile", "#profile-form button", "profile-busy"],
  ["PC-ORG-TOKENS", "permissions-token", "#token-link"],
  ["AC-MFA", "security", '[href="/security/mfa"]'],
  ["PC-PASSWORD", "security", "#password-form button", "security-password-busy"],
  ["PC-REVOKE", "security", "[data-revoke]", "security-busy"],
  ["PC-PREFERENCES", "notifications", "#preferences-form button", "notifications-busy"],
  ["PC-TREND", "assets", '[href^="/trends?topic="]'],
  ["PC-DECISION", "assets", '[href^="/opportunities/"]'],
  ["PC-TASK", "assets", '[href="/tasks"]'],
];
const actionVisualReferences = Object.fromEntries(
  actionTargets.map(([id, scene, selector, busy]) => [
    id,
    {
      selector,
      scope: "representative-control-only-not-all-variants-or-Vue",
      states: {
        default: scene,
        hover: `${id}-hover`,
        focus: `${id}-focus`,
        pressed: `${id}-pressed`,
        ...(busy ? { disabled: busy, busy } : {}),
      },
    },
  ]),
);
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
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      await page.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      assert.deepEqual(await page.evaluate(() => window.PERSONAL_SECTIONS_DATA), expectedData);
      const show = (scene) =>
        page.evaluate((s) => window.PERSONAL_COMPOSED_REVIEW.showScene(s), scene);
      const info = () => page.evaluate(() => window.PERSONAL_COMPOSED_DIAGNOSTICS());
      const select = async (section) => {
        await page.locator(`[data-section="${section}"]`).click();
        assert.equal((await info()).section, section);
      };
      const shot = async (scene) => {
        const metrics = await checkPrototypeMetrics(page);
        assert.equal(await page.locator("dialog,[role=dialog]").count(), 0);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const file = `${width}-${scene}.png`;
        expectedFiles.push(file);
        if (capture) {
          await page.screenshot({
            path: path.join(root, file),
            fullPage: true,
            animations: "disabled",
          });
          screenshots.push({
            file,
            scene,
            viewport,
            fullPage: true,
            approval: "pending",
            metrics,
            sha256: hash(await readFile(path.join(root, file))),
          });
        }
      };
      for (const scene of await page.evaluate(() => window.PERSONAL_COMPOSED_REVIEW.scenes)) {
        await show(scene);
        await shot(scene);
      }
      for (const theme of ["light", "dark", "contrast"])
        for (const density of ["comfortable", "compact"]) {
          await page.evaluate(
            ({ theme, density }) => {
              document.documentElement.dataset.theme = theme;
              document.documentElement.dataset.density = density;
            },
            { theme, density },
          );
          for (const section of expectedData.sections) {
            await show(section.key);
            await shot(`${section.key}-${theme}-${density}`);
          }
        }
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "light";
        document.documentElement.dataset.density = "comfortable";
      });
      await show("profile");
      await page.locator('[name="display_name"]').fill("连续切区保留的草稿");
      for (const section of ["permissions", "security", "notifications", "assets", "profile"])
        await select(section);
      assert.equal(await page.locator('[name="display_name"]').inputValue(), "连续切区保留的草稿");
      await page.locator(".review-tools summary").click();
      await page.locator("#outcome").selectOption("hold");
      await page.locator("#profile-form button").click();
      const token = (await info()).token;
      assert.ok(token);
      assert.equal(await page.locator("#profile-form button").isDisabled(), true);
      assert.equal((await info()).intent.body.expected_version, 3);
      assert.deepEqual(Object.keys((await info()).intent.body), [
        "username",
        "display_name",
        "avatar_url",
        "phone",
        "locale",
        "timezone",
        "reason",
        "expected_version",
      ]);
      await select("notifications");
      assert.equal(await page.locator("#notifications-notice").textContent(), "");
      await page.evaluate((t) => window.PERSONAL_COMPOSED_REVIEW.finish(t, "error"), token);
      assert.equal(await page.locator("#notifications-notice").textContent(), "");
      await select("profile");
      assert.match(await page.locator("#profile-notice").textContent(), /草稿已保留/);
      assert.equal(await page.locator('[name="display_name"]').inputValue(), "连续切区保留的草稿");
      assert.equal((await info()).profileVersion, 3);
      await page.locator("#profile-form button").click();
      await page.evaluate(() =>
        window.PERSONAL_COMPOSED_REVIEW.finish(window.PERSONAL_COMPOSED_DIAGNOSTICS().token),
      );
      assert.equal((await info()).profileVersion, 4);
      await show("profile-busy");
      const obsolete = (await info()).token;
      await show("assets");
      assert.equal(
        await page.evaluate((t) => window.PERSONAL_COMPOSED_REVIEW.finish(t), obsolete),
        false,
      );
      assert.equal((await info()).profileVersion, 3);
      await show("notifications");
      await page.locator('[name="email_enabled"]').check();
      await page.locator("#preferences-form button").click();
      await page.waitForFunction(() => !window.PERSONAL_COMPOSED_DIAGNOSTICS().token);
      assert.equal(
        await page.locator("#notifications-notice").textContent(),
        expectedData.mailBlocked.actionHint,
      );
      assert.equal((await info()).preferencesVersion, 7);
      await page.locator('[name="email_enabled"]').uncheck();
      await page.locator("#preferences-form button").click();
      await page.waitForFunction(() => !window.PERSONAL_COMPOSED_DIAGNOSTICS().token);
      assert.equal((await info()).preferencesVersion, 8);
      await show("security");
      for (const name of ["current_password", "new_password", "confirm_password"])
        await page
          .locator(`[name="${name}"]`)
          .fill(name === "confirm_password" ? "Mismatch-only-123" : "Preview-only-123");
      await page.locator("#password-form button").click();
      assert.equal((await info()).intent, null);
      assert.equal(
        await page.locator('[name="confirm_password"]').getAttribute("aria-invalid"),
        "true",
      );
      await page.locator('[name="confirm_password"]').fill("Preview-only-123");
      await page.locator("#password-form button").click();
      await page.waitForFunction(() => !window.PERSONAL_COMPOSED_DIAGNOSTICS().token);
      assert.deepEqual((await info()).intent, {
        method: "POST",
        path: "/me/password",
        bodyKeys: ["current_password", "new_password"],
      });
      assert.equal((await info()).route, "/login");
      assert.equal(await page.locator('[name="current_password"]').inputValue(), "");
      for (const session of expectedData.sample.sessions) {
        await show("security");
        await page.locator(`[data-revoke="${session.id}"]`).click();
        await page.waitForFunction(() => !window.PERSONAL_COMPOSED_DIAGNOSTICS().token);
        assert.equal((await info()).sessionIds.includes(session.id), session.status !== "active");
      }
      await show("assets");
      for (const href of [
        `/trends?topic=${expectedData.sample.assets.followed_trends[0].id}`,
        `/opportunities/${expectedData.sample.assets.decisions[0].opportunity_id}`,
        "/tasks",
      ]) {
        await page.locator(`[data-panel="assets"] a[href="${href}"]`).click();
        assert.equal((await info()).route, href);
      }
      await show("profile");
      const control = page.locator("#profile-form button");
      await control.hover();
      await shot("profile-real-hover");
      await control.focus();
      await shot("profile-real-focus");
      await page.mouse.down();
      await shot("profile-real-pressed");
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await page.locator("#refresh").click();
      assert.equal((await info()).intent.paths.length, 5);
      await page.waitForFunction(() => !window.PERSONAL_COMPOSED_DIAGNOSTICS().token);
      for (const [id, scene, selector, busy] of actionTargets) {
        for (const visualState of ["hover", "focus", "pressed"]) {
          await show(scene);
          await page.locator(".review-tools").evaluate((node) => {
            node.open = false;
          });
          const target = page.locator(selector).first();
          await target.scrollIntoViewIfNeeded();
          await target.hover();
          if (visualState === "focus") {
            await page.mouse.move(0, 0);
            await page.keyboard.press("Tab");
            await target.focus();
            assert.equal(await target.evaluate((node) => node.matches(":focus-visible")), true);
          }
          if (visualState === "pressed") {
            await page.mouse.down();
            assert.equal(await target.evaluate((node) => node.matches(":active")), true);
          }
          await shot(`${id}-${visualState}`);
          if (visualState === "pressed") {
            await page.mouse.move(0, 0);
            await page.mouse.up();
          }
        }
        if (busy) {
          await show(busy);
          assert.equal(await page.locator(selector).first().isDisabled(), true);
          assert.equal(await page.locator(selector).first().getAttribute("aria-busy"), "true");
        }
      }
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      for (const narrow of [768, 1024, 720]) {
        await page.setViewportSize({ width: narrow, height: 1000 });
        for (const section of expectedData.sections) {
          await show(section.key);
          await checkPrototypeMetrics(page);
        }
      }
      console.log(
        `personal_composed_c width=${width} continuous/drafts/late-result/payload/mail/password/revoke/themes verified HTTP=0 storage=0`,
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
        version: "PERSONAL-C-composed-r1",
        approval: "pending",
        kind: "continuous-five-section-offline-proposal",
        actionVisualReferences,
        sourceHashes,
        boundary:
          "No Vue/router/history/backend/production acceptance. 720px reflow is not real browser 200% zoom. Six-state sample board does not close every action state mapping.",
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    path.join(root, "gallery.html"),
    [
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>P11 连续稿图集</title>',
      "<style>body{font:16px sans-serif;background:#edf1f6;margin:24px}img{max-width:100%;height:auto}figure{margin:32px 0}</style>",
      '<h1>P11 连续稿 · 具体页面待审</h1><a href="index.html">打开交互提案</a>',
      ...screenshots.map(
        (s) =>
          `<figure><figcaption>${s.scene} · ${s.viewport.width}</figcaption><img loading="lazy" src="${s.file}" alt="${s.scene}" /></figure>`,
      ),
      "</html>",
    ].join("\n"),
  );
} else
  assert.deepEqual(
    previous.screenshots.map((s) => s.file),
    expectedFiles,
  );
