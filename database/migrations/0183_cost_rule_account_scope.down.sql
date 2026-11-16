-- Reject account-only writes and non-restorable coordinates before persistent DDL.
CREATE TEMPORARY TABLE scoutops_cost_rule_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_cost_rule_guard VALUES (1);
INSERT INTO scoutops_cost_rule_guard
SELECT 1 FROM cost_rules t LEFT JOIN workspaces w
  ON BINARY w.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(t.historical_context,'$.workspace_id'))
  AND BINARY w.organization_id=BINARY JSON_UNQUOTE(JSON_EXTRACT(t.historical_context,'$.organization_id'))
LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_retirement_scopes s ON s.run_id=c.source_run_id AND s.legacy_org_id=w.organization_id AND s.legacy_workspace_id=w.id
LEFT JOIN account_owned_records o ON o.source_table='cost_rules' AND o.source_id=t.id
WHERE w.id IS NULL OR s.account_id IS NULL OR s.account_id<>t.account_id
   OR o.account_id IS NULL OR o.account_id<>t.account_id OR o.reason<>s.reason
   OR (o.reason IN ('shared','unassigned') AND o.account_id<>c.primary_account_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_cost_rule_guard;
ALTER TABLE cost_rules ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE cost_rules SET organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),
  workspace_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.workspace_id'));
ALTER TABLE cost_rules MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_cost_rule_scope_version(organization_id,workspace_id,market,platform,version_code),
  ADD KEY idx_cost_rule_scope_status(organization_id,workspace_id,market,platform,status,effective_from),
  ADD KEY fk_cost_rule_workspace(workspace_id),
  ADD CONSTRAINT fk_cost_rule_org FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_cost_rule_workspace FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT,
  DROP FOREIGN KEY fk_cost_rule_account,DROP INDEX uq_cost_rule_account_version,DROP INDEX idx_cost_rule_account_status,
  DROP COLUMN account_id,DROP COLUMN historical_context;
