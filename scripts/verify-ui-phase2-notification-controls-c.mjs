import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { buildNotificationDesignData } from "./lib/ui-phase2-notification-design-data.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/notification-controls-direction-c";
const root = path.join(repo, relative);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const args = process.argv.slice(2);
assert.ok(args.every((a) => ["--smoke", "--capture"].includes(a)));
const capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
assert.ok(!(capture && smoke));
const parent = JSON.parse(
  await readFile(path.join(root, "../notification-direction-c/evidence.json"), "utf8"),
);
for (const [file, sha] of Object.entries(parent.sourceHashes)) {
  assert.equal(
    hash((await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n")),
    sha,
    file,
  );
}
const sourceHashes = { ...parent.sourceHashes };
for (const file of ["index.html", "controls.js", "controls.css"]
  .map((f) => `${relative}/${f}`)
  .concat("scripts/verify-ui-phase2-notification-controls-c.mjs")) {
  sourceHashes[file] = hash(
    (await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n"),
  );
}
const data = await buildNotificationDesignData(repo);
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256, shot.file);
}
const screenshots = [],
  checks = [],
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
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => Boolean(window.NOTIFICATION_CONTROLS_C));
      assert.deepEqual(await page.evaluate(() => window.NOTIFICATION_C_DATA), data);
      const controls = await page.evaluate(() => window.NOTIFICATION_CONTROLS_C.controls);
      for (const control of controls) {
        for (const state of smoke
          ? ["focus", "pending", "error"]
          : ["default", "hover", "focus", "pressed", "pending", "error"]) {
          await page.evaluate(({ id, mode }) => window.NOTIFICATION_CONTROLS_C.prepare(id, mode), {
            id: control.id,
            mode: state === "pending" ? "busy" : state === "error" ? "error" : "intent",
          });
          const before = await page.evaluate(() => window.NOTIFICATION_C.state());
          assert.equal(before.intents.length, 0);
          let target = page.locator(control.selector);
          await target.scrollIntoViewIfNeeded();
          await page.mouse.move(1, 1);
          if (state === "hover") await target.hover();
          if (state === "focus") {
            await page
              .locator(
                control.id === "preferences"
                  ? "#preferences-close"
                  : control.id === "markAll"
                    ? "#preferences-open"
                    : "#detail-close",
              )
              .focus();
            for (
              let i = 0;
              i < 30 && !(await target.evaluate((el) => el === document.activeElement));
              i++
            )
              await page.keyboard.press("Tab");
            assert.equal(await target.evaluate((el) => el.matches(":focus-visible")), true);
          }
          if (state === "pressed") {
            await target.hover();
            await page.mouse.down();
          }
          if (["pending", "error"].includes(state)) {
            await target.click();
            await page.evaluate(() => window.NOTIFICATION_CONTROLS_C.enhance());
            target = page.locator(control.selector);
            await target.scrollIntoViewIfNeeded();
          }
          const current = await page.evaluate(() => window.NOTIFICATION_C.state());
          assert.deepEqual(
            current.selected,
            before.selected,
            "preview must not fabricate selected facts",
          );
          assert.deepEqual(current.rows, before.rows);
          assert.deepEqual(current.summary, before.summary);
          if (["pending", "error"].includes(state))
            assert.deepEqual(current.intents, [data.contracts[control.id]]);
          else assert.equal(current.intents.length, 0);
          if (state === "pending") {
            assert.equal(await target.isDisabled(), true);
            assert.equal(await target.getAttribute("aria-busy"), "true");
            assert.equal(await target.textContent(), control.busyLabel);
          }
          if (state === "hover")
            assert.equal(await target.evaluate((el) => el.matches(":hover")), true);
          if (state === "pressed")
            assert.equal(await target.evaluate((el) => el.matches(":active")), true);
          const metrics = await target.evaluate((el) => {
            const r = el.getBoundingClientRect(),
              hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return {
              width: r.width,
              height: r.height,
              font: parseFloat(getComputedStyle(el).fontSize),
              hit: el === hit || el.contains(hit),
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              modalOverflow: [...document.querySelectorAll("dialog[open]")].some(
                (d) => d.scrollWidth > d.clientWidth + 1,
              ),
            };
          });
          assert.ok(
            metrics.width >= 44 && metrics.height >= 44 && metrics.font >= 16 && metrics.hit,
            JSON.stringify({ control: control.id, state, width, metrics }),
          );
          assert.equal(metrics.overflow || metrics.modalOverflow, false);
          const scene = `${control.id}-${state}`,
            file = `${scene}-${width}.png`;
          if (capture) {
            await page.screenshot({ path: path.join(root, file), fullPage: true });
            screenshots.push({
              scene,
              width,
              file,
              sha256: hash(await readFile(path.join(root, file))),
            });
          }
          actionVisualReferences[control.actionId] ??= {
            pageId: "P26",
            scope: "representative-control-only-not-all-variants-or-Vue",
            selector: control.selector,
            states: {},
          };
          actionVisualReferences[control.actionId].states[state] = scene;
          if (state === "pending") {
            actionVisualReferences[control.actionId].states.disabled = scene;
            actionVisualReferences[control.actionId].states.busy = scene;
            await target.dispatchEvent("click");
            if (control.id === "preferences")
              await page.locator("#preference-form").dispatchEvent("submit");
            assert.equal(
              (await page.evaluate(() => window.NOTIFICATION_C.state())).intents.length,
              1,
            );
            if (control.id !== "markAll") {
              await page.keyboard.press("Escape");
              assert.equal(
                await page
                  .locator(control.id === "preferences" ? "#preferences" : "#detail")
                  .evaluate((el) => el.open),
                control.id !== "preferences",
              );
              assert.equal(
                (await page.evaluate(() => window.NOTIFICATION_C.state())).pending,
                true,
              );
            }
          }
          if (state === "error") {
            await target.click();
            assert.deepEqual((await page.evaluate(() => window.NOTIFICATION_C.state())).intents, [
              data.contracts[control.id],
              data.contracts[control.id],
            ]);
          }
          if (state === "pressed") {
            await page.mouse.move(1, 1);
            await page.mouse.up();
            assert.equal(
              (await page.evaluate(() => window.NOTIFICATION_C.state())).intents.length,
              0,
            );
          }
          checks.push({
            width,
            control: control.id,
            state,
            exactPreview: true,
            factsUnchanged: true,
            targetMetrics: metrics,
          });
        }
      }
      await page.evaluate(() => window.NOTIFICATION_CONTROLS_C.prepare("preferences", "busy"));
      assert.equal(await page.locator("#email_enabled").isDisabled(), true);
      assert.equal(await page.locator("#email_enabled").isChecked(), false);
      await page.locator("#preferences-save").click();
      await page.locator("#task_enabled").uncheck();
      assert.deepEqual((await page.evaluate(() => window.NOTIFICATION_C.state())).intents, [
        data.contracts.preferences,
      ]);
      await page.evaluate(() => window.NOTIFICATION_C.scene("read_busy"));
      assert.deepEqual((await page.evaluate(() => window.NOTIFICATION_C.state())).intents, [
        data.contracts.read,
      ]);
      assert.equal(await page.locator("[data-action=read]").count(), 0);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#detail").evaluate((el) => el.open), true);
      assert.deepEqual(requests, []);
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const report = {
  version: "NOTIFICATION-CONTROLS-C-r1",
  scope: "offline-proposal-not-runtime-or-user-accepted",
  sourceHashes,
  checks,
  actionVisualReferences,
  screenshots,
};
if (capture) {
  assert.equal(screenshots.length, 60);
  await writeFile(path.join(root, "evidence.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(
    path.join(root, "gallery.html"),
    [
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P26 通知操作逐态待审</title>',
      "<style>body{margin:24px;font:16px/1.6 system-ui;background:#eff2f7;color:#17243a}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px}figure{margin:0;padding:16px;background:white}img{width:100%;height:480px;object-fit:contain;object-position:top}a{color:#244b91}</style>",
      '<h1>P26 通知操作逐态 · 待审</h1><p>五个操作，六种状态，桌面/手机共60图。禁用与忙碌共用真实等待状态。离线预览，不代表上线或整页通过。</p><p><a href="index.html">交互预览</a> · <a href="README.md">范围与差异</a></p><main>',
      ...screenshots.map(
        (s) =>
          `<figure><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.scene} ${s.width}"></a><figcaption>${s.scene} · ${s.width}px</figcaption></figure>`,
      ),
      "</main>\n",
    ].join(""),
  );
} else if (!smoke) {
  assert.deepEqual(previous.checks, checks);
  assert.deepEqual(previous.actionVisualReferences, actionVisualReferences);
}
console.log(
  JSON.stringify({
    mode: capture ? "capture" : smoke ? "smoke" : "verify",
    checks: checks.length,
    screenshots: capture ? screenshots.length : (previous?.screenshots.length ?? 0),
    browserClosed: true,
    networkRequests: 0,
  }),
);
