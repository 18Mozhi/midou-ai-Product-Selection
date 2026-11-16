CREATE TEMPORARY TABLE scoutops_competitor_rule_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_competitor_rule_guard VALUES (1);
INSERT INTO scoutops_competitor_rule_guard
SELECT 1 FROM competitor_monitor_rules q
LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_retirement_records r ON r.run_id=c.source_run_id AND r.source_table='competitor_monitor_rules' AND r.source_id=q.id
LEFT JOIN account_retirement_scopes s ON s.run_id=r.run_id AND s.legacy_org_id=r.legacy_org_id AND s.legacy_workspace_id=r.legacy_workspace_id
LEFT JOIN account_owned_records a ON a.source_table=r.source_table AND a.source_id=r.source_id AND a.account_id=s.account_id AND a.reason=s.reason
WHERE a.source_id IS NULL OR NOT (BINARY r.legacy_org_id <=> BINARY q.organization_id AND BINARY r.legacy_workspace_id <=> BINARY q.workspace_id)
  OR (a.reason IN ('shared','unassigned') AND a.account_id<>c.primary_account_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_competitor_rule_guard;
ALTER TABLE competitor_monitor_rules ADD COLUMN historical_context JSON NULL AFTER id;
UPDATE competitor_monitor_rules SET historical_context=JSON_OBJECT('organization_id',organization_id,'workspace_id',workspace_id);
ALTER TABLE competitor_monitor_rules MODIFY COLUMN historical_context JSON NOT NULL,
  DROP INDEX idx_competitor_rule_scope, DROP COLUMN organization_id, DROP COLUMN workspace_id;
