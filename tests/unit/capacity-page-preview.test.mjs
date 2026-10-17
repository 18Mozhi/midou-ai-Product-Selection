import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "@vue/compiler-sfc";
import { previewCapacityPage } from "../../scripts/lib/capacity-page-preview.mjs";

const source = readFileSync("apps/web/src/components/CapacityBoundaryCenter.vue", "utf8");
const preview = parse(previewCapacityPage(source)).descriptor;
const original = parse(source).descriptor;
const evidence = readFileSync("apps/web/src/components/CapacityBoundaryEvidence.vue", "utf8");

test("P71 C review preserves production script and original attestation dialog", () => {
  assert.equal(preview.scriptSetup.content, original.scriptSetup.content);
  assert.match(preview.template.content, /<PlatformPageHeader title="容量边界核验"/);
  assert.match(preview.template.content, /<CapacityBoundaryEvidence/);
  assert.equal((preview.template.content.match(/<ConfirmDialog/g) ?? []).length, 1);
});

test("P71 C review distinguishes returned stop facts from absolute resources", () => {
  const template = preview.template.content;
  for (const id of [
    "p71-paper",
    "p71-conclusion",
    "p71-stages",
    "p71-performance",
    "p71-resilience",
    "p71-resources",
    "p71-findings",
  ])
    assert.ok(evidence.includes(id), id);
  assert.match(template, /capacity-boundary--review/);
  assert.doesNotMatch(evidence.slice(evidence.indexOf('class="p71-resources')), /<progress/);
  assert.match(evidence, /缺失不补成承诺/);
  assert.doesNotMatch(evidence, /fetch\(|apiJson\(/);
});

test("P71 C review gives keyboard focus a visible shared treatment", () => {
  const css = readFileSync("apps/web/src/capacity-boundary-c.css", "utf8");
  const shared = readFileSync("apps/web/src/runtime-observation-workspace.css", "utf8");
  assert.ok(css.startsWith('@import "./runtime-observation-workspace.css";'));
  assert.match(shared, /:focus-visible/);
  assert.match(shared, /outline: 3px solid var\(--so-focus\)/);
});
