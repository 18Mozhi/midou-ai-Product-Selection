-- Stop writers. Check the exact task and failed attempt before persistent DDL.
DROP TEMPORARY TABLE IF EXISTS scoutops_collection_dead_scope_guard;
CREATE TEMPORARY TABLE scoutops_collection_dead_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_collection_dead_scope_guard VALUES (1);
INSERT INTO scoutops_collection_dead_scope_guard
SELECT 1 FROM collection_dead_letters d
LEFT JOIN collection_tasks t ON t.id=d.task_id
LEFT JOIN collection_task_attempts a ON a.id=d.attempt_id AND a.task_id=d.task_id
WHERE t.id IS NULL OR a.id IS NULL
  OR NOT (t.organization_id <=> d.organization_id AND t.workspace_id <=> d.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_collection_dead_scope_guard;
ALTER TABLE collection_dead_letters
  DROP FOREIGN KEY fk_collection_dead_organization,
  DROP FOREIGN KEY fk_collection_dead_workspace,
  DROP INDEX idx_collection_dead_scope_status,
  ADD KEY idx_collection_dead_created (created_at),
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
