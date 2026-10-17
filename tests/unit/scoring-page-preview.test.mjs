import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("P17 existing Vue keeps five-gate setup and governed rule lifecycle", async () => {
  const source = await readFile("apps/web/src/components/ScoreRuleConsole.vue", "utf8");
  assert.match(source, /score-setup-check/);
  assert.doesNotMatch(source, /QualityGateSetupSummary/);
  assert.match(source, /评分配置未就绪/);
  assert.match(source, /request<RulePreview>\([\s\S]*?\/preview\?page=/);
  assert.match(source, /expected_revision/);
  assert.match(source, /规则不会自动生效/);
});

test("retired rule prototypes stop before capture and current previews use actual Vue tests", async () => {
  for (const [script, message] of [
    [
      "scripts/verify-ui-phase2-scoring-c.mjs",
      "scoring_c_prototype_retired_use_verify_scoring_page_preview",
    ],
    [
      "scripts/verify-ui-phase2-cost-rules-c.mjs",
      "cost_rules_c_prototype_retired_use_verify_cost_rule_page_preview",
    ],
  ]) {
    const result = spawnSync(process.execPath, [script, "--capture"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr);
    assert.ok(result.stderr.includes(message));
  }
  for (const [script, spec] of [
    ["scripts/verify-scoring-page-preview.mjs", "m04-03-scoring.spec.ts"],
    ["scripts/verify-cost-rule-page-preview.mjs", "m04-04-profit.spec.ts"],
  ]) {
    const source = await readFile(script, "utf8");
    assert.ok(source.includes(spec));
    assert.doesNotMatch(source, /scoringPagePlugin|costRulePagePlugin|transformIndexHtml/);
  }
  for (const file of [
    "apps/web/src/components/shared/QualityGateSetupSummary.vue",
    "scripts/lib/scoring-page-preview.mjs",
    "scripts/lib/cost-rule-page-preview.mjs",
  ])
    await assert.rejects(access(file), { code: "ENOENT" });
});
