/** Archived or mismatched tenant scopes retain history but cannot consume collection capacity. */
export const activeCollectionScopeSql = (
  alias:
    "collection_tasks" | "ct" | "backlog" | "s" | "r" | "c" | "n" | "o" | "trend_projection_jobs",
) =>
  "EXISTS (SELECT 1 FROM organizations collection_scope_org " +
  "JOIN workspaces collection_scope_workspace ON collection_scope_workspace.organization_id=collection_scope_org.id " +
  `WHERE collection_scope_org.id=${alias}.organization_id AND collection_scope_org.status='active' ` +
  `AND collection_scope_workspace.id=${alias}.workspace_id AND collection_scope_workspace.status='active')`;

/** Materialize each scope's committed Worker claim once, never a per-candidate history lookup. */
export const collectionScopeFairnessJoinSql =
  " LEFT JOIN (SELECT organization_id,workspace_id,MAX(occurred_at) last_claim_at " +
  "FROM collection_task_events WHERE event_type='collection.task.leased' AND actor_type='worker' " +
  "GROUP BY organization_id,workspace_id) collection_scope_turn " +
  "ON collection_scope_turn.organization_id=collection_tasks.organization_id " +
  "AND collection_scope_turn.workspace_id=collection_tasks.workspace_id";

/** Durable producer provenance, never the caller-controlled request ID. */
export const automaticIntelligenceTaskSql = (taskAlias: "ct" | "collection_tasks") =>
  "EXISTS (SELECT 1 FROM collection_task_events source_event " +
  `WHERE source_event.task_id=${taskAlias}.id ` +
  `AND source_event.organization_id=${taskAlias}.organization_id ` +
  `AND source_event.workspace_id=${taskAlias}.workspace_id ` +
  "AND source_event.event_type='hotspot.automatic.scheduled' " +
  "AND source_event.actor_type='system')";

/** Only actual scoped Worker producers and their matching source/target enter the completion lane. */
export const automaticCompletionTaskSql =
  "EXISTS (SELECT 1 FROM collection_task_events completion_event " +
  "JOIN collection_subqueries completion_query ON completion_query.task_id=completion_event.task_id " +
  "AND completion_query.organization_id=completion_event.organization_id " +
  "AND completion_query.workspace_id=completion_event.workspace_id " +
  "JOIN providers completion_provider ON completion_provider.id=completion_query.provider_id " +
  "WHERE completion_event.task_id=collection_tasks.id " +
  "AND completion_event.organization_id=collection_tasks.organization_id " +
  "AND completion_event.workspace_id=collection_tasks.workspace_id AND completion_event.actor_type='worker' " +
  "AND ((completion_provider.code='amazon_product' AND " +
  "((completion_event.event_type IN ('competitor.collection.auto_scheduled','competitor.detail.auto_scheduled') " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(completion_query.target_json,'$.projection_type'))='competitor_snapshot') " +
  "OR (completion_event.event_type='competitor.discovery.auto_scheduled' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(completion_query.target_json,'$.projection_type'))='opportunity_competitors'))) " +
  "OR (completion_provider.code='1688_search' AND completion_event.event_type='sourcing.collection.auto_scheduled' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(completion_query.target_json,'$.projection_type'))='sourcing_search')))";

/** Hold queued tasks while a required source is disabled or its circuit is open; consume no attempt. */
export const collectionRequiredSourcesReadySql =
  " AND NOT EXISTS (SELECT 1 FROM collection_subqueries required_source_query " +
  "JOIN providers required_source_provider ON required_source_provider.id=required_source_query.provider_id " +
  "LEFT JOIN provider_runtime_circuits required_source_circuit ON required_source_circuit.provider_id=required_source_query.provider_id " +
  "WHERE required_source_query.task_id=collection_tasks.id " +
  "AND required_source_query.organization_id=collection_tasks.organization_id " +
  "AND required_source_query.workspace_id=collection_tasks.workspace_id " +
  "AND required_source_query.is_required=1 AND (required_source_provider.status<>'enabled' OR required_source_circuit.state='open') " +
  "AND NOT (required_source_provider.code='1688_search' " +
  "AND COALESCE(JSON_TYPE(JSON_EXTRACT(required_source_query.target_json,'$.acceptance_run')),'')='BOOLEAN' " +
  "AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(required_source_query.target_json,'$.acceptance_run')),'')='true'))";

/** Only the same scoped, still-pending subquery's durable successful browser result can be consumed. */
export const pendingBrowserResultSql =
  "EXISTS (SELECT 1 FROM collection_subqueries result_query " +
  "JOIN browser_collection_jobs result_job ON result_job.collection_subquery_id=result_query.id " +
  "AND result_job.collection_task_id=result_query.task_id " +
  "AND result_job.organization_id=result_query.organization_id " +
  "AND result_job.workspace_id=result_query.workspace_id AND result_job.provider_id=result_query.provider_id " +
  "WHERE result_query.task_id=collection_tasks.id " +
  "AND result_query.organization_id=collection_tasks.organization_id " +
  "AND result_query.workspace_id=collection_tasks.workspace_id AND result_query.status='pending' " +
  "AND result_job.status IN ('succeeded','succeeded_empty') AND result_job.result_json IS NOT NULL)";

/** Priority, scope and lanes precede durable result consumption; the FIFO escape turn stays unchanged. */
export const collectionReadyOrderSql = (completionFirst: boolean) =>
  " ORDER BY FIELD(CASE WHEN " +
  automaticIntelligenceTaskSql("collection_tasks") +
  " AND priority='normal' THEN 'high' ELSE priority END,'critical','high','normal','low')," +
  "collection_scope_turn.last_claim_at,CASE WHEN " +
  automaticIntelligenceTaskSql("collection_tasks") +
  " THEN 0 " +
  (completionFirst ? "WHEN " + automaticCompletionTaskSql + " THEN 1 ELSE 2 " : "ELSE 1 ") +
  "END," +
  (completionFirst ? "CASE WHEN " + pendingBrowserResultSql + " THEN 0 ELSE 1 END," : "") +
  "available_at,id LIMIT 1";

/** Shared admission threshold: count only unfinished collection work in active matching scopes. */
export const automaticCollectionBacklogCountSql =
  "(SELECT COUNT(*) FROM collection_tasks backlog WHERE " +
  activeCollectionScopeSql("backlog") +
  " AND backlog.status IN ('scheduled','queued','leased','running','parsing','validating','retry_scheduled','rate_limited'))";
