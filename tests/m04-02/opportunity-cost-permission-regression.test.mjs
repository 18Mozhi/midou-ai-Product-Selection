import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("opportunity profit controls follow the existing cost:confirm capability", async () => {
  const [routeState, workspace, panel] = await Promise.all([
    readFile("apps/web/src/navigation-shell-route-state.ts", "utf8"),
    readFile("apps/web/src/components/OpportunityWorkspace.vue", "utf8"),
    readFile("apps/web/src/components/OpportunityProfitPanel.vue", "utf8"),
  ]);

  assert.match(routeState, /case "opportunity-workspace"[\s\S]*capabilities: input\.capabilities/);
  assert.match(workspace, /capabilities\?: string\[\]/);
  assert.match(workspace, /includes\("cost:confirm"\)/);
  assert.match(
    workspace,
    /if \(canConfirmCost\.value\)[\s\S]*"\/cost-input-reviewers"[\s\S]*costReviewerOptions\.value = \[\]/,
  );
  assert.match(workspace, /:can-confirm-cost="canConfirmCost"/);
  assert.match(panel, /v-if="canConfirmCost" class="profit-input"/);
  assert.match(panel, /当前角色为只读成本视图/);
});
