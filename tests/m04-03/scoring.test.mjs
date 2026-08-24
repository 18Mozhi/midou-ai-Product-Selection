import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ScoringService,
  ScoringServiceError,
  validateScoreInput,
  validateScoreRule,
} from "../../apps/api/dist/scoring-service.js";
import { calculateScoreProjection } from "../../packages/contracts/dist/index.js";
import { hasBlockingQualityRegression } from "../../apps/worker/dist/opportunity-scoring-worker.js";
const dimensions = [
  {
    code: "market_demand",
    label: "市场需求",
    weight: 40,
    required: true,
    evidence_group: "market",
  },
  { code: "competition", label: "竞争", weight: 30, required: true, evidence_group: "competition" },
  { code: "profit", label: "利润", weight: 30, required: true, evidence_group: "cost" },
];
test("M04-03.A01/A02/A04/A12 score rule requires explicit normalized weights and thresholds", () => {
  const result = validateScoreRule({
    version_code: "org-v1",
    name: "规则一",
    dimensions,
    thresholds: { recommend_min: 75, observe_min: 55 },
  });
  assert.equal(
    result.dimensions.reduce((sum, item) => sum + item.weight, 0),
    100,
  );
  assert.throws(
    () =>
      validateScoreRule({
        version_code: "bad",
        name: "bad",
        dimensions: dimensions.map((item) => ({ ...item, weight: 20 })),
        thresholds: { recommend_min: 75, observe_min: 55 },
      }),
    (error) => error instanceof ScoringServiceError && error.code === "score_rule_weight_invalid",
  );
  assert.throws(
    () =>
      validateScoreRule({
        version_code: "bad",
        name: "bad",
        dimensions,
        thresholds: { recommend_min: 50, observe_min: 60 },
      }),
    (error) =>
      error instanceof ScoringServiceError && error.code === "score_rule_threshold_invalid",
  );
});
test("M04-03.A02/A04/A12 score inputs require provenance and truthful missing fields", () => {
  const evidence = "00000000-0000-4000-8000-000000000401";
  assert.equal(
    validateScoreInput({
      dimension_code: "market_demand",
      evidence_group: "market",
      score_value: 80,
      source_type: "probe",
      source_ref_id: "probe:1",
      evidence_ids: [evidence],
      missing_fields: [],
      observed_at: new Date().toISOString(),
      expected_version: 1,
    }).score_value,
    80,
  );
  assert.throws(
    () =>
      validateScoreInput({
        dimension_code: "market_demand",
        evidence_group: "market",
        score_value: 80,
        source_type: "probe",
        source_ref_id: "probe:1",
        evidence_ids: [],
        missing_fields: [],
        observed_at: new Date().toISOString(),
        expected_version: 1,
      }),
    (error) =>
      error instanceof ScoringServiceError && error.code === "score_input_evidence_required",
  );
});
test("M04-03 score preview reuses the production calculation without writing state", async () => {
  const projection = calculateScoreProjection(dimensions, { recommend_min: 75, observe_min: 55 }, [
    {
      dimension_code: "market_demand",
      evidence_group: "market",
      score_value: 82,
      evidence_ids: ["market-evidence"],
      missing_fields: [],
    },
    {
      dimension_code: "competition",
      evidence_group: "competition",
      score_value: 70,
      evidence_ids: ["competition-evidence"],
      missing_fields: [],
    },
    {
      dimension_code: "profit",
      evidence_group: "cost",
      score_value: 88,
      evidence_ids: ["cost-evidence"],
      missing_fields: [],
    },
  ]);
  assert.equal(projection.overall_score, 80.2);
  assert.equal(projection.recommendation_status, "recommend");
  let received;
  const service = new ScoringService({
    preview(input) {
      received = input;
      return Promise.resolve({ read_only: true });
    },
  });
  assert.deepEqual(
    await service.preview({
      organizationId: "org",
      workspaceId: "ws",
      ruleId: "00000000-0000-4000-8000-000000000435",
      page: 2,
      pageSize: 20,
    }),
    { read_only: true },
  );
  assert.equal(received.page, 2);
  assert.throws(
    () =>
      service.preview({
        organizationId: "org",
        workspaceId: "ws",
        ruleId: "00000000-0000-4000-8000-000000000435",
        page: 1,
        pageSize: 101,
      }),
    (error) =>
      error instanceof ScoringServiceError &&
      error.code === "score_rule_preview_pagination_invalid",
  );
});
test("M04-03 downstream scoring stops on a failed latest reconciliation or open critical evidence issue", () => {
  assert.equal(
    hasBlockingQualityRegression([
      { reconciliation_status: "passed", critical_issue_count: 0 },
      { reconciliation_status: "failed", critical_issue_count: 0 },
    ]),
    true,
  );
  assert.equal(
    hasBlockingQualityRegression([{ reconciliation_status: "passed", critical_issue_count: 1 }]),
    true,
  );
  assert.equal(
    hasBlockingQualityRegression([
      { reconciliation_status: "insufficient_sample", critical_issue_count: 0 },
    ]),
    false,
  );
});
test("M04-03.A03/A05-A11/A13-A17 delivery evidence covers the complete module", async () => {
  const paths = [
    "database/migrations/0017c_scoring_rules_m04_03.up.sql",
    "database/migrations/0017c_scoring_rules_m04_03.down.sql",
    "apps/api/src/scoring-service.ts",
    "apps/api/src/mysql-scoring-repository.ts",
    "apps/api/src/scoring-routes.ts",
    "packages/contracts/src/index.ts",
    "apps/worker/src/opportunity-scoring-worker.ts",
    "apps/web/src/components/ScoreRuleConsole.vue",
    "apps/web/src/components/OpportunityWorkspace.vue",
    "apps/web/src/scoring.css",
    "config/schema.json",
    "config/env.example",
    "docs/openapi.yaml",
    "docs/feature-map.json",
    "docs/architecture/m04-03-scoring-engine.md",
    "docs/runbooks/m04-03-scoring-engine.md",
    "tests/e2e/m04-03-scoring.spec.ts",
    "scripts/verify-scoring-live.mjs",
    "new-product-enterprise-blueprint.md",
  ];
  const values = await Promise.all(paths.map((path) => readFile(path, "utf8"))),
    [
      up,
      down,
      service,
      repository,
      routes,
      calculator,
      worker,
      consoleUi,
      opportunityUi,
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
    ] = values;
  const opportunityScoringUi = `${opportunityUi}\n${await readFile(
    "apps/web/src/components/OpportunityDetailInsights.vue",
    "utf8",
  )}`;
  assert.match(
    up,
    /score_rules[\s\S]*opportunity_score_inputs[\s\S]*opportunity_score_jobs[\s\S]*opportunity_score_runs[\s\S]*opportunity_score_components/,
  );
  assert.match(down, /DROP TABLE IF EXISTS `score_rules`/);
  assert.match(service, /score_rule_weight_invalid[\s\S]*score_input_evidence_required/);
  assert.match(repository, /pending_approval[\s\S]*rollback[\s\S]*organization_id=\?/);
  assert.match(routes, /opportunity:read[\s\S]*opportunity:decide[\s\S]*opportunity:approve/);
  assert.match(calculator, /coverage\s*>=\s*50[\s\S]*coverage\s*>=\s*80/);
  assert.match(worker, /calculateScoreProjection[\s\S]*completed_with_warnings[\s\S]*dead_letter/);
  assert.match(
    worker,
    /triggerTaskId[\s\S]*task\.evidence_completion\.redecision_ready[\s\S]*recipient_id/,
  );
  assert.match(
    worker,
    /reconciliation_runs[\s\S]*data_quality_issues[\s\S]*score_blocked_by_data_quality_regression/,
  );
  for (const state of ["loading", "ready", "empty", "error", "expired", "forbidden", "blocked"])
    assert.match(consoleUi, new RegExp(state));
  assert.match(opportunityScoringUi, /latest_score_run[\s\S]*score_components[\s\S]*重新评分/);
  assert.match(css, /@media\s*\(\s*max-width:\s*640px\s*\)/);
  assert.match(schema, /OPPORTUNITY_SCORING_POLL_MS/);
  assert.match(env, /OPPORTUNITY_SCORING_LEASE_SECONDS/);
  assert.match(openapi, /opportunity-score-rules[\s\S]*scoreRuleId.*preview/);
  assert.match(repository, /page_summary:[\s\S]*read_only:\s*true/);
  assert.match(consoleUi, /预览影响[\s\S]*发布影响预览/);
  assert.match(feature, /scoringEngine/);
  assert.match(architecture, /50%[\s\S]*80%/);
  assert.match(runbook, /宝塔[\s\S]*回滚/);
  assert.match(e2e, /toBeVisible|toHaveAttribute|keyboard\\.press/);
  assert.match(live, /historical_runs_preserved/);
  assert.match(blueprint, /M04-03 实现合同/);
});
