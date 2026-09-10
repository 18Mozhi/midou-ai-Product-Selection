import assert from "node:assert/strict";

// Refresh only the real child binding and its verification machinery. A changed
// proposal renderer/data must be reviewed as a new image revision, never relabeled.
const permitted = new Set([
  "apps/web/src/components/OrganizationApprovalPanel.vue",
  "scripts/verify-ui-phase2-org-approvals-c.mjs",
  "scripts/verify-ui-phase2-org-approvals-controls-c.mjs",
  "scripts/verify-ui-phase2-org-approvals-fields-c.mjs",
  "scripts/lib/ui-phase2-org-approvals-retained-sources.mjs",
]);

export function assertRetainedProposalSources(previous, current) {
  for (const file of new Set([...Object.keys(previous), ...Object.keys(current)])) {
    if (!permitted.has(file))
      assert.equal(current[file], previous[file], `Cannot refresh changed proposal input: ${file}`);
  }
}
