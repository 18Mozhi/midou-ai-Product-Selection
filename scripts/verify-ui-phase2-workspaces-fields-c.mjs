import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const base = "design-plans/ui-phase-2-2026-09-07/design";
const output = `${base}/workspaces-fields-direction-c`;
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(
  process.argv.slice(2).every((a) => ["--capture", "--smoke"].includes(a)) && !(capture && smoke),
);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const parent = JSON.parse(await readFile(`${base}/workspaces-direction-c/evidence.json`, "utf8"));
const sourceHashes = { ...parent.sourceHashes };
for (const [file, sha] of Object.entries(sourceHashes))
  assert.equal(hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")), sha, file);
for (const file of ["index.html", "fields.css", "fields.js"]
  .map((f) => `${output}/${f}`)
  .concat(
    `${base}/workspaces-controls-direction-c/controls.css`,
    "scripts/verify-ui-phase2-workspaces-fields-c.mjs",
  ))
  sourceHashes[file] = hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n"));
const approvedFile = `${base}/workspaces-controls-direction-c/composition-restore-390.png`;
const approvedHash = "640c22bdbccc5a6f7fc24b427487f6d0e25f23418d2080a453035aff17c49176";
assert.equal(hash(await readFile(approvedFile)), approvedHash);
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(`${output}/evidence.json`, "utf8"));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots) {
    assert.match(s.file, /^[a-z_-]+-(1440|390)\.png$/);
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
  }
}
const checks = [],
  screenshots = [],
  observations = [];
