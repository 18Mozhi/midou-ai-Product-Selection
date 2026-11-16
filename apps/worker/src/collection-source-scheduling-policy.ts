import { accountCompletionReadySourcingTaskSql, accountSourcingCompletionRankTaskSql, completionReadySourcingTaskSql, nativeCompletionReadySourcingTaskSql } from "./completion-sourcing-policy.js";
import { accountCompetitorCompletionRankTaskSql, completionReadyCompetitorTaskSql, nativeCompletionReadyCompetitorTaskSql } from "./completion-competitor-policy.js";
import { eligibleTaskOwnerFromSql } from "./collection-account-backlog.js";

/** Archived or mismatched tenant scopes retain history but cannot consume collection capacity. */
export const activeCollectionScopeSql = (
  alias:
    "collection_tasks" | "ct" | "backlog" | "s" | "r" | "c" | "n" | "o" | "t" | "projection_scope_task" | "trend_projection_jobs",
) =>
  "EXISTS (SELECT 1 FROM organizations collection_scope_org " +
  "JOIN workspaces collection_scope_workspace ON collection_scope_workspace.organization_id=collection_scope_org.id " +
  `WHERE collection_scope_org.id=${alias}.organization_id AND collection_scope_org.status='active' ` +
  `AND collection_scope_workspace.id=${alias}.workspace_id AND collection_scope_workspace.status='active')`;

export const activeTrendProjectionScopeSql =
  "EXISTS (SELECT 1 FROM normalized_records projection_scope_record " +
  "JOIN raw_evidence projection_scope_evidence ON projection_scope_evidence.id=projection_scope_record.raw_evidence_id " +
  "AND projection_scope_evidence.provider_id=projection_scope_record.provider_id " +
  "JOIN collection_tasks projection_scope_task ON projection_scope_task.id=projection_scope_evidence.collection_task_id " +
  "WHERE projection_scope_record.id=trend_projection_jobs.normalized_record_id " +
  `AND ${activeCollectionScopeSql("projection_scope_task")})`;

/** Materialize each scope's committed Worker claim once, never a per-candidate history lookup. */
export const collectionScopeFairnessJoinSql =
  " LEFT JOIN (SELECT t.organization_id,t.workspace_id,MAX(e.occurred_at) last_claim_at " +
  "FROM collection_task_events e JOIN collection_tasks t ON t.id=e.task_id " +
  "WHERE e.event_type='collection.task.leased' AND e.actor_type='worker' " +
  "GROUP BY t.organization_id,t.workspace_id) collection_scope_turn " +
  "ON collection_scope_turn.organization_id=collection_tasks.organization_id " +
  "AND collection_scope_turn.workspace_id=collection_tasks.workspace_id";

/** Read only sealed task ownership; a creator or a historical scope is not an owner. */
const taskOwnerForQueueSql =
  "SELECT task_owner.account_id " + eligibleTaskOwnerFromSql +
  " AND task_owner.source_id=collection_tasks.id";
export const collectionAccountCandidateSql = "(" + taskOwnerForQueueSql + ")";
export const collectionAccountLockSql = "(" + taskOwnerForQueueSql + " LOCK IN SHARE MODE)=?";

export const collectionAccountFairnessJoinSql =
  " LEFT JOIN (SELECT claim_owner.account_id,MAX(e.occurred_at) last_claim_at " +
  "FROM collection_task_events e JOIN account_owned_records claim_owner " +
  "ON claim_owner.source_table='collection_tasks' AND claim_owner.source_id=e.task_id " +
  "WHERE e.event_type='collection.task.leased' AND e.actor_type='worker' " +
  "GROUP BY claim_owner.account_id) collection_scope_turn " +
  "ON collection_scope_turn.account_id=" + collectionAccountCandidateSql;

/** Durable producer provenance, never the caller-controlled request ID. */
export const automaticIntelligenceTaskSql = (taskAlias: "ct" | "collection_tasks") =>
  "EXISTS (SELECT 1 FROM collection_task_events source_event " +
  `WHERE source_event.task_id=${taskAlias}.id ` +
  "AND source_event.event_type='hotspot.automatic.scheduled' " +
  "AND source_event.actor_type='system')";

/** Only actual scoped Worker producers and their matching source/target enter the completion lane. */
export const automaticCompletionTaskSql =
  "EXISTS (SELECT 1 FROM collection_task_events completion_event " +
  "JOIN collection_subqueries completion_query ON completion_query.task_id=completion_event.task_id " +
  "JOIN providers completion_provider ON completion_provider.id=completion_query.provider_id " +
  "WHERE completion_event.task_id=collection_tasks.id " +
  "AND completion_event.actor_type='worker' " +
  "AND ((completion_provider.code='amazon_product' AND " +
  "((completion_event.event_type IN ('competitor.collection.auto_scheduled','competitor.detail.auto_scheduled') " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(completion_query.target_json,'$.projection_type'))='competitor_snapshot') " +
  "OR (completion_event.event_type='competitor.discovery.auto_scheduled' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(completion_query.target_json,'$.projection_type'))='opportunity_competitors'))) " +
  "OR (completion_provider.code='1688_search' AND completion_event.event_type='sourcing.collection.auto_scheduled' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(completion_query.target_json,'$.projection_type'))='sourcing_search')))";

