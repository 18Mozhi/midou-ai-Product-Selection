CREATE TEMPORARY TABLE scoutops_reconciliation_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_reconciliation_guard VALUES (1);
INSERT INTO scoutops_reconciliation_guard
SELECT 1 FROM reconciliation_runs q
LEFT JOIN workspaces w ON BINARY w.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(q.historical_context,'$.workspace_id'))
  AND BINARY w.organization_id=BINARY JSON_UNQUOTE(JSON_EXTRACT(q.historical_context,'$.organization_id'))
WHERE w.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_reconciliation_guard;
ALTER TABLE reconciliation_runs ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE reconciliation_runs SET
  organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),
  workspace_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.workspace_id'));
ALTER TABLE reconciliation_runs
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP COLUMN historical_context,
  ADD KEY idx_reconciliation_scope_time (organization_id,workspace_id,created_at),
  ADD KEY fk_reconciliation_workspace (workspace_id),
  ADD CONSTRAINT fk_reconciliation_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_reconciliation_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
