const sourcePolicies = {
  amazon_product: "p.code='amazon_product' AND p.access_mode='public_page'",
  "1688_search": "p.code='1688_search' AND p.access_mode='authenticated_browser'",
} as const;

// Account-native tasks retain a sealed owner ledger. Creator identity alone
// cannot authorize a probe for another account or a mismatched subquery.
export const accountRecoveryWorkJoins =
  "JOIN collection_tasks t ON t.id=q.task_id " +
  "JOIN users recovery_owner ON recovery_owner.id=t.account_id AND recovery_owner.status='active' " +
  "JOIN account_ownership_cutover recovery_cut ON recovery_cut.slot='current' AND recovery_cut.contract_version=25 " +
  "JOIN account_owned_records task_owner ON task_owner.source_table='collection_tasks' AND task_owner.source_id=t.id AND task_owner.account_id=t.account_id " +
  "JOIN account_owned_records query_owner ON query_owner.source_table='collection_subqueries' AND query_owner.source_id=q.id AND query_owner.account_id=t.account_id " +
  "AND (task_owner.reason='exclusive_owner' OR (task_owner.reason IN ('shared','unassigned') AND t.account_id=recovery_cut.primary_account_id)) " +
  "AND (query_owner.reason='exclusive_owner' OR (query_owner.reason IN ('shared','unassigned') AND t.account_id=recovery_cut.primary_account_id)) ";
export const pendingRecoveryTaskSql = "t.status IN ('scheduled','queued','retry_scheduled','rate_limited')";
export const accountAmazonRecoveryScopeSql =
  "SELECT t.account_id FROM providers p JOIN collection_subqueries q ON q.provider_id=p.id " +
  accountRecoveryWorkJoins +
  "JOIN users recovery_actor ON recovery_actor.id=t.created_by AND recovery_actor.status='active' " +
  "WHERE t.id=? AND recovery_actor.id=? AND " + sourcePolicies.amazon_product +
  " AND p.status='enabled' AND " + pendingRecoveryTaskSql;

/** Code-owned source policies, never an HTTP supplied identifier. */
export function pendingTaskRecoveryCandidatesSql(
  code: keyof typeof sourcePolicies,
  options: { captchaHandoff?: boolean; accountScope?: boolean } = {},
) {
  const policy = sourcePolicies[code];
  if (!Object.hasOwn(sourcePolicies, code) || typeof policy !== "string")
    throw new Error("automatic_source_recovery_policy_invalid");
  if (options.captchaHandoff && code !== "amazon_product")
    throw new Error("automatic_source_recovery_policy_invalid");
  if (options.accountScope && code !== "amazon_product")
    throw new Error("automatic_source_recovery_policy_invalid");
  const ready =
    "h.health_status='ready' AND h.last_checked_at>c.opened_at AND h.last_checked_at>=p.updated_at";
  const pendingWork =
    code === "1688_search"
      ? "(t.status IN ('scheduled','queued','retry_scheduled','rate_limited') OR (t.status='completed_with_warnings' AND q.status='blocked' AND q.error_code='source_circuit_open' AND q.available_result_count=0 AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='sourcing_search' " +
        "AND EXISTS (SELECT 1 FROM sourcing_searches pending_search WHERE pending_search.collection_task_id=t.id AND pending_search.organization_id=t.organization_id AND pending_search.workspace_id=t.workspace_id AND pending_search.status IN ('queued','succeeded_empty') AND pending_search.candidate_count=0 AND pending_search.input_type='opportunity' AND pending_search.deleted_at IS NULL " +
        "AND NOT EXISTS (SELECT 1 FROM sourcing_candidates pending_offer WHERE pending_offer.search_id=pending_search.id AND pending_offer.organization_id=pending_search.organization_id AND pending_offer.workspace_id=pending_search.workspace_id))))"
      : pendingRecoveryTaskSql;
  return (
    "SELECT p.id,p.version,c.opened_at,t.id collection_task_id" +
    (options.captchaHandoff
      ? ",h.health_status recovery_health_status,h.last_checked_at recovery_checked_at,p.updated_at recovery_provider_updated_at"
      : "") +
    " FROM providers p " +
    "JOIN users recovery_actor ON recovery_actor.id=? AND recovery_actor.status='active' " +
    "JOIN provider_runtime_circuits c ON c.provider_id=p.id AND c.state='open' " +
    "LEFT JOIN provider_adapter_health h ON h.provider_id=p.id " +
    "JOIN collection_subqueries q ON q.provider_id=p.id " +
    (options.accountScope
      ? accountRecoveryWorkJoins
      : "JOIN collection_tasks t ON t.id=q.task_id AND t.organization_id=q.organization_id " +
    "AND t.workspace_id=q.workspace_id AND t.created_by=recovery_actor.id " +
    "JOIN organizations o ON o.id=t.organization_id AND o.status='active' " +
    "JOIN workspaces w ON w.id=t.workspace_id AND w.organization_id=t.organization_id AND w.status='active' ") +
    `WHERE ${policy} AND p.status='enabled' ` +
    (options.accountScope ? "AND t.created_by=recovery_actor.id " : "") +
    "AND p.terms_review_status='approved' AND CHAR_LENGTH(p.terms_version)>0 " +
    "AND (p.terms_permanent=1 OR p.terms_expires_at>?) " +
    `AND ${pendingWork} ` +
    (options.captchaHandoff
      ? "AND c.last_error_code IN ('network_error','timeout','rate_limited','captcha','blocked_captcha') " +
        `AND ((${ready}) OR c.opened_at<=?) AND (h.last_checked_at IS NULL OR h.last_checked_at<=? OR (${ready})) ` +
        "AND (h.last_checked_at<c.opened_at OR h.last_error_code IS NULL OR h.last_error_code IN ('network_error','timeout','rate_limited','captcha','blocked_captcha','dependency_unavailable')) " +
        "AND NOT EXISTS (SELECT 1 FROM crawler_profile_leases busy JOIN crawler_profiles busy_profile ON busy_profile.id=busy.crawler_profile_id WHERE busy_profile.provider_id=p.id AND busy.expires_at>?) "
      : "AND c.last_error_code IN ('network_error','timeout','rate_limited') AND c.opened_at<=? AND (h.last_checked_at IS NULL OR h.last_checked_at<=?) ") +
    "AND COALESCE(h.health_status='blocked' AND h.last_checked_at>=c.opened_at,0)=0 " +
    "ORDER BY t.created_at,t.id LIMIT 1"
  );
}