/** The actual intelligence-to-Amazon producer is a separate progress stage, not manual history. */
export const automaticProductSearchTaskSql =
  "EXISTS (SELECT 1 FROM collection_task_events product_search_event " +
  "JOIN collection_subqueries product_search_query ON product_search_query.task_id=product_search_event.task_id " +
  "JOIN providers product_search_provider ON product_search_provider.id=product_search_query.provider_id " +
  "WHERE product_search_event.task_id=collection_tasks.id " +
  "AND product_search_event.actor_type='worker' " +
  "AND product_search_event.event_type='intelligence.product_search.auto_scheduled' " +
  "AND product_search_provider.code='amazon_product' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(product_search_query.target_json,'$.projection_type'))='intelligence_product_discovery')";

/** Hold queued tasks while a required source is disabled or its circuit is open; consume no attempt. */
export const collectionRequiredSourcesReadySql =
  " AND NOT EXISTS (SELECT 1 FROM collection_subqueries required_source_query " +
  "JOIN providers required_source_provider ON required_source_provider.id=required_source_query.provider_id " +
  "LEFT JOIN provider_runtime_circuits required_source_circuit ON required_source_circuit.provider_id=required_source_query.provider_id " +
  "WHERE required_source_query.task_id=collection_tasks.id " +
  "AND required_source_query.is_required=1 AND (required_source_provider.status<>'enabled' OR required_source_circuit.state='open') " +
  "AND NOT (required_source_provider.code='1688_search' " +
  "AND COALESCE(JSON_TYPE(JSON_EXTRACT(required_source_query.target_json,'$.acceptance_run')),'')='BOOLEAN' " +
  "AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(required_source_query.target_json,'$.acceptance_run')),'')='true'))";

/** Prefer unconsumed scoped results, including ordinary retries after post-browser validation failed. */
export const pendingBrowserResultSql =
  "EXISTS (SELECT 1 FROM collection_subqueries result_query " +
  "JOIN browser_collection_jobs result_job ON result_job.collection_subquery_id=result_query.id " +
  "AND result_job.collection_task_id=result_query.task_id " +
  "AND result_job.provider_id=result_query.provider_id " +
  "WHERE result_query.task_id=collection_tasks.id " +
  "AND (result_query.status='pending' OR (result_query.status='failed' " +
  "AND result_query.error_code='validation_failed' " +
  "AND collection_tasks.status IN ('queued','retry_scheduled'))) " +
  "AND result_job.status IN ('succeeded','succeeded_empty') AND result_job.result_json IS NOT NULL)";

/** Priority, scope and alternating progress stages precede result consumption; FIFO stays unchanged. */
export const collectionReadyOrderSql = (
  completionFirst: boolean,
  productSearchFirst = false,
  sourcingFirst = false,
  competitorFirst = true,
  accountSourcing = false,
  nativeTask = false,
  rankShape?: "account_task" | "account_competitor" | "account_parent",
) =>
  " ORDER BY FIELD(CASE WHEN " +
  automaticIntelligenceTaskSql("collection_tasks") +
  " AND priority='normal' THEN 'high' ELSE priority END,'critical','high','normal','low')," +
  "collection_scope_turn.last_claim_at,CASE WHEN " +
  automaticIntelligenceTaskSql("collection_tasks") +
  " THEN 0 " +
  (completionFirst
    ? "WHEN " +
      automaticCompletionTaskSql +
      " THEN " +
      (productSearchFirst ? 2 : 1) +
      " WHEN " +
      automaticProductSearchTaskSql +
      " THEN " +
      (productSearchFirst ? 1 : 2) +
      " ELSE 3 "
    : "ELSE 1 ") +
  "END," +
  (completionFirst && sourcingFirst
    ? "CASE WHEN " + (rankShape ? accountSourcingCompletionRankTaskSql[rankShape === "account_parent" ? 2 : rankShape === "account_competitor" ? 1 : 0] :
      nativeTask ? nativeCompletionReadySourcingTaskSql : accountSourcing ? accountCompletionReadySourcingTaskSql : completionReadySourcingTaskSql) + " THEN 0 ELSE 1 END,"
    : "") +
  (completionFirst ? "CASE WHEN " + pendingBrowserResultSql + " THEN 0 ELSE 1 END," : "") +
  (completionFirst && !productSearchFirst && competitorFirst
    ? "CASE WHEN " + (rankShape ? accountCompetitorCompletionRankTaskSql[rankShape === "account_parent" ? 2 : rankShape === "account_competitor" ? 1 : 0] :
      nativeTask ? nativeCompletionReadyCompetitorTaskSql : completionReadyCompetitorTaskSql) + " THEN 0 ELSE 1 END,"
    : "") +
  "available_at,id LIMIT 1";

/** Shared admission threshold; the set of runnable tasks follows the selected admission boundary. */
export const activeCollectionTaskStatusesSql =
  "('scheduled','queued','leased','running','parsing','validating','retry_scheduled','rate_limited')";

export const collectionBacklogQuerySql = (accountMode: boolean) =>
  "SELECT COUNT(*) FROM collection_tasks backlog WHERE " +
  (accountMode
    ? "EXISTS (SELECT 1 " + eligibleTaskOwnerFromSql + " AND task_owner.source_id=backlog.id)"
    : activeCollectionScopeSql("backlog")) +
  " AND backlog.status IN " + activeCollectionTaskStatusesSql;

export const automaticCollectionBacklogCountSql = "(" + collectionBacklogQuerySql(false) + ")";
export const accountCollectionBacklogCountSql = "(" + collectionBacklogQuerySql(true) + ")";
