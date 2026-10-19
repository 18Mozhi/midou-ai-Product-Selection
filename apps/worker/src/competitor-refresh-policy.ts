/** A refresh waits for its own active detail task, not unrelated ingestion in the organization. */
export const competitorRefreshNoActiveDetailSql =
  "NOT EXISTS (SELECT 1 FROM collection_subqueries q_refresh " +
  "JOIN collection_tasks ct_refresh ON ct_refresh.id=q_refresh.task_id " +
  "AND ct_refresh.organization_id=q_refresh.organization_id AND ct_refresh.workspace_id=q_refresh.workspace_id " +
  "WHERE q_refresh.organization_id=c.organization_id AND q_refresh.workspace_id=c.workspace_id " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(q_refresh.target_json,'$.projection_type'))='competitor_snapshot' " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(q_refresh.target_json,'$.competitor_id'))=BINARY c.id " +
  "AND ct_refresh.status IN ('scheduled','queued','leased','running','parsing','validating','retry_scheduled','rate_limited'))";

/** Missing first observations age from the original competitor creation, never a fabricated snapshot. */
export const competitorRefreshObservedAtSql =
  "(CASE WHEN c.latest_snapshot_id IS NULL THEN c.created_at ELSE s.captured_at END)";
export const competitorRefreshOrderSql =
  "ORDER BY (c.latest_snapshot_id IS NOT NULL)," +
  competitorRefreshObservedAtSql +
  ",c.id LIMIT 1 FOR UPDATE";
