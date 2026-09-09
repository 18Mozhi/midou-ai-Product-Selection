import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { buildNotificationFormsData } from "./lib/ui-phase2-notification-forms-data.mjs";
import { buildNotificationDesignData } from "./lib/ui-phase2-notification-design-data.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "design-plans/ui-phase-2-2026-09-07/design/notification-forms-direction-c";
const root = path.join(repo, relative),
  hash = (v) => createHash("sha256").update(v).digest("hex");
const args = process.argv.slice(2);
assert.ok(args.every((a) => ["--smoke", "--capture"].includes(a)));
const smoke = args.includes("--smoke"),
  capture = args.includes("--capture");
assert.ok(!(smoke && capture));
const data = await buildNotificationFormsData(repo),
  baseData = await buildNotificationDesignData(repo);
const generated = "window.NOTIFICATION_FORMS_DATA = " + JSON.stringify(data, null, 2) + ";\n";
if (capture || smoke) await writeFile(path.join(root, "data.js"), generated);
else
  assert.equal(
    (await readFile(path.join(root, "data.js"), "utf8")).replaceAll("\r\n", "\n"),
    generated,
  );
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
for (const file of ["index.html", "forms.js", "forms.css", "data.js"]
  .map((f) => `${relative}/${f}`)
  .concat(
    "scripts/verify-ui-phase2-notification-forms-c.mjs",
    "scripts/lib/ui-phase2-notification-forms-data.mjs",
    "apps/web/src/api-client.ts",
  ))
  sourceHashes[file] = hash(
    (await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n"),
  );
const previous =
  !capture && !smoke ? JSON.parse(await readFile(path.join(root, "evidence.json"), "utf8")) : null;
if (previous) {
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(path.join(root, s.file))), s.sha256);
}
const cases = data.fields.flatMap((field) =>
  (field.disabled
    ? ["disabled"]
    : smoke
      ? ["focus", "pending"]
      : ["default", "focus", "off", "pending"]
  ).map((state) => ({
    scene: `field-${field.key}-${state}`,
    type: "field",
    field,
    state,
    base: state === "pending" ? "preferences_busy" : "preferences",
  })),
);
cases.push(
  ...[
    "preferences",
    "preferences_off",
    "preferences_busy",
    "preferences_error",
    "preferences_conflict",
  ].map((base) => ({ scene: `modal-${base}`, type: "modal", base })),
);
for (const d of data.diagnostics)
  for (const state of smoke
    ? ["expanded"]
    : ["default", "expanded", ...(d.scene === "error" ? ["hover", "focus", "pressed"] : [])])
    cases.push({
      scene: `diagnostic-${d.scene}-${state}`,
      type: "diagnostic",
      state,
      diagnostic: d,
      base: `diagnostic-${d.scene}`,
    });
