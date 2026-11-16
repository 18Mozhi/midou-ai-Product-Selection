/** Code-owned aliases only. Callers scope the seed to the opportunity parent. */
export const currentProductVersionJoinSql = (
  link: string,
  record: string,
  evidenceField: "raw_evidence_id" | "evidence_id" = "raw_evidence_id",
) =>
  `STRAIGHT_JOIN normalized_records ${record}_seed FORCE INDEX (idx_normalized_evidence) ON ${record}_seed.raw_evidence_id=${link}.${evidenceField} ` +
  `AND ${record}_seed.status IN ('active','superseded') ` +
  `STRAIGHT_JOIN normalized_records ${record} FORCE INDEX (uq_normalized_scope_record_version) ON ${record}.organization_id=${record}_seed.organization_id ` +
  `AND ${record}.workspace_id=${record}_seed.workspace_id AND ${record}.provider_id=${record}_seed.provider_id ` +
  `AND ${record}.record_key=${record}_seed.record_key AND ${record}.status='active' ` +
  `AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(${record}.payload_json,'$.asin')))=BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(${record}_seed.payload_json,'$.asin'))) `;
