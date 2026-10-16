import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateOpportunitySelection,
  opportunityRecommendedSql,
  competitorDetailEvidenceSql,
  opportunityCandidateSql,
} from "../../apps/api/dist/opportunity-selection-policy.js";
import { selectionCandidateSql } from "../../packages/database/dist/index.js";

const complete = {
  decision_status: "pending",
  candidate_ready: 1,
  recommendation_status: "recommend",
  overall_score: 82,
  score_rule_version: "score-v1",
  coverage_status: "complete",
  trend_score: 80,
  competition_score: 76,
  profit_status: "calculated",
  risk_gate_passed: 1,
  competition_gate_passed: 1,
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

test("competition provenance fails closed and must bind detail task, product and exact evidence", () => {
  for (const competition_gate_passed of [undefined, null, false, 0])
    assert.equal(
      evaluateOpportunitySelection({ ...complete, competition_gate_passed }).quality_gates
        .competition,
      false,
    );
  const sql = competitorDetailEvidenceSql("s");
  for (const evidence of [
    "l_detail.raw_evidence_id=s.evidence_id",
    "l_detail.normalized_record_id",
    "s.competitor_id",
    "q_detail.organization_id=s.organization_id",
    "q_detail.workspace_id=s.workspace_id",
    "'competitor_snapshot'",
    "(dp|gp/product)",
  ])
    assert.ok(sql.includes(evidence), evidence);
});

test("an identified primary remains a candidate when any one quality gate is missing", () => {
  for (const [field, value] of [
    ["overall_score", null],
    ["trend_score", null],
    ["competition_score", null],
    ["competition_gate_passed", 0],
    ["profit_status", "insufficient_data"],
    ["risk_gate_passed", 0],
  ]) {
    const result = evaluateOpportunitySelection({ ...complete, [field]: value });
    assert.equal(result.selection_stage, "rule_candidate", field);
    assert.equal(result.quality_gates.all_passed, false, field);
  }
});

test("an item without verified primary identity is not yet a candidate", () => {
  assert.equal(
    evaluateOpportunitySelection({ ...complete, candidate_ready: 0 }).selection_stage,
    "not_eligible",
  );
});

test("API and worker share a scoped Amazon identity prerequisite instead of a monitoring threshold", () => {
  assert.equal(opportunityCandidateSql, selectionCandidateSql);
  assert.doesNotMatch(
    selectionCandidateSql,
    /trend_monitoring_rules|opportunity_rule_matches|recommendation_min_source_count/,
  );
  for (const fact of [
    "n_primary.organization_id=l_primary.organization_id",
    "n_primary.workspace_id=l_primary.workspace_id",
    "l_primary.opportunity_id=o.id",
    "n_primary.status='active'",
    "p_primary.code='amazon_product'",
    "$.canonical_url",
    "(dp|gp/product)",
  ])
    assert.ok(selectionCandidateSql.includes(fact), fact);
  assert.equal(
    evaluateOpportunitySelection({
      ...complete,
      candidate_ready: undefined,
      rule_candidate_ready: 1,
    }).selection_stage,
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
    "COUNT(DISTINCT UPPER(c_sample.external_id))",
    ">=5",
    "p_sample.status='enabled'",
  ])
    assert.ok(opportunityRecommendedSql.includes(fact), fact);
  assert.doesNotMatch(opportunityRecommendedSql, /WITH\s+|JSON_TABLE|QUALIFY/i);
});
