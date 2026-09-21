import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P25 review layer preserves approval reads and decision contract", async () => {
  const source = await readFile("apps/web/src/components/ApprovalWorkspace.vue", "utf8");
  assert.match(source, /\/tasks\/approvals\?page=/);
  assert.match(source, /\/tasks\/approval-templates/);
  assert.match(source, /action,\s*reason: reason\.value,\s*expected_version/);
  assert.match(source, /selected\.can_decide && canManage/);
});
