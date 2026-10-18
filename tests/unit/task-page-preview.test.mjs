// Retired task references in this file verify fixed Git history, never current UI.
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { readTaskReviewFile as readFile } from "../../scripts/lib/retired-task-surface.mjs";
import test from "node:test";
import { previewTaskWorkspace } from "../../scripts/lib/task-page-preview.mjs";

test("P13 historical preview preserves archived controls and rejects current retired creation", async () => {
  const current = await readFile("apps/web/src/components/TaskWorkspace.vue", "utf8");
  assert.throws(() => previewTaskWorkspace(current), /manual_task_creation_retired/);
  const source = execFileSync(
      "git",
      [
        "show",
        "16b949ff811886b0e0b03238603218da932148d6:apps/web/src/components/TaskWorkspace.vue",
      ],
      { encoding: "utf8" },
    ),
    preview = previewTaskWorkspace(source);
  assert.match(preview, /params\.set\("mine", "true"\)/);
  assert.match(preview, /\/tasks\/summary/);
  assert.match(preview, /\/tasks\/member-options/);
  assert.match(preview, /expected_version/);
  assert.match(preview, /const actionName = batchAction\.value/);
  assert.match(
    preview,
    /eligibleSnapshot = batchEligible\.value\.map\(\(\{ id, version \}\) => \(\{ id, version \}\)\)/,
  );
  assert.match(preview, /action: actionName/);
  assert.match(preview, /if \(busy\.value \|\|/);
  assert.match(preview, /先决定下一项需要推进的工作/);
  assert.match(preview, /不等同于仅今天到期/);
  assert.match(preview, /TaskBatchActions/);
  assert.doesNotMatch(preview, /导出任务<\/button>/);
});
