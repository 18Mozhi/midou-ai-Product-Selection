import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewAllTaskWorkspace } from "../../scripts/lib/all-task-page-preview.mjs";

test("P23 preserves the all-task read path while separating the actor summary", async () => {
  const source = await readFile("apps/web/src/components/TaskWorkspace.vue", "utf8");
  const preview = previewAllTaskWorkspace(source);
  assert.match(preview, /\?\$\{params\.toString\(\)\}/);
  assert.match(preview, /\/tasks\/summary/);
  assert.match(preview, /工作区任务；下方本人汇总只用于提示优先事项/);
  assert.doesNotMatch(preview, /不等同于仅今天到期/);
});
