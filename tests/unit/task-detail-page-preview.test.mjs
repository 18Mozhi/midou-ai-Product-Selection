import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  previewTaskDetailPanel,
  previewTaskDetailWorkspace,
} from "../../scripts/lib/task-detail-page-preview.mjs";

test("P24 keeps the actual direct-detail reader and action emit boundary", async () => {
  const [workspace, detail] = await Promise.all([
    readFile("apps/web/src/components/TaskWorkspace.vue", "utf8"),
    readFile("apps/web/src/components/TaskDetailPanel.vue", "utf8"),
  ]);
  const page = previewTaskDetailWorkspace(workspace),
    panel = previewTaskDetailPanel(detail);
  assert.match(page, /\/tasks\/\$\{id\}/);
  assert.match(page, /\/tasks\/member-options/);
  assert.match(panel, /\$emit\('action','progress'\)/);
  assert.match(page, /expected_version/);
  assert.match(panel, /完成进度（0–100）/);
  assert.match(workspace, /TASK DOSSIER \/ 任务详情/);
  assert.match(detail, /class="task-dossier"/);
  assert.match(detail, /class="task-dossier-facts"/);
  assert.match(detail, /class="task-dossier-activity"/);
});
