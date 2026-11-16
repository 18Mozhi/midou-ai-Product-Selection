CREATE TEMPORARY TABLE scoutops_trend_rule_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_trend_rule_scope_guard VALUES (1);
INSERT INTO scoutops_trend_rule_scope_guard
SELECT 1 FROM trend_monitoring_rules r LEFT JOIN workspaces w
  ON BINARY w.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(r.historical_context,'$.workspace_id'))
  AND BINARY w.organization_id=BINARY JSON_UNQUOTE(JSON_EXTRACT(r.historical_context,'$.organization_id'))
LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_retirement_scopes s ON s.run_id=c.source_run_id AND s.legacy_org_id=w.organization_id AND s.legacy_workspace_id=w.id
LEFT JOIN account_owned_records o ON o.source_table='trend_monitoring_rules' AND o.source_id=r.id
WHERE w.id IS NULL OR s.account_id IS NULL OR s.account_id<>r.account_id OR o.account_id IS NULL OR o.account_id<>r.account_id OR o.reason<>s.reason LIMIT 1;
DROP TEMPORARY TABLE scoutops_trend_rule_scope_guard;
ALTER TABLE trend_monitoring_rules ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER account_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE trend_monitoring_rules SET organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),
  workspace_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.workspace_id'));
ALTER TABLE trend_monitoring_rules MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_trend_rule_scope_name(organization_id,workspace_id,name),
  ADD KEY idx_trend_rule_scope_status(organization_id,workspace_id,status,updated_at),
  ADD KEY fk_trend_rule_workspace(workspace_id),
  ADD CONSTRAINT fk_trend_rule_org FOREIGN KEY(organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_trend_rule_workspace FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  DROP INDEX uq_trend_rule_account_name,DROP INDEX idx_trend_rule_account_status,DROP COLUMN historical_context;
