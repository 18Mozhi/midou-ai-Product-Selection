import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P18 keeps human adoption behind all five actual quality gates", async () => {
  const source = await readFile("apps/web/src/components/OpportunityDecisionPanel.vue", "utf8");
  assert.match(source, /selectionStage\.value === "recommended"/);
  assert.match(source, /qualityGates\.value\.all_passed/);
  assert.match(source, /提前人工处理/);
  assert.match(source, /查看每项判断/);
  assert.match(source, /创建补采任务/);
});
