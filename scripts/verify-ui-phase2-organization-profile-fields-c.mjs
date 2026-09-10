import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative =
  "design-plans/ui-phase-2-2026-09-07/design/organization-profile-fields-direction-c";
const root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex");
const args = process.argv.slice(2),
  capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
assert.ok(args.every((v) => ["--capture", "--smoke"].includes(v)) && !(capture && smoke));
const parent = JSON.parse(
  await readFile(path.join(root, "../organization-profile-direction-c/evidence.json"), "utf8"),
);
const sourceHashes = { ...parent.sourceHashes };
for (const [file, sha] of Object.entries(sourceHashes))
  assert.equal(
    hash((await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n")),
    sha,
    file,
  );
for (const file of ["index.html", "fields.js", "fields.css"]
  .map((f) => `${relative}/${f}`)
  .concat("scripts/verify-ui-phase2-organization-profile-fields-c.mjs"))
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
function contrast(a, b) {
  const luminance = (color) =>
    color
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const screenshots = [],
  checks = [],
  fieldVisualReferences = {},
  actionVisualReferences = {};
const combinations = [
  "editing",
  "save_busy",
  "save_conflict",
  "write_read_failed",
  "save_timeout",
  "missing_workspace",
  "no_options",
  "archived_option",
];
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
      await page.route(/^https?:/, (r) => {
        requests.push(r.request().url());
        return r.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => Boolean(window.ORG_PROFILE_FIELDS_C));
      const fields = await page.evaluate(() => window.ORG_PROFILE_FIELDS_C.fields);
      assert.equal(fields.length, 6);
      for (const field of fields) {
        fieldVisualReferences[field.binding] ??= {
          pageId: "P29",
          label: field.label,
          selector: field.selector,
          scope: "six-source-fields-proposal-not-Vue",
          states: {},
        };
        for (const state of smoke ? ["focus", "invalid"] : field.states) {
          await page.evaluate(({ id, state }) => window.ORG_PROFILE_FIELDS_C.prepare(id, state), {
            id: field.id,
            state,
          });
          const target = page.locator(field.selector);
          assert.equal(await target.count(), 1);
          if (state === "corrected") {
            const value = await page.evaluate(
              (id) =>
                id === "reason" ? "核验组织资料" : window.ORG_PROFILE_C_DATA.initialForm[id],
              field.id,
            );
            if (field.id === "default_workspace_id") await target.selectOption(String(value));
            else await target.fill(String(value));
            assert.equal(await target.evaluate((el) => el.checkValidity()), true);
            assert.equal(await target.getAttribute("aria-invalid"), "false");
            assert.equal(await page.locator(`#${field.id}-error`).isHidden(), true);
          }
          if (state === "save_editable") {
            assert.equal(await target.isEnabled(), true);
            assert.equal(await page.locator("#save-profile").isDisabled(), true);
            if (field.id !== "default_workspace_id") {
              const value =
                field.id === "data_retention_days"
                  ? "366"
                  : field.id === "logo_url"
                    ? "https://example.test/edited.png"
                    : "继续编辑";
              await target.fill(value);
              assert.equal(
                String((await page.evaluate(() => window.ORG_PROFILE_C.state())).form[field.id]),
                value,
              );
            }
          }
          await page.mouse.move(1, 1);
          await page.evaluate(() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          });
          if (state === "focus") {
            await page.keyboard.press("Tab");
            for (
              let i = 0;
              i < 80 && !(await target.evaluate((el) => el === document.activeElement));
              i++
            )
              await page.keyboard.press("Tab");
            assert.equal(await target.evaluate((el) => el.matches(":focus-visible")), true);
          }
          await target.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
          if (["hover", "pressed"].includes(state)) await target.hover();
          if (state === "pressed") await page.mouse.down();
          if (["hover", "pressed"].includes(state))
            assert.equal(
              await target.evaluate(
                (el, s) => el.matches(s === "pressed" ? ":active" : ":hover"),
                state,
              ),
              true,
            );
          const m = await target.evaluate((el) => {
            const r = el.getBoundingClientRect(),
              css = getComputedStyle(el),
              hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return {
              width: r.width,
              height: r.height,
              font: parseFloat(css.fontSize),
              border: css.borderTopColor,
              color: css.color,
              background: css.backgroundColor,
              outline: css.outlineColor,
              hit: el === hit || el.contains(hit),
              required: el.required,
              disabled: el.disabled,
              invalid: el.getAttribute("aria-invalid"),
              label: document.querySelector(`label[for='${el.id}']`)?.textContent,
              descriptions: el
                .getAttribute("aria-describedby")
                .split(" ")
                .every((id) => Boolean(document.getElementById(id))),
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
            };
          });
          assert.ok(
            m.label &&
              m.descriptions &&
              m.hit &&
              !m.overflow &&
              !m.disabled &&
              m.font >= 16 &&
              m.width >= 44 &&
              m.height >= 44,
            JSON.stringify({ field, state, m }),
          );
          assert.equal(m.required, field.id !== "logo_url");
          assert.ok(contrast(m.border, m.background) >= 3);
          assert.ok(contrast(m.color, m.background) >= 4.5);
          if (state === "focus") assert.ok(contrast(m.outline, m.background) >= 3);
          const error = page.locator(`#${field.id}-error`);
          assert.equal(await error.getAttribute("aria-live"), "polite");
          if (state === "invalid") {
            assert.equal(m.invalid, "true");
            assert.equal(await error.isVisible(), true);
            assert.ok(await error.textContent());
          }
          assert.deepEqual((await page.evaluate(() => window.ORG_PROFILE_C.state())).intents, []);
          assert.equal(await page.locator("dialog").count(), 0);
          await page.evaluate(() => window.getSelection()?.removeAllRanges());
          const scene = `${field.id}-${state}`,
            file = `${scene}-${width}.png`;
          if (capture) {
            await page.screenshot({ path: path.join(root, file) });
            screenshots.push({
              scene,
              width,
              file,
              sha256: hash(await readFile(path.join(root, file))),
              control: { selector: field.selector, binding: field.binding, state },
            });
          }
          fieldVisualReferences[field.binding].states[state] = scene;
          if (field.id === "logo_url" && ["default", "hover", "focus", "pressed"].includes(state)) {
            actionVisualReferences["OG-PROFILE-LOGO"] ??= {
              pageId: "P29",
              scope: "representative-control-only-not-all-variants-or-Vue",
              selector: "#logo_url",
              states: {},
            };
            actionVisualReferences["OG-PROFILE-LOGO"].states[state] = scene;
          }
          checks.push({ field: field.id, width, state, metrics: m });
          if (state === "pressed") {
            await page.mouse.move(1, 1);
            await page.mouse.up();
          }
        }
      }
      if (!smoke)
        for (const scene of combinations) {
          await page.evaluate((scene) => window.ORG_PROFILE_FIELDS_C.combination(scene), scene);
          assert.equal(
            await page
              .locator("#profile-form input,#profile-form select,#profile-form textarea")
              .count(),
            6,
          );
          if (scene === "editing")
            for (const id of ["name", "logo_url", "timezone", "reason"]) {
              const el = page.locator(`#${id}`),
                limit = Number(await el.getAttribute("maxlength"));
              assert.equal((await el.inputValue()).length, limit);
              assert.equal(
                await page.locator(`#${id}-count`).textContent(),
                `${limit} / ${limit} 字符`,
              );
              await el.focus();
              await page.keyboard.press("End");
              await page.keyboard.insertText("多");
              assert.equal((await el.inputValue()).length, limit);
            }
          if (scene === "no_options")
            assert.equal(
              await page.locator("#default_workspace_id option:not([disabled])").count(),
              0,
            );
          if (scene === "archived_option")
            assert.equal(
              await page.locator("#default_workspace_id option:not([disabled])").count(),
              1,
            );
          const file = `${scene}-form-${width}.png`;
          if (capture) {
            await page.locator(".edit-paper").screenshot({ path: path.join(root, file) });
            screenshots.push({
              scene: `${scene}-form`,
              width,
              file,
              sha256: hash(await readFile(path.join(root, file))),
              scope: "form-combination-not-all-runtime-states",
            });
          }
        }
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      assert.deepEqual(await context.cookies(), []);
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (capture) {
  assert.equal(screenshots.length, 110);
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        version: "ORG-PROFILE-FIELDS-C-r1",
        scope: "proposal-not-Vue-or-user-accepted",
        sourceHashes,
        fieldVisualReferences,
        actionVisualReferences,
        combinations,
        checks,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  const html = [
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    "<title>P29 六字段状态待审</title><style>body{margin:24px;color:#202c3d;background:#edf1f6;font:16px/1.6 sans-serif}",
    "main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px}figure{margin:0;padding:16px;background:white}img{width:100%;height:480px;object-fit:contain}</style>",
    "<h1>P29 六字段状态待审</h1><p>94字段状态图＋16表单组合图；保存中仍可编辑。不代表真实Vue、全部组合或用户批准。</p>",
    '<p><a href="index.html">交互稿</a> · <a href="README.md">范围说明</a></p><main>',
  ];
  const stateLabels = {
    default: "默认",
    hover: "悬停",
    focus: "键盘焦点",
    pressed: "按下",
    empty: "留空",
    invalid: "校验失败",
    corrected: "修正后",
    save_editable: "保存中仍可编辑",
  };
  const formLabels = {
    editing: "最大字符数",
    save_busy: "保存中",
    save_conflict: "版本冲突",
    write_read_failed: "写入成功但重读失败",
    save_timeout: "保存结果未确认",
    missing_workspace: "默认工作区缺失",
    no_options: "没有可选工作区",
    archived_option: "返回归档工作区",
  };
  for (const s of screenshots) {
    const label = s.control
      ? `${fieldVisualReferences[s.control.binding].label} · ${stateLabels[s.control.state]}`
      : `表单组合 · ${formLabels[s.scene.replace(/-form$/, "")]}`;
    html.push(
      `<figure><a href="${s.file}"><img src="${s.file}" loading="lazy" alt="${label} ${s.width}"></a><figcaption>${label} · ${s.width}px</figcaption></figure>`,
    );
  }
  await writeFile(path.join(root, "gallery.html"), html.join("\n") + "\n</main></html>\n");
} else if (!smoke) {
  assert.deepEqual(previous.checks, checks);
  assert.deepEqual(previous.fieldVisualReferences, fieldVisualReferences);
  assert.deepEqual(previous.actionVisualReferences, actionVisualReferences);
}
console.log(
  JSON.stringify({
    mode: capture ? "capture" : smoke ? "smoke" : "verify",
    checks: checks.length,
    screenshots: screenshots.length || previous?.screenshots.length || 0,
    httpRequests: 0,
    browserClosed: true,
  }),
);
