/** Code-owned aliases only. A definite later rejection invalidates that historical receipt,
 * while missing provenance or unrelated scope/ASIN/news never rewrites history.
 * A subsequent genuinely verified completion can establish a new first valid receipt.
 */
export const selectionCompletionSourceNotRejectedSql = (alias: string) =>
  "NOT EXISTS (SELECT 1 FROM opportunity_events rejected_source WHERE " +
  `rejected_source.organization_id=${alias}.organization_id AND ` +
  `rejected_source.workspace_id=${alias}.workspace_id AND ` +
  `rejected_source.resource_id=${alias}.resource_id AND ` +
  "rejected_source.resource_type='opportunity' AND rejected_source.actor_type='worker' " +
  "AND rejected_source.event_type='opportunity.primary_source_support_checked' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(rejected_source.payload_json,'$.revision'))='persisted-primary-source-support-v1' " +
  "AND JSON_TYPE(JSON_EXTRACT(rejected_source.payload_json,'$.supported'))='BOOLEAN' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(rejected_source.payload_json,'$.supported'))='false' " +
  "AND JSON_TYPE(JSON_EXTRACT(rejected_source.payload_json,'$.rationale'))='STRING' " +
  "AND LENGTH(TRIM(JSON_UNQUOTE(JSON_EXTRACT(rejected_source.payload_json,'$.rationale'))))>0 " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(rejected_source.payload_json,'$.rationale'))<>'original_intelligence_or_primary_missing' " +
  "AND JSON_TYPE(JSON_EXTRACT(rejected_source.payload_json,'$.origin_event_id'))='STRING' " +
  "AND LENGTH(JSON_UNQUOTE(JSON_EXTRACT(rejected_source.payload_json,'$.origin_event_id')))>0 " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(rejected_source.payload_json,'$.fingerprint')) REGEXP '^[a-f0-9]{64}$' " +
  `AND rejected_source.occurred_at>=${alias}.occurred_at ` +
  "AND EXISTS (SELECT 1 FROM trend_events rejected_origin WHERE " +
  "rejected_origin.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(rejected_source.payload_json,'$.origin_event_id')) USING ascii) " +
  "AND BINARY rejected_origin.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(rejected_source.payload_json,'$.origin_event_id')) " +
  `AND rejected_origin.organization_id=${alias}.organization_id AND rejected_origin.workspace_id=${alias}.workspace_id ` +
  "AND rejected_origin.event_type='trend.intelligence.primary_selected' " +
  `AND rejected_origin.occurred_at<=${alias}.occurred_at ` +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(rejected_origin.payload_json,'$.opportunity_id'))=" +
  `BINARY ${alias}.resource_id AND BINARY JSON_UNQUOTE(JSON_EXTRACT(rejected_origin.payload_json,'$.intelligence_source_record_id'))=` +
  `BINARY JSON_UNQUOTE(JSON_EXTRACT(${alias}.payload_json,'$.intelligence_record_id'))) ` +
  "AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(rejected_source.payload_json,'$.primary_asin')))=" +
  `BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(${alias}.payload_json,'$.main_asin'))) ` +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(rejected_source.payload_json,'$.intelligence_record_id'))=" +
  `BINARY JSON_UNQUOTE(JSON_EXTRACT(${alias}.payload_json,'$.intelligence_record_id')))`;
