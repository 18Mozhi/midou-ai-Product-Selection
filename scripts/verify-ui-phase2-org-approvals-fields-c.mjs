import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { loadOrgApprovalFieldContract } from "./lib/ui-phase2-org-approvals-fields-data.mjs";
import { assertRetainedProposalSources } from "./lib/ui-phase2-org-approvals-retained-sources.mjs";

const base = "design-plans/ui-phase-2-2026-09-07/design";
const output = `${base}/org-approvals-fields-direction-c`;
const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke"),
  refreshSources = process.argv.includes("--refresh-sources");
assert.ok(
  process.argv.slice(2).every((v) => ["--capture", "--smoke", "--refresh-sources"].includes(v)) &&
    [capture, smoke, refreshSources].filter(Boolean).length <= 1,
);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const parent = JSON.parse(
  await readFile(`${base}/org-approvals-controls-direction-c/evidence.json`, "utf8"),
);
const sourceHashes = { ...parent.sourceHashes };
for (const [file, sha] of Object.entries(sourceHashes))
  assert.equal(hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n")), sha, file);
for (const file of ["index.html", "fields.css", "fields.js"]
  .map((f) => `${output}/${f}`)
  .concat(
    "scripts/verify-ui-phase2-org-approvals-fields-c.mjs",
    "scripts/lib/ui-phase2-org-approvals-fields-data.mjs",
  ))
  sourceHashes[file] = hash((await readFile(file, "utf8")).replaceAll("\r\n", "\n"));
let previous;
if (!capture && !smoke) {
  previous = JSON.parse(await readFile(`${output}/evidence.json`, "utf8"));
  if (refreshSources) assertRetainedProposalSources(previous.sourceHashes, sourceHashes);
  else assert.deepEqual(previous.sourceHashes, sourceHashes);
  for (const s of previous.screenshots) {
    assert.match(s.file, /^[a-z\d_-]+-(390|1440)\.png$/);
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
  }
}
const contract = await loadOrgApprovalFieldContract();
const fieldChecks = [],
  compositionChecks = [],
  workflowChecks = [],
  screenshots = [];
let fields, cases, compositions;
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
      await page.waitForFunction(() => !!window.ORG_APPROVAL_FIELDS_C);
      ({ fields, cases, compositions } = await page.evaluate(() => ({
        fields: window.ORG_APPROVAL_FIELDS_C.fields,
        cases: window.ORG_APPROVAL_FIELDS_C.cases,
        compositions: window.ORG_APPROVAL_FIELDS_C.compositions,
      })));
      assert.deepEqual(
        fields.map((f) => f.binding).sort(),
        contract.inputs.map((f) => f.binding).sort(),
      );
      const getState = () => page.evaluate(() => window.ORG_APPROVALS_C.state());
      const verifyFacts = async () => {
        const state = await getState(),
          expected = contract.evaluate(state);
        const actual = await page.evaluate(() => ({
          requests: window.ORG_APPROVALS_C.filtered("request").map((r) => r.id),
          templates: window.ORG_APPROVALS_C.filtered("template").map((r) => r.id),
        }));
        assert.deepEqual(actual.requests, expected.requests);
        assert.deepEqual(actual.templates, expected.templates);
        assert.deepEqual(state.intents, []);
        assert.equal(await page.locator("dialog").count(), 0);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        );
        return { state, expected };
      };
      const verifyField = async (f) => {
        const el = page.locator(f.selector);
        assert.ok(await el.isVisible());
        assert.equal(await el.isDisabled(), false, "refresh does not disable source local filters");
        assert.equal(await el.getAttribute("aria-invalid"), null);
        const native = await el.evaluate((n) => ({
          type: n.type,
          required: n.required,
          max: n.getAttribute("maxlength"),
          min: n.getAttribute("minlength"),
          valid: n.checkValidity(),
          described: n
            .getAttribute("aria-describedby")
            .split(" ")
            .every((id) => !!document.getElementById(id)),
          font: parseFloat(getComputedStyle(n).fontSize),
          height: n.getBoundingClientRect().height,
        }));
        assert.ok(
          !native.required &&
            native.valid &&
            native.described &&
            native.font >= 16 &&
            native.height >= 44,
        );
        if (f.key === "query") {
          assert.equal(native.max, null);
          assert.equal(native.min, null);
        }
        const source = contract.inputs.find((s) => s.binding === f.binding);
        if (f.options) {
          const options = await el
            .locator("option")
            .evaluateAll((nodes) => nodes.map((n) => n.value));
          const state = await getState();
          const expectedOptions =
            f.key === "workspace"
              ? ["all", ...contract.evaluate(state).workspaces]
              : source.options.map((o) => o.value);
          assert.deepEqual(options, expectedOptions);
        }
      };
      const shot = async (scene, selector, meta) => {
        if (!capture) return;
        const file = `${scene}-${width}.png`;
        await page.locator(selector).screenshot({ path: `${output}/${file}` });
        screenshots.push({
          file,
          scene,
          width,
          pageId: "P34",
          scope: "offline-field-not-vue-or-production",
          captureSelector: selector,
          sha256: hash(await readFile(`${output}/${file}`)),
          ...meta,
        });
      };
      for (const c of smoke
        ? cases.filter((c) => c.state === "focus" || c.state === "restored-200")
        : cases) {
        await page.evaluate((id) => window.ORG_APPROVAL_FIELDS_C.prepare(id), c.id);
        if (c.reload) {
          await page.reload();
          await page.waitForFunction(() => !!window.ORG_APPROVAL_FIELDS_C);
          if (!(await getState()).filtersOpen) await page.locator("#filters-toggle").click();
        }
        const f = fields.find((f) => f.id === c.fieldId);
        await page.waitForFunction(
          (selector) => !!document.querySelector(selector)?.getAttribute("aria-describedby"),
          c.selector,
        );
        await verifyField(f);
        const { state, expected } = await verifyFacts();
        if (Object.hasOwn(c, "value"))
          assert.equal(
            await page.locator(c.selector).inputValue(),
            c.reload ? c.value.slice(0, 200) : c.value,
          );
        if (f.key === "query")
          assert.equal(
            await page.locator(`#${f.id}-count`).textContent(),
            `当前输入长度：${state[c.kind].query.length}`,
          );
        if (
          ["no-result", "hidden-id", "length-200", "length-220", "restored-200"].includes(c.state)
        )
          assert.equal(expected[c.kind === "request" ? "requests" : "templates"].length, 0);
        if (c.state === "whitespace")
          assert.equal(
            expected[c.kind === "request" ? "requests" : "templates"].length,
            c.kind === "request" ? state.items.length : state.templates.length,
          );
        if (c.focus) {
          await page.keyboard.press("Tab");
          await page.locator(c.selector).focus();
          assert.ok(
            await page
              .locator(c.selector)
              .evaluate(
                (n) =>
                  n === document.activeElement &&
                  n.matches(":focus-visible") &&
                  getComputedStyle(n).outlineColor === "rgb(40, 94, 199)",
              ),
          );
        } else await page.evaluate(() => document.activeElement?.blur());
        await shot(c.id, `label:has(${c.selector})`, {
          field: { id: f.id, binding: f.binding, state: c.state, selector: f.selector },
        });
        fieldChecks.push({
          id: c.id,
          width,
          value: state[c.kind][c.key],
          sourceIds: expected[c.kind === "request" ? "requests" : "templates"],
          nativeConstraints: true,
          sourceOptionsAndResults: true,
        });
      }
      for (const c of compositions) {
        await page.evaluate((id) => window.ORG_APPROVAL_FIELDS_C.compose(id), c.id);
        for (const f of fields.filter((f) => f.kind === c.kind)) await verifyField(f);
        const { state, expected } = await verifyFacts();
        if (c.matching)
          assert.equal(expected[c.kind === "request" ? "requests" : "templates"].length, 1);
        if (c.empty) {
          assert.equal(expected[c.kind === "request" ? "requests" : "templates"].length, 0);
          assert.ok(await page.locator(".empty[role=status]").isVisible());
        }
        if (c.refreshing) assert.ok(await page.locator("#refresh").isDisabled());
        await page.evaluate(() => document.activeElement?.blur());
        await shot(c.id, c.refreshing ? ".main" : ".paper", { composition: c.id });
        compositionChecks.push({
          id: c.id,
          width,
          filters: state[c.kind],
          sourceIds: expected[c.kind === "request" ? "requests" : "templates"],
          localFiltersEnabled: true,
        });
      }
      for (const f of fields) {
        await page.evaluate((kind) => {
          window.ORG_APPROVALS_C.scene(
            kind === "request" ? "request_page_two" : "template_page_two",
          );
          if (!window.ORG_APPROVALS_C.state().filtersOpen)
            document.querySelector("#filters-toggle").click();
        }, f.kind);
        assert.equal((await getState())[f.kind].page, 2);
        const value = f.key === "query" ? "治理" : f.options[1];
        if (f.key === "query") await page.locator(f.selector).fill(value);
        else await page.locator(f.selector).selectOption(value);
        const { state } = await verifyFacts();
        assert.equal(state[f.kind].page, 1);
        assert.equal(new URL(page.url()).searchParams.get(`approval_${f.kind}_${f.key}`), value);
        assert.equal(new URL(page.url()).searchParams.get(`approval_${f.kind}_page`), null);
        workflowChecks.push({ id: f.id, width, filterResetsPageAndWritesExistingUrl: true });
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
  assert.equal(screenshots.length, (cases.length + compositions.length) * 2);
  const evidence = {
    kind: "ORG-APPROVALS-FIELDS-C-r1",
    approval: "pending-user-review",
    boundary:
      "Offline ten-filter proposal and source-function comparison, not mounted Vue or production. No input cap, new validation rule, API, business dialog or permission change. Native select popup visuals and full page/parent lifecycle remain pending.",
    sourceHashes,
    sourceInputs: contract.inputs,
    fields,
    cases,
    compositions,
    fieldChecks,
    compositionChecks,
    workflowChecks,
    screenshots,
  };
  await writeFile(`${output}/evidence.json`, JSON.stringify(evidence, null, 2) + "\n");
  const figure = (s) =>
    `<figure><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.scene} ${s.width}px"></a><figcaption>${s.field?.state || s.scene} / ${s.width}px</figcaption></figure>`;
  const groups = fields
    .map(
      (f) =>
        `<section><h2>${f.label}</h2><p>真实绑定：${f.binding}。只读本地筛选，不是业务表单。</p><div class="shots">${screenshots
          .filter((s) => s.field?.id === f.id)
          .map(figure)
          .join("")}</div></section>`,
    )
    .join("\n");
  await writeFile(
    `${output}/gallery.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>P34 筛选字段图册</title>
<style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;background:#edf1f6;color:#202c3d;margin:24px}section{background:white;padding:20px;margin:24px 0;border-left:4px solid #254a9c}.shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}figure{margin:0}img{max-width:100%;height:320px;object-fit:contain;object-position:top left}a{color:#193b80}</style>
<h1>P34 审批治理 · 十字段与八组合</h1><p>${cases.length}个代表字段状态 / ${screenshots.length}张双端图。全部待审；无输入硬上限，不把筛选无结果当校验错误。</p><p><a href="README.md">来源与边界</a> · <a href="index.html">离线交互</a></p>
<section><h2>筛选组合</h2><div class="shots">${screenshots
      .filter((s) => s.composition)
      .map(figure)
      .join("")}</div></section>${groups}</html>`,
  );
} else if (!smoke) {
  assert.deepEqual(fieldChecks, previous.fieldChecks);
  assert.deepEqual(compositionChecks, previous.compositionChecks);
  assert.deepEqual(workflowChecks, previous.workflowChecks);
  if (refreshSources) {
    const withoutDescriptions = (inputs) =>
      inputs.map((input) => ({
        ...input,
        attrs: Object.fromEntries(
          Object.entries(input.attrs).filter(
            ([key, value]) =>
              !["aria-label", "aria-describedby"].includes(key) &&
              !(
                input.binding === "templateQuery" &&
                key === "ref" &&
                value === "templateSearchInput"
              ),
          ),
        ),
      }));
    assert.deepEqual(
      withoutDescriptions(JSON.parse(JSON.stringify(contract.inputs))),
      withoutDescriptions(previous.sourceInputs),
    );
    await writeFile(
      `${output}/evidence.json`,
      JSON.stringify({ ...previous, sourceHashes, sourceInputs: contract.inputs }, null, 2) + "\n",
    );
  }
}
console.log(
  JSON.stringify({
    fields: fields.length,
    cases: cases.length,
    compositions: compositions.length,
    fieldChecks: fieldChecks.length,
    compositionChecks: compositionChecks.length,
    workflowChecks: workflowChecks.length,
    screenshots: screenshots.length,
    browserClosed: true,
    noHttpOrStorage: true,
  }),
);
