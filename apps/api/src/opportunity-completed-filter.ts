import { opportunityEventReadRelation } from "@scoutops/database";
import { selectionCompletionSourceNotRejectedSql } from "@scoutops/database";
import { rehearsalOwns } from "./account-read-rehearsal.js";

/** Code-owned aliases only. Completion is historical proof, independent of recommendation gates. */
const validCompletion = (alias: string, account?: string) =>
  `${alias}.resource_type='selection_pipeline' AND ` +
  `${alias}.event_type='opportunity.selection_pipeline_completed' AND ${alias}.actor_type='worker' AND ` +
  `JSON_UNQUOTE(JSON_EXTRACT(${alias}.payload_json,'$.contract')) IN ('selection-pipeline-v1','selection-pipeline-v2') AND ` +
  `JSON_UNQUOTE(JSON_EXTRACT(${alias}.payload_json,'$.main_asin')) REGEXP '^[A-Za-z0-9]{10}$' AND ` +
  selectionCompletionSourceNotRejectedSql(alias, account);

/** Historical completion belongs to this scoped opportunity and its current primary ASIN. */
export const opportunityAnalysisCompletedAtSql =
  "SELECT receipt.occurred_at FROM " +
  opportunityEventReadRelation +
  " receipt WHERE receipt.organization_id=? " +
  "AND receipt.workspace_id=? AND receipt.resource_id=? AND " +
  validCompletion("receipt") +
  " AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(receipt.payload_json,'$.main_asin')))=BINARY UPPER(?) " +
  "ORDER BY receipt.occurred_at,receipt.id LIMIT 1";

/** Keep the original opportunity of the first completion per scoped ASIN, breaking timestamp ties by event id. */
export const opportunityCompletedFilterSql =
  "EXISTS (SELECT 1 FROM " +
  opportunityEventReadRelation +
  " completed WHERE completed.organization_id=o.organization_id " +
  "AND completed.workspace_id=o.workspace_id AND completed.resource_id=o.id AND " +
  validCompletion("completed") +
  " AND NOT EXISTS (SELECT 1 FROM " +
  opportunityEventReadRelation +
  " earlier WHERE earlier.organization_id=completed.organization_id " +
  "AND earlier.workspace_id=completed.workspace_id AND " +
  validCompletion("earlier") +
  " AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(earlier.payload_json,'$.main_asin')))=" +
  "BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(completed.payload_json,'$.main_asin'))) " +
  "AND (earlier.occurred_at<completed.occurred_at OR " +
  "(earlier.occurred_at=completed.occurred_at AND earlier.id<completed.id))))";

const ownedReceipt = (alias: string, account: string) =>
  rehearsalOwns("opportunity_events", `${alias}.id`, account) +
  " AND " +
  rehearsalOwns("opportunities", `${alias}.resource_id`, account);

/** Preserve the first valid receipt per ASIN within the account, across legacy scopes. */
export const accountOpportunityCompletedFilterSql =
  "EXISTS (SELECT 1 FROM " +
  opportunityEventReadRelation +
  " completed WHERE completed.resource_id=o.id AND " +
  ownedReceipt("completed", "oo.account_id") +
  " AND " +
  validCompletion("completed", "oo.account_id") +
  " AND NOT EXISTS (SELECT 1 FROM " +
  opportunityEventReadRelation +
  " earlier WHERE " +
  ownedReceipt("earlier", "oo.account_id") +
  " AND " +
  validCompletion("earlier", "oo.account_id") +
  " AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(earlier.payload_json,'$.main_asin')))=" +
  "BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(completed.payload_json,'$.main_asin'))) " +
  "AND (earlier.occurred_at<completed.occurred_at OR " +
  "(earlier.occurred_at=completed.occurred_at AND earlier.id<completed.id))))";

export const accountOpportunityAnalysisCompletedAtSql =
  "SELECT receipt.occurred_at FROM account_owned_records receipt_owner JOIN " +
  opportunityEventReadRelation +
  " receipt ON receipt.id=receipt_owner.source_id " +
  "WHERE receipt_owner.source_table='opportunity_events' AND receipt_owner.account_id=? AND receipt.resource_id=? AND " +
  rehearsalOwns("opportunities", "receipt.resource_id", "receipt_owner.account_id") +
  " AND " +
  validCompletion("receipt", "receipt_owner.account_id") +
  " AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(receipt.payload_json,'$.main_asin')))=BINARY UPPER(?) " +
  "ORDER BY receipt.occurred_at,receipt.id LIMIT 1";
