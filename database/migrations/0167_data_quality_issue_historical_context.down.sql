CREATE TEMPORARY TABLE scoutops_quality_issue_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_quality_issue_guard VALUES (1);
INSERT INTO scoutops_quality_issue_guard
SELECT 1 FROM data_quality_issues r LEFT JOIN workspaces w
  ON BINARY w.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(r.historical_context,'$.workspace_id'))
  AND BINARY w.organization_id=BINARY JSON_UNQUOTE(JSON_EXTRACT(r.historical_context,'$.organization_id'))
WHERE w.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_quality_issue_guard;
ALTER TABLE data_quality_issues ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE data_quality_issues SET organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),
  workspace_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.workspace_id'));
ALTER TABLE data_quality_issues MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL, DROP COLUMN historical_context,
  ADD KEY idx_quality_issue_scope_status (organization_id,workspace_id,status,severity,updated_at),
  ADD KEY fk_quality_issue_workspace (workspace_id),
  ADD CONSTRAINT fk_quality_issue_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_quality_issue_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
