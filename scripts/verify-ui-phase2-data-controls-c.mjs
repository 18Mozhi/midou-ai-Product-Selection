import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "design-plans/ui-phase-2-2026-09-07",
  relative = `${base}/design/data-controls-direction-c`,
  root = path.join(repo, relative);
const args = process.argv.slice(2);
assert.ok(args.every((arg) => ["--capture", "--smoke"].includes(arg)));
const capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
assert.ok(!(capture && smoke));
const hash = (s) => createHash("sha256").update(s).digest("hex");
const read = async (file) =>
  (await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n");
const parentPath = `${base}/design/data-composed-direction-c/evidence.json`;
const parent = JSON.parse(await read(parentPath));
for (const [file, expected] of Object.entries(parent.sourceHashes))
  assert.equal(hash(await read(file)), expected, file);
const sources = [
  ...Object.keys(parent.sourceHashes),
  parentPath,
  ...["index.html", "controls.js", "control-overrides.css"].map((file) => `${relative}/${file}`),
  "scripts/verify-ui-phase2-data-controls-c.mjs",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(sources.map(async (file) => [file, hash(await read(file))])),
);
const review = JSON.parse(await read(`${base}/action-reviews/P54.json`));
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await read(`${relative}/evidence.json`));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256, shot.file);
}
const screenshots = [],
  expectedFiles = [],
  observations = [],
  actionVisualReferences = {},
  controlVisualReferences = {};
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
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => !!window.DATA_CONTROL_REVIEW_C);
      const controls = await page.evaluate(() => window.DATA_CONTROL_REVIEW_C.controls);
      assert.equal(controls.length, 40);
      assert.equal(new Set(controls.map((c) => c.id)).size, controls.length);
      assert.deepEqual(
        controls
          .filter((c) => c.primary)
          .map((c) => c.actionId)
          .sort(),
        review.actions.map((a) => a.actionId).sort(),
      );
      const initialData = await page.evaluate(() => [
        window.DATA_RECORDS_DATA,
        window.DATA_QUALITY_DATA,
      ]);
      for (const control of controls) {
        if (
          smoke &&
          ![
            "filter-apply",
            "export-open",
            "record-technical",
            "issue-select",
            "resolve-submit",
            "quality-next",
          ].includes(control.id)
        )
          continue;
        const refs = Object.fromEntries(
          control.states.map((state) => [state, `${control.id}-${state}`]),
        );
        controlVisualReferences[control.id] = { ...control, states: refs };
        if (control.primary)
          actionVisualReferences[control.actionId] = {
            scope: "representative-control-only-not-all-variants-or-Vue",
            selector: control.selector,
            states: refs,
          };
        for (const state of control.states) {
          await page.mouse.move(1, 1);
          await page.evaluate(({ id, state }) => window.DATA_CONTROL_REVIEW_C.prepare(id, state), {
            id: control.id,
            state,
          });
          const target = page.locator(control.selector + ":visible");
          assert.equal(await target.count(), 1, control.id);
          await target.scrollIntoViewIfNeeded();
          await target.evaluate((n) => n.blur());
          const before = await page.evaluate(() =>
            Object.values(window.DATA_COMPOSED_C.controls).map((c) => c.state()),
          );
          let down = false;
          try {
            if (state === "hover") await target.hover();
            if (state === "focus") {
              await target.focus();
              await page.keyboard.press("Shift+Tab");
              await page.keyboard.press("Tab");
            }
            if (state === "pressed") {
              await target.hover();
              await page.mouse.down();
              down = true;
            }
            const measured = await target.evaluate((n) => {
              const b = n.getBoundingClientRect(),
                css = getComputedStyle(n),
                localRoot = n.getRootNode();
              const hit = localRoot.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
              const checkbox = n.matches('input[type="checkbox"]');
              const touch = checkbox ? n.closest("label").getBoundingClientRect() : b;
              return {
                label: n.textContent.trim() || n.getAttribute("aria-label"),
                tag: n.tagName,
                checked: checkbox ? n.checked : null,
                disabled: !!n.disabled,
                hover: n.matches(":hover"),
                pressed: n.matches(":active"),
                focusVisible: n.matches(":focus-visible"),
                fontSize: parseFloat(css.fontSize),
                touchWidth: touch.width,
                touchHeight: touch.height,
                inViewport:
                  b.left >= 0 &&
                  b.right <= innerWidth + 1 &&
                  b.top >= 0 &&
                  b.bottom <= innerHeight + 1,
                hittable: hit === n || n.contains(hit),
                overflow: document.documentElement.scrollWidth > innerWidth + 1,
                style: {
                  background: css.backgroundColor,
                  color: css.color,
                  outlineStyle: css.outlineStyle,
                  outlineWidth: css.outlineWidth,
                  transform: css.transform,
                },
              };
            });
            assert.ok(
              measured.inViewport && measured.hittable && !measured.overflow,
              `${width}/${control.id}/${state}: target visibility`,
            );
            assert.ok(
              measured.touchWidth >= 43.9 && measured.touchHeight >= 43.9,
              `${control.id}: touch target`,
            );
            if (measured.tag !== "INPUT") assert.ok(measured.fontSize >= 16);
            if (state === "disabled") assert.equal(measured.disabled, true, control.id);
            else if (state !== "busy") assert.equal(measured.disabled, false, control.id);
            if (state === "hover") assert.equal(measured.hover, true, control.id);
            if (state === "pressed") assert.equal(measured.pressed, true, control.id);
            if (state === "focus") assert.equal(measured.focusVisible, true, control.id);
            if (state === "busy") {
              const pending = await page.evaluate(
                (scope) => window.DATA_COMPOSED_C.controls[scope].state().pending,
                control.scope,
              );
              assert.ok(pending?.kind, `${control.id}: no real pending prototype operation`);
            }
            const scene = `${control.id}-${state}`,
              file = `${width}-${scene}.png`;
            expectedFiles.push(file);
            observations.push({
              width,
              control: control.id,
              actionId: control.actionId,
              state,
              ...measured,
            });
            if (capture) {
              await page.screenshot({
                path: path.join(root, file),
                fullPage: false,
                animations: "disabled",
              });
              screenshots.push({
                file,
                scene,
                control: control.id,
                actionId: control.actionId,
                selector: control.selector,
                state,
                viewport,
                fullPage: false,
                approval: "pending",
                sha256: hash(await readFile(path.join(root, file))),
              });
            }
          } finally {
            if (down) {
              await page.mouse.move(1, 1);
              await page.mouse.up();
            }
          }
          const after = await page.evaluate(() =>
            Object.values(window.DATA_COMPOSED_C.controls).map((c) => c.state()),
          );
          assert.deepEqual(
            after,
            before,
            `${control.id}/${state}: visual interaction changed business intent`,
          );
        }
      }
      assert.deepEqual(
        await page.evaluate(() => [window.DATA_RECORDS_DATA, window.DATA_QUALITY_DATA]),
        initialData,
      );
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      console.log(
        `data_controls width=${width} selectors/native-states/target-hit/intent-stability passed HTTP=0 storage=0`,
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
        version: "DATA-CONTROLS-C-r1",
        approval: "pending",
        kind: "additive-listed-control-state-proof",
        sourceHashes,
        actionVisualReferences,
        controlVisualReferences,
        observations,
        screenshots,
        boundary:
          "40 listed control variants under17 local semantic groups. Primary references representative only. Source handler guards differ from proposed disabled states; busy pagination may remain enabled. Missing states unproven, no blanket N/A. No real Vue/API/SQL/download/approval or full shared-control/row/theme coverage.",
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    path.join(root, "gallery.html"),
    [
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P54 逐控件状态待审</title>',
      '<style>body{font:16px "Microsoft YaHei",sans-serif;margin:24px;background:#edf1f6;color:#202c3d}img{max-width:100%;height:auto}figure{margin:24px 0}nav{display:flex;gap:12px;flex-wrap:wrap}section{border-top:2px solid #254a9c;padding-top:16px}</style>',
      '<h1>P54 逐按钮状态 · C方向待审</h1><p>真实悬停/键盘焦点/指针按下；禁用或处理中依据原型状态，不等于源Vue实现。40个列明控件，不代表所有动态行和共享消费者。</p><a href="index.html">打开可交互稿与控件定位</a>',
      "<nav>" +
        Object.keys(controlVisualReferences)
          .map((id) => `<a href="#${id}">${id}</a>`)
          .join("") +
        "</nav>",
      ...Object.values(controlVisualReferences).map(
        (c) =>
          `<section id="${c.id}"><h2>${c.actionId} / ${c.id}</h2><p>未列的disabled/busy保持未验证，不补造状态。</p>${screenshots
            .filter((s) => s.control === c.id)
            .map(
              (s) =>
                `<figure><figcaption>${s.state} · ${s.viewport.width}</figcaption><img loading="lazy" src="${s.file}" alt="${c.id} ${s.state}"></figure>`,
            )
            .join("")}</section>`,
      ),
      "</html>",
    ].join("\n"),
  );
} else if (!smoke) {
  assert.deepEqual(
    previous.screenshots.map((s) => s.file),
    expectedFiles,
  );
  assert.deepEqual(previous.actionVisualReferences, actionVisualReferences);
  assert.deepEqual(previous.controlVisualReferences, controlVisualReferences);
  assert.deepEqual(previous.observations, observations);
}
