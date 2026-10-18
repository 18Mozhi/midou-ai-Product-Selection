// Retired task references in this file verify fixed Git history, never current UI.
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { readTaskReviewFile as readFile } from "../../scripts/lib/retired-task-surface.mjs";
import test from "node:test";
import { previewAllTaskWorkspace } from "../../scripts/lib/all-task-page-preview.mjs";

test("P23 archived preview separates actor summary and refuses current retired creation", async () => {
  const current = await readFile("apps/web/src/components/TaskWorkspace.vue", "utf8");
  assert.throws(() => previewAllTaskWorkspace(current), /manual_task_creation_retired/);
  const source = execFileSync(
    "git",
    ["show", "16b949ff811886b0e0b03238603218da932148d6:apps/web/src/components/TaskWorkspace.vue"],
    { encoding: "utf8" },
  );
  const preview = previewAllTaskWorkspace(source);
  assert.match(preview, /\?\$\{params\.toString\(\)\}/);
  assert.match(preview, /\/tasks\/summary/);
  assert.match(preview, /工作区任务；下方本人汇总只用于提示优先事项/);
  assert.doesNotMatch(preview, /不等同于仅今天到期/);
});
