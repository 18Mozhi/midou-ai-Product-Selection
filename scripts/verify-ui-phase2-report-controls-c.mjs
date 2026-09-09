import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/report-controls-direction-c";
const root = path.join(repo, relative);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const args = process.argv.slice(2);
assert.ok(args.every((a) => ["--capture", "--smoke"].includes(a)));
const capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
assert.ok(!(capture && smoke));
const parent = JSON.parse(
  await readFile(path.join(root, "../report-direction-c/evidence.json"), "utf8"),
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
  "scripts/verify-ui-phase2-report-controls-c.mjs",
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
  actionVisualReferences = {},
  controlVariantReferences = {};
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
      await page.waitForFunction(() => Boolean(window.REPORT_CONTROLS_C));
      const controls = await page.evaluate(() => window.REPORT_CONTROLS_C.controls);
      const variants = await page.evaluate(() => window.REPORT_CONTROLS_C.variants);
      assert.equal(controls.length, 10);
      assert.equal(variants.length, 14);
      for (const control of [...controls, ...variants]) {
        for (const state of [
          ...(smoke ? ["focus"] : ["default", "hover", "focus", "pressed"]),
          ...(control.busyScene || control.busyClick
            ? [control.variantKey ? "busy" : "pending"]
            : []),
        ]) {
          const inFlight = ["pending", "busy"].includes(state);
          await page.evaluate(({ id, mode }) => window.REPORT_CONTROLS_C.prepare(id, mode), {
            id: control.id,
            mode: inFlight ? "busy" : "default",
          });
          const before = await page.evaluate(() => window.REPORT_C.state());
          const target = page.locator(control.selector);
          assert.equal(await target.count(), 1, control.id + " ambiguous representative");
          if (Object.hasOwn(control, "selected"))
            assert.equal(await target.getAttribute("aria-pressed"), String(control.selected));
          if (control.busyClick && inFlight) {
            const intent = before.intents.at(-1);
            assert.equal(intent.method, "POST");
            if (control.actionId === "RP-CREATE")
              assert.deepEqual(intent.body, { report_type: before.type, format: "csv" });
            else {
              assert.ok(intent.url.endsWith("/regenerate"));
              assert.equal(Object.hasOwn(intent, "body"), false);
            }
          }
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
          if (inFlight) {
            assert.equal(await target.isDisabled(), true, control.id);
            assert.ok(["create", "refresh", "download", "regenerate"].includes(before.busy));
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
            await page.evaluate(() => window.REPORT_C.state()),
            before,
            "Visual state must not change facts or send new intents",
          );
          const scene = `${control.id}-${state}`,
            file = `${scene}-${width}.png`;
          // Moving away before mouse-up avoids activation but can leave a text selection.
          await page.evaluate(() => window.getSelection()?.removeAllRanges());
          assert.equal(await page.evaluate(() => String(window.getSelection())), "");
          if (capture) {
            await page.screenshot({ path: path.join(root, file) });
            screenshots.push({
              scene,
              width,
              file,
              sha256: hash(await readFile(path.join(root, file))),
              control: {
                selector: control.selector,
                actionId: control.actionId,
                state,
                ...(control.variantKey ? { key: control.variantKey } : {}),
              },
            });
          }
          const references = control.variantKey ? controlVariantReferences : actionVisualReferences;
          const referenceKey = control.variantKey ?? control.actionId;
          references[referenceKey] ??= {
            pageId: "P28",
            scope: control.variantKey
              ? "additional-control-variant-not-new-action"
              : "representative-control-only-not-all-variants-or-Vue",
            ...(control.variantKey ? { actionId: control.actionId } : {}),
            selector: control.selector,
            states: {},
          };
          if (state === "pending") {
            references[referenceKey].states.disabled = scene;
            references[referenceKey].states.busy = scene;
          } else references[referenceKey].states[state] = scene;
          checks.push({
            width,
            actionId: control.actionId,
            ...(control.variantKey ? { variantKey: control.variantKey } : {}),
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
  assert.equal(screenshots.length, 208);
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        version: "REPORT-CONTROLS-C-r1",
        scope: "offline-proposal-not-runtime-or-user-accepted",
        sourceHashes,
        actionVisualReferences,
        controlVariantReferences,
        checks,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    path.join(root, "gallery.html"),
    '<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P28逐按钮状态待审</title><style>body{margin:24px;background:#edf1f6;color:#202c3d;font:16px/1.6 sans-serif}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px}figure{margin:0;padding:16px;background:white}img{width:100%;height:480px;object-fit:contain}a{color:#254a9c}</style><h1>P28 报表与导出 · 逐按钮状态待审</h1><p>10个代表控件＋14个扩展变体，双端208图；不是全组合、真实Vue或用户批准。</p><p><a href="index.html">交互稿</a> · <a href="README.md">范围与未完成项</a></p><main>' +
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
  assert.deepEqual(previous.controlVariantReferences, controlVariantReferences);
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
