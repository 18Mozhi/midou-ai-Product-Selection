import type { RowDataPacket } from "mysql2/promise";
import { MINIMUM_SELECTION_COMPETITORS } from "@scoutops/contracts";
import {
  selectionCandidateSql,
  selectionPrimaryAsinSql,
  selectionRiskGateSql,
  selectionCompetitionGateSql,
  competitorDetailEvidenceSql as sharedCompetitorDetailEvidenceSql,
} from "@scoutops/database";

export type OpportunitySelectionStage = "rule_candidate" | "recommended" | "not_eligible";

export interface OpportunityQualityGates {
  score: boolean;
  market: boolean;
  competition: boolean;
  cost: boolean;
  risk: boolean;
  all_passed: boolean;
}

export const opportunityCandidateSql = selectionCandidateSql;

export const opportunityRiskGateSql = selectionRiskGateSql;
export const opportunityPrimaryAsinSql = selectionPrimaryAsinSql;
export const competitorDetailEvidenceSql = sharedCompetitorDetailEvidenceSql;
export const opportunityCompetitionGateSql = selectionCompetitionGateSql(
  MINIMUM_SELECTION_COMPETITORS,
);

export const opportunityQualityGateSql =
  `(o.recommendation_status='recommend' AND o.overall_score IS NOT NULL AND ` +
  `o.score_rule_version IS NOT NULL AND o.coverage_status='complete' AND ` +
  `o.trend_score IS NOT NULL AND o.competition_score IS NOT NULL AND ` +
  `o.profit_status='calculated' AND ${opportunityRiskGateSql} AND ${opportunityCompetitionGateSql})`;

export const opportunityRecommendedSql = `(${opportunityCandidateSql} AND ${opportunityQualityGateSql})`;

export const opportunitySelectionProjectionSql = `${opportunityCandidateSql} candidate_ready,${opportunityRiskGateSql} risk_gate_passed,${opportunityCompetitionGateSql} competition_gate_passed,${opportunityPrimaryAsinSql} main_asin`;

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
      competition: row.competition_score != null && sqlBoolean(row.competition_gate_passed),
      cost: row.profit_status === "calculated",
      risk: sqlBoolean(row.risk_gate_passed),
    },
    allPassed = Object.values(qualityGates).every(Boolean),
    candidate = sqlBoolean(row.candidate_ready),
    pending = row.decision_status === "pending";
  return {
    selection_stage:
      pending && candidate && allPassed
        ? "recommended"
        : pending && candidate
          ? "rule_candidate"
          : "not_eligible",
    quality_gates: { ...qualityGates, all_passed: allPassed },
  };
}
