CREATE TEMPORARY TABLE scoutops_crawler_run_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_crawler_run_guard VALUES (1);
INSERT INTO scoutops_crawler_run_guard
SELECT 1 FROM crawler_browser_runs r LEFT JOIN workspaces w
  ON BINARY w.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(r.historical_context,'$.workspace_id'))
  AND BINARY w.organization_id=BINARY JSON_UNQUOTE(JSON_EXTRACT(r.historical_context,'$.organization_id'))
WHERE w.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_crawler_run_guard;
ALTER TABLE crawler_browser_runs ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE crawler_browser_runs SET organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),
  workspace_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.workspace_id'));
ALTER TABLE crawler_browser_runs MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL, DROP COLUMN historical_context,
  ADD KEY idx_crawler_run_scope_time (organization_id,workspace_id,started_at),
  ADD KEY fk_crawler_run_workspace (workspace_id),
  ADD CONSTRAINT fk_crawler_run_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_crawler_run_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