const screenshots = [],
  checks = [],
  actionVisualReferences = {
    "AN-N-TECH-PAGE": {
      pageId: "P26",
      scope: "representative-control-only-not-all-variants-or-Vue",
      selector: "#page-technical summary",
      states: {},
    },
  };
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
        requests = [],
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route(/^https?:/, (r) => {
        requests.push(r.request().url());
        return r.abort();
      });
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => Boolean(window.NOTIFICATION_FORMS_C));
      assert.deepEqual(await page.evaluate(() => window.NOTIFICATION_FORMS_DATA), data);
      for (const c of cases) {
        await page.evaluate((scene) => window.NOTIFICATION_FORMS_C.prepare(scene), c.base);
        await page.mouse.move(0, 0);
        await page.evaluate(() => document.activeElement?.blur());
        const before = await page.evaluate(() => window.NOTIFICATION_C.state());
        let target;
        if (c.type === "field") {
          const input = page.locator(`#${c.field.key}`);
          target = page.locator(`label[for="${c.field.key}"]`);
          assert.equal(await input.isDisabled(), c.field.disabled);
          assert.equal(await input.getAttribute("type"), "checkbox");
          assert.equal(await input.getAttribute("required"), null);
          assert.equal(await input.getAttribute("aria-labelledby"), `${c.field.key}-label`);
          assert.equal(await input.getAttribute("aria-describedby"), `${c.field.key}-help`);
          assert.ok((await page.locator(`#${c.field.key}-help`).textContent()).trim());
          if (c.state === "off") await input.uncheck();
          if (c.state === "focus") {
            await page.locator("#preferences-close").focus();
            for (
              let i = 0;
              i < 20 && !(await input.evaluate((el) => el === document.activeElement));
              i++
            )
              await page.keyboard.press("Tab");
            assert.equal(
              await input.evaluate(
                (el) => el === document.activeElement && el.matches(":focus-visible"),
              ),
              true,
            );
          }
          if (c.field.disabled) assert.equal(await input.isChecked(), false);
        } else if (c.type === "diagnostic") {
          target = page.locator("#page-technical summary");
          assert.equal(
            await page.locator("#page-request-id").textContent(),
            c.diagnostic.requestId,
          );
          assert.equal(await page.locator("#page-request-id").isVisible(), false);
          if (c.state === "expanded") await target.click();
          if (c.state === "focus") {
            await page.locator("#preferences-open").focus();
            for (
              let i = 0;
              i < 25 && !(await target.evaluate((el) => el === document.activeElement));
              i++
            )
              await page.keyboard.press("Tab");
            assert.equal(await target.evaluate((el) => el.matches(":focus-visible")), true);
          }
        } else {
          target = page.locator(
            c.base === "preferences" || c.base === "preferences_off"
              ? "#preferences .modal-header"
              : ".preferences-actions",
          );
          assert.equal(
            await page.locator("#preference-form").evaluate((el) => el.checkValidity()),
            true,
          );
          assert.equal(await page.locator("#email_enabled").isChecked(), false);
          if (c.base === "preferences_error" || c.base === "preferences_conflict") {
            assert.equal(
              await page.locator("#preference-form").getAttribute("aria-describedby"),
              "preference-result",
            );
            assert.equal(await page.locator("#preference-result").getAttribute("role"), "status");
          }
        }
        await target.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
        if (["hover", "pressed"].includes(c.state)) {
          await target.hover();
          if (c.state === "pressed") await page.mouse.down();
        }
        const metrics = await target.evaluate((el) => {
          const r = el.getBoundingClientRect(),
            hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return {
            width: r.width,
            height: r.height,
            fullyVisible: r.top >= 6 && r.bottom <= innerHeight - 6,
            hit: el === hit || el.contains(hit),
            outline: getComputedStyle(el).outlineWidth,
            overflow:
              document.documentElement.scrollWidth > innerWidth + 1 ||
              [...document.querySelectorAll("dialog[open]")].some(
                (d) => d.scrollWidth > d.clientWidth + 1,
              ),
          };
        });
        assert.ok(
          metrics.width >= 44 && metrics.height >= 44 && metrics.fullyVisible && metrics.hit,
          JSON.stringify({ scene: c.scene, width, metrics }),
        );
        assert.equal(metrics.overflow, false);
        if (c.state === "focus") assert.ok(parseFloat(metrics.outline) >= 3);
        if (c.state === "hover")
          assert.equal(await target.evaluate((el) => el.matches(":hover")), true);
        if (c.state === "pressed")
          assert.equal(await target.evaluate((el) => el.matches(":active")), true);
        const current = await page.evaluate(() => window.NOTIFICATION_C.state());
        assert.deepEqual(current.rows, before.rows);
        assert.deepEqual(current.summary, before.summary);
        assert.deepEqual(current.intents, before.intents);
        const file = `${c.scene}-${width}.png`;
        if (capture) {
          await page.screenshot({ path: path.join(root, file) });
          screenshots.push({
            scene: c.scene,
            width,
            file,
            sha256: hash(await readFile(path.join(root, file))),
            ...(c.field ? { field: c.field.binding } : {}),
          });
        }
        if (
          c.type === "diagnostic" &&
          c.diagnostic.scene === "error" &&
          ["default", "hover", "focus", "pressed"].includes(c.state)
        )
          actionVisualReferences["AN-N-TECH-PAGE"].states[c.state] = c.scene;
        if (c.state === "pressed") {
          await page.mouse.move(0, 0);
          await page.mouse.up();
        }
        if (c.type === "field" && !c.field.disabled) {
          const input = page.locator(`#${c.field.key}`),
            prior = await input.isChecked();
          await target.click();
          assert.equal(await input.isChecked(), !prior);
          const next = await page.evaluate(() => window.NOTIFICATION_C.state());
          assert.equal(next.preferenceDraft[c.field.key], !prior);
          assert.deepEqual(next.intents, current.intents);
          if (c.state === "pending") assert.equal(next.pending, true);
        }
        if (c.type === "diagnostic") {
          if (c.state === "expanded") {
            assert.equal(await page.locator("#page-request-id").isVisible(), true);
            await target.click();
            assert.equal(await page.locator("#page-request-id").isVisible(), false);
          }
          assert.equal(
            (await page.evaluate(() => window.NOTIFICATION_C.state())).path,
            before.path,
          );
        }
        checks.push({ width, scene: c.scene, metrics, factsUnchanged: true });
      }
      // Turning all four editable fields off remains valid; no invented required/minimum selection.
      await page.evaluate(() => window.NOTIFICATION_FORMS_C.prepare("preferences_off"));
      await page.locator("#preferences-save").click();
      const intent = (await page.evaluate(() => window.NOTIFICATION_C.state())).intents.at(-1);
      assert.deepEqual(intent, {
        ...baseData.contracts.preferences,
        body: {
          ...baseData.contracts.preferences.body,
          in_app_enabled: false,
          task_enabled: false,
          approval_enabled: false,
          competitor_enabled: false,
        },
      });
      await page.keyboard.press("Escape");
      await page.locator("#preferences-open").click();
      for (const f of data.fields) assert.equal(await page.locator(`#${f.key}`).isChecked(), false);
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
  version: "NOTIFICATION-FORMS-C-r1",
  scope: "offline-proposal-not-runtime-or-user-accepted",
  sourceHashes,
  sourceFields: data.fields,
  diagnosticAdapterChecks: data.diagnostics,
  actionVisualReferences,
  checks,
  screenshots,
};
if (capture) {
  assert.equal(screenshots.length, 70);
  await writeFile(path.join(root, "evidence.json"), JSON.stringify(report, null, 2) + "\n");
  const head =
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P26 偏好与诊断图册</title>';
  const style =
    '<style>body{margin:24px;font:16px/1.7 "Microsoft YaHei",sans-serif;background:#eff2f7;color:#17243a}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px}figure{margin:0;padding:16px;background:white}img{width:100%;height:480px;object-fit:contain;object-position:top}a{color:#244b91}</style>';
  await writeFile(
    path.join(root, "gallery.html"),
    head +
      style +
      '<h1>P26 / 偏好与诊断 · 待审</h1><p>五个现有字段、两端70张图。邮件禁用、全关可保存、错误就近展示；合成编号不是生产请求。</p><p><a href="index.html">交互审核</a> · <a href="README.md">范围与缺口</a></p><main>' +
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
  assert.deepEqual(previous.actionVisualReferences, actionVisualReferences);
  assert.deepEqual(previous.diagnosticAdapterChecks, data.diagnostics);
}
console.log(
  JSON.stringify({
    mode: capture ? "capture" : smoke ? "smoke" : "verify",
    checks: checks.length,
    screenshots: screenshots.length || previous?.screenshots.length || 0,
    sourceFields: data.fields.length,
    diagnosticSourceChecks: data.diagnostics.length,
    browserClosed: true,
    networkRequests: 0,
  }),
);
