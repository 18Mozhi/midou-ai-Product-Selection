-- Stop writers. Materialize only the sealed, independently staged owner of every original rule.
DROP TEMPORARY TABLE IF EXISTS scoutops_trend_rule_account_guard;
CREATE TEMPORARY TABLE scoutops_trend_rule_account_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_trend_rule_account_guard VALUES (1);
INSERT INTO scoutops_trend_rule_account_guard
SELECT 1 FROM trend_monitoring_rules r
LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_owned_records o ON o.source_table='trend_monitoring_rules' AND o.source_id=r.id
LEFT JOIN account_retirement_records rr ON rr.run_id=c.source_run_id
  AND rr.source_table='trend_monitoring_rules' AND rr.source_id=r.id
LEFT JOIN account_retirement_scopes s ON s.run_id=rr.run_id
  AND s.legacy_org_id=rr.legacy_org_id AND s.legacy_workspace_id=rr.legacy_workspace_id
LEFT JOIN users u ON u.id=o.account_id
WHERE c.slot IS NULL OR o.account_id IS NULL OR s.account_id IS NULL OR u.id IS NULL
   OR NOT (r.organization_id <=> rr.legacy_org_id AND r.workspace_id <=> rr.legacy_workspace_id)
   OR NOT (s.account_id <=> o.account_id AND s.reason <=> o.reason)
   OR (o.reason IN ('shared','unassigned') AND NOT (o.account_id <=> c.primary_account_id))
LIMIT 1;
DROP TEMPORARY TABLE scoutops_trend_rule_account_guard;
ALTER TABLE trend_monitoring_rules ADD COLUMN account_id CHAR(36) CHARACTER SET ascii NULL AFTER id;
UPDATE trend_monitoring_rules r
JOIN account_owned_records o ON o.source_table='trend_monitoring_rules' AND o.source_id=r.id
SET r.account_id=o.account_id;
ALTER TABLE trend_monitoring_rules MODIFY COLUMN account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_trend_rule_account_updated (account_id,updated_at,id),
  ADD CONSTRAINT fk_trend_rule_account FOREIGN KEY (account_id) REFERENCES users(id) ON DELETE RESTRICT;
