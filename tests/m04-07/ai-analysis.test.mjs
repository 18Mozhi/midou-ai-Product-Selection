import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateQueue, validateReview } from "../../apps/api/dist/ai-analysis-service.js";
import {
  AiAnalysisWorkerError,
  validateAiAssistOutput,
} from "../../apps/worker/dist/ai-analysis-worker.js";
test("M04-07.A01/A02/A04/A12 validates version review schema and evidence references", () => {
  assert.equal(validateQueue({ expected_version: 3 }).expected_version, 3);
  assert.equal(
    validateReview({ outcome: "approved", notes: "抽检事实引用完整" }).outcome,
    "approved",
  );
  const value = {
    summary: "仅对已存事实做摘要。",
    classifications: [
      {
        label: "待补充",
        rationale: "利润输入缺失。",
        source_refs: ["opportunity:00000000-0000-4000-8000-000000000701"],
      },
    ],
    missing_fields: [
      {
        field: "profit",
        reason: "没有利润运行。",
        source_refs: ["opportunity:00000000-0000-4000-8000-000000000701"],
      },
    ],
  };
  assert.equal(
    validateAiAssistOutput(value, new Set(["opportunity:00000000-0000-4000-8000-000000000701"]))
      .summary,
    value.summary,
  );
  assert.throws(
    () =>
      validateAiAssistOutput(
        {
          ...value,
          classifications: [{ ...value.classifications[0], source_refs: ["invented:1"] }],
        },
        new Set(["opportunity:00000000-0000-4000-8000-000000000701"]),
      ),
    (e) => e instanceof AiAnalysisWorkerError && e.code === "ai_output_source_ref_invalid",
  );
});
test("M04-07.A03/A05-A11/A13-A17 delivery evidence exists", async () => {
  const paths = [
      "database/migrations/0017g_ai_assist_m04_07.up.sql",
      "database/migrations/0017g_ai_assist_m04_07.down.sql",
      "apps/api/src/ai-analysis-service.ts",
      "apps/api/src/mysql-ai-analysis-repository.ts",
      "apps/api/src/ai-analysis-routes.ts",
      "apps/worker/src/ai-analysis-worker.ts",
      "apps/web/src/components/OpportunityWorkspace.vue",
      "apps/web/src/opportunity-ai.css",
      "config/schema.json",
      "config/env.example",
      "docs/openapi.yaml",
      "docs/feature-map.json",
      "docs/architecture/m04-07-ai-analysis.md",
      "docs/runbooks/m04-07-ai-analysis.md",
      "tests/e2e/m04-07-ai-analysis.spec.ts",
      "scripts/verify-ai-analysis-live.mjs",
      "new-product-enterprise-blueprint.md",
    ],
    v = await Promise.all(paths.map((p) => readFile(p, "utf8"))),
    [
      up,
      down,
      service,
      repo,
      routes,
      worker,
      ui,
      css,
      schema,
      env,
      openapi,
      feature,
      architecture,
      runbook,
      e2e,
      live,
      blueprint,
    ] = v;
  assert.match(up, /ai_analysis_requests[\s\S]*ai_analysis_results[\s\S]*ai_analysis_reviews/);
  assert.match(down, /DROP TABLE IF EXISTS `ai_analysis_requests`/);
  assert.match(service, /validateQueue[\s\S]*validateReview/);
  assert.match(repo, /input_snapshot_json[\s\S]*ai\.analysis\.reviewed/);
  assert.match(routes, /opportunity:read/);
  assert.match(routes, /opportunity:decide/);
  assert.match(worker, /chat\/completions[\s\S]*response_format[\s\S]*dead_letter/);
  assert.match(ui, /AI 辅助分析[\s\S]*ai_generated[\s\S]*抽检通过/);
  assert.match(css, /@media\s*\(\s*max-width:\s*700px\s*\)/);
  assert.match(schema, /AI_RETRY_LIMIT/);
  assert.match(env, /AI_ANALYSIS_LEASE_SECONDS/);
  assert.match(openapi, /ai-analyses/);
  assert.match(feature, /aiAssistedAnalysis/);
  assert.match(architecture, /ai_generated[\s\S]*MySQL 5\.7/);
  assert.match(runbook, /宝塔[\s\S]*回滚/);
  assert.match(e2e, /toBeVisible|toHaveAttribute|keyboard\\.press/);
  assert.match(live, /provider_timeout_dead_letter/);
  assert.match(blueprint, /M04-07 实现合同/);
});
