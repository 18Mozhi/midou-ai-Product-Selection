import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateOpportunitySelection,
  opportunityRecommendedSql,
} from "../../apps/api/dist/opportunity-selection-policy.js";

const complete = {
  decision_status: "pending",
  rule_candidate_ready: 1,
  recommendation_status: "recommend",
  overall_score: 82,
  score_rule_version: "score-v1",
  coverage_status: "complete",
  trend_score: 80,
  competition_score: 76,
  profit_status: "calculated",
  risk_gate_passed: 1,
};

test("five passed quality gates expose a recommendation while keeping adoption human", () => {
  assert.deepEqual(evaluateOpportunitySelection(complete), {
    selection_stage: "recommended",
    quality_gates: {
      score: true,
      market: true,
      competition: true,
      cost: true,
      risk: true,
      all_passed: true,
    },
  });
});

test("a threshold match remains a rule candidate when any one quality gate is missing", () => {
  for (const [field, value] of [
    ["overall_score", null],
    ["trend_score", null],
    ["competition_score", null],
    ["profit_status", "insufficient_data"],
    ["risk_gate_passed", 0],
  ]) {
    const result = evaluateOpportunitySelection({ ...complete, [field]: value });
    assert.equal(result.selection_stage, "rule_candidate", field);
    assert.equal(result.quality_gates.all_passed, false, field);
  }
});

test("a collected item below the enabled rule source threshold is not yet a rule candidate", () => {
  assert.equal(
    evaluateOpportunitySelection({ ...complete, rule_candidate_ready: 0 }).selection_stage,
    "not_eligible",
  );
});

test("recommended SQL names the same five persisted quality gates and stays MySQL 5.7 compatible", () => {
  for (const fact of [
    "recommendation_status='recommend'",
    "trend_score IS NOT NULL",
    "competition_score IS NOT NULL",
    "profit_status='calculated'",
    "dimension_code='risk'",
  ])
    assert.match(opportunityRecommendedSql, new RegExp(fact));
  assert.doesNotMatch(opportunityRecommendedSql, /WITH\s+|JSON_TABLE|QUALIFY/i);
});
