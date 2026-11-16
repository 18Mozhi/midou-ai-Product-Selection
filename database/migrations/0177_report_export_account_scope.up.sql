CREATE TEMPORARY TABLE scoutops_report_export_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_report_export_guard VALUES (1);
INSERT INTO scoutops_report_export_guard
SELECT 1 FROM report_exports e LEFT JOIN workspaces w ON w.id=e.workspace_id AND w.organization_id=e.organization_id
LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_retirement_scopes m ON m.run_id=c.source_run_id AND m.legacy_org_id=e.organization_id AND m.legacy_workspace_id=e.workspace_id
WHERE w.id IS NULL OR m.account_id IS NULL
  OR NOT (m.reason='exclusive_owner' OR (m.reason IN ('shared','unassigned') AND m.account_id=c.primary_account_id))
  OR (e.status IN ('queued','leased','retry_scheduled') AND e.expires_at>UTC_TIMESTAMP(3)) LIMIT 1;
DROP TEMPORARY TABLE scoutops_report_export_guard;
ALTER TABLE report_exports ADD COLUMN account_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN historical_context JSON NULL AFTER account_id;
UPDATE report_exports e JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
JOIN account_retirement_scopes m ON m.run_id=c.source_run_id AND m.legacy_org_id=e.organization_id AND m.legacy_workspace_id=e.workspace_id
SET e.account_id=m.account_id,e.historical_context=JSON_OBJECT('organization_id',e.organization_id,'workspace_id',e.workspace_id);
ALTER TABLE report_exports MODIFY COLUMN account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD INDEX idx_report_exports_account (account_id,created_at),
  ADD CONSTRAINT fk_report_export_account FOREIGN KEY (account_id) REFERENCES users(id) ON DELETE RESTRICT,
  DROP FOREIGN KEY fk_report_export_org, DROP FOREIGN KEY fk_report_export_workspace,
  DROP INDEX idx_report_exports_scope, DROP INDEX fk_report_export_workspace,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
CREATE TABLE report_export_events (
  id CHAR(36) CHARACTER SET ascii NOT NULL,
  export_id CHAR(36) CHARACTER SET ascii NOT NULL,
  event_type VARCHAR(120) NOT NULL,
  payload_json JSON NOT NULL,
  request_id VARCHAR(128) CHARACTER SET ascii NOT NULL,
  trace_id VARCHAR(128) CHARACTER SET ascii NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  PRIMARY KEY(id), KEY idx_report_export_event(export_id,occurred_at),
  CONSTRAINT fk_report_export_event FOREIGN KEY(export_id) REFERENCES report_exports(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
