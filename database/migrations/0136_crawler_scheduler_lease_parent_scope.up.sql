-- Stop writers. A task or browser run supplies the original coordinates.
DROP TEMPORARY TABLE IF EXISTS scoutops_scheduler_scope_guard;
CREATE TEMPORARY TABLE scoutops_scheduler_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_scheduler_scope_guard VALUES (1);
INSERT INTO scoutops_scheduler_scope_guard
SELECT 1 FROM crawler_scheduler_leases l
LEFT JOIN collection_tasks t ON t.id=l.task_id
LEFT JOIN crawler_browser_runs r ON r.id=l.run_id
WHERE NOT (l.organization_id <=> COALESCE(t.organization_id,r.organization_id))
   OR NOT (l.workspace_id <=> COALESCE(t.workspace_id,r.workspace_id))
   OR (t.id IS NOT NULL AND r.id IS NOT NULL AND
       NOT (t.organization_id <=> r.organization_id AND t.workspace_id <=> r.workspace_id))
LIMIT 1;
DROP TEMPORARY TABLE scoutops_scheduler_scope_guard;
ALTER TABLE crawler_scheduler_leases
  DROP FOREIGN KEY fk_crawler_scheduler_organization,
  DROP FOREIGN KEY fk_crawler_scheduler_workspace,
  DROP INDEX idx_crawler_scheduler_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
