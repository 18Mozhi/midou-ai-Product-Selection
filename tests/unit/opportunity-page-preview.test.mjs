import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import test from "node:test";

test("selection preview verifies the current Vue route instead of injecting historical user panels", async () => {
  const [workspace, cli, vite] = await Promise.all(
    [
      "apps/web/src/components/OpportunityWorkspace.vue",
      "scripts/verify-opportunity-page-preview.mjs",
      "apps/web/vite.config.ts",
    ].map((file) => readFile(file, "utf8")),
  );
  assert.match(workspace, /SelectionProductHeader/);
  assert.match(workspace, /OpportunityDecisionPanel/);
  assert.doesNotMatch(
    workspace,
    /OpportunityAiPanel|OpportunityFeedbackPanel|OpportunityLineagePanel/,
  );
  assert.match(cli, /tests\/e2e\/m04-02-opportunities.spec.ts/);
  assert.match(cli, /tests\/e2e\/m04-07-ai-analysis.spec.ts/);
  assert.doesNotMatch(
    cli + vite,
    /replaceTemplate|opportunityPagePlugin|opportunity-page-preview.css/,
  );
  await assert.rejects(access("scripts/lib/opportunity-page-preview.mjs"), { code: "ENOENT" });
});

test("retired ERP proposal refuses current source before browser or output creation", async () => {
  const { buildOpportunityDesignData } =
    await import("../../scripts/lib/ui-phase2-opportunity-design-data.mjs");
  await assert.rejects(buildOpportunityDesignData(process.cwd()), /erp_import_surface_retired/);
  for (const file of ["OpportunityErpImportDialog.vue", "use-opportunity-workspace-erp-import.ts"])
    await assert.rejects(access(`apps/web/src/components/${file}`), { code: "ENOENT" });
});
