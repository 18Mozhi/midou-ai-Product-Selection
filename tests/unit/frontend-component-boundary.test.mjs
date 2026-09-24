import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const components = "apps/web/src/components";

test("thousand-line platform pages keep data orchestration in bounded presentation components", async () => {
  const limits = new Map([
    [`${components}/PlatformAccountCenter.vue`, 850],
    [`${components}/PlatformAccountDirectoryWorkspace.vue`, 280],
    [`${components}/PlatformAccountGlobalRail.vue`, 100],
    [`${components}/PlatformOrganizationRecords.vue`, 180],
    [`${components}/PlatformUserRecords.vue`, 180],
    [`${components}/PlatformAdminRecords.vue`, 240],
    [`${components}/ProviderSourceCenter.vue`, 1_000],
    ["apps/web/src/composables/useProviderParserSamples.ts", 320],
    ["apps/web/src/composables/useProviderSourceConfigurationVersions.ts", 380],
    ["apps/web/src/composables/useProviderSourceDirectory.ts", 260],
    [`${components}/ProviderSourceConfigurationDialog.vue`, 400],
    [`${components}/ProviderSourceEditDialog.vue`, 280],
    [`${components}/ProviderSourceVersionHistoryDialog.vue`, 220],
    [`${components}/ProviderParserSampleDialog.vue`, 240],
    [`${components}/ProviderParserSampleReview.vue`, 100],
    [`${components}/OpportunityWorkspace.vue`, 1_000],
    [`${components}/OpportunityLineagePanel.vue`, 140],
    [`${components}/OpportunityDecisionPanel.vue`, 180],
    [`${components}/OpportunityWorkspaceDialogs.vue`, 240],
    [`${components}/TrendDashboard.vue`, 800],
    [`${components}/TrendFilterPanel.vue`, 100],
    [`${components}/TrendDetailPanel.vue`, 140],
    [`${components}/TrendEvidenceTimeline.vue`, 180],
    [`${components}/SourcingWorkspace.vue`, 700],
    [`${components}/SourcingComparisonPanel.vue`, 120],
    [`${components}/NavigationShell.vue`, 700],
    [`${components}/NavigationAccessPanel.vue`, 120],
    [`${components}/navigation-surface-registry.ts`, 130],
    [`${components}/HomeAutomationOverview.vue`, 140],
    ["apps/web/src/navigation-shell-permissions.ts", 80],
    ["apps/web/src/use-navigation-shell-theme.ts", 100],
    ["apps/web/src/use-navigation-discovery.ts", 40],
    ["apps/web/src/use-platform-user-detail.ts", 100],
  ]);

  for (const [path, limit] of limits) {
    const source = await readFile(path, "utf8");
    assert.ok(source.split(/\r?\n/u).length < limit, `${path} must remain below ${limit} lines`);
  }

  const [
    accounts,
    accountDirectory,
    accountRail,
    sources,
    opportunities,
    trends,
    sourcing,
    organization,
  ] = await Promise.all([
    readFile(`${components}/PlatformAccountCenter.vue`, "utf8"),
    readFile(`${components}/PlatformAccountDirectoryWorkspace.vue`, "utf8"),
    readFile(`${components}/PlatformAccountGlobalRail.vue`, "utf8"),
    readFile(`${components}/ProviderSourceCenter.vue`, "utf8"),
    readFile(`${components}/OpportunityWorkspace.vue`, "utf8"),
    readFile(`${components}/TrendDashboard.vue`, "utf8"),
    readFile(`${components}/SourcingWorkspace.vue`, "utf8"),
    readFile(`${components}/OrganizationAdminCenter.vue`, "utf8"),
  ]);
  assert.match(accounts, /const PlatformAccountDirectoryWorkspace = defineAsyncComponent/);
  assert.match(accounts, /loadAccounts/);
  assert.match(accountDirectory, /defineModel<string>\("query"/);
  assert.match(accountDirectory, /\(event: "open-user"/);
  assert.doesNotMatch(accountDirectory, /createApiClient|fetch\(/);
  assert.match(accountDirectory, /import PlatformAccountGlobalRail/);
  assert.match(accountDirectory, /<PlatformAccountGlobalRail/);
  assert.doesNotMatch(accountRail, /createApiClient|fetch\(/);
  assert.match(accountDirectory, /import PlatformAdminRecords/);
  assert.match(accounts, /usePlatformUserDetail\(request, selected,/);
  assert.match(accountDirectory, /<PlatformAdminRecords/);
  assert.match(accountDirectory, /import PlatformOrganizationRecords/);
  assert.match(accountDirectory, /<PlatformOrganizationRecords/);
  assert.match(accountDirectory, /import PlatformUserRecords/);
  assert.match(accountDirectory, /<PlatformUserRecords/);
  assert.match(sources, /const ProviderParserSampleDialog = defineAsyncComponent/);
  assert.match(sources, /<ProviderParserSampleDialog/);
  assert.match(sources, /useProviderParserSamples\(\{ api, message, requestId \}\)/);
  assert.match(sources, /useProviderSourceConfigurationVersions/);
  assert.match(sources, /useProviderSourceDirectory/);
  const [parserSamples, sourceVersions, sourceDirectory] = await Promise.all([
    readFile("apps/web/src/composables/useProviderParserSamples.ts", "utf8"),
    readFile("apps/web/src/composables/useProviderSourceConfigurationVersions.ts", "utf8"),
    readFile("apps/web/src/composables/useProviderSourceDirectory.ts", "utf8"),
  ]);
  assert.match(parserSamples, /parser-samples\/\$\{sample\.id\}\/replays/);
  assert.match(parserSamples, /parser-samples\/\$\{sample\.id\}\/reviews/);
  assert.match(sourceVersions, /configuration\/rollbacks/);
  assert.match(sourceDirectory, /router\.replace\(\{ query: next \}\)/);
  const parserDialog = await readFile(`${components}/ProviderParserSampleDialog.vue`, "utf8");
  assert.match(parserDialog, /import ProviderParserSampleReview/);
  assert.match(parserDialog, /<ProviderParserSampleReview/);
  assert.match(sources, /const ProviderSourceConfigurationDialog = defineAsyncComponent/);
  assert.match(sources, /<ProviderSourceConfigurationDialog/);
  const configurationDialog = await readFile(
    `${components}/ProviderSourceConfigurationDialog.vue`,
    "utf8",
  );
  assert.match(configurationDialog, /import ProviderSourceEditDialog/);
  assert.match(configurationDialog, /<ProviderSourceEditDialog/);
  assert.match(configurationDialog, /import ProviderSourceVersionHistoryDialog/);
  assert.match(configurationDialog, /<ProviderSourceVersionHistoryDialog/);
  assert.doesNotMatch(configurationDialog, /useProviderSourceDialogFocus|createApiClient|fetch\(/);
  assert.match(opportunities, /const OpportunityWorkspaceDialogs = defineAsyncComponent/);
  assert.match(opportunities, /<OpportunityWorkspaceDialogs/);
  assert.match(opportunities, /const OpportunityDecisionPanel = defineAsyncComponent/);
  assert.match(opportunities, /<OpportunityDecisionPanel/);
  assert.match(opportunities, /const OpportunityLineagePanel = defineAsyncComponent/);
  assert.match(opportunities, /<OpportunityLineagePanel/);
  assert.match(trends, /import TrendFilterPanel/);
  assert.match(trends, /<TrendFilterPanel/);
  assert.match(trends, /import TrendDetailPanel/);
  assert.match(trends, /<TrendDetailPanel/);
  assert.match(sourcing, /import SourcingComparisonPanel/);
  assert.match(sourcing, /<SourcingComparisonPanel/);
  assert.match(sourcing, /import SourcingWorkspaceDialogs/);
  assert.match(sourcing, /<SourcingWorkspaceDialogs/);
  assert.match(organization, /const OrganizationMemberPanel = defineAsyncComponent/);
  assert.match(organization, /<OrganizationMemberPanel/);
  assert.match(organization, /const OrganizationRolePanel = defineAsyncComponent/);
  assert.match(organization, /<OrganizationRolePanel/);
  assert.match(organization, /const OrganizationApprovalPanel = defineAsyncComponent/);
  assert.match(organization, /<OrganizationApprovalPanel/);
  const navigationShell = await readFile(`${components}/NavigationShell.vue`, "utf8");
  const surfaceRegistry = await readFile(`${components}/navigation-surface-registry.ts`, "utf8");
  assert.match(navigationShell, /import NavigationAccessPanel/);
  assert.match(navigationShell, /state="missing"/);
  assert.match(navigationShell, /state="forbidden"/);
  assert.match(navigationShell, /import \{ DiscoveryOverlay, surfaceComponents \}/);
  assert.match(surfaceRegistry, /export const surfaceComponents/);
  assert.match(surfaceRegistry, /"provider-runtime-surface"/);
});
