CREATE TEMPORARY TABLE scoutops_approval_template_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_approval_template_guard VALUES (1);
INSERT INTO scoutops_approval_template_guard
SELECT 1 FROM approval_templates t LEFT JOIN workspaces w
  ON BINARY w.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(t.historical_context,'$.workspace_id'))
  AND BINARY w.organization_id=BINARY JSON_UNQUOTE(JSON_EXTRACT(t.historical_context,'$.organization_id'))
LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_retirement_scopes s ON s.run_id=c.source_run_id AND s.legacy_org_id=w.organization_id AND s.legacy_workspace_id=w.id
LEFT JOIN account_owned_records o ON o.source_table='approval_templates' AND o.source_id=t.id
WHERE w.id IS NULL OR s.account_id IS NULL OR s.account_id<>t.account_id OR o.account_id IS NULL OR o.account_id<>t.account_id OR o.reason<>s.reason
  OR (o.reason IN ('shared','unassigned') AND o.account_id<>c.primary_account_id) LIMIT 1;
DROP TEMPORARY TABLE scoutops_approval_template_guard;
ALTER TABLE approval_templates ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE approval_templates SET organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),
  workspace_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.workspace_id'));
ALTER TABLE approval_templates MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD INDEX idx_approval_template_scope(organization_id,workspace_id,status,updated_at),
  ADD INDEX fk_approval_template_workspace(workspace_id),
  ADD CONSTRAINT fk_approval_template_org FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_approval_template_workspace FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT,
  DROP FOREIGN KEY fk_approval_template_account,DROP INDEX idx_approval_template_account,
  DROP COLUMN account_id,DROP COLUMN historical_context;
