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
test("retained backend AI contracts stay available while member-side manual AI is removed", async () => {
  const paths = [
    "apps/api/src/ai-analysis-service.ts",
    "apps/api/src/ai-analysis-routes.ts",
    "apps/worker/src/ai-analysis-worker.ts",
    "apps/worker/src/intelligence-product-association.ts",
    "apps/web/src/components/OpportunityWorkspace.vue",
    "apps/web/src/components/use-opportunity-workspace-reads.ts",
    "docs/openapi.yaml",
    "config/env.example",
  ];
  const [service, routes, worker, association, workspace, reads, openapi, env] = await Promise.all(
    paths.map((path) => readFile(path, "utf8")),
  );
  assert.match(service, /validateQueue[\s\S]*validateReview/);
  assert.match(routes, /opportunity:read/);
  assert.match(routes, /opportunity:decide/);
  assert.match(worker, /chat\/completions[\s\S]*response_format/);
  assert.match(association, /source_ref/);
  assert.doesNotMatch(workspace + reads, /OpportunityAiPanel|reviewAi|loadAi|\/ai-analyses/);
  assert.match(openapi, /ai-analyses/);
  assert.match(env, /AI_ANALYSIS_LEASE_SECONDS/);
});
