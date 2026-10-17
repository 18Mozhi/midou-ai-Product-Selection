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
  assert.match(
    preview.template.content,
    /PlatformPageHeader title="文件存储核验" :heading-level="1"/,
  );
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
  assert.match(template, /使用率暂不可用。/);
  assert.match(template, /不发起恢复/);
});

test("P69 C review exposes the same visible focus treatment for native actions", () => {
  const css = readFileSync("apps/web/src/runtime-observation-workspace.css", "utf8");
  assert.ok(css.includes(".file-resilience--c"));
  assert.match(css, /:is\(button, a, summary\):focus-visible/);
  assert.match(css, /outline:\s*3px solid var\(--so-focus\)/);
  assert.match(
    readFileSync("apps/web/src/commerce-workspace.css", "utf8"),
    /prefers-reduced-motion/,
  );
});