let fields, compositions;
const browser = await chromium.launch({ headless: true });
try {
  for (const width of smoke ? [390] : [1440, 390]) {
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
      await page.route(/^https?:/u, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.goto(pathToFileURL(path.resolve(output, "index.html")).href);
      await page.waitForFunction(() => !!window.WORKSPACE_FIELDS_C);
      const catalog = await page.evaluate(() => ({
        fields: window.WORKSPACE_FIELDS_C.fields,
        compositions: window.WORKSPACE_FIELDS_C.compositions,
      }));
      fields = catalog.fields;
      compositions = catalog.compositions;
      const check = (name, actual, expected = true) => {
        assert.deepEqual(actual, expected, `${width}: ${name}`);
        checks.push({ width, name });
      };
      const prepare = (id, state) =>
        page.evaluate(([i, s]) => window.WORKSPACE_FIELDS_C.prepare(i, s), [id, state]);
      const state = () => page.evaluate(() => window.WORKSPACES_C.state());
      const shot = async (scene, selector, meta = {}) => {
        check(
          `${scene}: no page overflow`,
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        if (capture) {
          await page.mouse.move(1, 1);
          const file = `${scene}-${width}.png`,
            bytes = await page.locator(selector).screenshot();
          await writeFile(`${output}/${file}`, bytes);
          screenshots.push({
            file,
            scene,
            width,
            pageId: "P32",
            scope: "offline-field-proposal-not-production",
            sha256: hash(bytes),
            ...meta,
          });
        }
      };
      for (const field of fields)
        for (const variant of field.states) {
          await prepare(field.id, variant);
          const input = page.locator(field.selector),
            key = `${field.id}-${variant}`;
          const properties = await input.evaluate((n) => ({
            disabled: n.disabled,
            required: n.required,
            max: n.maxLength,
            label: !!document.querySelector(`label[for="${n.id}"]`),
            size: parseFloat(getComputedStyle(n).fontSize),
            height: n.getBoundingClientRect().height,
            help: (n.getAttribute("aria-describedby") || "")
              .split(" ")
              .filter(Boolean)
              .map((id) => !!document.getElementById(id)),
          }));
          check(
            `${key}: accessible label and readable target`,
            properties.label && properties.size >= 16 && properties.height >= 44,
          );
          check(`${key}: editable`, properties.disabled, false);
          if (field.max) {
            check(
              `${key}: source required and max`,
              [properties.required, properties.max],
              [true, field.max],
            );
            check(`${key}: linked help count and error`, properties.help, [true, true, true]);
            check(
              `${key}: counter`,
              await page.locator(`#${field.id}-field-count`).innerText(),
              `${(await input.inputValue()).length}/${field.max}`,
            );
          }
          if (
            ["empty", "whitespace", "uppercase", "leading-hyphen", "trailing-hyphen"].includes(
              variant,
            )
          ) {
            check(`${key}: inline invalid`, await input.getAttribute("aria-invalid"), "true");
            check(`${key}: no write intent`, (await state()).intents, []);
            check(
              `${key}: error text visible`,
              (await page.locator(`#${field.id}-error`).innerText()).length > 0,
            );
          }
          if (variant === "corrected")
            check(`${key}: local error clears`, await input.getAttribute("aria-invalid"), "false");
          if (variant === "focus") {
            await input.focus();
            check(
              `${key}: visible keyboard focus`,
              await input.evaluate(
                (n) =>
                  n === document.activeElement &&
                  n.matches(":focus-visible") &&
                  getComputedStyle(n).outlineWidth === "3px",
              ),
            );
          }
          if (variant === "pending") {
            check(
              `${key}: submission and cancel disabled`,
              [
                await page.locator("#create-submit").isDisabled(),
                await page.locator("#cancel-create").isDisabled(),
              ],
              [true, true],
            );
            await input.fill(field.id === "slug" ? "later-draft" : "提交期间后续编辑");
            check(
              `${key}: actual draft changes`,
              (await state()).form[field.id],
              await input.inputValue(),
            );
          }
          if (variant === "boundary") {
            await input.focus();
            await input.press("End");
            await input.press("x");
            check(
              `${key}: native extra character blocked`,
              (await input.inputValue()).length,
              field.max,
            );
          }
          if (field.id === "sort" && !["default", "focus"].includes(variant))
            check(`${key}: exact sort value`, (await state()).sort, variant);
          if (key === "query-no-result")
            check(
              `${key}: honest empty result`,
              await page.locator(".workspace-list li").count(),
              0,
            );
          if (key === "query-cleared") check(`${key}: clears query`, (await state()).query, "");
          await shot(key, field.max ? `[data-field="${field.id}"]` : ".filter-fields", {
            field: field.id,
            variant,
          });
        }
      for (const [scene] of Object.entries(compositions)) {
        await prepare(scene);
        await shot(scene, "#create-form", { composition: true });
      }
      // Real browser events through the existing renderer; no synthetic HTTP success.
      await prepare("create-ready");
      await page.locator("#workspace-name").fill("  北美新品决策  ");
      await page.locator("#workspace-slug").fill("north-america-launch");
      await page.locator("#workspace-reason").fill("  划分新品团队的数据边界  ");
      await page.evaluate(() => window.WORKSPACES_C.setMode("hold"));
      await page.locator("#create-submit").click();
      const submitted = await state();
      check("exact trimmed create intent", submitted.intents, [
        {
          url: "/org/admin/workspaces",
          method: "POST",
          body: {
            name: "北美新品决策",
            slug: "north-america-launch",
            reason: "划分新品团队的数据边界",
          },
        },
      ]);
      await page.locator("#create-submit").evaluate((n) => n.click());
      check("disabled submit no duplicate", (await state()).intents, submitted.intents);
      check("waiting creates no fake row", (await state()).items.length, submitted.items.length);
      await prepare("create-ready");
      await page.locator("#cancel-create").click();
      check("cancel clears draft", (await state()).form, { name: "", slug: "", reason: "" });
      check("cancel closes inline form", await page.locator("#create-form").count(), 0);
      check("cancel never submits", (await state()).intents, []);
      check("no browser errors", errors, []);
      check("no HTTP", requests, []);
      check("no cookies", await context.cookies(), []);
      check(
        "no storage",
        await page.evaluate(() => localStorage.length + sessionStorage.length),
        0,
      );
      observations.push({
        width,
        exactCreateIntent: submitted.intents[0],
        fieldsRemainEditable: true,
        noProductionWrites: true,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
assert.equal(hash(await readFile(approvedFile)), approvedHash);
if (capture) {
  assert.equal(
    screenshots.length,
    2 * (fields.reduce((n, f) => n + f.states.length, 0) + Object.keys(compositions).length),
  );
  await writeFile(
    `${output}/evidence.json`,
    JSON.stringify(
      {
        kind: "WORKSPACES-FIELDS-C-r1",
        approval: "pending-user-review",
        boundary:
          "Independent field proposal; real Vue remains unchanged. Source field contracts retained; local error presentation is proposed. Shared reason dialog excluded. Pending editing snapshot does not decide later-draft completion policy.",
        sourceHashes,
        fields,
        compositions,
        checks,
        observations,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  const groups = [
    ...fields.map((f) => ({ label: f.label, shots: screenshots.filter((s) => s.field === f.id) })),
    ...Object.entries(compositions).map(([key, [, label]]) => ({
      label,
      shots: screenshots.filter((s) => s.scene === key),
    })),
  ];
  await writeFile(
    `${output}/gallery.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P32 字段与创建组合图册</title>
<style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;background:#edf1f6;color:#202c3d;margin:24px}
section{background:white;padding:20px;margin:24px 0;border-left:4px solid #254a9c}a{color:#193b80}
.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}figure{margin:0}
img{max-width:100%;height:360px;object-fit:contain;object-position:top left}h2{font-size:21px}</style>
<h1>P32 字段与创建组合</h1><p>5字段、8组合、${screenshots.length}张双端图。全部待审；不是线上截图或整页验收。</p>
<p><a href="README.md">边界与验证</a> · <a href="index.html">交互原型</a></p>${groups
      .map(
        (g) =>
          `<section><h2>${g.label}</h2><div class="shots">${g.shots
            .map(
              (s) =>
                `<figure><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.scene} ${s.width}px"></a><figcaption>${s.scene} / ${s.width}px</figcaption></figure>`,
            )
            .join("")}</div></section>`,
      )
      .join("")}</html>`,
  );
} else if (!smoke) {
  assert.deepEqual(checks, previous.checks);
  assert.deepEqual(observations, previous.observations);
}
console.log(
  JSON.stringify({
    checks: checks.length,
    screenshots: screenshots.length,
    browserClosed: true,
    noProductionWrites: true,
  }),
);
