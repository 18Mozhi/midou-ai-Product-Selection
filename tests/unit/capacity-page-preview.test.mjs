import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "@vue/compiler-sfc";
import { previewCapacityPage } from "../../scripts/lib/capacity-page-preview.mjs";

const source = readFileSync("apps/web/src/components/CapacityBoundaryCenter.vue", "utf8");
const preview = parse(previewCapacityPage(source)).descriptor;
const original = parse(source).descriptor;

test("P71 C review preserves production script and original attestation dialog", () => {
  assert.equal(preview.scriptSetup.content, original.scriptSetup.content);
  assert.match(preview.template.content, /<h1>容量边界核验<\/h1>/);
  assert.equal((preview.template.content.match(/<ConfirmDialog/g) ?? []).length, 1);
});

test("P71 C review distinguishes returned stop facts from absolute resources", () => {
  const template = preview.template.content;
  for (const id of [
    "p71-stages",
    "p71-performance",
    "p71-resilience",
    "p71-resources",
    "p71-findings",
  ])
    assert.ok(template.includes(id), id);
  assert.match(template, /不绘制误导性水位条/);
  assert.match(template, /不构成压测授权或扩容承诺/);
  assert.match(template, /不执行恢复/);
});

test("P71 C review gives keyboard focus a visible shared treatment", () => {
  const css = readFileSync(
    "design-plans/ui-phase-2-2026-09-07/implementation/capacity-page-preview.css",
    "utf8",
  );
  assert.match(css, /capacity-boundary--review :is\(button,\s*summary\):focus-visible/);
  assert.match(css, /outline:\s*3px solid #2465d7/);
});
