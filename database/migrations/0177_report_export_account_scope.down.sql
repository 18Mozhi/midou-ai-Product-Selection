CREATE TEMPORARY TABLE scoutops_report_export_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_report_export_guard VALUES (1);
INSERT INTO scoutops_report_export_guard
SELECT 1 FROM report_exports e LEFT JOIN workspaces w
  ON BINARY w.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(e.historical_context,'$.workspace_id'))
  AND BINARY w.organization_id=BINARY JSON_UNQUOTE(JSON_EXTRACT(e.historical_context,'$.organization_id'))
LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_retirement_scopes m ON m.run_id=c.source_run_id AND m.legacy_org_id=w.organization_id AND m.legacy_workspace_id=w.id
WHERE w.id IS NULL OR m.account_id IS NULL OR m.account_id<>e.account_id
  OR EXISTS (SELECT 1 FROM report_export_events v WHERE v.export_id=e.id)
  OR NOT (m.reason='exclusive_owner' OR (m.reason IN ('shared','unassigned') AND m.account_id=c.primary_account_id)) LIMIT 1;
DROP TEMPORARY TABLE scoutops_report_export_guard;
ALTER TABLE report_exports ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE report_exports SET organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),
  workspace_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.workspace_id'));
ALTER TABLE report_exports MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD INDEX idx_report_exports_scope (organization_id,workspace_id,created_at),
  ADD INDEX fk_report_export_workspace (workspace_id),
  ADD CONSTRAINT fk_report_export_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_report_export_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT,
  DROP FOREIGN KEY fk_report_export_account, DROP INDEX idx_report_exports_account,
  DROP COLUMN account_id, DROP COLUMN historical_context;
DROP TABLE report_export_events;
