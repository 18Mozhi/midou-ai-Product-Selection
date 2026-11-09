import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";

const source = readFileSync("apps/web/src/components/sourcing-comparison-specification.ts", "utf8");
const context = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  context,
);
const { specificationHint } = context.exports;

test("extracted quote specification hint retains raw, format-only and distinct specification states", () => {
  for (const [values, status] of [
    [["128 GB", "128 GB"], "aligned"],
    [["１２８ GB", "128  gb"], "format_only"],
    [["128 GB", "256 GB"], "needs_review"],
  ]) {
    const quotes = values.map((specification) => ({ specification }));
    const before = JSON.stringify(quotes);
    assert.equal(specificationHint(quotes).status, status);
    assert.equal(JSON.stringify(quotes), before, "display hints never normalize saved quote data");
  }
});

test("comparison table keeps external CSS scoped and preserves table and mobile semantics", () => {
  const component = readFileSync("apps/web/src/components/SourcingComparisonPanel.vue", "utf8");
  const { descriptor, errors } = parse(component);
  assert.deepEqual(errors, []);
  assert.equal(descriptor.styles[0].scoped, true);
  assert.equal(descriptor.styles[0].src, "../sourcing-comparison-table.css");
  assert.match(component, /<table class="sourcing-quote-table">/);
  assert.match(component, /tabindex="0"/);
  const css = readFileSync("apps/web/src/sourcing-comparison-table.css", "utf8");
  assert.match(css, /position: sticky/);
  assert.match(css, /@media \(max-width: 760px\)/);
});
