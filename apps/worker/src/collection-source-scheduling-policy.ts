/** Durable producer provenance, never the caller-controlled request ID. */
export const automaticIntelligenceTaskSql = (taskAlias: "ct" | "collection_tasks") =>
  "EXISTS (SELECT 1 FROM collection_task_events source_event " +
  `WHERE source_event.task_id=${taskAlias}.id ` +
  `AND source_event.organization_id=${taskAlias}.organization_id ` +
  `AND source_event.workspace_id=${taskAlias}.workspace_id ` +
  "AND source_event.event_type='hotspot.automatic.scheduled' " +
  "AND source_event.actor_type='system')";

/** Intake uses high priority; old normal intake is promoted without rewriting history. */
export const collectionReadyOrderSql =
  " ORDER BY FIELD(CASE WHEN " +
  automaticIntelligenceTaskSql("collection_tasks") +
  " AND priority='normal' THEN 'high' ELSE priority END,'critical','high','normal','low'),CASE WHEN " +
  automaticIntelligenceTaskSql("collection_tasks") +
  " THEN 0 ELSE 1 END,available_at,id LIMIT 1 FOR UPDATE";
