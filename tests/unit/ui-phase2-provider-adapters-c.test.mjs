import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import postcss from "postcss";
import ts from "typescript";
import {
  adapterCRevisions,
  historicalAdapterCSource,
} from "../../scripts/lib/ui-phase2-adapter-c-baseline.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const file = "apps/web/src/components/ProviderAdapterCenter.vue";
const source = read(file);
const baseline = historicalAdapterCSource(file, source);
const root = "output/playwright/p47-c-integration";
const evidence = () => JSON.parse(read(`${root}/evidence.json`));
const tokens = (text) => {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text);
  const result = [];
  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) result.push(scanner.getTokenText());
  return result.join("\u001f");
};
function contract(text) {
  const tree = baseParse(parse(text).descriptor.template.content);
  const actions = [],
    models = [],
    conditions = [],
    facts = [];
  function visit(node) {
    if (node.type === 5) facts.push(tokens(node.content.content));
    if (node.type === 1)
      for (const prop of node.props.filter((prop) => prop.type === 7)) {
        const signature = [
          node.tag,
          prop.name,
          prop.arg?.content ?? "",
          tokens(prop.exp?.content ?? ""),
        ].join("|");
        if (prop.name === "on") actions.push(signature);
        if (prop.name === "model") models.push(signature);
        if (["if", "else-if", "for"].includes(prop.name)) conditions.push(signature);
      }
    for (const child of node.children ?? []) visit(child);
  }
  visit(tree);
  return { actions: actions.sort(), models: models.sort(), conditions: conditions.sort(), facts };
}

test("P47 C actual script preserves all existing runtime logic and exact historical association", () => {
  for (const revision of adapterCRevisions) {
    const current = read(revision.file);
    assert.equal(hash(current), revision.after);
    assert.equal(hash(historicalAdapterCSource(revision.file, current)), revision.before);
    assert.equal(
      historicalAdapterCSource(revision.file, current + "\n// drift"),
      current + "\n// drift",
    );
  }
  const previous = parse(baseline).descriptor;
  const current = parse(source).descriptor;
  const withoutStyles = current.scriptSetup.content.replace(
    /^import "\.\.\/provider-adapters-c-(page|detail|feedback)\.css";\n/gm,
    "",
  );
  assert.equal(tokens(withoutStyles), tokens(previous.scriptSetup.content));
  assert.deepEqual(
    current.styles.map((style) => style.content),
    previous.styles.map((style) => style.content),
  );
  const originalFixture = historicalAdapterCSource(
    adapterCRevisions[1].file,
    read(adapterCRevisions[1].file),
  );
  const definitions = (text) =>
    text.slice(text.indexOf("const navigation"), text.indexOf("async function nav"));
  assert.equal(definitions(read(adapterCRevisions[1].file)), definitions(originalFixture));
});

test("P47 C template retains original actions, all six models, conditions and displayed facts", () => {
  const old = contract(baseline),
    current = contract(source);
  assert.deepEqual(current.actions, old.actions);
  assert.deepEqual(current.models, old.models);
  assert.equal(current.models.length, 6);
  assert.deepEqual(current.conditions, old.conditions);
  const remaining = [...current.facts];
  for (const fact of old.facts) {
    const index = remaining.indexOf(fact);
    assert.ok(index >= 0, fact);
    remaining.splice(index, 1);
  }
  assert.equal((source.match(/<th>/g) ?? []).length, 5);
  for (const name of ["来源身份", "健康探针", "24 小时实际采集", "暂停与恢复"])
    assert.ok(source.includes(`<h3>${name}</h3>`), name);
  assert.match(source, /class="adapter-center adapter-center--c"/);
  assert.match(source, /@click="probe\(row, \$event\)"/);
  assert.ok(!source.includes("Preview"));
});

test("P47 C styles are approved composition rules rescaled only to the active production marker", () => {
  for (const [current, reference] of [
    ["page", "vue-preview"],
    ["detail", "detail-preview"],
    ["feedback", "feedback-review"],
  ]) {
    const actual = postcss.parse(read(`apps/web/src/provider-adapters-c-${current}.css`));
    const expected = postcss.parse(
      read(`design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-${reference}.css`)
        .replaceAll("body.p47-adapter-review", "body")
        .replaceAll(".adapter-center", ".adapter-center--c"),
    );
    const signature = (css) => {
      const rules = [];
      css.walkRules((rule) => {
        const selector = rule.selector.replace(/\s+/g, " ");
        assert.ok(selector.includes(".adapter-center--c"), selector);
        assert.ok(!selector.includes("p47-adapter-review"), selector);
        const declarations = rule.nodes.filter((node) => node.type === "decl");
        assert.ok(declarations.every((decl) => !decl.important));
        rules.push([
          selector,
          declarations.map((decl) => [decl.prop, decl.value.replace(/\s+/g, " ")]),
        ]);
      });
      return rules;
    };
    assert.deepEqual(signature(actual), signature(expected));
  }
});

test("P47 C actual browser pack binds current raw runtime and all20 images without preview injection", () => {
  const e = evidence();
  assert.equal(e.kind, "P47-C-INTEGRATION-r1");
  assert.equal(e.productionUntransformed, true);
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 36);
  assert.equal(
    e.runs.reduce((n, run) => n + run.checks.length, 0),
    430,
  );
  assert.equal(Object.keys(e.sourceHashes).length, 170);
  assert.equal(e.e2eResult.exitCode, 0);
  assert.match(e.e2eResult.output, /16 passed/);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  assert.equal(e.sourceHashes[file], hash(source));
  assert.equal(e.screenshots.length, 20);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["index.html", "evidence.json", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const shot of e.screenshots) {
    const bytes = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
});

test("P47 C runtime keeps initial read/explicit recovery, cache locks, focus and neighboring style isolation", () => {
  for (const run of evidence().runs) {
    const value = (name) => {
      const matches = run.checks.filter((check) => check.name === name);
      assert.equal(matches.length, 1, `${run.scenario}:${name}`);
      return matches[0].actual;
    };
    assert.equal(value("C styles stop matching on P46").length, 3);
    assert.equal(value("background released after browser Back"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no browser errors"), []);
    assert.equal(value("no request bodies"), true);
    if (run.action === "initial") {
      assert.equal(value("initial read retained across cached return"), 1);
      assert.equal(
        value("initial read or explicit recovery count"),
        run.outcome === "failure" ? 2 : 1,
      );
      assert.equal(value("initial read never probes"), 0);
    } else {
      assert.equal(value("exact adapter GET count"), run.action === "read" ? 2 : 1);
      assert.equal(value("no probe replay"), run.action === "probe" ? 1 : 0);
      assert.equal(value("drawer stays closed on return"), 0);
      if (run.width <= 760 && run.action === "probe") {
        assert.equal(value("C detail header palette"), "rgb(41, 76, 175)");
        assert.equal(value("C detail focus cycles both directions"), true);
      }
    }
    if (run.timing === "returned") assert.equal(value("pending lock retained after return"), true);
    assert.ok(run.requests.every((req) => req.body === null));
  }
});
