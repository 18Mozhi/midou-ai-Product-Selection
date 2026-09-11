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
  historicalAdapterFeedbackSource(f, historicalAdapterReadSource(f, readFileSync(f, "utf8")));
const hash = (s) => createHash("sha256").update(s).digest("hex");
const component = "apps/web/src/components/ProviderAdapterCenter.vue";
const preview =
  "design-plans/ui-phase-2-2026-09-07/implementation/ProviderAdapterDetailPreview.vue";
const css =
  "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-detail-preview.css";
const root = "output/playwright/p47-adapters-detail-vue";
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

test("P47 detail actual Vue review preserves all script, event/model/condition contracts and original displayed facts", () => {
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

test("P47 detail changes only the original detail slot and isolates shared drawer styling", () => {
  const previous = read(
    "design-plans/ui-phase-2-2026-09-07/implementation/ProviderAdapterCenterPreview.vue",
  );
  const current = read(preview);
  const withoutDetail = (value) =>
    value.replace(/<template #detail="\{ row \}">[\s\S]*?<\/template>/, "");
  assert.equal(withoutDetail(current), withoutDetail(previous));
  assert.equal((current.match(/class="p47-detail-section"/g) || []).length, 4);
  postcss.parse(read(css)).walkRules((rule) => {
    assert.ok(rule.selector.includes("body.p47-adapter-review:has(#app .adapter-center)"));
    assert.ok(rule.selector.includes(".responsive-data-view__overlay:has(.p47-diagnostic-detail)"));
    for (const d of rule.nodes.filter((n) => n.type === "decl"))
      assert.equal(d.important, undefined);
  });
  for (const f of Object.keys(e.sourceHashes).filter((f) => f.startsWith("apps/"))) {
    assert.ok(!read(f).includes("provider-adapters-detail-preview"));
    assert.ok(!read(f).includes("ProviderAdapterDetailPreview"));
  }
});

test("P47 detail continuous screenshots bind current sources and explicit fixture boundaries", () => {
  assert.equal(e.kind, "P47-ADAPTERS-DETAIL-ACTUAL-VUE-r1");
  assert.equal(e.processesClosed, true);
  assert.equal(e.checks.length, 118);
  assert.equal(e.screenshots.length, 47);
  assert.equal(Object.keys(e.sourceHashes).length, 168);
  for (const [f, sha] of Object.entries(e.sourceHashes)) assert.equal(hash(read(f)), sha, f);
  assert.deepEqual(
    readdirSync(root).sort(),
    [...e.screenshots.map((s) => s.file), "evidence.json", "index.html"].sort(),
  );
  for (const s of e.screenshots) {
    const bytes = readFileSync(root + "/" + s.file);
    assert.equal(hash(bytes), s.sha256, s.file);
    assert.equal(bytes.readUInt32BE(16), s.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), s.pixelHeight);
  }
  for (const name of [
    "App.vue",
    "NavigationShell.vue",
    "ProviderRuntimeSurface.vue",
    "ResponsiveDataView.vue",
  ]) {
    assert.ok(Object.keys(e.sourceHashes).some((f) => f.endsWith("/" + name)));
  }
  assert.match(e.fixtureBoundary, /explicit synthetic zero\/recovery and long text/);
  assert.match(e.fixtureBoundary, /Background-only feedback remains unresolved/);
  assert.equal(e.observations.length, 16);
  for (const o of e.observations) {
    assert.equal(o.positions[0], 0);
    assert.equal(o.positions.at(-1), o.max);
    for (let i = 1; i < o.positions.length; i++)
      assert.ok(o.positions[i] - o.positions[i - 1] <= o.height - o.header);
    for (let i = 0; i < o.positions.length; i++)
      assert.ok(
        e.screenshots.some((s) => s.width === o.width && s.state === o.state + "-part" + (i + 1)),
      );
  }
});

test("P47 detail verifies local focus and records unresolved background feedback without real probes", () => {
  for (const width of [390, 760]) {
    const actual = (name) => e.checks.find((c) => c.width === width && c.name === name)?.actual;
    for (const scene of [
      "registered",
      "unregistered",
      "synthetic-zero-recovery",
      "synthetic-long",
    ]) {
      for (const suffix of [
        " initial close focus",
        " background inert",
        " closed-details Tab cycle",
        " no horizontal overflow",
        "44px controls",
        " restores trigger",
      ])
        assert.equal(actual(scene + suffix), true, scene + suffix);
      assert.equal(actual(scene + " releases inert"), false);
      assert.equal(actual(scene + " four diagnostic sections"), 4);
      assert.equal(actual(scene + " twelve facts"), 12);
      assert.equal(actual(scene + " seven technical facts"), 7);
    }
    assert.equal(actual("busy button skipped in Tab"), true);
    assert.equal(actual("known background-only probe feedback"), true);
    assert.equal(actual("drawer has no owned live result"), 0);
    assert.equal(actual("recovery link is original conditional deep-link"), true);
    assert.deepEqual(actual("no unexpected network"), []);
    assert.deepEqual(actual("no browser errors"), []);
    const requests = e.network.find((n) => n.width === width).requests;
    assert.equal(requests.filter((r) => r.key.startsWith("POST ")).length, 1);
    assert.ok(requests.every((r) => r.body === null));
  }
});
