-- Quiesce writers before replacing the cost rule scope.
CREATE TEMPORARY TABLE scoutops_cost_rule_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_cost_rule_guard VALUES (1);
INSERT INTO scoutops_cost_rule_guard
SELECT 1 FROM cost_rules t
LEFT JOIN workspaces w ON w.id=t.workspace_id AND w.organization_id=t.organization_id
LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_retirement_scopes s ON s.run_id=c.source_run_id AND s.legacy_org_id=t.organization_id AND s.legacy_workspace_id=t.workspace_id
LEFT JOIN account_owned_records o ON o.source_table='cost_rules' AND o.source_id=t.id
WHERE w.id IS NULL OR s.account_id IS NULL OR o.account_id IS NULL OR s.account_id<>o.account_id OR s.reason<>o.reason
   OR (o.reason IN ('shared','unassigned') AND o.account_id<>c.primary_account_id)
   OR EXISTS (
     SELECT 1 FROM cost_rules r JOIN account_owned_records p ON p.source_table='cost_rules' AND p.source_id=r.id
     WHERE p.account_id=o.account_id AND r.id<>t.id AND r.market=t.market AND r.platform=t.platform
       AND (r.version_code=t.version_code OR (r.status='active' AND t.status='active'))
   ) LIMIT 1;
DROP TEMPORARY TABLE scoutops_cost_rule_guard;
ALTER TABLE cost_rules ADD COLUMN account_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN historical_context JSON NULL AFTER account_id;
UPDATE cost_rules t JOIN account_owned_records o ON o.source_table='cost_rules' AND o.source_id=t.id
SET t.account_id=o.account_id,t.historical_context=JSON_OBJECT('organization_id',t.organization_id,'workspace_id',t.workspace_id);
ALTER TABLE cost_rules MODIFY COLUMN account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_cost_rule_account_version(account_id,market,platform,version_code),
  ADD KEY idx_cost_rule_account_status(account_id,market,platform,status,effective_from),
  ADD CONSTRAINT fk_cost_rule_account FOREIGN KEY(account_id) REFERENCES users(id) ON DELETE RESTRICT,
  DROP FOREIGN KEY fk_cost_rule_org,DROP FOREIGN KEY fk_cost_rule_workspace,
  DROP INDEX uq_cost_rule_scope_version,DROP INDEX idx_cost_rule_scope_status,DROP INDEX fk_cost_rule_workspace,
  DROP COLUMN organization_id,DROP COLUMN workspace_id;
