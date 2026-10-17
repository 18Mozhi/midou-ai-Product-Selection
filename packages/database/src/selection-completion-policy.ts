import { selectionPrimaryAsinSql } from "./selection-candidate-sql.js";

export const selectionRiskGateSql =
  "EXISTS (SELECT 1 FROM opportunity_score_runs sr_gate " +
  "JOIN opportunity_score_components sc_gate ON sc_gate.score_run_id=sr_gate.id " +
  "WHERE sr_gate.id=(SELECT sr_latest.id FROM opportunity_score_runs sr_latest WHERE " +
  "sr_latest.opportunity_id=o.id AND sr_latest.organization_id=o.organization_id AND " +
  "sr_latest.workspace_id=o.workspace_id ORDER BY sr_latest.scored_at DESC,sr_latest.id DESC LIMIT 1) " +
  "AND sc_gate.dimension_code='risk' AND sc_gate.input_score IS NOT NULL)";

const opportunityPrimaryAsinSql = selectionPrimaryAsinSql;

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

export const detailedSelectionCompetitorsFromSql =
  "FROM competitors c_sample " +
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
  `AND BINARY UPPER(c_sample.external_id)<>BINARY COALESCE(${opportunityPrimaryAsinSql},'')`;

export function selectionCompetitionGateSql(minimumCompetitors: number) {
  if (!Number.isInteger(minimumCompetitors) || minimumCompetitors < 1 || minimumCompetitors > 10)
    throw new Error("selection_competitor_minimum_invalid");
  return `(${opportunityPrimaryAsinSql} IS NOT NULL AND (SELECT COUNT(DISTINCT UPPER(c_sample.external_id)) ${detailedSelectionCompetitorsFromSql})>=${minimumCompetitors})`;
}

/** Scope is bound separately. The rows use the same actual detail proof as recommendation gates. */
export const selectionCompletedCompetitorsSql =
  "SELECT UPPER(c_sample.external_id) asin,c_sample.id competitor_id," +
  "s_sample.id snapshot_id,s_sample.evidence_id FROM opportunities o," +
  detailedSelectionCompetitorsFromSql.slice("FROM ".length) +
  " AND o.id=? AND o.organization_id=? AND o.workspace_id=? " +
  "ORDER BY s_sample.captured_at DESC,c_sample.id LIMIT 100";

/** Completion deliberately has no recommendation, minimum-score or low-risk requirement. */
export const selectionPipelineCompletionProofSql =
  "SELECT o.id opportunity_id," +
  selectionPrimaryAsinSql +
  " main_asin," +
  "sr.id score_run_id,sr.overall_score,sr.recommendation_status," +
  "news.id intelligence_record_id,news.raw_evidence_id intelligence_evidence_id," +
  "ci.id purchase_input_id,ci.amount_value purchase_price,ci.currency purchase_currency," +
  "supply.id supply_record_id,supply.raw_evidence_id supply_evidence_id," +
  "JSON_UNQUOTE(JSON_EXTRACT(supply.payload_json,'$.external_id')) supply_offer_id " +
  "FROM opportunities o JOIN opportunity_score_runs sr ON sr.opportunity_id=o.id " +
  "AND sr.organization_id=o.organization_id AND sr.workspace_id=o.workspace_id " +
  "JOIN opportunity_cost_inputs ci ON ci.opportunity_id=o.id AND ci.organization_id=o.organization_id " +
  "AND ci.workspace_id=o.workspace_id AND ci.input_type='purchase_price' AND ci.is_current=1 " +
  "AND ci.amount_value>0 AND ci.currency='CNY' " +
  "JOIN normalized_records supply ON supply.raw_evidence_id=ci.evidence_id " +
  "AND supply.organization_id=o.organization_id AND supply.workspace_id=o.workspace_id AND supply.status='active' " +
  "JOIN providers supplier ON supplier.id=supply.provider_id AND supplier.code='1688_search' " +
  "JOIN collection_task_evidence_links sl ON sl.normalized_record_id=supply.id AND sl.raw_evidence_id=supply.raw_evidence_id " +
  "AND sl.organization_id=o.organization_id AND sl.workspace_id=o.workspace_id " +
  "JOIN sourcing_searches ss ON ss.collection_task_id=sl.collection_task_id AND ss.organization_id=o.organization_id " +
  "AND ss.workspace_id=o.workspace_id AND ss.input_type='opportunity' AND ss.input_ref=o.id AND ss.deleted_at IS NULL " +
  "JOIN trend_events ie ON ie.organization_id=o.organization_id AND ie.workspace_id=o.workspace_id " +
  "AND ie.event_type='trend.intelligence.primary_selected' " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(ie.payload_json,'$.opportunity_id'))=BINARY o.id " +
  "JOIN normalized_records news ON news.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(ie.payload_json,'$.intelligence_source_record_id')) USING ascii) " +
  "AND news.organization_id=o.organization_id AND news.workspace_id=o.workspace_id AND news.status='active' " +
  "JOIN opportunity_evidence_links nl ON nl.opportunity_id=o.id AND nl.organization_id=o.organization_id " +
  "AND nl.workspace_id=o.workspace_id AND nl.raw_evidence_id=news.raw_evidence_id " +
  "WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? AND o.lifecycle_status NOT IN ('archived','deleted') " +
  "AND sr.id=(SELECT latest.id FROM opportunity_score_runs latest WHERE latest.opportunity_id=o.id " +
  "AND latest.organization_id=o.organization_id AND latest.workspace_id=o.workspace_id " +
  "ORDER BY latest.scored_at DESC,latest.id DESC LIMIT 1) " +
  "AND sr.status='calculated' AND sr.overall_score IS NOT NULL AND o.score_rule_version IS NOT NULL " +
  "AND sr.overall_score=o.overall_score AND sr.rule_version_code=o.score_rule_version AND sr.scored_at=o.scored_at " +
  "AND EXISTS (SELECT 1 FROM opportunity_score_components cost_score WHERE cost_score.score_run_id=sr.id " +
  "AND cost_score.dimension_code='profit' AND cost_score.input_score IS NOT NULL " +
  "AND JSON_CONTAINS(cost_score.evidence_ids_json,JSON_QUOTE(ci.evidence_id))) " +
  "AND o.coverage_status='complete' AND o.trend_score IS NOT NULL AND o.competition_score IS NOT NULL " +
  "AND o.profit_status='calculated' AND " +
  selectionRiskGateSql +
  " AND JSON_UNQUOTE(JSON_EXTRACT(supply.payload_json,'$.external_id')) REGEXP '^[0-9]{1,40}$' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(supply.payload_json,'$.canonical_url'))=" +
  "CONCAT('https://detail.1688.com/offer/',JSON_UNQUOTE(JSON_EXTRACT(supply.payload_json,'$.external_id')),'.html') " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(supply.payload_json,'$.currency'))='CNY' " +
  "AND LENGTH(TRIM(JSON_UNQUOTE(JSON_EXTRACT(supply.payload_json,'$.title'))))>0 " +
  "AND LENGTH(TRIM(JSON_UNQUOTE(JSON_EXTRACT(supply.payload_json,'$.supplier_name'))))>0 " +
  "AND CAST(JSON_UNQUOTE(JSON_EXTRACT(supply.payload_json,'$.price')) AS DECIMAL(18,6))=ci.amount_value " +
  "AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(supply.payload_json,'$.price_description')),'') NOT LIKE '%新人价%' " +
  "ORDER BY ci.created_at DESC,news.created_at DESC,supply.created_at DESC LIMIT 1";
