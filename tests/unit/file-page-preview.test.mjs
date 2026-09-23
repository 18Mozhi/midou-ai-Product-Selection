import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "@vue/compiler-sfc";
import { previewFilePage } from "../../scripts/lib/file-page-preview.mjs";

const source = readFileSync("apps/web/src/components/FileResilienceCenter.vue", "utf8");
const preview = parse(previewFilePage(source)).descriptor;

test("P69 C review uses the production Vue page and compiles a single page heading", () => {
  assert.match(preview.scriptSetup.content, /FileResilienceSnapshot/);
  assert.match(preview.scriptSetup.content, /async function load\(\)/);
  assert.match(preview.scriptSetup.content, /GET|platform\/operations\/files/);
  assert.ok(preview.template.content.includes("<h1>文件存储核验</h1>"));
  assert.match(preview.template.content, /file-resilience--c/);
});

test("P69 C review separates filesystem watermarks from indexes and recovery evidence", () => {
  const template =
    preview.template.content +
    readFileSync(
      "apps/web/src/components/file-resilience/FileResilienceDirectoryLedger.vue",
      "utf8",
    ) +
    readFileSync(
      "apps/web/src/components/file-resilience/FileResilienceIntegrityAndRecovery.vue",
      "utf8",
    );
  for (const id of ["p69-directory", "p69-root-evidence", "p69-integrity", "p69-recovery"])
    assert.ok(template.includes(id), id);
  assert.match(template, /同盘读数不能相加/);
  assert.match(template, /零样本可以是 ready/);
  assert.match(template, /不会绘制有效水位条/);
  assert.match(template, /不发起恢复/);
});

test("P69 C review exposes the same visible focus treatment for native actions", () => {
  const css = readFileSync("apps/web/src/file-resilience.css", "utf8");
  assert.match(css, /#app .file-resilience--c :is\(button,\s*a,\s*summary\):focus-visible/);
  assert.match(css, /outline:\s*3px solid #2465d7/);
});
