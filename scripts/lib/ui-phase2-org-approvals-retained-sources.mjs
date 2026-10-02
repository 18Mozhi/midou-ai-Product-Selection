import assert from "node:assert/strict";

// Refresh the real child binding and verification machinery. The data extractor
// may change only when the caller has already proved its full output still equals
// the immutable proposal data; renderer/data changes remain a new image revision.
const permitted = new Set([
  "apps/web/src/components/OrganizationApprovalPanel.vue",
  "apps/web/src/components/OrganizationAdminCenter.vue",
  "tests/e2e/m06-01-organization-admin.spec.ts",
  "scripts/lib/ui-phase2-org-approvals-design-data.mjs",
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
