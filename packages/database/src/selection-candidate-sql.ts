/** Shared scoped primary identity; monitoring subscriptions are not selection prerequisites. */
export const selectionPrimaryAsinSql =
  "(SELECT UPPER(JSON_UNQUOTE(JSON_EXTRACT(n_primary.payload_json,'$.asin'))) " +
  "FROM opportunity_evidence_links l_primary JOIN normalized_records n_primary " +
  "ON n_primary.raw_evidence_id=l_primary.raw_evidence_id AND n_primary.organization_id=l_primary.organization_id " +
  "AND n_primary.workspace_id=l_primary.workspace_id AND n_primary.status IN ('active','superseded') " +
  "JOIN normalized_records n_primary_current ON n_primary_current.organization_id=n_primary.organization_id " +
  "AND n_primary_current.workspace_id=n_primary.workspace_id AND n_primary_current.provider_id=n_primary.provider_id " +
  "AND n_primary_current.record_key=n_primary.record_key AND n_primary_current.status='active' " +
  "AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n_primary_current.payload_json,'$.asin')))=BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n_primary.payload_json,'$.asin'))) " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(n_primary_current.payload_json,'$.canonical_url')) REGEXP " +
  "CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',JSON_UNQUOTE(JSON_EXTRACT(n_primary_current.payload_json,'$.asin')),'([/?#]|$)') " +
  "JOIN providers p_primary ON p_primary.id=n_primary.provider_id AND p_primary.code='amazon_product' " +
  "WHERE l_primary.opportunity_id=o.id AND l_primary.organization_id=o.organization_id " +
  "AND l_primary.workspace_id=o.workspace_id AND JSON_UNQUOTE(JSON_EXTRACT(n_primary.payload_json,'$.asin')) REGEXP '^[A-Za-z0-9]{10}$' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(n_primary.payload_json,'$.canonical_url')) REGEXP " +
  "CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',JSON_UNQUOTE(JSON_EXTRACT(n_primary.payload_json,'$.asin')),'([/?#]|$)') " +
  "ORDER BY l_primary.created_at,n_primary.created_at DESC LIMIT 1)";

export const selectionCandidateSql = `(${selectionPrimaryAsinSql} IS NOT NULL)`;
