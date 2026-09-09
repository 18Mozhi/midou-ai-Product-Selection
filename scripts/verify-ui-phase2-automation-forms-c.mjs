import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import {
  validateAutomationFieldContract,
  validateAutomationFieldEvidence,
} from "./lib/ui-phase2-automation-form-review.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/automation-forms-direction-c";
const root = path.join(repo, relative);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const args = process.argv.slice(2);
assert.ok(args.every((v) => ["--smoke", "--capture"].includes(v)));
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
for (const file of ["index.html", "forms.js", "forms.css", "fields.js"]
  .map((f) => `${relative}/${f}`)
  .concat(
    "scripts/verify-ui-phase2-automation-forms-c.mjs",
    "scripts/lib/ui-phase2-automation-form-review.mjs",
  ))
  sourceHashes[file] = hash(
    (await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n"),
  );
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  assert.equal(previous.screenshots.length, 114);
  for (const shot of previous.screenshots) {
    assert.match(shot.file, /^[\w-]+\.png$/);
    assert.equal(hash(await readFile(path.join(root, shot.file))), shot.sha256, shot.file);
  }
}
const screenshots = [],
  checks = [],
  fieldVisualReferences = {};
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
      await page.waitForFunction(() => Boolean(window.AUTOMATION_FORMS_C));
      const fields = await page.evaluate(() => window.AUTOMATION_FORMS_C.fields);
      validateAutomationFieldContract(
        await readFile(path.join(repo, "apps/web/src/components/AutomationRuleCenter.vue"), "utf8"),
        fields,
      );
      if (previous)
        validateAutomationFieldEvidence(
          fields,
          JSON.parse(
            await readFile(
              path.join(repo, "design-plans/ui-phase-2-2026-09-07/action-reviews/P27.json"),
              "utf8",
            ),
          ),
          previous,
        );
      const state = () => page.evaluate(() => window.AUTOMATION_C.state());
      async function center(selector) {
        const target = page.locator(selector);
        await target.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
        return target;
      }
      async function click(selector) {
        await (await center(selector)).click();
      }
      async function validForm(skip = "") {
        for (const f of fields) {
          const target = page.locator(`#${f.id}`);
          if (f.id === skip || !(await target.count()) || !f.required) continue;
          if (f.tag === "select") {
            const value = await target
              .locator("option:not([disabled])")
              .first()
              .getAttribute("value");
            assert.ok(value);
            await target.selectOption(value);
          } else if (f.id === "reason") await target.fill("核验后调整频率");
          else if (f.type === "number")
            await target.fill(f.id === "rate_limit_count" ? "20" : "60");
          else await target.fill(f.id === "name" ? "审批超时提醒" : "审批超时，请人工处理");
        }
      }
      async function keyboardFocus(target) {
        await page.keyboard.press("Tab");
        for (
          let i = 0;
          i < 70 && !(await target.evaluate((el) => el === document.activeElement));
          i++
        )
          await page.keyboard.press("Tab");
        assert.equal(await target.evaluate((el) => el.matches(":focus-visible")), true);
      }
      async function record(scene, selector, field = null, mode = null) {
        const target = await center(selector);
        const metrics = await target.evaluate((el) => {
          const r = el.getBoundingClientRect(),
            hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return {
            width: r.width,
            height: r.height,
            font: parseFloat(getComputedStyle(el).fontSize),
            hit: el === hit || el.contains(hit),
            overflow:
              document.documentElement.scrollWidth > innerWidth + 1 ||
              [...document.querySelectorAll("dialog[open]")].some(
                (d) => d.scrollWidth > d.clientWidth + 1,
              ),
          };
        });
        assert.ok(
          metrics.width >= 44 &&
            metrics.height >= 44 &&
            metrics.font >= 16 &&
            metrics.hit &&
            !metrics.overflow,
          JSON.stringify({ scene, width, metrics }),
        );
        if (field) {
          const contrast = await target.evaluate((el) => {
            const luminance = (color) => {
              const rgb = color
                .match(/[\d.]+/g)
                .slice(0, 3)
                .map(Number)
                .map((n) => {
                  const c = n / 255;
                  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
                });
              return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
            };
            const style = getComputedStyle(el),
              background = luminance(style.backgroundColor);
            const ratio = (color) => {
              const value = luminance(color);
              return (Math.max(value, background) + 0.05) / (Math.min(value, background) + 0.05);
            };
            return { border: ratio(style.borderTopColor), text: ratio(style.color) };
          });
          assert.ok(
            contrast.border >= 3 && contrast.text >= 4.5,
            JSON.stringify({ scene, contrast }),
          );
          metrics.contrast = contrast;
          assert.equal((await target.getAttribute("aria-describedby")) !== null, true);
          assert.ok((await page.locator(`#${field.id}-hint`).textContent()).includes(field.hint));
          fieldVisualReferences[field.binding] ??= {
            pageId: "P27",
            scope: "offline-field-proposal-not-Vue-or-user-accepted",
            selector,
            states: {},
          };
          fieldVisualReferences[field.binding].states[mode] = scene;
        }
        const file = `${scene}-${width}.png`;
        if (capture) {
          await page.screenshot({ path: path.join(root, file) });
          screenshots.push({
            scene,
            width,
            file,
            sha256: hash(await readFile(path.join(root, file))),
            ...(field ? { field: { binding: field.binding, selector, state: mode } } : {}),
          });
        }
        checks.push({ scene, width, selector, metrics });
      }
      for (const field of fields) {
        const modes = smoke
          ? ["focus", ...(field.required ? ["missing"] : [])]
          : [
              "default",
              "focus",
              "busy",
              ...(field.required ? ["missing"] : []),
              ...(field.type === "number" ? ["min", "max", "below", "above", "fraction"] : []),
              ...(field.maxlength ? ["maxlength"] : []),
            ];
        for (const mode of modes) {
          await page.evaluate((id) => window.AUTOMATION_FORMS_C.prepare(id), field.id);
          await validForm(mode === "missing" && field.tag === "select" ? field.id : "");
          const target = page.locator(`#${field.id}`);
          const before = await state();
          assert.deepEqual(before.intents, []);
          if (mode === "focus") await keyboardFocus(target);
          else await page.evaluate(() => document.activeElement?.blur());
          if (mode === "missing" && field.tag !== "select") await target.fill("");
          if (["min", "max", "below", "above", "fraction"].includes(mode)) {
            const value = {
              min: field.min,
              max: field.max,
              below: field.min - 1,
              above: field.max + 1,
              fraction: 1.5,
            }[mode];
            await target.fill(String(value));
          }
          if (mode === "maxlength") {
            await target.fill("字".repeat(field.maxlength));
            await target.press("End");
            await target.pressSequentially("另");
            assert.equal((await target.inputValue()).length, field.maxlength);
          }
          if (["missing", "below", "above", "fraction"].includes(mode)) {
            await click("#preview");
            assert.deepEqual((await state()).intents, []);
            assert.equal(await target.getAttribute("aria-invalid"), "true");
            assert.ok(
              (await target.getAttribute("aria-describedby")).includes(`${field.id}-error`),
            );
            assert.equal(await target.evaluate((el) => el === document.activeElement), true);
            assert.ok(
              (await page.locator(`#${field.id}-error`).textContent()).includes(
                field.type === "number" && mode !== "missing" ? "整数" : field.label,
              ),
            );
          } else if (mode === "busy") {
            await page.evaluate(() => window.AUTOMATION_C.setMode("busy"));
            await click("#save");
            const pending = await state();
            assert.equal(pending.busy, true);
            assert.equal(pending.intents.length, 1);
            assert.equal(await target.isEnabled(), true, "saving does not freeze source fields");
            let changed = true;
            if (field.tag === "select") {
              const values = await target
                .locator("option:not([disabled])")
                .evaluateAll((els) => els.map((el) => el.value));
              const next = values.find((v) => v !== pending.form[field.id]);
              changed = Boolean(next);
              // Existing fixture returns one member; do not invent a second selectable identity.
              await target.selectOption(next ?? values[0]);
            } else await target.fill(field.type === "number" ? "2" : "提交后的新草稿");
            const after = await state();
            assert.equal(after.busy, true);
            assert.deepEqual(
              after.intents,
              pending.intents,
              "pending body cannot change with draft",
            );
            assert[changed ? "notDeepEqual" : "deepEqual"](
              { form: after.form, reason: after.reason },
              { form: pending.form, reason: pending.reason },
            );
            assert.equal(await page.locator("#save").isDisabled(), true);
          } else {
            assert.equal(await target.evaluate((el) => el.validity.valid), true);
            assert.deepEqual((await state()).intents, []);
          }
          await record(`${field.id}-${mode}`, `#${field.id}`, field, mode);
          if (["missing", "below", "above", "fraction"].includes(mode)) {
            await validForm();
            assert.equal(
              await target.getAttribute("aria-invalid"),
              null,
              "fixed field no longer has stale error",
            );
            assert.equal(await page.locator(`#${field.id}-error`).count(), 0);
          }
        }
      }
      if (!smoke) {
        await page.evaluate(() => window.AUTOMATION_FORMS_C.prepare("action_assignee_id"));
        await validForm();
        await page.locator("#trigger_event_type").selectOption("task.created");
        assert.equal((await state()).form.action_type, "notify_owner");
        assert.equal((await state()).form.action_assignee_id, "");
        assert.equal(await page.locator("#action_assignee_id").count(), 0);
        assert.deepEqual(
          await page.locator("#action_type option").evaluateAll((els) => els.map((el) => el.value)),
          ["notify_owner"],
        );
        await record("task-trigger", "#action_type");
        for (const kind of ["empty", "error"]) {
          await page.evaluate((k) => window.AUTOMATION_C.scene(`members_${k}`), kind);
          assert.equal(await page.locator("#owner_id option:not([disabled])").count(), 0);
          assert.equal(await page.locator("#owner_id").isEnabled(), true);
          assert.equal((await state()).memberState, kind);
          assert.ok(
            (await page.locator("#member-warning").textContent()).includes(
              kind === "error" ? "读取失败" : "为空",
            ),
          );
          await record(`members-${kind}`, "#owner_id");
        }
        await page.evaluate(() => window.AUTOMATION_C.scene("preview"));
        assert.ok((await state()).preview);
        await page.locator("#rate_limit_count").fill("2");
        assert.equal((await state()).preview, null);
        assert.equal((await state()).intents.length, 1);
        await record("preview-edited", "#preview-section");
        await page.evaluate(() => window.AUTOMATION_FORMS_C.prepare("reason"));
        await validForm();
        await page.evaluate(() => window.AUTOMATION_C.setMode("response"));
        await click("#preview");
        const withPreview = await state();
        assert.ok(withPreview.preview);
        assert.equal(Object.hasOwn(withPreview.intents[0].body, "reason"), false);
        await page.locator("#reason").fill("仅补充审计原因");
        assert.deepEqual((await state()).preview, withPreview.preview);
        assert.deepEqual((await state()).intents, withPreview.intents);
        await record("reason-preview-retained", "#reason");
        for (const kind of ["create", "edit"]) {
          await page.evaluate(
            (id) => window.AUTOMATION_FORMS_C.prepare(id),
            kind === "edit" ? "reason" : "name",
          );
          await validForm();
          const draft = await state();
          await page.evaluate(
            (m) => window.AUTOMATION_C.setMode(m),
            kind === "edit" ? "conflict" : "error",
          );
          await click("#save");
          const after = await state();
          assert.deepEqual(after.form, draft.form);
          assert.equal(after.reason, draft.reason);
          assert.deepEqual(after.rows, draft.rows);
          assert.equal(after.busy, false);
          assert.equal(after.intents.length, 1);
          assert.equal(after.intents[0].method, kind === "edit" ? "PATCH" : "POST");
          await record(kind === "edit" ? "edit-conflict" : "create-failure", "#editor-result");
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
  assert.equal(screenshots.length, 114);
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        version: "AUTOMATION-FORMS-C-r1",
        scope: "offline-proposal-not-runtime-or-user-accepted",
        sourceHashes,
        fieldVisualReferences,
        checks,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    path.join(root, "gallery.html"),
    '<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P27字段状态待审</title><style>body{margin:24px;background:#edf1f6;color:#202c3d;font:16px/1.6 sans-serif}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px}figure{margin:0;padding:16px;background:white}img{width:100%;height:480px;object-fit:contain}a{color:#254a9c}</style><h1>P27 自动化规则 · 字段状态待审</h1><p>10字段、50字段状态和7组合场景，双端114图。仅图稿，未连接API；真实Vue及具体审核仍待。</p><p><a href="index.html">交互稿</a> · <a href="README.md">逐字段范围与差异</a></p><main>' +
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
  assert.deepEqual(previous.fieldVisualReferences, fieldVisualReferences);
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
