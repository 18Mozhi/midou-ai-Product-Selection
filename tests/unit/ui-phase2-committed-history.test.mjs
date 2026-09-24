import assert from "node:assert/strict";
import test from "node:test";
import { findCommittedHistoricalRevision } from "../../scripts/lib/ui-phase2-committed-history.mjs";

test("historical UI source is associated only with an exact committed revision", () => {
  const file = "apps/web/src/components/PlatformAccountCenter.vue";
  const reviewedSource = "2b41c1f174bf0a1a67c97e8252e1d805a01c559d7bcb6817da80d7affd4b3474";

  assert.equal(
    findCommittedHistoricalRevision(file, reviewedSource),
    "55a7439b61297cd0a0c5ab5893af56fcbf2cfd9a",
  );
  assert.equal(findCommittedHistoricalRevision(file, "0".repeat(64)), null);
});
