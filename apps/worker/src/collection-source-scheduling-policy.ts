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
  "((completion_event.event_type='competitor.collection.auto_scheduled' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(completion_query.target_json,'$.projection_type'))='competitor_snapshot') " +
  "OR (completion_event.event_type='competitor.discovery.auto_scheduled' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(completion_query.target_json,'$.projection_type'))='opportunity_competitors'))) " +
  "OR (completion_provider.code='1688_search' AND completion_event.event_type='sourcing.collection.auto_scheduled' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(completion_query.target_json,'$.projection_type'))='sourcing_search')))";

/** Explicit priority and intake stay first; one FIFO turn bounds completion bursts. No locks during sorting. */
export const collectionReadyOrderSql = (completionFirst: boolean) =>
  " ORDER BY FIELD(CASE WHEN " +
  automaticIntelligenceTaskSql("collection_tasks") +
  " AND priority='normal' THEN 'high' ELSE priority END,'critical','high','normal','low'),CASE WHEN " +
  automaticIntelligenceTaskSql("collection_tasks") +
  " THEN 0 " +
  (completionFirst ? "WHEN " + automaticCompletionTaskSql + " THEN 1 ELSE 2 " : "ELSE 1 ") +
  "END,available_at,id LIMIT 1";
