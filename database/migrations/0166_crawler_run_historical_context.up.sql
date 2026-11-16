-- Stop writers. Preserve original scope for historical display and reverse migration.
CREATE TEMPORARY TABLE scoutops_crawler_run_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_crawler_run_guard VALUES (1);
INSERT INTO scoutops_crawler_run_guard
SELECT 1 FROM crawler_browser_runs r LEFT JOIN workspaces w
  ON w.id=r.workspace_id AND w.organization_id=r.organization_id
WHERE w.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_crawler_run_guard;
ALTER TABLE crawler_browser_runs ADD COLUMN historical_context JSON NULL AFTER id;
UPDATE crawler_browser_runs SET historical_context=JSON_OBJECT('organization_id',organization_id,'workspace_id',workspace_id);
ALTER TABLE crawler_browser_runs MODIFY COLUMN historical_context JSON NOT NULL,
  DROP FOREIGN KEY fk_crawler_run_organization, DROP FOREIGN KEY fk_crawler_run_workspace,
  DROP INDEX idx_crawler_run_scope_time, DROP INDEX fk_crawler_run_workspace,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
