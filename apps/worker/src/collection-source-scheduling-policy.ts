/** Durable producer provenance, never the caller-controlled request ID. */
export const automaticIntelligenceTaskSql = (taskAlias: "ct" | "collection_tasks") =>
  "EXISTS (SELECT 1 FROM collection_task_events source_event " +
  `WHERE source_event.task_id=${taskAlias}.id ` +
  `AND source_event.organization_id=${taskAlias}.organization_id ` +
  `AND source_event.workspace_id=${taskAlias}.workspace_id ` +
  "AND source_event.event_type='hotspot.automatic.scheduled' " +
  "AND source_event.actor_type='system')";

/** Keep explicit priority first and FIFO within each intake/enrichment group. */
export const collectionReadyOrderSql =
  " ORDER BY FIELD(priority,'critical','high','normal','low'),CASE WHEN " +
  automaticIntelligenceTaskSql("collection_tasks") +
  " THEN 0 ELSE 1 END,available_at,id LIMIT 1 FOR UPDATE";
