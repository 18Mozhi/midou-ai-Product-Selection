import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/automation-controls-direction-c";
const root = path.join(repo, relative);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const args = process.argv.slice(2);
assert.ok(args.every((a) => ["--capture", "--smoke"].includes(a)));
const capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
assert.ok(!(capture && smoke));
const parent = JSON.parse(
  await readFile(path.join(root, "../automation-direction-c/evidence.json"), "utf8"),
);
for (const [file, sha] of Object.entries(parent.sourceHashes))
  assert.equal(
    hash((await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n")),
    sha,
    file,
  );
const sourceHashes = { ...parent.sourceHashes };
for (const file of [
  `${relative}/index.html`,
  `${relative}/controls.js`,
  `${relative}/controls.css`,
  "scripts/verify-ui-phase2-automation-controls-c.mjs",
])
  sourceHashes[file] = hash(
    (await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n"),
  );
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots) {
    assert.match(shot.file, /^[\w-]+\.png$/);
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256);
  }
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
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await page.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => Boolean(window.AUTOMATION_CONTROLS_C));
      const controls = await page.evaluate(() => window.AUTOMATION_CONTROLS_C.controls);
      assert.equal(controls.length, 14);
      for (const control of controls) {
        for (const state of [
          ...(smoke ? ["focus"] : ["default", "hover", "focus", "pressed"]),
          ...(control.busyScene ? ["pending"] : []),
        ]) {
          await page.evaluate(({ id, mode }) => window.AUTOMATION_CONTROLS_C.prepare(id, mode), {
            id: control.id,
            mode: state === "pending" ? "busy" : "default",
          });
          const before = await page.evaluate(() => window.AUTOMATION_C.state());
          const target = page.locator(control.selector);
          assert.equal(await target.count(), 1, control.id + " ambiguous representative");
          await page.mouse.move(1, 1);
          if (state === "focus") {
            // Move with real Tab, including when prepare placed initial focus on this target.
            await page.keyboard.press("Tab");
            for (
              let i = 0;
              i < 90 && !(await target.evaluate((el) => el === document.activeElement));
              i++
            )
              await page.keyboard.press("Tab");
            assert.equal(
              await target.evaluate((el) => el.matches(":focus-visible")),
              true,
              control.id,
            );
          } else {
            await page.evaluate(() => {
              if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            });
          }
          await target.scrollIntoViewIfNeeded();
          await target.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
          if (["hover", "pressed"].includes(state)) await target.hover();
          if (state === "pressed") await page.mouse.down();
          if (state === "hover")
            assert.equal(await target.evaluate((el) => el.matches(":hover")), true);
          if (state === "pressed")
            assert.equal(await target.evaluate((el) => el.matches(":active")), true);
          if (state === "pending") {
            assert.equal(await target.isDisabled(), true, control.id);
            assert.equal(control.id === "preview" ? before.previewing : before.busy, true);
          } else assert.equal(await target.isEnabled(), true, control.id);
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
            metrics.width >= 44 &&
              metrics.height >= 44 &&
              metrics.font >= 16 &&
              metrics.hit &&
              !metrics.overflow &&
              !metrics.modalOverflow,
            JSON.stringify({ control: control.id, width, state, metrics }),
          );
          assert.deepEqual(
            await page.evaluate(() => window.AUTOMATION_C.state()),
            before,
            "Visual state must not change facts or send new intents",
          );
          const scene = `${control.id}-${state}`,
            file = `${scene}-${width}.png`;
          if (capture) {
            await page.screenshot({ path: path.join(root, file) });
            screenshots.push({
              scene,
              width,
              file,
              sha256: hash(await readFile(path.join(root, file))),
              control: { selector: control.selector, actionId: control.actionId, state },
            });
          }
          actionVisualReferences[control.actionId] ??= {
            pageId: "P27",
            scope: "representative-control-only-not-all-variants-or-Vue",
            selector: control.selector,
            states: {},
          };
          if (state === "pending") {
            actionVisualReferences[control.actionId].states.disabled = scene;
            actionVisualReferences[control.actionId].states.busy = scene;
          } else actionVisualReferences[control.actionId].states[state] = scene;
          checks.push({
            width,
            actionId: control.actionId,
            state,
            metrics,
            factsAndIntentsUnchanged: true,
          });
          if (state === "pressed") {
            await page.mouse.move(1, 1);
            await page.mouse.up();
          }
        }
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
      assert.deepEqual(await context.cookies(), []);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture) {
  assert.equal(screenshots.length, 124);
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        version: "AUTOMATION-CONTROLS-C-r1",
        scope: "offline-proposal-not-runtime-or-user-accepted",
        sourceHashes,
        actionVisualReferences,
        checks,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    path.join(root, "gallery.html"),
    '<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P27逐按钮状态待审</title><style>body{margin:24px;background:#edf1f6;color:#202c3d;font:16px/1.6 sans-serif}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px}figure{margin:0;padding:16px;background:white}img{width:100%;height:480px;object-fit:contain}a{color:#254a9c}</style><h1>P27 自动化规则 · 逐按钮状态待审</h1><p>14个代表控件，56个常规状态＋6个在途场景，双端124图；不是全变体、真实Vue或用户批准。</p><p><a href="index.html">交互稿</a> · <a href="README.md">范围与未完成项</a></p><main>' +
      screenshots
        .map(
          (s) =>
            `<figure><a href="${s.file}"><img src="${s.file}" loading="lazy" alt="${s.scene} ${s.width}"></a><figcaption>${s.scene} · ${s.width}px</figcaption></figure>`,
        )
        .join("") +
      "</main></html>\n",
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
