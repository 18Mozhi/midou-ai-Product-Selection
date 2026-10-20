import { selectionCompletionSourceNotRejectedSql } from "@scoutops/database";

/** Code-owned aliases only. Completion is historical proof, independent of recommendation gates. */
const validCompletion = (alias: string) =>
  `${alias}.resource_type='selection_pipeline' AND ` +
  `${alias}.event_type='opportunity.selection_pipeline_completed' AND ${alias}.actor_type='worker' AND ` +
  `JSON_UNQUOTE(JSON_EXTRACT(${alias}.payload_json,'$.contract')) IN ('selection-pipeline-v1','selection-pipeline-v2') AND ` +
  `JSON_UNQUOTE(JSON_EXTRACT(${alias}.payload_json,'$.main_asin')) REGEXP '^[A-Za-z0-9]{10}$' AND ` +
  selectionCompletionSourceNotRejectedSql(alias);

/** Historical completion belongs to this scoped opportunity and its current primary ASIN. */
export const opportunityAnalysisCompletedAtSql =
  "SELECT receipt.occurred_at FROM opportunity_events receipt WHERE receipt.organization_id=? " +
  "AND receipt.workspace_id=? AND receipt.resource_id=? AND " +
  validCompletion("receipt") +
  " AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(receipt.payload_json,'$.main_asin')))=BINARY UPPER(?) " +
  "ORDER BY receipt.occurred_at,receipt.id LIMIT 1";

/** Keep the original opportunity of the first completion per scoped ASIN, breaking timestamp ties by event id. */
export const opportunityCompletedFilterSql =
  "EXISTS (SELECT 1 FROM opportunity_events completed WHERE completed.organization_id=o.organization_id " +
  "AND completed.workspace_id=o.workspace_id AND completed.resource_id=o.id AND " +
  validCompletion("completed") +
  " AND NOT EXISTS (SELECT 1 FROM opportunity_events earlier WHERE earlier.organization_id=completed.organization_id " +
  "AND earlier.workspace_id=completed.workspace_id AND " +
  validCompletion("earlier") +
  " AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(earlier.payload_json,'$.main_asin')))=" +
  "BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(completed.payload_json,'$.main_asin'))) " +
  "AND (earlier.occurred_at<completed.occurred_at OR " +
  "(earlier.occurred_at=completed.occurred_at AND earlier.id<completed.id))))";
