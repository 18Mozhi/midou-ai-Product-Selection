import { historicalAdapterCSource } from "../../scripts/lib/ui-phase2-adapter-c-baseline.mjs";
import test from "node:test";
import { historicalAdapterReadSource } from "../../scripts/lib/ui-phase2-adapter-read-baseline.mjs";
import { historicalAdapterFeedbackSource } from "../../scripts/lib/ui-phase2-adapter-feedback-baseline.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import postcss from "postcss";
import ts from "typescript";

const read = (f) =>
  historicalAdapterFeedbackSource(
    f,
    historicalAdapterReadSource(f, historicalAdapterCSource(f, readFileSync(f, "utf8"))),
  );
const hash = (s) => createHash("sha256").update(s).digest("hex");
const component = "apps/web/src/components/ProviderAdapterCenter.vue";
const preview =
  "design-plans/ui-phase-2-2026-09-07/implementation/ProviderAdapterCenterPreview.vue";
const css = "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-vue-preview.css";
const root = "output/playwright/p47-adapters-vue";
const e = JSON.parse(read(`${root}/evidence.json`));

function tokens(value) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    value,
  );
  const result = [];
  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) result.push(scanner.getTokenText());
  return result.join("\u001f");
}
function templateContract(text) {
  const sfc = parse(text).descriptor,
    tree = baseParse(sfc.template.content);
  const actions = [],
    models = [],
    conditions = [],
    expressions = [];
  function walk(node) {
    if (node.type === 5) expressions.push(tokens(node.content.content));
    if (node.type === 1) {
      for (const p of node.props.filter((p) => p.type === 7)) {
        const signature = [
          node.tag,
          p.name,
          p.arg?.content ?? "",
          tokens(p.exp?.content ?? ""),
          p.modifiers.map((m) => m.content),
        ].join("|");
        if (p.name === "on") actions.push(signature);
        if (p.name === "model") models.push(signature);
        if (["if", "else-if", "for"].includes(p.name)) conditions.push(signature);
      }
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(tree);
  return {
    script: sfc.scriptSetup.content,
    actions: actions.sort(),
    models: models.sort(),
    conditions: conditions.sort(),
    expressions,
  };
}

test("P47 actual Vue review preserves all script, event/model/condition contracts and original displayed facts", () => {
  const a = templateContract(read(component)),
    b = templateContract(read(preview));
  assert.equal(a.script, b.script);
  assert.deepEqual(a.actions, b.actions);
  assert.deepEqual(a.models, b.models);
  assert.deepEqual(a.conditions, b.conditions);
  assert.equal(b.models.length, 6);
  const remaining = [...b.expressions];
  for (const expression of a.expressions) {
    const index = remaining.indexOf(expression);
    assert.ok(index >= 0, expression);
    remaining.splice(index, 1);
  }
  assert.equal((read(preview).match(/<th>/g) ?? []).length, 5);
  assert.ok(
    read(preview).indexOf('class="adapter-reset"') <
      read(preview).indexOf('class="adapter-advanced"'),
  );
  assert.ok(!read(component).includes("Preview"));
});

test("P47 review style is marker and mounted-page scoped and never imported by production files", () => {
  postcss.parse(read(css)).walkRules((rule) => {
    const selector = rule.selector.replace(/\s+/g, " ");
    assert.ok(selector.includes("p47-adapter-review"), selector);
    assert.ok(selector.includes(".adapter-center"), selector);
    for (const d of rule.nodes.filter((n) => n.type === "decl"))
      assert.equal(d.important, undefined);
  });
  for (const f of Object.keys(e.sourceHashes).filter((f) => f.startsWith("apps/"))) {
    assert.ok(!read(f).includes("provider-adapters-vue-preview"), f);
    assert.ok(!read(f).includes("ProviderAdapterCenterPreview"), f);
  }
});

test("P47 actual route, original/synthetic fixtures and exact72 PNG inventory bind current raw files", () => {
  assert.equal(e.kind, "P47-ADAPTERS-ACTUAL-VUE-r1");
  assert.equal(e.processesClosed, true);
  assert.equal(e.checks.length, 130);
  assert.equal(e.screenshots.length, 72);
  assert.equal(Object.keys(e.sourceHashes).length, 167);
  for (const [f, sha] of Object.entries(e.sourceHashes)) assert.equal(hash(read(f)), sha, f);
  assert.deepEqual(
    readdirSync(root).sort(),
    [...e.screenshots.map((s) => s.file), "evidence.json", "index.html"].sort(),
  );
  for (const s of e.screenshots) {
    const bytes = readFileSync(`${root}/${s.file}`);
    assert.equal(hash(bytes), s.sha256, s.file);
    assert.equal(bytes.readUInt32BE(16), s.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), s.pixelHeight);
  }
  for (const name of [
    "App.vue",
    "NavigationShell.vue",
    "ProviderRuntimeSurface.vue",
    "ProviderAdapterCenter.vue",
  ])
    assert.ok(Object.keys(e.sourceHashes).some((f) => f.endsWith("/" + name)));
  assert.match(e.fixtureBoundary, /catalog completed/);
  assert.match(e.fixtureBoundary, /Original mobile detail/);
});

test("P47 current replay preserves no-request reset,20/20/5 pagination and bodyless locally rejected probes", () => {
  for (const width of [390, 760, 761, 1440]) {
    const check = (name) => e.checks.find((c) => c.width === width && c.name === name)?.actual;
    assert.equal(check("two displayed records"), 2);
    assert.equal(check("first record has visible44px before fixed nav"), true);
    assert.equal(check("catalog page1"), 20);
    assert.equal(check("catalog page2"), 20);
    assert.equal(check("catalog page3"), 5);
    assert.equal(check("filter resets page"), true);
    assert.equal(check("search Tab reaches reset"), true);
    assert.equal(check("probe request has no body"), null);
    assert.equal(check("forbidden only reload action"), 1);
    assert.equal(check("error only reload action"), 1);
    assert.deepEqual(check("no unexpected network"), []);
    assert.deepEqual(check("no browser errors"), []);
    if (width <= 760) assert.equal(check("original detail returns trigger"), true);
    const requests = e.network.find((n) => n.width === width).requests;
    assert.equal(requests.filter((r) => r.key.startsWith("POST ")).length, 1);
    assert.ok(requests.every((r) => r.body === null));
  }
});
