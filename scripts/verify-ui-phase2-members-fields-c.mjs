import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/members-fields-direction-c";
const root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex");
const args = process.argv.slice(2),
  capture = args.includes("--capture"),
  smoke = args.includes("--smoke");
assert.ok(args.every((s) => ["--capture", "--smoke"].includes(s)) && !(capture && smoke));
const parent = JSON.parse(
  await readFile(path.join(root, "../members-direction-c/evidence.json"), "utf8"),
);
const sourceHashes = { ...parent.sourceHashes };
for (const [file, sha] of Object.entries(sourceHashes))
  assert.equal(
    hash((await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n")),
    sha,
    file,
  );
for (const file of ["index.html", "fields.css", "fields.js"]
  .map((f) => `${relative}/${f}`)
  .concat(
    "scripts/verify-ui-phase2-members-fields-c.mjs",
    "design-plans/ui-phase-2-2026-09-07/design/members-controls-direction-c/controls.css",
  ))
  sourceHashes[file] = hash(
    (await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n"),
  );
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots) {
    assert.match(s.file, /^[\w-]+\.png$/);
    assert.equal(hash(await readFile(path.join(root, s.file))), s.sha256);
  }
}
const screenshots = [],
  checks = [],
  interactions = [],
  fieldVisualReferences = {};
const combinations = [
  "invite_invalid",
  "invite_partial",
  "invite_busy",
  "invite_success",
  "reason_disable",
  "reason_restore",
  "reason_role",
  "reason_revoke",
];
let catalog;
function contrast(a, b) {
  const l = (v) =>
    v
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((x) => x / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
      .reduce((n, x, i) => n + x * [0.2126, 0.7152, 0.0722][i], 0);
  const x = l(a),
    y = l(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
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
      await page.waitForFunction(() => Boolean(window.MEMBERS_FIELDS_C));
      const fields = await page.evaluate(() => window.MEMBERS_FIELDS_C.fields);
      assert.equal(fields.length, 10);
      if (catalog) assert.deepEqual(fields, catalog);
      else catalog = fields;
      const prepare = (id, state) =>
        page.evaluate(({ id, state }) => window.MEMBERS_FIELDS_C.prepare(id, state), { id, state });
      const current = () =>
        page.evaluate(() => ({ ...window.MEMBERS_C.state(), ...window.MEMBERS_FIELDS_C.state() }));
      for (const f of fields) {
        fieldVisualReferences[f.binding] ??= {
          pageId: "P30",
          label: f.label,
          selector: f.selector,
          scope: "source-field-proposal-not-Vue",
          options: f.options,
          states: {},
        };
        for (const state of smoke ? ["focus", f.states.at(-1)] : f.states) {
          await prepare(f.id, state);
          const target = page.locator(f.selector);
          assert.equal(await target.count(), 1);
          if (state === "corrected") {
            assert.equal(await target.getAttribute("aria-invalid"), "true");
            await target.fill(f.id === "emails" ? "correct@example.test" : "核验");
            assert.equal(await target.getAttribute("aria-invalid"), "false");
            assert.equal(await page.locator(`#field-${f.id}-error`).isHidden(), true);
          }
          if (state === "editable") {
            assert.equal(await target.isEnabled(), true);
            assert.equal(await page.locator("#invite-submit").isDisabled(), true);
            const value = f.select
              ? f.options.at(-1).value
              : f.id === "emails"
                ? "edited@example.test"
                : f.id === "query"
                  ? "陈"
                  : "继续编辑";
            if (f.select) await target.selectOption(value);
            else await target.fill(value);
            const s = await current();
            const actual = f.binding.startsWith("form.")
              ? s.form[f.binding.slice(5)]
              : f.id === "row-role"
                ? s.selections[await target.getAttribute("data-selection")]
                : s.filters[f.id];
            assert.equal(actual, value);
            assert.deepEqual(s.intents, []);
          }
          if (state.startsWith("option_"))
            assert.equal(await target.inputValue(), f.options[Number(state.slice(7))].value);
          if (["boundary254", "boundary255"].includes(state))
            assert.equal((await target.inputValue()).length, Number(state.slice(8)));
          if (state === "boundary500") {
            await target.focus();
            await page.keyboard.press("Control+End");
            await page.keyboard.insertText("多");
            assert.equal((await target.inputValue()).length, 500);
          }
          if (f.id === "shared-reason") {
            assert.equal(await target.getAttribute("maxlength"), null);
            assert.equal(
              await page.locator("#reason-confirm").isDisabled(),
              ["empty", "short"].includes(state),
            );
          }
          await page.mouse.move(1, 1);
          await page.evaluate(() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          });
          if (state === "focus") {
            for (
              let i = 0;
              i < 100 &&
              !(await target.evaluate(
                (el) => el === document.activeElement && el.matches(":focus-visible"),
              ));
              i++
            )
              await page.keyboard.press("Tab");
            assert.equal(
              await target.evaluate(
                (el) => el === document.activeElement && el.matches(":focus-visible"),
              ),
              true,
            );
          }
          await target.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
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
              label:
                el.getAttribute("aria-label") ||
                [...(el.labels ?? [])].map((l) => l.textContent).join(" "),
              required: el.required,
              disabled: el.disabled,
              invalid: el.getAttribute("aria-invalid"),
              described: el
                .getAttribute("aria-describedby")
                .split(" ")
                .every((id) => Boolean(document.getElementById(id))),
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
            };
          });
          assert.ok(
            m.hit &&
              !m.overflow &&
              m.label?.trim() &&
              m.described &&
              !m.disabled &&
              m.font >= 16 &&
              m.width >= 44 &&
              m.height >= 44,
            JSON.stringify({ id: f.id, state, m }),
          );
          assert.ok(contrast(m.border, m.background) >= 3, JSON.stringify({ id: f.id, state, m }));
          assert.ok(contrast(m.color, m.background) >= 4.5);
          if (state === "focus") assert.ok(contrast(m.outline, m.background) >= 3);
          assert.equal(
            m.required,
            ["emails", "invite-role", "invite-reason", "shared-reason"].includes(f.id),
          );
          const expectedInvalid =
            ["invalid", "mixed", "boundary255", "whitespace", "injected501", "short"].includes(
              state,
            ) ||
            (state === "empty" && f.id !== "query");
          assert.equal(m.invalid, String(expectedInvalid), f.id + " " + state);
          const error = page.locator(`#field-${f.id}-error`);
          assert.equal(await error.getAttribute("aria-live"), "polite");
          assert.equal(await error.isVisible(), expectedInvalid);
          const s = await current();
          assert.deepEqual(s.intents, []);
          assert.deepEqual(s.reasonIntents, []);
          const scene = `${f.id}-${state}`,
            file = `${scene}-${width}.png`;
          if (capture) {
            await page.screenshot({ path: path.join(root, file), animations: "disabled" });
            screenshots.push({
              file,
              scene,
              width,
              sha256: hash(await readFile(path.join(root, file))),
              control: { selector: f.selector, binding: f.binding, state },
            });
          }
          fieldVisualReferences[f.binding].states[state] = scene;
          checks.push({ field: f.id, state, width, metrics: m });
        }
      }
      // Preserve partial batch submission: an aria-invalid warning must not block valid addresses.
      for (const mode of ["mixed", "normalized", "boundary254", "boundary255"]) {
        await prepare("emails", mode);
        const before = await current();
        await page.locator("#invite-submit").click();
        const after = await current();
        const raw = before.form.emails
          .split(/[\n,;]+/)
          .map((v) => v.trim().toLowerCase())
          .filter(Boolean);
        const accepted = [...new Set(raw)].filter(
          (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254,
        );
        assert.deepEqual(
          after.intents,
          accepted.map((email) => ({
            url: "/org/admin/invitations",
            method: "POST",
            body: { email, role_code: before.form.role_code, reason: before.form.reason.trim() },
          })),
        );
        assert.deepEqual(after.items, before.items);
        assert.deepEqual(after.invitations, before.invitations);
        interactions.push({ width, kind: mode, intents: after.intents });
      }
      // Exercise every shared caller with >500 characters, using the current frontend contract.
      for (const action of ["disable", "restore", "role", "revoke"]) {
        await page.evaluate((action) => {
          window.MEMBERS_FIELDS_C.prepare("shared-reason");
          window.MEMBERS_C.scene(`reason_${action}`);
          window.MEMBERS_FIELDS_C.assign("shared-reason", "因".repeat(501));
        }, action);
        const before = await current();
        await page.locator("#reason-confirm").click();
        const after = await current();
        const d = before.dialog;
        assert.equal(await page.locator("dialog[open]").count(), 0);
        assert.deepEqual(after.intents, []);
        assert.deepEqual(after.reasonIntents, [
          {
            url:
              action === "revoke"
                ? `/org/admin/invitations/${d.item.id}/actions`
                : `/org/admin/members/${d.item.id}/${action === "role" ? "roles" : "actions"}`,
            method: "POST",
            body: {
              ...(action === "role" ? { role_code: d.role } : { action }),
              expected_version: d.item.version,
              reason: "因".repeat(501),
            },
          },
        ]);
        assert.deepEqual(after.items, before.items);
        assert.deepEqual(after.invitations, before.invitations);
        interactions.push({
          width,
          kind: `reason_${action}_501`,
          length: 501,
          closed: true,
          intentionsOnly: true,
        });
      }
      if (!smoke)
        for (const scene of combinations) {
          await page.evaluate((scene) => {
            window.MEMBERS_C.scene(scene);
            window.MEMBERS_FIELDS_C.decorate();
          }, scene);
          const target = scene.startsWith("reason_")
            ? page.locator("#reason-dialog")
            : page.locator("#invitation-section");
          const file = `${scene}-form-${width}.png`;
          if (capture) {
            await target.screenshot({ path: path.join(root, file) });
            screenshots.push({
              file,
              scene: `${scene}-form`,
              width,
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
  assert.equal(checks.length, catalog.reduce((n, f) => n + f.states.length, 0) * 2);
  assert.equal(screenshots.length, checks.length + combinations.length * 2);
  await writeFile(
    path.join(root, "evidence.json"),
    JSON.stringify(
      {
        version: "MEMBERS-FIELDS-C-r1",
        scope: "proposal-not-Vue-or-user-accepted",
        sourceHashes,
        catalog,
        fieldVisualReferences,
        combinations,
        checks,
        interactions,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  const html = [
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P30字段与表单待审</title><style>body{margin:24px;color:#202c3d;background:#edf1f6;font:16px/1.6 sans-serif}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px}figure{margin:0;padding:16px;background:white}img{width:100%;height:480px;object-fit:contain}</style>',
    `<h1>P30字段与表单待审</h1><p>10字段、${checks.length}字段状态图、16表单组合图；不是实际Vue或用户批准。</p><p><a href="index.html">交互稿</a> · <a href="README.md">边界说明</a></p><main>`,
  ];
  const combinationLabels = {
    invite_invalid: "非法与重复邮箱",
    invite_partial: "逐条部分失败",
    invite_busy: "邀请写入中",
    invite_success: "创建待投递",
    reason_disable: "禁用原因",
    reason_restore: "恢复原因",
    reason_role: "分配角色原因",
    reason_revoke: "撤销邀请原因",
  };
  for (const s of screenshots) {
    const f = s.control ? catalog.find((f) => f.binding === s.control.binding) : null;
    const label = f
      ? `${f.label} · ${f.stateLabels[s.control.state]}`
      : `表单组合 · ${combinationLabels[s.scene.replace(/-form$/, "")]}`;
    html.push(
      `<figure><a href="${s.file}"><img src="${s.file}" loading="lazy" alt="${label} ${s.width}"></a><figcaption>${label} · ${s.width}px</figcaption></figure>`,
    );
  }
  await writeFile(path.join(root, "gallery.html"), html.join("\n") + "\n</main></html>\n");
} else if (!smoke) {
  for (const [key, value] of Object.entries({
    catalog,
    checks,
    interactions,
    fieldVisualReferences,
  }))
    assert.deepEqual(previous[key], value, key);
}
console.log(
  JSON.stringify({
    mode: capture ? "capture" : smoke ? "smoke" : "verify",
    fields: catalog.length,
    states: catalog.reduce((n, f) => n + f.states.length, 0),
    checks: checks.length,
    interactions: interactions.length,
    screenshots: screenshots.length || previous?.screenshots.length || 0,
    httpRequests: 0,
    browserClosed: true,
  }),
);
