-- Freeze writers. Check the exact browser job, its source and the parent task.
DROP TEMPORARY TABLE IF EXISTS scoutops_parser_sample_scope_guard;
CREATE TEMPORARY TABLE scoutops_parser_sample_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_parser_sample_scope_guard VALUES (1);
INSERT INTO scoutops_parser_sample_scope_guard
SELECT 1 FROM provider_parser_samples s
LEFT JOIN browser_collection_jobs j ON j.id=s.browser_job_id AND j.provider_id=s.provider_id
LEFT JOIN collection_tasks t ON t.id=j.collection_task_id
WHERE t.id IS NULL OR NOT (s.organization_id <=> t.organization_id AND s.workspace_id <=> t.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_parser_sample_scope_guard;
ALTER TABLE provider_parser_samples
  DROP FOREIGN KEY fk_provider_parser_sample_organization,
  DROP FOREIGN KEY fk_provider_parser_sample_workspace,
  DROP INDEX idx_provider_parser_sample_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
