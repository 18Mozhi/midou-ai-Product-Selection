import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewTaskWorkspace } from "../../scripts/lib/task-page-preview.mjs";

test("P13 review preserves the today task scope and original write controls", async () => {
  const source = await readFile("apps/web/src/components/TaskWorkspace.vue", "utf8"),
    preview = previewTaskWorkspace(source);
  assert.match(preview, /params\.set\("mine", "true"\)/);
  assert.match(preview, /\/tasks\/summary/);
  assert.match(preview, /\/tasks\/member-options/);
  assert.match(preview, /expected_version/);
  assert.match(preview, /const actionName = batchAction\.value/);
  assert.match(preview, /targets = batchEligible\.value\.map\(\(\{ id, version \}\)/);
  assert.match(preview, /action: actionName/);
  assert.match(preview, /if \(busy\.value \|\|/);
  assert.match(preview, /先决定下一项需要推进的工作/);
  assert.match(preview, /不等同于仅今天到期/);
  assert.match(preview, /TaskBatchActions/);
  assert.doesNotMatch(preview, /导出任务<\/button>/);
});
