CREATE TEMPORARY TABLE scoutops_trend_rule_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_trend_rule_scope_guard VALUES (1);
INSERT INTO scoutops_trend_rule_scope_guard
SELECT 1 FROM trend_monitoring_rules r LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_owned_records o ON o.source_table='trend_monitoring_rules' AND o.source_id=r.id
LEFT JOIN account_retirement_scopes s ON s.run_id=c.source_run_id AND s.legacy_org_id=r.organization_id AND s.legacy_workspace_id=r.workspace_id
WHERE o.account_id IS NULL OR s.account_id IS NULL OR o.account_id<>r.account_id OR s.account_id<>r.account_id OR s.reason<>o.reason LIMIT 1;
INSERT INTO scoutops_trend_rule_scope_guard
SELECT 1 FROM trend_monitoring_rules GROUP BY account_id,name HAVING COUNT(*)>1 LIMIT 1;
DROP TEMPORARY TABLE scoutops_trend_rule_scope_guard;
ALTER TABLE trend_monitoring_rules ADD COLUMN historical_context JSON NULL AFTER account_id;
UPDATE trend_monitoring_rules SET historical_context=JSON_OBJECT('organization_id',organization_id,'workspace_id',workspace_id);
ALTER TABLE trend_monitoring_rules MODIFY COLUMN historical_context JSON NOT NULL,
  ADD UNIQUE KEY uq_trend_rule_account_name(account_id,name),
  ADD KEY idx_trend_rule_account_status(account_id,status,updated_at),
  DROP FOREIGN KEY fk_trend_rule_org,DROP FOREIGN KEY fk_trend_rule_workspace,
  DROP INDEX uq_trend_rule_scope_name,DROP INDEX idx_trend_rule_scope_status,DROP INDEX fk_trend_rule_workspace,
  DROP COLUMN organization_id,DROP COLUMN workspace_id;
