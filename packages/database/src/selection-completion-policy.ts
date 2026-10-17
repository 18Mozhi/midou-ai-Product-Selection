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
  "AND n_detail.raw_evidence_id=l_detail.raw_evidence_id AND n_detail.status IN ('active','superseded') " +
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

/** Choose the latest actual detail, including legacy evidence superseded by discovery pages. */
export const latestCompetitorDetailSnapshotSql = (competitor: "c" | "c_sample") =>
  "(SELECT s.id FROM competitor_snapshots s " +
  `WHERE s.competitor_id=${competitor}.id AND s.organization_id=${competitor}.organization_id ` +
  `AND s.workspace_id=${competitor}.workspace_id AND ${competitorDetailEvidenceSql("s")} ` +
  "ORDER BY s.captured_at DESC,s.id DESC LIMIT 1)";

// The producer stores the full original titles. Keep relatedness separate from detail collection:
// an old/manual snapshot is still readable, but cannot prove an independent substitute.
const relevanceFieldsSql =
  "IF(JSON_TYPE(JSON_EXTRACT(n_relation.payload_json,'$.fields'))='OBJECT'," +
  "JSON_EXTRACT(n_relation.payload_json,'$.fields'),n_relation.payload_json)";
const relevanceTitleSql = `JSON_UNQUOTE(JSON_EXTRACT(${relevanceFieldsSql},'$.title'))`;
const relevanceAsinSql = `JSON_UNQUOTE(JSON_EXTRACT(${relevanceFieldsSql},'$.asin'))`;
const relevanceUrlSql =
  `COALESCE(JSON_UNQUOTE(JSON_EXTRACT(${relevanceFieldsSql},'$.canonical_url')),` +
  `JSON_UNQUOTE(JSON_EXTRACT(${relevanceFieldsSql},'$.source_url')))`;

