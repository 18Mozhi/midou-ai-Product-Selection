import { readFileSync } from "node:fs";
import { readPreSelectionRebuild } from "./pre-selection-rebuild-snapshot.mjs";

// The retired P33 registry includes later, independently audited shared-focus
// revisions. Freeze the rebuilt page inputs without replacing those shared bytes.
const rebuiltFiles = new Set([
  "apps/web/src/components/OrganizationAdminCenter.vue",
  "apps/web/src/components/OrganizationTeamPanel.vue",
  "apps/web/src/organization-admin.css",
  "apps/web/src/design/organization-admin-tokens.css",
  "tests/e2e/m06-01-organization-admin.spec.ts",
]);

export function readPreRebuildTeamsBoundary(file) {
  return rebuiltFiles.has(file) ? readPreSelectionRebuild(file) : readFileSync(file, "utf8");
}
