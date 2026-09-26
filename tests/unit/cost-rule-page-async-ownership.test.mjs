import assert from "node:assert/strict";
import test from "node:test";
import { verifyCostRulesReview } from "../../scripts/verify-ui-phase2-cost-rules-review.mjs";

test("P22 latest reads and action confirmation retain their own rule snapshot", async () => {
  const result = await verifyCostRulesReview();
  assert.ok(
    result.checks.includes(
      "Action confirmation retains the original A ID/revision and context after the selected read snapshot changes to B",
    ),
  );
  assert.ok(
    result.checks.includes(
      "Out-of-order reads apply only the latest response and cannot restore an older snapshot",
    ),
  );
});