export const selectionCompetitorRelevanceSql =
  "EXISTS (SELECT 1 FROM collection_subqueries q_relation " +
  "JOIN collection_task_evidence_links l_relation ON l_relation.collection_subquery_id=q_relation.id " +
  "AND l_relation.collection_task_id=q_relation.task_id AND l_relation.organization_id=q_relation.organization_id " +
  "AND l_relation.workspace_id=q_relation.workspace_id " +
  "JOIN normalized_records n_relation ON n_relation.id=l_relation.normalized_record_id " +
  "AND n_relation.raw_evidence_id=l_relation.raw_evidence_id AND n_relation.organization_id=l_relation.organization_id " +
  "AND n_relation.workspace_id=l_relation.workspace_id AND n_relation.provider_id=q_relation.provider_id " +
  "AND n_relation.status='active' " +
  "JOIN opportunity_events e_relation ON e_relation.organization_id=q_relation.organization_id " +
  "AND e_relation.workspace_id=q_relation.workspace_id " +
  "AND e_relation.resource_type='opportunity' AND e_relation.event_type='opportunity.competitors_classified' " +
  "WHERE e_relation.resource_id=o.id AND q_relation.organization_id=o.organization_id AND q_relation.workspace_id=o.workspace_id " +
  "AND q_relation.provider_id=c_sample.provider_id " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(q_relation.target_json,'$.projection_type'))='opportunity_competitors' " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(q_relation.target_json,'$.opportunity_id'))=BINARY o.id " +
  `AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(q_relation.target_json,'$.main_asin')))=BINARY ${selectionPrimaryAsinSql} ` +
  `AND (${relevanceAsinSql} IS NULL OR BINARY UPPER(${relevanceAsinSql})=BINARY UPPER(c_sample.external_id)) ` +
  `AND CONVERT(${relevanceUrlSql} USING utf8mb4) COLLATE utf8mb4_general_ci REGEXP ` +
  "CONVERT(CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',c_sample.external_id,'([/?#]|$)') USING utf8mb4) COLLATE utf8mb4_general_ci " +
  `AND LENGTH(TRIM(${relevanceTitleSql}))>0 ` +
  "AND JSON_UNQUOTE(JSON_EXTRACT(e_relation.payload_json,'$.version'))='competitor-title-v1' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(e_relation.payload_json,'$.model_fingerprint')) REGEXP '^[a-f0-9]{64}$' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(e_relation.payload_json,'$.input_fingerprint')) REGEXP '^[a-f0-9]{64}$' " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(e_relation.payload_json,'$.task_id'))=BINARY q_relation.task_id " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(e_relation.payload_json,'$.subquery_id'))=BINARY q_relation.id " +
  "AND JSON_CONTAINS(JSON_EXTRACT(e_relation.payload_json,'$.scope')," +
  "JSON_OBJECT('taskId',q_relation.task_id,'subqueryId',q_relation.id,'organizationId',o.organization_id," +
  "'workspaceId',o.workspace_id,'opportunityId',o.id,'mainAsin'," +
  "UPPER(JSON_UNQUOTE(JSON_EXTRACT(q_relation.target_json,'$.main_asin')))))=1 " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(e_relation.payload_json,'$.input.primary.asin'))=" +
  "BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(q_relation.target_json,'$.main_asin'))) " +
  "AND LENGTH(TRIM(JSON_UNQUOTE(JSON_EXTRACT(e_relation.payload_json,'$.input.primary.title'))))>0 " +
  "AND JSON_CONTAINS(JSON_EXTRACT(e_relation.payload_json,'$.input.candidates')," +
  `JSON_OBJECT('source_ref',n_relation.id,'asin',UPPER(c_sample.external_id),'title',${relevanceTitleSql}))=1 ` +
  "AND JSON_CONTAINS(JSON_EXTRACT(e_relation.payload_json,'$.classifications')," +
  "JSON_OBJECT('source_ref',n_relation.id,'relation','substitute'," +
  `'candidate_excerpt',${relevanceTitleSql},` +
  "'primary_excerpt',JSON_UNQUOTE(JSON_EXTRACT(e_relation.payload_json,'$.input.primary.title'))))=1 " +
  "AND e_relation.id=(SELECT latest_relation.id FROM opportunity_events latest_relation " +
  "WHERE latest_relation.organization_id=e_relation.organization_id AND latest_relation.workspace_id=e_relation.workspace_id " +
  "AND latest_relation.resource_id=e_relation.resource_id AND latest_relation.resource_type='opportunity' " +
  "AND latest_relation.event_type='opportunity.competitors_classified' " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(latest_relation.payload_json,'$.task_id'))=BINARY q_relation.task_id " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(latest_relation.payload_json,'$.subquery_id'))=BINARY q_relation.id " +
  "ORDER BY latest_relation.occurred_at DESC,latest_relation.id DESC LIMIT 1) " +
  "AND NOT EXISTS (SELECT 1 FROM opportunity_events newer_relation " +
  "WHERE newer_relation.organization_id=e_relation.organization_id " +
  "AND newer_relation.workspace_id=e_relation.workspace_id AND newer_relation.resource_id=e_relation.resource_id " +
  "AND newer_relation.resource_type='opportunity' AND newer_relation.event_type='opportunity.competitors_classified' " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(newer_relation.payload_json,'$.input.primary.asin'))=" +
  "BINARY JSON_UNQUOTE(JSON_EXTRACT(e_relation.payload_json,'$.input.primary.asin')) " +
  "AND JSON_CONTAINS(JSON_EXTRACT(newer_relation.payload_json,'$.input.candidates')," +
  "JSON_OBJECT('asin',UPPER(c_sample.external_id)))=1 " +
  "AND (newer_relation.occurred_at>e_relation.occurred_at OR " +
  "(newer_relation.occurred_at=e_relation.occurred_at AND newer_relation.id>e_relation.id))))";

