import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const components = "apps/web/src/components";

test("thousand-line platform pages keep data orchestration in bounded presentation components", async () => {
  const limits = new Map([
    [`${components}/PlatformAccountCenter.vue`, 850],
    [`${components}/PlatformOrganizationRecords.vue`, 180],
    [`${components}/PlatformUserRecords.vue`, 180],
    [`${components}/PlatformAdminRecords.vue`, 240],
    [`${components}/ProviderSourceCenter.vue`, 1_000],
    [`${components}/ProviderSourceConfigurationDialog.vue`, 400],
    [`${components}/ProviderParserSampleDialog.vue`, 240],
    [`${components}/ProviderParserSampleReview.vue`, 100],
    [`${components}/OpportunityWorkspace.vue`, 1_000],
    [`${components}/OpportunityDecisionPanel.vue`, 180],
    [`${components}/OpportunityWorkspaceDialogs.vue`, 240],
    [`${components}/TrendDashboard.vue`, 800],
    [`${components}/TrendFilterPanel.vue`, 100],
    [`${components}/TrendDetailPanel.vue`, 140],
    [`${components}/TrendEvidenceTimeline.vue`, 180],
    [`${components}/SourcingWorkspace.vue`, 700],
    [`${components}/SourcingComparisonPanel.vue`, 120],
    [`${components}/SourcingWorkspaceDialogs.vue`, 280],
    [`${components}/OrganizationAdminCenter.vue`, 800],
    [`${components}/OrganizationMemberPanel.vue`, 200],
    [`${components}/OrganizationRolePanel.vue`, 80],
    [`${components}/OrganizationApprovalPanel.vue`, 120],
    [`${components}/NavigationShell.vue`, 700],
    ["apps/web/src/navigation-shell-route-state.ts", 180],
    ["apps/web/src/navigation-shell-permissions.ts", 80],
    ["apps/web/src/use-navigation-shell-theme.ts", 100],
    ["apps/web/src/use-navigation-discovery.ts", 40],
  ]);

  for (const [path, limit] of limits) {
    const source = await readFile(path, "utf8");
    assert.ok(source.split(/\r?\n/u).length < limit, `${path} must remain below ${limit} lines`);
  }

  const [accounts, sources, opportunities, trends, sourcing, organization] = await Promise.all([
    readFile(`${components}/PlatformAccountCenter.vue`, "utf8"),
    readFile(`${components}/ProviderSourceCenter.vue`, "utf8"),
    readFile(`${components}/OpportunityWorkspace.vue`, "utf8"),
    readFile(`${components}/TrendDashboard.vue`, "utf8"),
    readFile(`${components}/SourcingWorkspace.vue`, "utf8"),
    readFile(`${components}/OrganizationAdminCenter.vue`, "utf8"),
  ]);
  assert.match(accounts, /import PlatformAdminRecords/);
  assert.match(accounts, /<PlatformAdminRecords/);
  assert.match(accounts, /import PlatformOrganizationRecords/);
  assert.match(accounts, /<PlatformOrganizationRecords/);
  assert.match(accounts, /import PlatformUserRecords/);
  assert.match(accounts, /<PlatformUserRecords/);
  assert.match(sources, /import ProviderParserSampleDialog/);
  assert.match(sources, /<ProviderParserSampleDialog/);
  const parserDialog = await readFile(`${components}/ProviderParserSampleDialog.vue`, "utf8");
  assert.match(parserDialog, /import ProviderParserSampleReview/);
  assert.match(parserDialog, /<ProviderParserSampleReview/);
  assert.match(sources, /import ProviderSourceConfigurationDialog/);
  assert.match(sources, /<ProviderSourceConfigurationDialog/);
  assert.match(opportunities, /import OpportunityWorkspaceDialogs/);
  assert.match(opportunities, /<OpportunityWorkspaceDialogs/);
  assert.match(opportunities, /import OpportunityDecisionPanel/);
  assert.match(opportunities, /<OpportunityDecisionPanel/);
  assert.match(trends, /import TrendFilterPanel/);
  assert.match(trends, /<TrendFilterPanel/);
  assert.match(trends, /import TrendDetailPanel/);
  assert.match(trends, /<TrendDetailPanel/);
  assert.match(sourcing, /import SourcingComparisonPanel/);
  assert.match(sourcing, /<SourcingComparisonPanel/);
  assert.match(sourcing, /import SourcingWorkspaceDialogs/);
  assert.match(sourcing, /<SourcingWorkspaceDialogs/);
  assert.match(organization, /import OrganizationMemberPanel/);
  assert.match(organization, /<OrganizationMemberPanel/);
  assert.match(organization, /import OrganizationRolePanel/);
  assert.match(organization, /<OrganizationRolePanel/);
  assert.match(organization, /import OrganizationApprovalPanel/);
  assert.match(organization, /<OrganizationApprovalPanel/);
});
