import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "@vue/compiler-sfc";
import { previewFilePage } from "../../scripts/lib/file-page-preview.mjs";

const source = readFileSync("apps/web/src/components/FileResilienceCenter.vue", "utf8");
const preview = parse(previewFilePage(source)).descriptor;
const original = parse(source).descriptor;

test("P69 C review preserves production script and compiles a single page heading", () => {
  assert.equal(preview.scriptSetup.content, original.scriptSetup.content);
  assert.ok(preview.template.content.includes("<h1>文件存储核验</h1>"));
  assert.doesNotMatch(preview.template.content, /file-resilience__metrics|file-resilience__layout/);
});

test("P69 C review separates filesystem watermarks from indexes and recovery evidence", () => {
  const template = preview.template.content;
  for (const id of ["p69-directory", "p69-root-evidence", "p69-integrity", "p69-recovery"])
    assert.ok(template.includes(id), id);
  assert.match(template, /同盘读数不能相加/);
  assert.match(template, /零样本可以是ready/);
  assert.match(template, /不会绘制有效水位条/);
  assert.match(template, /不发起恢复/);
});

test("P69 C review exposes the same visible focus treatment for native actions", () => {
  const css = readFileSync(
    "design-plans/ui-phase-2-2026-09-07/implementation/file-page-preview.css",
    "utf8",
  );
  assert.match(css, /file-resilience--review :is\(button,\s*summary\):focus-visible/);
  assert.match(css, /outline:\s*3px solid #2465d7/);
});
