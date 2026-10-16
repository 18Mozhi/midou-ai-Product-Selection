import type { RowDataPacket } from "mysql2/promise";
import { MINIMUM_SELECTION_COMPETITORS } from "@scoutops/contracts";

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

export const opportunityPrimaryAsinSql =
  "(SELECT JSON_UNQUOTE(JSON_EXTRACT(n_primary.payload_json,'$.asin')) " +
  "FROM opportunity_evidence_links l_primary JOIN normalized_records n_primary " +
  "ON n_primary.raw_evidence_id=l_primary.raw_evidence_id AND n_primary.organization_id=l_primary.organization_id " +
  "AND n_primary.workspace_id=l_primary.workspace_id AND n_primary.status='active' " +
  "JOIN providers p_primary ON p_primary.id=n_primary.provider_id AND p_primary.code='amazon_product' " +
  "WHERE l_primary.opportunity_id=o.id AND l_primary.organization_id=o.organization_id " +
  "AND l_primary.workspace_id=o.workspace_id AND JSON_UNQUOTE(JSON_EXTRACT(n_primary.payload_json,'$.asin')) REGEXP '^[A-Z0-9]{10}$' " +
  "ORDER BY l_primary.created_at,n_primary.created_at DESC LIMIT 1)";

export const competitorDetailEvidenceSql = (snapshot: "s" | "s_sample") =>
  "EXISTS (SELECT 1 FROM collection_subqueries q_detail JOIN collection_task_evidence_links l_detail " +
  "ON l_detail.collection_task_id=q_detail.task_id AND l_detail.organization_id=q_detail.organization_id " +
  "AND l_detail.workspace_id=q_detail.workspace_id " +
  "JOIN normalized_records n_detail ON n_detail.id=l_detail.normalized_record_id " +
  "AND n_detail.organization_id=l_detail.organization_id AND n_detail.workspace_id=l_detail.workspace_id " +
  "JOIN competitors c_detail ON c_detail.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(q_detail.target_json,'$.competitor_id')) USING ascii) " +
  "AND c_detail.organization_id=q_detail.organization_id AND c_detail.workspace_id=q_detail.workspace_id " +
  `WHERE LEFT(${snapshot}.source_ref_id,11)='collection:' AND q_detail.task_id=CONVERT(SUBSTRING(${snapshot}.source_ref_id,12,36) USING ascii) ` +
  `AND q_detail.organization_id=${snapshot}.organization_id AND q_detail.workspace_id=${snapshot}.workspace_id ` +
  `AND l_detail.raw_evidence_id=${snapshot}.evidence_id AND l_detail.normalized_record_id=CONVERT(RIGHT(${snapshot}.source_ref_id,36) USING ascii) ` +
  `AND BINARY JSON_UNQUOTE(JSON_EXTRACT(q_detail.target_json,'$.competitor_id'))=BINARY ${snapshot}.competitor_id ` +
  "AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n_detail.payload_json,'$.asin')))=BINARY UPPER(c_detail.external_id) " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(q_detail.target_json,'$.projection_type'))='competitor_snapshot' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(q_detail.target_json,'$.page_url')) REGEXP '^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/[A-Za-z0-9]{10}([/?#]|$)')";

export const opportunityCompetitionGateSql =
  `(${opportunityPrimaryAsinSql} IS NOT NULL AND (SELECT COUNT(DISTINCT UPPER(c_sample.external_id)) FROM competitors c_sample ` +
  "JOIN providers p_sample ON p_sample.id=c_sample.provider_id AND p_sample.code='amazon_product' AND p_sample.status='enabled' " +
  "JOIN competitor_snapshots s_sample ON s_sample.id=c_sample.latest_snapshot_id " +
  "AND s_sample.organization_id=c_sample.organization_id AND s_sample.workspace_id=c_sample.workspace_id " +
  "WHERE c_sample.opportunity_id=o.id AND c_sample.organization_id=o.organization_id " +
  "AND c_sample.workspace_id=o.workspace_id AND c_sample.source_site='Amazon' AND c_sample.status='active' " +
  "AND c_sample.external_id REGEXP '^[A-Za-z0-9]{10}$' " +
  "AND c_sample.deleted_at IS NULL AND s_sample.freshness='fresh' AND s_sample.source_status='healthy' " +
  "AND s_sample.current_price IS NOT NULL AND s_sample.currency IS NOT NULL " +
  "AND s_sample.review_count IS NOT NULL AND s_sample.rating_value IS NOT NULL " +
  `AND ${competitorDetailEvidenceSql("s_sample")} ` +
  `AND BINARY UPPER(c_sample.external_id)<>BINARY COALESCE(${opportunityPrimaryAsinSql},''))>=${MINIMUM_SELECTION_COMPETITORS})`;

export const opportunityQualityGateSql =
  `(o.recommendation_status='recommend' AND o.overall_score IS NOT NULL AND ` +
  `o.score_rule_version IS NOT NULL AND o.coverage_status='complete' AND ` +
  `o.trend_score IS NOT NULL AND o.competition_score IS NOT NULL AND ` +
  `o.profit_status='calculated' AND ${opportunityRiskGateSql} AND ${opportunityCompetitionGateSql})`;

export const opportunityRecommendedSql = `(${opportunityRuleCandidateSql} AND ${opportunityQualityGateSql})`;

export const opportunitySelectionProjectionSql = `${opportunityRuleCandidateSql} rule_candidate_ready,${opportunityRiskGateSql} risk_gate_passed,${opportunityCompetitionGateSql} competition_gate_passed,${opportunityPrimaryAsinSql} main_asin`;

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
