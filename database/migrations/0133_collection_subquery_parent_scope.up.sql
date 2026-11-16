-- Stop writers. Verify every original scope against its task before changing structure.
DROP TEMPORARY TABLE IF EXISTS scoutops_collection_subquery_scope_guard;
CREATE TEMPORARY TABLE scoutops_collection_subquery_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_collection_subquery_scope_guard VALUES (1);
INSERT INTO scoutops_collection_subquery_scope_guard
SELECT 1 FROM collection_subqueries q LEFT JOIN collection_tasks t ON t.id=q.task_id
WHERE t.id IS NULL OR NOT (q.organization_id <=> t.organization_id AND q.workspace_id <=> t.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_collection_subquery_scope_guard;
ALTER TABLE collection_subqueries
  DROP FOREIGN KEY fk_collection_subquery_organization,
  DROP FOREIGN KEY fk_collection_subquery_workspace,
  DROP INDEX idx_collection_subquery_scope_status,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
