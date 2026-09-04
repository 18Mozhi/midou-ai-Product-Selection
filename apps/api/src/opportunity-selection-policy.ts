import type { RowDataPacket } from "mysql2/promise";

export type OpportunitySelectionStage = "rule_candidate" | "recommended" | "not_eligible";

export interface OpportunityQualityGates {
  score: boolean;
  market: boolean;
  competition: boolean;
  cost: boolean;
  risk: boolean;
  all_passed: boolean;
}

export const opportunityRuleCandidateSql =
  "EXISTS (SELECT 1 FROM opportunity_rule_matches orm_gate JOIN trend_monitoring_rules r_gate " +
  "ON r_gate.id=orm_gate.monitoring_rule_id AND r_gate.organization_id=orm_gate.organization_id " +
  "AND r_gate.workspace_id=orm_gate.workspace_id WHERE orm_gate.opportunity_id=o.id AND " +
  "orm_gate.organization_id=o.organization_id AND orm_gate.workspace_id=o.workspace_id AND " +
  "r_gate.status='enabled' AND o.source_count>=r_gate.recommendation_min_source_count)";

export const opportunityRiskGateSql =
  "EXISTS (SELECT 1 FROM opportunity_score_runs sr_gate " +
  "JOIN opportunity_score_components sc_gate ON sc_gate.score_run_id=sr_gate.id " +
  "WHERE sr_gate.id=(SELECT sr_latest.id FROM opportunity_score_runs sr_latest WHERE " +
  "sr_latest.opportunity_id=o.id AND sr_latest.organization_id=o.organization_id AND " +
  "sr_latest.workspace_id=o.workspace_id ORDER BY sr_latest.scored_at DESC,sr_latest.id DESC LIMIT 1) " +
  "AND sc_gate.dimension_code='risk' AND sc_gate.input_score IS NOT NULL)";

export const opportunityQualityGateSql =
  `(o.recommendation_status='recommend' AND o.overall_score IS NOT NULL AND ` +
  `o.score_rule_version IS NOT NULL AND o.coverage_status='complete' AND ` +
  `o.trend_score IS NOT NULL AND o.competition_score IS NOT NULL AND ` +
  `o.profit_status='calculated' AND ${opportunityRiskGateSql})`;

export const opportunityRecommendedSql = `(${opportunityRuleCandidateSql} AND ${opportunityQualityGateSql})`;

export const opportunitySelectionProjectionSql = `${opportunityRuleCandidateSql} rule_candidate_ready,${opportunityRiskGateSql} risk_gate_passed`;

const sqlBoolean = (value: unknown) => value === true || Number(value ?? 0) === 1;

export function evaluateOpportunitySelection(row: RowDataPacket | Record<string, unknown>): {
  selection_stage: OpportunitySelectionStage;
  quality_gates: OpportunityQualityGates;
} {
  const qualityGates = {
      score:
        row.recommendation_status === "recommend" &&
        row.overall_score != null &&
        row.score_rule_version != null &&
        row.coverage_status === "complete",
      market: row.trend_score != null,
      competition: row.competition_score != null,
      cost: row.profit_status === "calculated",
      risk: sqlBoolean(row.risk_gate_passed),
    },
    allPassed = Object.values(qualityGates).every(Boolean),
    ruleCandidate = sqlBoolean(row.rule_candidate_ready),
    pending = row.decision_status === "pending";
  return {
    selection_stage:
      pending && ruleCandidate && allPassed
        ? "recommended"
        : pending && ruleCandidate
          ? "rule_candidate"
          : "not_eligible",
    quality_gates: { ...qualityGates, all_passed: allPassed },
  };
}
