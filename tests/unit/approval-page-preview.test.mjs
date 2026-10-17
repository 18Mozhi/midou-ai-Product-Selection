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

test("current page preview verifies Vue without historical CSS injection", async () => {
  const cli = await readFile("scripts/verify-approval-page-preview.mjs", "utf8");
  assert.match(cli, /@playwright\/test\/cli/);
  assert.match(cli, /m05-02-approval-workflow/);
  assert.doesNotMatch(cli, /PagePlugin|createServer|addStyleTag|implementation\//);
});
