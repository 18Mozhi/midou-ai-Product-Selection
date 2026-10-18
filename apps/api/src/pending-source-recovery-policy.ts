const sourcePolicies = {
  amazon_product: "p.code='amazon_product' AND p.access_mode='public_page'",
  "1688_search": "p.code='1688_search' AND p.access_mode='authenticated_browser'",
} as const;

/** Code-owned source policies, never an HTTP supplied identifier. */
export function pendingTaskRecoveryCandidatesSql(code: keyof typeof sourcePolicies) {
  const policy = sourcePolicies[code];
  if (!Object.hasOwn(sourcePolicies, code) || typeof policy !== "string")
    throw new Error("automatic_source_recovery_policy_invalid");
  const pendingWork =
    code === "1688_search"
      ? "(t.status IN ('scheduled','queued','retry_scheduled','rate_limited') OR (t.status='completed_with_warnings' AND q.status='blocked' AND q.error_code='source_circuit_open' AND q.available_result_count=0 AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='sourcing_search' " +
        "AND EXISTS (SELECT 1 FROM sourcing_searches pending_search WHERE pending_search.collection_task_id=t.id AND pending_search.organization_id=t.organization_id AND pending_search.workspace_id=t.workspace_id AND pending_search.status IN ('queued','succeeded_empty') AND pending_search.candidate_count=0 AND pending_search.input_type='opportunity' AND pending_search.deleted_at IS NULL " +
        "AND NOT EXISTS (SELECT 1 FROM sourcing_candidates pending_offer WHERE pending_offer.search_id=pending_search.id AND pending_offer.organization_id=pending_search.organization_id AND pending_offer.workspace_id=pending_search.workspace_id))))"
      : "t.status IN ('scheduled','queued','retry_scheduled','rate_limited')";
  return (
    "SELECT p.id,p.version,c.opened_at,t.id collection_task_id FROM providers p " +
    "JOIN users recovery_actor ON recovery_actor.id=? AND recovery_actor.status='active' " +
    "JOIN provider_runtime_circuits c ON c.provider_id=p.id AND c.state='open' " +
    "LEFT JOIN provider_adapter_health h ON h.provider_id=p.id " +
    "JOIN collection_subqueries q ON q.provider_id=p.id " +
    "JOIN collection_tasks t ON t.id=q.task_id AND t.organization_id=q.organization_id " +
    "AND t.workspace_id=q.workspace_id AND t.created_by=recovery_actor.id " +
    "JOIN organizations o ON o.id=t.organization_id AND o.status='active' " +
    "JOIN workspaces w ON w.id=t.workspace_id AND w.organization_id=t.organization_id AND w.status='active' " +
    `WHERE ${policy} AND p.status='enabled' ` +
    "AND p.terms_review_status='approved' AND CHAR_LENGTH(p.terms_version)>0 " +
    "AND (p.terms_permanent=1 OR p.terms_expires_at>?) " +
    `AND ${pendingWork} ` +
    "AND c.last_error_code IN ('network_error','timeout','rate_limited') AND c.opened_at<=? " +
    "AND (h.last_checked_at IS NULL OR h.last_checked_at<=?) " +
    "AND COALESCE(h.health_status='blocked' AND h.last_checked_at>=c.opened_at,0)=0 " +
    "ORDER BY t.created_at,t.id LIMIT 1"
  );
}
