import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("opportunity write controls follow their existing API capabilities", async () => {
  const [workspace, list, decision, feedback] = await Promise.all([
    readFile("apps/web/src/components/OpportunityWorkspace.vue", "utf8"),
    readFile("apps/web/src/components/OpportunityListPanel.vue", "utf8"),
    readFile("apps/web/src/components/OpportunityDecisionPanel.vue", "utf8"),
    readFile("apps/web/src/components/OpportunityFeedbackPanel.vue", "utf8"),
  ]);

  assert.match(workspace, /includes\("opportunity:decide"\)/);
  assert.match(workspace, /includes\("competitor:manage"\)/);
  assert.match(workspace, /includes\("supplier_quote:manage"\)/);
  assert.match(workspace, /v-if="canDecide" class="opportunity-hero-actions"/);
  assert.match(workspace, /:can-decide="canDecide"/);
  assert.match(workspace, /:can-write="canDecide"/);
  assert.match(workspace, /v-if="canManageCompetitors"[\s\S]*discoverCompetitors/);
  assert.match(workspace, /v-if="canManageSuppliers"[\s\S]*discoverSuppliers/);
  assert.match(list, /v-if="canDecide && selectedIds\.length"/);
  assert.match(list, /v-if="canDecide" class="opportunity-row-select"/);
  assert.match(decision, /v-if="canDecide"[\s\S]*aria-label="机会决策操作"/);
  assert.match(decision, /canDecide && blocker\.status !== 'cleared'/);
  assert.match(feedback, /<form v-if="canWrite"/);
});
