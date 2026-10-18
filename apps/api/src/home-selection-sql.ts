import { MINIMUM_SELECTION_COMPETITORS } from "@scoutops/contracts";
import { selectionCandidateExistsSql } from "@scoutops/database";
import { opportunityQualityGateSql } from "./opportunity-selection-policy.js";

export const homeCandidateSql = `(${selectionCandidateExistsSql})`;

// A superset of the full detail proof: historical snapshots and unverified relations
// may increase this count, but cannot exclude a competitor accepted by the real gate.
export const homeCompetitorUpperBoundSql =
  "(SELECT COUNT(DISTINCT UPPER(c_bound.external_id)) FROM competitors c_bound " +
  "JOIN competitor_snapshots s_bound ON s_bound.competitor_id=c_bound.id " +
  "AND s_bound.organization_id=c_bound.organization_id AND s_bound.workspace_id=c_bound.workspace_id " +
  "WHERE c_bound.opportunity_id=o.id AND c_bound.organization_id=o.organization_id " +
  "AND c_bound.workspace_id=o.workspace_id AND c_bound.source_site='Amazon' " +
  "AND c_bound.status='active' AND c_bound.deleted_at IS NULL " +
  "AND s_bound.current_price IS NOT NULL AND s_bound.currency IS NOT NULL " +
  "AND s_bound.review_count IS NOT NULL AND s_bound.rating_value IS NOT NULL " +
  "AND s_bound.freshness='fresh' AND s_bound.source_status='healthy')";

// CASE forces the cheap necessary condition before the expensive original proof.
// Meeting the bound alone never grants a recommendation.
export const homeQualityGateSql =
  `(CASE WHEN ${homeCompetitorUpperBoundSql}>=${MINIMUM_SELECTION_COMPETITORS} ` +
  `THEN ${opportunityQualityGateSql} ELSE 0 END)`;
export const homeRecommendedSql = `(${homeCandidateSql} AND ${homeQualityGateSql})`;
