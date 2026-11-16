-- Stop writers. Verify task, query, source and original scope before DDL.
DROP TEMPORARY TABLE IF EXISTS scoutops_browser_job_scope_guard;
CREATE TEMPORARY TABLE scoutops_browser_job_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_browser_job_scope_guard VALUES (1);
INSERT INTO scoutops_browser_job_scope_guard
SELECT 1 FROM browser_collection_jobs j LEFT JOIN collection_tasks t ON t.id=j.collection_task_id
LEFT JOIN collection_subqueries q ON q.id=j.collection_subquery_id AND q.task_id=t.id AND q.provider_id=j.provider_id
WHERE t.id IS NULL OR q.id IS NULL OR NOT (j.organization_id <=> t.organization_id AND j.workspace_id <=> t.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_browser_job_scope_guard;
ALTER TABLE browser_collection_jobs DROP FOREIGN KEY fk_browser_collection_organization,
  DROP FOREIGN KEY fk_browser_collection_workspace, DROP INDEX idx_browser_collection_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
