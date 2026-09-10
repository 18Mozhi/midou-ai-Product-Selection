import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { chromium } from "playwright";
import { buildOrgTokenDesignData } from "./lib/ui-phase2-org-token-design-data.mjs";

const capture = process.argv.includes("--capture"),
  smoke = process.argv.includes("--smoke");
assert.ok(
  process.argv.slice(2).every((v) => ["--capture", "--smoke"].includes(v)) && !(capture && smoke),
);
const original = "design-plans/ui-phase-2-2026-09-07/design/org-token-direction-c";
const design = "design-plans/ui-phase-2-2026-09-07/design/org-token-fields";
const output = "output/playwright/p36-fields-review";
const source = "apps/web/src/components/OrganizationTokenPanel.vue";
const text = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const plain = (v) => JSON.parse(JSON.stringify(v));
const fixture = await buildOrgTokenDesignData(process.cwd());
const retained = {},
  sourceHashes = {};
for (const dir of [original, "output/playwright/p36-controls-review"]) {
  const e = JSON.parse(await text(`${dir}/evidence.json`));
  retained[dir] = {
    manifest: hash(await text(`${dir}/evidence.json`)),
    pngCount: e.screenshots.length,
  };
  for (const [f, sha] of Object.entries(e.sourceHashes)) {
    assert.equal(hash(await text(f)), sha, f);
    sourceHashes[f] = sha;
  }
  for (const s of e.screenshots)
    assert.equal(hash(await readFile(`${dir}/${s.file}`)), s.sha256, s.file);
}
for (const f of ["index.html", "fields.js", "fields.css"]
  .map((f) => `${design}/${f}`)
  .concat("scripts/verify-ui-phase2-org-token-fields.mjs"))
  sourceHashes[f] = hash(await text(f));
const child = await text(source),
  descriptor = parse(child).descriptor;
const models = [];
function visit(n) {
  if (n.type === 1) {
    const p = n.props.find((p) => p.type === 7 && p.name === "model");
    if (p)
      models.push({
        model: p.exp.content,
        tag: n.tag,
        attrs: Object.fromEntries(
          n.props.filter((p) => p.type === 6).map((p) => [p.name, p.value?.content ?? ""]),
        ),
        options:
          n.tag === "select"
            ? n.children
                .filter((c) => c.type === 1 && c.tag === "option")
                .flatMap((c) => {
                  const value = c.props.find((p) => p.type === 6 && p.name === "value");
                  if (value) return [value.value.content];
                  assert.ok(
                    c.props.some(
                      (p) =>
                        p.type === 7 &&
                        p.name === "for" &&
                        p.exp.content === "scope in scopeOptions",
                    ),
                  );
                  return fixture.scopeOptions.map((s) => s.value);
                })
            : null,
      });
  }
  for (const c of n.children ?? []) visit(c);
}
visit(baseParse(descriptor.template.content));
assert.equal(models.length, 7);
const ast = ts.createSourceFile(
  "child.ts",
  descriptor.scriptSetup.content,
  ts.ScriptTarget.Latest,
  true,
);
const script = ts.transpileModule(
  ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(ast))
    .join("\n") +
    "\nglobalThis.result={tokenQuery,statusFilter,scopeFilter,tokenSort,createForm,filteredTokens,scopeOptions,submitCreate};",
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [fixture.fixedTime]));
  }
  static now() {
    return Date.parse(fixture.fixedTime);
  }
}
function oracle(state) {
  const calls = [],
    box = {
      Date: FixedDate,
      defineProps: () => ({
        tokens: state.tokens,
        secret: "",
        busy: false,
        createToken: async (v) => {
          calls.push(plain(v));
          return false;
        },
      }),
      useRoute: () => ({ query: {} }),
      useRouter: () => ({ replace: () => Promise.resolve() }),
      ref: (value) => ({ value }),
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
      watch: () => {},
    };
  vm.runInNewContext(script, box);
  const h = box.result;
  for (const [key, model] of Object.entries({
    query: "tokenQuery",
    status: "statusFilter",
    scope: "scopeFilter",
    sort: "tokenSort",
  }))
    h[model].value = state.filter[key];
  h.createForm.value = plain(state.form);
  return { ids: plain(h.filteredTokens.value.map((r) => r.id)), h, calls };
}
let previous, fields;
if (!capture && !smoke) {
  previous = JSON.parse(await text(`${output}/evidence.json`));
  assert.deepEqual(previous.sourceHashes, sourceHashes);
  assert.deepEqual(previous.retained, retained);
  for (const s of previous.screenshots)
    assert.equal(hash(await readFile(`${output}/${s.file}`)), s.sha256);
}
if (capture) await mkdir(output, { recursive: true });
const checks = [],
  flows = [],
  screenshots = [];
