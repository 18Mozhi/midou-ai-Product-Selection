-- Stop writers; verify typed lineage and the exact event before persistent DDL.
DROP TEMPORARY TABLE IF EXISTS scoutops_ai_delivery_scope_guard;
CREATE TEMPORARY TABLE scoutops_ai_delivery_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_ai_delivery_scope_guard VALUES (1);
INSERT INTO scoutops_ai_delivery_scope_guard
SELECT 1 FROM ai_analysis_events e
LEFT JOIN ai_analysis_results r
  ON e.event_type IN ('ai.analysis.completed','ai.analysis.reviewed') AND r.id=e.resource_id
LEFT JOIN ai_analysis_requests q
  ON q.id=CASE WHEN e.event_type='ai.analysis.queued' THEN e.resource_id ELSE r.request_id_fk END
LEFT JOIN opportunities o ON o.id=q.opportunity_id
WHERE q.id IS NULL OR o.id IS NULL OR (r.id IS NOT NULL AND r.opportunity_id<>q.opportunity_id)
  OR NOT (e.organization_id <=> o.organization_id AND e.workspace_id <=> o.workspace_id)
LIMIT 1;
INSERT INTO scoutops_ai_delivery_scope_guard
SELECT 1 FROM ai_analysis_outbox d LEFT JOIN ai_analysis_events e ON e.id=d.id
WHERE e.id IS NULL OR NOT (BINARY d.event_type <=> BINARY e.event_type AND d.resource_id <=> e.resource_id
  AND d.organization_id <=> e.organization_id AND d.workspace_id <=> e.workspace_id
  AND BINARY CAST(d.payload_json AS CHAR) <=> BINARY CAST(e.payload_json AS CHAR))
LIMIT 1;
DROP TEMPORARY TABLE scoutops_ai_delivery_scope_guard;
ALTER TABLE ai_analysis_outbox DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE ai_analysis_events DROP INDEX idx_ai_event_scope, DROP COLUMN organization_id, DROP COLUMN workspace_id;
