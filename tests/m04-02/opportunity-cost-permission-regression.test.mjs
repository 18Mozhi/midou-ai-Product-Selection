import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("member profit view has no manual cost reads or writes while backend governance remains", async () => {
  const [workspace, panel, access, reads, routes] = await Promise.all([
    readFile("apps/web/src/components/OpportunityWorkspace.vue", "utf8"),
    readFile("apps/web/src/components/OpportunityProfitPanel.vue", "utf8"),
    readFile("apps/web/src/components/use-opportunity-workspace-access.ts", "utf8"),
    readFile("apps/web/src/components/use-opportunity-workspace-reads.ts", "utf8"),
    readFile("apps/api/src/profit-routes.ts", "utf8"),
  ]);
  assert.doesNotMatch(
    workspace + panel + access + reads,
    /costForm|costReviewer|canConfirmCost|confirmCost|reviewCost|queueProfit|cost-input-reviewers|profit-input|OpportunityCostReviewQueue/,
  );
  assert.match(reads, /profit-analysis/);
  assert.match(panel, /profitStatus === 'calculated'/);
  assert.match(panel, /查看计算依据/);
  assert.match(panel, /retryProfit/);
  assert.match(routes, /cost:confirm[\s\S]*profit-runs/);
});
