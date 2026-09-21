import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { previewOpportunityWorkspace } from "../../scripts/lib/opportunity-page-preview.mjs";

test("P15 review keeps four truthful queues and manual decision boundary", async () => {
  const source = await readFile("apps/web/src/components/OpportunityWorkspace.vue", "utf8"),
    preview = previewOpportunityWorkspace(source);
  assert.match(preview, /OpportunityListPanel/);
  assert.match(preview, /selectionView/);
  assert.match(preview, /五项均通过/);
  assert.match(preview, /最终决定必须保留人工原因/);
  assert.match(preview, /source_topic_id/);
  assert.match(preview, /OpportunityWorkspaceDialogs/);
});
