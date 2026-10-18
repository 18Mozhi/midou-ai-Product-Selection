/** The same scoped facts back scalar identity, presence and grouped historical reads. */
const primarySeedProofSql =
  "n_primary.raw_evidence_id=l_primary.raw_evidence_id AND n_primary.organization_id=l_primary.organization_id " +
  "AND n_primary.workspace_id=l_primary.workspace_id AND n_primary.status IN ('active','superseded') ";
const primaryCurrentProofSql =
  "n_primary_current.organization_id=n_primary.organization_id " +
  "AND n_primary_current.workspace_id=n_primary.workspace_id AND n_primary_current.provider_id=n_primary.provider_id " +
  "AND n_primary_current.record_key=n_primary.record_key AND n_primary_current.status='active' " +
  "AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n_primary_current.payload_json,'$.asin')))=BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n_primary.payload_json,'$.asin'))) " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(n_primary_current.payload_json,'$.canonical_url')) REGEXP " +
  "CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',JSON_UNQUOTE(JSON_EXTRACT(n_primary_current.payload_json,'$.asin')),'([/?#]|$)') ";
const primaryLinkProofSql =
  "l_primary.opportunity_id=o.id AND l_primary.organization_id=o.organization_id " +
  "AND l_primary.workspace_id=o.workspace_id AND JSON_UNQUOTE(JSON_EXTRACT(n_primary.payload_json,'$.asin')) REGEXP '^[A-Za-z0-9]{10}$' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(n_primary.payload_json,'$.canonical_url')) REGEXP " +
  "CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',JSON_UNQUOTE(JSON_EXTRACT(n_primary.payload_json,'$.asin')),'([/?#]|$)') ";

const selectionPrimaryEvidenceFromSql =
  "FROM opportunity_evidence_links l_primary JOIN normalized_records n_primary ON " +
  primarySeedProofSql +
  "JOIN normalized_records n_primary_current ON " +
  primaryCurrentProofSql +
  "JOIN providers p_primary ON p_primary.id=n_primary.provider_id AND p_primary.code='amazon_product' " +
  "WHERE " +
  primaryLinkProofSql;

export const selectionPrimaryAsinSql =
  "(SELECT UPPER(JSON_UNQUOTE(JSON_EXTRACT(n_primary.payload_json,'$.asin'))) " +
  selectionPrimaryEvidenceFromSql +
  "ORDER BY l_primary.created_at,n_primary.created_at DESC LIMIT 1)";

/** Presence needs the same proof, but never needs to sort the matching identities. */
export const selectionCandidateExistsSql = `EXISTS (SELECT 1 ${selectionPrimaryEvidenceFromSql})`;
export const selectionCandidateSql = `(${selectionPrimaryAsinSql} IS NOT NULL)`;

/** Fixed modes only; tenant and time values remain bound parameters. */
export function selectionScopedPrimaryIdentitiesSql(mode: "daily" | "historical") {
  const window =
    mode === "daily"
      ? "o.created_at>=? AND o.created_at<? AND o.lifecycle_status NOT IN ('archived','deleted') "
      : "o.created_at<? ";
  // ASINs have already passed the ten-character format proof. Only the first
  // ten characters are needed; an unusually small server concatenation limit
  // falls back to the unchanged scalar proof instead of truncating an identity.
  return (
    "SELECT o.id opportunity_id,CASE WHEN @@session.group_concat_max_len>=10 THEN " +
    "SUBSTRING(GROUP_CONCAT(UPPER(JSON_UNQUOTE(JSON_EXTRACT(n_primary.payload_json,'$.asin'))) " +
    "ORDER BY l_primary.created_at,n_primary.created_at DESC SEPARATOR ''),1,10) " +
    `ELSE ${selectionPrimaryAsinSql} END main_asin ` +
    "FROM normalized_records n_primary_current FORCE INDEX (idx_normalized_scope_status) " +
    "STRAIGHT_JOIN normalized_records n_primary FORCE INDEX (uq_normalized_scope_record_version) ON " +
    primaryCurrentProofSql +
    "STRAIGHT_JOIN providers p_primary ON p_primary.id=n_primary.provider_id AND p_primary.code='amazon_product' " +
    "STRAIGHT_JOIN opportunity_evidence_links l_primary ON " +
    primarySeedProofSql +
    "STRAIGHT_JOIN opportunities o ON o.id=l_primary.opportunity_id WHERE " +
    primaryLinkProofSql +
    "AND o.organization_id=? AND o.workspace_id=? AND " +
    window +
    "GROUP BY o.id"
  );
}
