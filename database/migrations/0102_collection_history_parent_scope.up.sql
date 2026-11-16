-- Stop writers. Verify event and delivery scope before persistent DDL.
DROP TEMPORARY TABLE IF EXISTS scoutops_collection_history_scope_guard;
CREATE TEMPORARY TABLE scoutops_collection_history_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_collection_history_scope_guard VALUES (1);
INSERT INTO scoutops_collection_history_scope_guard
SELECT 1 FROM collection_task_events h LEFT JOIN collection_tasks t ON t.id=h.task_id
WHERE t.id IS NULL OR NOT (t.organization_id <=> h.organization_id AND t.workspace_id <=> h.workspace_id)
LIMIT 1;
INSERT INTO scoutops_collection_history_scope_guard
SELECT 1 FROM collection_task_outbox h LEFT JOIN collection_tasks t ON t.id=h.task_id
WHERE t.id IS NULL OR NOT (t.organization_id <=> h.organization_id AND t.workspace_id <=> h.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_collection_history_scope_guard;
ALTER TABLE collection_task_events DROP INDEX idx_collection_event_scope_time, DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE collection_task_outbox DROP INDEX idx_collection_outbox_scope, DROP COLUMN organization_id, DROP COLUMN workspace_id;
