-- Stop writers. Refuse before either ALTER if a task child disagrees with its parent.
DROP TEMPORARY TABLE IF EXISTS scoutops_task_history_scope_guard;
CREATE TEMPORARY TABLE scoutops_task_history_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_task_history_scope_guard VALUES (1);
INSERT INTO scoutops_task_history_scope_guard
SELECT 1 FROM task_comments c LEFT JOIN tasks t ON t.id=c.task_id
WHERE t.id IS NULL OR NOT (c.organization_id <=> t.organization_id AND c.workspace_id <=> t.workspace_id)
LIMIT 1;
INSERT INTO scoutops_task_history_scope_guard
SELECT 1 FROM task_events e LEFT JOIN tasks t ON t.id=e.task_id
WHERE t.id IS NULL OR NOT (e.organization_id <=> t.organization_id AND e.workspace_id <=> t.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_task_history_scope_guard;
ALTER TABLE task_comments DROP INDEX idx_task_comments_task_time,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE task_events DROP INDEX idx_task_events_scope_task,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