const compositions = [
  ["filters-default", "normal", "filters"],
  ["filters-search", "search", "filters"],
  ["filters-empty", "filter_empty", "filters"],
  ["filters-refreshing", "refreshing", "filters"],
  ...[
    "create",
    "create_draft",
    "create_all_scopes",
    "create_required",
    "create_busy",
    "create_failure",
    "create_long",
    "create_ttl_error",
  ].map((scene) => [scene, scene, "create"]),
  ...["rotate", "revoke"].flatMap((action) =>
    ["default", "short", "valid", "limit"].map((variant) => [
      `${action}-${variant}`,
      `reason-${action}`,
      "reason",
      variant,
    ]),
  ),
];
const browser = await chromium.launch({ headless: true });
try {
  for (const width of smoke ? [390] : [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce",
    });
    try {
      await context.addInitScript(() => {
        window.__clipboardCalls = 0;
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: async () => {
              window.__clipboardCalls++;
              throw Error("No OS clipboard in review");
            },
          },
        });
      });
      const page = await context.newPage(),
        errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route(/^https?:/u, (r) => {
        requests.push(r.request().url());
        return r.abort();
      });
      await page.goto(pathToFileURL(path.resolve(design, "index.html")).href);
      await page.waitForFunction(() => !!window.ORG_TOKEN_FIELDS_C);
      fields = await page.evaluate(() => window.ORG_TOKEN_FIELDS_C.fields);
      assert.deepEqual(
        fields
          .filter((f) => f.kind !== "scopes" && f.kind !== "reason")
          .map((f) => f.model)
          .sort(),
        models.map((m) => m.model).sort(),
      );
      const state = () => page.evaluate(() => window.ORG_TOKEN_C.state());
      const prepare = (id, variant) =>
        page.evaluate(
          ([id, variant]) => window.ORG_TOKEN_FIELDS_C.prepare(id, variant),
          [id, variant],
        );
      const save = async (name, locator, extra) => {
        if (!capture) return;
        const file = `${name}-${width}.png`;
        const bytes = await locator.screenshot({ animations: "disabled" });
        await writeFile(`${output}/${file}`, bytes);
        screenshots.push({ file, width, sha256: hash(bytes), ...extra });
      };
      for (const f of fields)
        for (const variant of smoke
          ? [f.variants.includes("focus") ? "focus" : f.variants[0]]
          : f.variants) {
          await prepare(f.id, variant);
          const input = page.locator(`#${f.inputId ?? f.id}`),
            label = f.kind === "scopes" ? input : input.locator("..");
          await label.evaluate((n) => n.scrollIntoView({ block: "center" }));
          await page.mouse.move(0, 0);
          await page.evaluate(() => document.activeElement?.blur());
          if (variant === "focus") {
            await page.keyboard.press("Tab");
            await input.focus();
          }
          if (variant === "hover") await input.hover();
          const before = await state();
          assert.deepEqual(
            await page.evaluate(() => window.ORG_TOKEN_C.filtered().map((r) => r.id)),
            oracle(before).ids,
          );
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            true,
          );
          if (f.kind !== "scopes") {
            const attributes = await input.evaluate((n) => ({
              font: parseFloat(getComputedStyle(n).fontSize),
              height: n.getBoundingClientRect().height,
              labelled: n.getAttribute("aria-labelledby"),
              described: n.getAttribute("aria-describedby"),
              disabled: n.disabled,
              required: n.required,
              max: n.getAttribute("maxlength"),
              min: n.getAttribute("min"),
              maxNumber: n.getAttribute("max"),
              focus: n.matches(":focus-visible"),
              outline: getComputedStyle(n).outlineWidth,
            }));
            assert.ok(attributes.font >= 16 && attributes.height >= 44);
            assert.ok(attributes.labelled && attributes.described);
            for (const id of attributes.described.split(" "))
              assert.equal(await page.locator(`#${id}`).count(), 1);
            assert.equal(attributes.disabled, variant === "busy");
            if (variant === "focus") assert.ok(attributes.focus && attributes.outline === "3px");
            if (f.kind === "select")
              assert.deepEqual(
                await input.locator("option").evaluateAll((ns) => ns.map((n) => n.value)),
                f.options,
              );
            const model = models.find((m) => m.model === f.model);
            if (model) {
              if (model.options) assert.deepEqual(f.options, model.options);
              for (const [attr, key] of [
                ["maxlength", "max"],
                ["min", "min"],
                ["max", "maxNumber"],
              ])
                assert.equal(attributes[key], model.attrs[attr] ?? null);
              assert.equal(attributes.required, Object.hasOwn(model.attrs, "required"));
            }
            if (f.kind === "reason") {
              assert.ok(attributes.height >= 140);
              assert.equal(attributes.max, "500");
              assert.equal(attributes.required, true);
            }
            if (f.id === "filter-query" && variant === "long")
              assert.equal((await input.inputValue()).length, 220);
            if (f.id === "filter-query" && ["empty-result", "id-excluded"].includes(variant))
              assert.equal(oracle(before).ids.length, 0);
            if (f.max && variant === "limit") {
              await input.focus();
              await input.press("End");
              await input.pressSequentially("尾");
              assert.equal((await input.inputValue()).length, f.max);
            }
            if (f.id === "create-ttl" && ["zero", "over", "fraction", "empty"].includes(variant))
              assert.equal(await input.evaluate((n) => n.validity.valid), false);
            if (variant === "error") assert.equal(await input.getAttribute("aria-invalid"), "true");
          } else {
            const checked = await input.locator("input:checked").count();
            if (["empty", "one", "all", "error"].includes(variant))
              assert.equal(checked, { empty: 0, one: 1, all: 4, error: 0 }[variant]);
          }
          assert.deepEqual(
            await state(),
            before,
            "field presentation must not mutate data or intentions",
          );
          if (capture) {
            const b = await label.boundingBox(),
              x = Math.max(0, b.x - 8),
              y = Math.max(0, b.y - 10);
            assert.ok(b.y >= 0 && b.y + b.height <= 1000, "field region fits capture viewport");
            const file = `${f.id}-${variant.replaceAll(":", "-")}-${width}.png`;
            const bytes = await page.screenshot({
              clip: {
                x,
                y,
                width: Math.min(width - x, b.width + 16),
                height: Math.min(1000 - y, b.height + 20),
              },
              animations: "disabled",
            });
            await writeFile(`${output}/${file}`, bytes);
            screenshots.push({
              file,
              width,
              fieldId: f.id,
              variant,
              sha256: hash(bytes),
              scope: "offline-field-proposal-not-Vue-or-user-approval",
            });
          }
          checks.push({
            fieldId: f.id,
            variant,
            width,
            sourceFilterIds: true,
            fieldContract: true,
          });
        }
      // Native editing checks, not programmatic filling alone.
      for (const id of ["filter-query", "create-name", "create-reason"]) {
        await prepare(id, "filled");
        const input = page.locator(`#${id}`);
        await input.focus();
        await input.press("End");
        await input.pressSequentially("甲乙");
        assert.equal(
          await input.evaluate((n) => n === document.activeElement && n.value.endsWith("甲乙")),
          true,
        );
        await input.press("ArrowLeft");
        await input.pressSequentially("中");
        assert.equal((await input.inputValue()).endsWith("甲中乙"), true);
        flows.push({ id, width, kind: "native-input-caret" });
      }
      await prepare("create-name", "default");
      await page.locator("#create-name").focus();
      for (const selector of [
        "#create-ttl",
        ...[30, 90, 180, 365].map((n) => `[data-ttl="${n}"]`),
        ...[0, 1, 2, 3].map((n) => `#scope-${n}`),
        "#create-reason",
        "#create-submit",
      ]) {
        await page.keyboard.press("Tab");
        assert.equal(
          await page.locator(selector).evaluate((n) => n === document.activeElement),
          true,
          selector,
        );
      }
      flows.push({ width, id: "create-order", kind: "native-tab-form-order" });
      await page.evaluate(() => {
        window.ORG_TOKEN_C.scene("create_draft");
        window.ORG_TOKEN_FIELDS_C.decorate();
      });
      const draft = await state(),
        actual = oracle(draft);
      await actual.h.submitCreate();
      await page.locator("#create-submit").click();
      assert.deepEqual((await state()).intents, [
        { method: "POST", path: "/org/admin/tokens", body: actual.calls[0] },
      ]);
      assert.deepEqual((await state()).tokens, draft.tokens);
      flows.push({ width, id: "create", kind: "exact-source-handler-body-intent-only" });
      for (const [name, scene, kind, variant] of compositions.filter(
        (c) =>
          !smoke ||
          ["filters-default", "create_draft", "rotate-valid", "revoke-valid"].includes(c[0]),
      )) {
        if (kind === "reason") await prepare(scene, variant);
        else
          await page.evaluate((scene) => {
            window.ORG_TOKEN_C.scene(scene);
            window.ORG_TOKEN_FIELDS_C.decorate();
          }, scene);
        if (kind === "filters" && !(await state()).filtersOpen) {
          await page.locator("#filters-toggle").click();
          await page.waitForFunction(() => !!document.querySelector(".field-review-region"));
        }
        await page.mouse.move(0, 0);
        await page.evaluate(() => document.activeElement?.blur());
        await save(
          `composition-${name}`,
          page.locator(
            kind === "reason"
              ? "dialog[open]"
              : kind === "filters"
                ? ".field-review-region"
                : "#create",
          ),
          { composition: name, scope: "offline-field-composition-pending-user-review" },
        );
        if (kind === "reason") {
          const before = await state();
          await page.locator("#reason-cancel").click();
          assert.equal((await state()).dialog, null);
          assert.deepEqual((await state()).intents, before.intents);
        }
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, []);
      assert.deepEqual(await context.cookies(), []);
      assert.deepEqual(
        await page.evaluate(() => [
          localStorage.length,
          sessionStorage.length,
          window.__clipboardCalls,
        ]),
        [0, 0, 0],
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
    `${output}/evidence.json`,
    JSON.stringify(
      {
        pageId: "P36",
        approval: "pending-field-review",
        scope:
          "Offline fields and source-expression oracle; no mounted Vue/API/SQL/permissions/OS clipboard or production proof",
        sourceHashes,
        retained,
        models,
        fields,
        checks,
        flows,
        compositions,
        screenshots,
      },
      null,
      2,
    ) + "\n",
  );
  const cards = screenshots
    .map(
      (s) =>
        `<article><h2>${s.fieldId ?? s.composition} / ${s.variant ?? "组合"} / ${s.width}</h2><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.file}"></a></article>`,
    )
    .join("\n");
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>P36 字段组合审核</title>
<style>body{font:16px/1.6 'Microsoft YaHei',sans-serif;margin:24px;background:#edf1f6;color:#202c3d}article{background:white;padding:20px;margin:24px 0}img{max-width:100%}</style>
<h1>P36 字段与组合 · 全部待审</h1><p>独立HTML稿；原原因500上限和busy草稿锁定是提案，非实际Vue合同或生产验收。</p>
${cards}</html>`,
  );
} else if (!smoke) {
  assert.deepEqual(checks, previous.checks);
  assert.deepEqual(flows, previous.flows);
  assert.deepEqual(fields, previous.fields);
}
console.log(
  JSON.stringify({
    fields: fields.length,
    checks: checks.length,
    flows: flows.length,
    compositions: compositions.length,
    screenshots: screenshots.length,
    browserClosed: true,
    noServer: true,
  }),
);
