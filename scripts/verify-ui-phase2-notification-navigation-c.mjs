import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { buildNotificationDesignData } from "./lib/ui-phase2-notification-design-data.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/notification-navigation-direction-c";
const root = path.join(repo, relative);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const args = process.argv.slice(2);
assert.ok(args.every((v) => ["--smoke", "--capture"].includes(v)));
const smoke = args.includes("--smoke"),
  capture = args.includes("--capture");
assert.ok(!(smoke && capture));
const parent = JSON.parse(
  await readFile(path.join(root, "../notification-direction-c/evidence.json"), "utf8"),
);
const sourceHashes = { ...parent.sourceHashes };
for (const [file, sha] of Object.entries(sourceHashes))
  assert.equal(
    hash((await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n")),
    sha,
    file,
  );
for (const file of ["index.html", "navigation.js", "navigation.css"]
  .map((v) => `${relative}/${v}`)
  .concat("scripts/verify-ui-phase2-notification-navigation-c.mjs"))
  sourceHashes[file] = hash(
    (await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n"),
  );
const data = await buildNotificationDesignData(repo);
const registry = JSON.parse(
  await readFile(
    path.join(repo, "design-plans/ui-phase-2-2026-09-07/action-reviews/P26.json"),
    "utf8",
  ),
);
const previous =
  !capture && !smoke ? JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8")) : null;
if (previous) {
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256, shot.file);
}
const screenshots = [],
  checks = [],
  clicks = [],
  variants = [],
  actionVisualReferences = {};
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
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => Boolean(window.NOTIFICATION_NAVIGATION_C));
      assert.deepEqual(await page.evaluate(() => window.NOTIFICATION_C_DATA), data);
      const controls = await page.evaluate(() => window.NOTIFICATION_NAVIGATION_C.controls);
      assert.equal(controls.length, 26);
      for (const c of controls) {
        assert.ok(registry.actions.some((a) => a.actionId === c.actionId));
        const states = smoke
          ? ["focus", ...(c.disabledScene ? ["disabled"] : [])]
          : [
              "default",
              "hover",
              "focus",
              "pressed",
              ...(c.selected ? ["selected"] : []),
              ...(c.disabledScene ? ["disabled"] : []),
            ];
        const references = {};
        for (const state of states) {
          await page.evaluate(
            ({ id, disabled }) => window.NOTIFICATION_NAVIGATION_C.prepare(id, disabled),
            { id: c.id, disabled: state === "disabled" },
          );
          const before = await page.evaluate(() => window.NOTIFICATION_C.state());
          let target = page.locator(c.selector).first();
          await page.evaluate(() => document.activeElement?.blur());
          await page.mouse.move(0, 0);
          await target.scrollIntoViewIfNeeded();
          await target.evaluate((el) =>
            (el.closest(".check") || el).scrollIntoView({ block: "center", inline: "nearest" }),
          );
          if (state === "hover") await target.hover();
          if (state === "focus") {
            // Establish keyboard modality, then walk native tab order; no fake focus class.
            const dialog = page.locator("dialog[open]");
            if (await dialog.count())
              await dialog.locator("button:not(:disabled),a,summary").first().focus();
            else await page.locator("#navigation-prepare").focus();
            await page.keyboard.press("Tab");
            for (
              let i = 0;
              i < 80 && !(await target.evaluate((el) => el === document.activeElement));
              i++
            )
              await page.keyboard.press("Tab");
            assert.equal(
              await target.evaluate(
                (el) => el === document.activeElement && el.matches(":focus-visible"),
              ),
              true,
              c.id,
            );
          }
          if (state === "pressed") {
            await target.hover();
            await page.mouse.down();
          }
          if (state === "selected") {
            await target.click();
            target = page.locator(c.selector).first();
            if (c.id.startsWith("unread-")) assert.equal(await target.isChecked(), !before.unread);
            else assert.equal(await target.getAttribute("aria-pressed"), "true");
            assert.equal(await target.evaluate((el) => el.matches(":active")), false);
          }
          if (state === "disabled") assert.equal(await target.isDisabled(), true);
          if (state === "hover")
            assert.equal(await target.evaluate((el) => el.matches(":hover")), true);
          if (state === "pressed")
            assert.equal(await target.evaluate((el) => el.matches(":active")), true);
          const hitTarget = c.target ? page.locator(c.target) : target;
          await hitTarget.evaluate((el) =>
            el.scrollIntoView({ block: "center", inline: "nearest" }),
          );
          if (["hover", "pressed"].includes(state)) await target.hover();
          if (state === "hover")
            assert.equal(await target.evaluate((el) => el.matches(":hover")), true);
          if (state === "pressed")
            assert.equal(await target.evaluate((el) => el.matches(":active")), true);
          const metrics = await hitTarget.evaluate((el) => {
            const r = el.getBoundingClientRect(),
              style = getComputedStyle(el);
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return {
              width: r.width,
              height: r.height,
              font: parseFloat(style.fontSize),
              outline: style.outlineWidth,
              fullyVisible:
                r.top >= 6 &&
                r.bottom <= innerHeight - 6 &&
                r.left >= 6 &&
                r.right <= innerWidth - 6,
              hit: el === hit || el.contains(hit),
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              modalOverflow: [...document.querySelectorAll("dialog[open]")].some(
                (d) => d.scrollWidth > d.clientWidth + 1,
              ),
            };
          });
          assert.ok(
            metrics.width >= 44 &&
              metrics.height >= 44 &&
              metrics.font >= 16 &&
              metrics.hit &&
              metrics.fullyVisible,
            JSON.stringify({ id: c.id, state, width, metrics }),
          );
          assert.equal(metrics.overflow || metrics.modalOverflow, false);
          if (state === "focus") assert.ok(parseFloat(metrics.outline) >= 3);
          const current = await page.evaluate(() => window.NOTIFICATION_C.state());
          assert.deepEqual(current.rows, before.rows);
          assert.deepEqual(current.summary, before.summary);
          assert.deepEqual(current.intents, before.intents);
          const scene = `${c.id}-${state}`,
            file = `${scene}-${width}.png`;
          if (capture) {
            await page.screenshot({ path: path.join(root, file) });
            screenshots.push({
              scene,
              width,
              file,
              sha256: hash(await readFile(path.join(root, file))),
            });
          }
          references[state] = scene;
          if (state === "disabled" && !["previous", "next"].includes(c.id)) references.busy = scene;
          if (state === "pressed") {
            await page.mouse.move(0, 0);
            await page.mouse.up();
            assert.deepEqual(
              (await page.evaluate(() => window.NOTIFICATION_C.state())).intents,
              before.intents,
            );
          }
          if (state === "default" || (smoke && state === "focus")) {
            await target.click();
            const after = await page.evaluate(() => window.NOTIFICATION_C.state());
            assert.deepEqual(after.rows, before.rows);
            assert.deepEqual(after.summary, before.summary);
            const delta = c.id === "row-unread" ? [data.contracts.read] : [];
            assert.deepEqual(after.intents, before.intents.concat(delta));
            if (c.id.startsWith("category-")) {
              assert.equal(after.category, c.id.slice(9).replace(/^all$/, ""));
              assert.equal(after.page, 1);
            }
            if (c.id.startsWith("status-")) {
              assert.equal(after.status, c.id.slice(7).replace(/^all$/, ""));
              assert.equal(after.page, 1);
            }
            if (c.id.startsWith("unread-")) assert.equal(after.unread, !before.unread);
            if (c.id.startsWith("retry-")) {
              assert.equal(after.read, before.read);
              assert.match(after.message, /读取意图/);
            }
            if (c.id === "previous" || c.id === "next")
              assert.equal(after.page, before.page + (c.id === "next" ? 1 : -1));
            if (c.id.startsWith("row-")) {
              assert.equal(await page.locator("#detail").evaluate((el) => el.open), true);
              assert.equal(after.selected.id, before.rows[0].id);
              await page.keyboard.press("Escape");
              assert.equal(
                await page
                  .locator(c.selector)
                  .first()
                  .evaluate((el) => el === document.activeElement),
                true,
              );
            }
            if (c.id === "preferences-open") {
              assert.equal(await page.locator("#preferences").evaluate((el) => el.open), true);
              await page.keyboard.press("Escape");
              assert.equal(
                await page.locator(c.selector).evaluate((el) => el === document.activeElement),
                true,
              );
            }
            if (c.id === "source") {
              assert.match(after.detailMessage, /离线导航预览/);
              assert.equal(after.path, before.path);
            }
            if (c.id === "technical")
              assert.equal(await page.locator("#technical").evaluate((el) => el.open), true);
            if (c.id === "detail-close") {
              assert.equal(after.selected, null);
              assert.equal(await page.locator("#detail").evaluate((el) => el.open), false);
            }
            if (["preferences-cancel", "preferences-close"].includes(c.id)) {
              assert.equal(await page.locator("#preferences").evaluate((el) => el.open), false);
              assert.deepEqual(after.preferenceDraft, before.preferenceDraft);
            }
            clicks.push({
              width,
              control: c.id,
              factsUnchanged: true,
              autoReadIntents: delta.length,
            });
          }
          checks.push({ width, control: c.id, state, metrics });
        }
        if (width === 1440) {
          variants.push({
            id: c.id,
            actionId: c.actionId,
            selector: c.selector,
            proposalOnly: Boolean(c.proposalOnly),
            states: references,
          });
          if (!c.proposalOnly && !actionVisualReferences[c.actionId])
            actionVisualReferences[c.actionId] = {
              pageId: "P26",
              scope: "representative-control-only-not-all-variants-or-Vue",
              selector: c.selector,
              states: references,
            };
        }
      }
      // Pending close differences are current contract, not cancellation or source-race repair.
      await page.evaluate(() => window.NOTIFICATION_C.scene("start_busy"));
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#detail").evaluate((el) => el.open), true);
      await page.evaluate(() => window.NOTIFICATION_C.scene("preferences_busy"));
      const pending = await page.evaluate(() => window.NOTIFICATION_C.state());
      await page.locator("#preferences-cancel").click();
      assert.equal(await page.locator("#preferences").evaluate((el) => el.open), false);
      assert.deepEqual(
        (await page.evaluate(() => window.NOTIFICATION_C.state())).intents,
        pending.intents,
      );
      assert.equal((await page.evaluate(() => window.NOTIFICATION_C.state())).pending, true);
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const report = {
  version: "NOTIFICATION-NAVIGATION-C-r1",
  scope: "offline-proposal-not-runtime-or-user-accepted",
  sourceHashes,
  actionVisualReferences,
  controlVariantReferences: Object.fromEntries(
    variants
      .filter((v) => !v.proposalOnly)
      .map((v) => [
        v.id,
        {
          scope: "additional-control-variant-not-new-action",
          pageId: "P26",
          actionId: v.actionId,
          selector: v.selector,
          states: Object.fromEntries(
            Object.entries(v.states).filter(([state]) => !["selected", "busy"].includes(state)),
          ),
        },
      ]),
  ),
  controlVariants: variants,
  checks,
  clicks,
  screenshots,
};
for (const shot of screenshots) {
  const control = variants.find((v) => Object.values(v.states).includes(shot.scene));
  const state = Object.entries(control.states).find(([, scene]) => scene === shot.scene)[0];
  shot.control = { key: control.id, actionId: control.actionId, selector: control.selector, state };
}
if (capture) {
  assert.equal(screenshots.length, 240);
  assert.equal(clicks.length, 52);
  await writeFile(path.join(root, "evidence.json"), JSON.stringify(report, null, 2) + "\n");
  const heading =
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P26 导航与关闭审核图册</title>';
  const style =
    '<style>body{margin:24px;font:16px/1.7 "Microsoft YaHei",sans-serif;background:#eff2f7;color:#17243a}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px}figure{margin:0;padding:16px;background:white}img{width:100%;height:480px;object-fit:contain;object-position:top}a{color:#244b91}</style>';
  await writeFile(
    path.join(root, "gallery.html"),
    heading +
      style +
      '<h1>P26 / 导航与关闭 · 待审</h1><p>26控件变体 / 240双端图。selected代表逻辑选中（checkbox为切换结果），不是鼠标按下。额外偏好关闭图标是提案，不增加源动作。</p><p><a href="index.html">交互审核</a> · <a href="README.md">范围与缺口</a></p><main>' +
      screenshots
        .map(
          (s) =>
            `<figure><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.scene} ${s.width}px"></a><figcaption>${s.scene} · ${s.width}px</figcaption></figure>`,
        )
        .join("") +
      "</main>\n",
  );
} else if (previous) {
  assert.deepEqual(previous.checks, checks);
  assert.deepEqual(previous.clicks, clicks);
  assert.deepEqual(previous.actionVisualReferences, actionVisualReferences);
  assert.deepEqual(previous.controlVariants, variants);
  assert.deepEqual(previous.controlVariantReferences, report.controlVariantReferences);
}
console.log(
  JSON.stringify({
    mode: capture ? "capture" : smoke ? "smoke" : "verify",
    checks: checks.length,
    clicks: clicks.length,
    screenshots: screenshots.length || previous?.screenshots.length || 0,
    browserClosed: true,
    networkRequests: 0,
  }),
);
