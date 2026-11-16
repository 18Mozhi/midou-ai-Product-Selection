-- Stop writers. A run inherits its original collection task; never replay the job.
DROP TEMPORARY TABLE IF EXISTS scoutops_core_projection_scope_guard;
CREATE TEMPORARY TABLE scoutops_core_projection_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_core_projection_scope_guard VALUES (1);
INSERT INTO scoutops_core_projection_scope_guard
SELECT 1 FROM core_collection_projection_runs r
LEFT JOIN collection_tasks t ON t.id=r.collection_task_id
WHERE t.id IS NULL OR NOT (r.organization_id <=> t.organization_id AND r.workspace_id <=> t.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_core_projection_scope_guard;
ALTER TABLE core_collection_projection_runs DROP INDEX idx_core_projection_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