export const detailedSelectionCompetitorsFromSql =
  "FROM competitors c_sample " +
  "JOIN providers p_sample ON p_sample.id=c_sample.provider_id AND p_sample.code='amazon_product' AND p_sample.status='enabled' " +
  `JOIN competitor_snapshots s_sample ON s_sample.id=${latestCompetitorDetailSnapshotSql("c_sample")} ` +
  "AND s_sample.organization_id=c_sample.organization_id AND s_sample.workspace_id=c_sample.workspace_id " +
  "WHERE c_sample.opportunity_id=o.id AND c_sample.organization_id=o.organization_id " +
  "AND c_sample.workspace_id=o.workspace_id AND c_sample.source_site='Amazon' AND c_sample.status='active' " +
  "AND c_sample.external_id REGEXP '^[A-Za-z0-9]{10}$' " +
  "AND c_sample.deleted_at IS NULL AND s_sample.freshness='fresh' AND s_sample.source_status='healthy' " +
  "AND s_sample.current_price IS NOT NULL AND s_sample.currency IS NOT NULL " +
  "AND s_sample.review_count IS NOT NULL AND s_sample.rating_value IS NOT NULL " +
  `AND ${competitorDetailEvidenceSql("s_sample")} AND ${selectionCompetitorRelevanceSql} ` +
  `AND BINARY UPPER(c_sample.external_id)<>BINARY COALESCE(${opportunityPrimaryAsinSql},'')`;

export function selectionCompetitionGateSql(
  minimumCompetitors: number,
  identity: "linked" | "materialized" = "linked",
) {
  if (!Number.isInteger(minimumCompetitors) || minimumCompetitors < 1 || minimumCompetitors > 10)
    throw new Error("selection_competitor_minimum_invalid");
  const predicate = `(${opportunityPrimaryAsinSql} IS NOT NULL AND (SELECT COUNT(DISTINCT UPPER(c_sample.external_id)) ${detailedSelectionCompetitorsFromSql})>=${minimumCompetitors})`;
  // Only the scheduler's materialized opportunity query owns this verified cache.
  // Replacement is of our fixed SQL fragment, never a caller-provided expression.
  return identity === "materialized"
    ? predicate.replaceAll(selectionPrimaryAsinSql, "o.primary_asin")
    : predicate;
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
  "sr.coverage_percent score_coverage_percent,sr.missing_fields_json score_missing_fields_json," +
  "CASE WHEN cost_score.input_score IS NULL THEN 'unknown' ELSE 'calculated' END profit_state," +
  "cost_score.missing_fields_json profit_missing_fields_json," +
  "news.id intelligence_record_id,news.raw_evidence_id intelligence_evidence_id," +
  "ci.id purchase_input_id,ci.amount_value purchase_price,ci.currency purchase_currency," +
  "supply.id supply_record_id,supply.raw_evidence_id supply_evidence_id," +
  "JSON_UNQUOTE(JSON_EXTRACT(supply.payload_json,'$.external_id')) supply_offer_id " +
  "FROM opportunities o JOIN opportunity_score_runs sr ON sr.opportunity_id=o.id " +
  "AND sr.organization_id=o.organization_id AND sr.workspace_id=o.workspace_id " +
  "JOIN opportunity_score_components cost_score ON cost_score.score_run_id=sr.id AND cost_score.dimension_code='profit' " +
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
  "AND ((cost_score.input_score IS NOT NULL AND o.coverage_status='complete' AND o.profit_status='calculated' " +
  "AND JSON_CONTAINS(cost_score.evidence_ids_json,JSON_QUOTE(ci.evidence_id))) OR " +
  "(cost_score.input_score IS NULL AND JSON_LENGTH(cost_score.missing_fields_json)>0 " +
  "AND o.profit_status='insufficient_data' AND sr.recommendation_status IN ('insufficient_data','observe','not_recommend') " +
  "AND o.recommendation_status<>'recommend' " +
  "AND o.coverage_status='partial' AND sr.coverage_percent>=80 " +
  "AND (SELECT COUNT(DISTINCT analysis_component.dimension_code) FROM opportunity_score_components analysis_component " +
  "WHERE analysis_component.score_run_id=sr.id AND analysis_component.dimension_code IN ('market_demand','competition','risk','data_quality') " +
  "AND analysis_component.input_score BETWEEN 0 AND 100 AND JSON_LENGTH(analysis_component.evidence_ids_json)>0)=4 " +
  "AND NOT EXISTS (SELECT 1 FROM opportunity_score_components incomplete_component WHERE incomplete_component.score_run_id=sr.id " +
  "AND incomplete_component.dimension_code<>'profit' AND (incomplete_component.input_score IS NULL " +
  "OR JSON_LENGTH(incomplete_component.missing_fields_json)>0)))) " +
  "AND o.trend_score IS NOT NULL AND o.competition_score IS NOT NULL AND " +
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
