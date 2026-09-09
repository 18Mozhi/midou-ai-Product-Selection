import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "design-plans/ui-phase-2-2026-09-07";
const relative = `${base}/design/approval-controls-direction-c`,
  root = path.join(repo, relative);
const args = process.argv.slice(2);
assert.ok(args.every((arg) => ["--capture", "--smoke"].includes(arg)));
const capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
assert.ok(!(capture && smoke));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const read = async (file) =>
  (await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n");
const parentPath = `${base}/design/approval-direction-c/evidence.json`;
const parent = JSON.parse(await read(parentPath));
for (const [file, expected] of Object.entries(parent.sourceHashes))
  assert.equal(hash(await read(file)), expected, file);
const sources = [
  ...Object.keys(parent.sourceHashes),
  parentPath,
  ...["index.html", "controls.js", "controls.css"].map((name) => `${relative}/${name}`),
  "scripts/verify-ui-phase2-approval-controls-c.mjs",
  "scripts/verify-ui-phase2-approval-review.mjs",
];
const sourceHashes = Object.fromEntries(
  await Promise.all(sources.map(async (file) => [file, hash(await read(file))])),
);
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await read(`${relative}/evidence.json`));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const shot of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256, shot.file);
}
const expected = [],
  screenshots = [],
  observations = [],
  actionVisualReferences = {};
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
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.route(/^https?:/, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => Boolean(window.APPROVAL_CONTROL_C));
      const controls = await page.evaluate(() => window.APPROVAL_CONTROL_C.controls);
      assert.equal(controls.length, 5);
      assert.equal(new Set(controls.map((c) => c.actionId)).size, 5);
      const originalFacts = await page.evaluate(() => window.APPROVAL_C_DATA);
      for (const control of controls) {
        actionVisualReferences[control.actionId] = {
          scope: "representative-control-only-not-all-variants-or-Vue",
          pageId: "P25",
          selector: control.selector,
          states: Object.fromEntries(
            control.states.map((state) => [state, `${control.id}-${state}`]),
          ),
        };
        for (const state of [...control.states, "error"]) {
          if (smoke && !["focus", "pressed", "busy", "error", "disabled"].includes(state)) continue;
          await page.mouse.move(1, 1);
          await page.evaluate(({ id, state }) => window.APPROVAL_CONTROL_C.prepare(id, state), {
            id: control.id,
            state,
          });
          const target = page.locator(control.selector + ":visible");
          assert.equal(await target.count(), 1);
          if (["busy", "error"].includes(state)) {
            await target.click();
            const pending = await page.evaluate(() => window.APPROVAL_CONTROL_C.state().pending);
            assert.equal(pending?.id, control.id);
            assert.deepEqual(pending.request, originalFacts.contracts[control.id]);
            assert.equal(await page.evaluate(() => window.APPROVAL_C.state().intents.length), 1);
            if (state === "error") {
              await page.locator("dialog[open] .review-failure").click();
              assert.equal(
                await page.evaluate(() => window.APPROVAL_CONTROL_C.state().pending),
                null,
              );
              assert.deepEqual(
                await page.evaluate(() => window.APPROVAL_CONTROL_C.state().lastFailure.request),
                pending.request,
              );
              assert.match(await page.locator(control.message).innerText(), /输入已保留/);
            }
          }
          await target.scrollIntoViewIfNeeded();
          await target.evaluate((node) => node.blur());
          const before = await page.evaluate(() => ({
            core: window.APPROVAL_C.state(),
            overlay: window.APPROVAL_CONTROL_C.state(),
          }));
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
            const measured = await target.evaluate((node) => {
              const b = node.getBoundingClientRect(),
                css = getComputedStyle(node);
              const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
              const dialog = node.closest("dialog");
              return {
                label: node.textContent.trim(),
                disabled: node.disabled,
                busy: node.getAttribute("aria-busy"),
                hover: node.matches(":hover"),
                pressed: node.matches(":active"),
                focus: node.matches(":focus-visible"),
                width: b.width,
                height: b.height,
                fontSize: parseFloat(css.fontSize),
                hit: hit === node || node.contains(hit),
                inViewport:
                  b.left >= 0 &&
                  b.right <= innerWidth + 1 &&
                  b.top >= 0 &&
                  b.bottom <= innerHeight + 1,
                overflow:
                  document.documentElement.scrollWidth > innerWidth + 1 ||
                  dialog.scrollWidth > dialog.clientWidth + 1,
                style: {
                  background: css.backgroundColor,
                  color: css.color,
                  outline: css.outlineStyle,
                  outlineWidth: css.outlineWidth,
                },
              };
            });
            const label = `${width}/${control.id}/${state}`;
            assert.ok(
              measured.hit && measured.inViewport && !measured.overflow,
              `${label}: target visibility`,
            );
            assert.ok(
              measured.width >= 43.9 && measured.height >= 43.9 && measured.fontSize >= 16,
              `${label}: target size`,
            );
            assert.equal(measured.disabled, ["disabled", "busy"].includes(state), label);
            if (state === "busy") {
              assert.equal(measured.busy, "true");
              assert.equal(measured.label, control.busyLabel);
            }
            if (state === "focus") assert.equal(measured.focus, true, label);
            if (state === "hover") assert.equal(measured.hover, true, label);
            if (state === "pressed") assert.equal(measured.pressed, true, label);
            if (state === "default")
              assert.equal(measured.focus || measured.hover || measured.pressed, false, label);
            const scene = `${control.id}-${state}`,
              file = `${width}-${scene}.png`;
            expected.push(file);
            observations.push({ viewportWidth: width, id: control.id, state, ...measured });
            if (capture) {
              const bytes = await page.screenshot({
                path: path.join(root, file),
                fullPage: false,
                animations: "disabled",
              });
              screenshots.push({
                file,
                scene,
                pageId: "P25",
                viewport,
                fullPage: false,
                control: { actionId: control.actionId, selector: control.selector, state },
                sha256: hash(bytes),
              });
            }
          } finally {
            if (down) {
              const dialog = await target.locator("xpath=ancestor::dialog").boundingBox();
              assert.ok(dialog);
              await page.mouse.move(dialog.x + 16, dialog.y + 16);
              await page.mouse.up();
            }
          }
          assert.deepEqual(
            await page.evaluate(() => ({
              core: window.APPROVAL_C.state(),
              overlay: window.APPROVAL_CONTROL_C.state(),
            })),
            before,
            `${control.id}/${state}: appearance interaction changed intent`,
          );
          if (["busy", "disabled"].includes(state)) {
            const box = await target.boundingBox();
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            assert.deepEqual(
              await page.evaluate(() => ({
                core: window.APPROVAL_C.state(),
                overlay: window.APPROVAL_CONTROL_C.state(),
              })),
              before,
            );
          }
          if (state === "error") {
            await target.click();
            const core = await page.evaluate(() => window.APPROVAL_C.state());
            assert.equal(core.intents.length, 2);
            assert.deepEqual(core.intents[1], core.intents[0], "retry lost original fields");
          }
        }
      }
      assert.deepEqual(await page.evaluate(() => window.APPROVAL_C_DATA), originalFacts);
      assert.deepEqual(
        await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        [0, 0],
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      console.log(
        `approval_controls ${width}: native states, five bodies, disabled/no-repeat, failure/retry, facts stable; HTTP/storage/errors=0`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture) {
  assert.equal(screenshots.length, 64);
  const evidence = {
    version: "APPROVAL-CONTROLS-C-r1",
    approval: "pending",
    kind: "additive-listed-control-state-proof",
    sourceHashes,
    actionVisualReferences,
    observations,
    screenshots,
    boundary:
      "5 representative write controls,27 mapped native visual states and5 extra failure scenes at1440/390;64 PNG. Template/publish/request do not invent independent blank-field disabled scenes. Busy is a click-driven local pending proposal, not a live request; source Vue fields/close/async ownership remain unchanged. All variants/fields/themes/modal consumers/real service/user approval pending.",
  };
  await writeFile(path.join(root, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
  const stateLabels = {
    default: "默认",
    hover: "悬停",
    focus: "键盘焦点",
    pressed: "按下",
    disabled: "原因为空禁用",
    busy: "等待结果",
    error: "失败保留",
  };
  await writeFile(
    path.join(root, "gallery.html"),
    [
      '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P25 审批按钮逐态审核</title>',
      '<style>body{font:16px "Microsoft YaHei",sans-serif;background:#edf1f6;color:#202c3d;margin:24px}nav{display:flex;gap:16px;flex-wrap:wrap}section{margin-top:40px;border-top:2px solid #254a9c}img{max-width:100%;height:auto}figure{margin:20px 0}summary{min-height:44px;cursor:pointer;padding:12px}a{color:#254a9c}</style>',
      '<h1>P25 审批写入按钮 · 逐态待审</h1><p>5个代表控件，64张双端上下文图。默认/悬停/键盘焦点/按下为浏览器原生状态；处理中是点击后冻结请求预览的离线提案，不是API成功。失败图保留输入。未列的独立禁用态不补造。</p><nav><a href="index.html">交互稿</a><a href="README.md">范围与源码差异</a></nav>',
      ...Object.entries(actionVisualReferences).map(([id, value]) => {
        const shots = screenshots.filter((shot) => shot.control.actionId === id);
        return `<section><h2>${id}</h2><p>${value.selector} · 代表控件，不代表所有窗口/字段/角色</p>${shots.map((shot) => `<details><summary>${stateLabels[shot.control.state]} · ${shot.viewport.width}</summary><figure><img loading="lazy" src="${shot.file}" alt="${id} ${stateLabels[shot.control.state]} ${shot.viewport.width}"></figure></details>`).join("")}</section>`;
      }),
      "</html>",
    ].join("\n"),
  );
} else if (!smoke) {
  assert.deepEqual(
    previous.screenshots.map((shot) => shot.file),
    expected,
  );
  assert.deepEqual(previous.actionVisualReferences, actionVisualReferences);
  assert.deepEqual(previous.observations, observations);
}
if (!smoke)
  assert.deepEqual(
    (await readdir(root)).filter((file) => file.endsWith(".png")).sort(),
    [...expected].sort(),
  );
console.log(JSON.stringify({ passed: true, capture, smoke, observations: observations.length }));
