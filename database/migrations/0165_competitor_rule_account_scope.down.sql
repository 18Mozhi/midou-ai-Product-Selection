CREATE TEMPORARY TABLE scoutops_competitor_rule_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_competitor_rule_guard VALUES (1);
INSERT INTO scoutops_competitor_rule_guard
SELECT 1 FROM competitor_monitor_rules q
LEFT JOIN workspaces w ON BINARY w.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(q.historical_context,'$.workspace_id'))
  AND BINARY w.organization_id=BINARY JSON_UNQUOTE(JSON_EXTRACT(q.historical_context,'$.organization_id'))
WHERE w.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_competitor_rule_guard;
ALTER TABLE competitor_monitor_rules ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE competitor_monitor_rules SET organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),
  workspace_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.workspace_id'));
ALTER TABLE competitor_monitor_rules MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL, DROP COLUMN historical_context,
  ADD KEY idx_competitor_rule_scope (organization_id,workspace_id,status,metric);
