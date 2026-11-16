ALTER TABLE automation_executions
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE automation_executions x JOIN automation_rules r ON r.id=x.rule_id
SET x.organization_id=r.organization_id,x.workspace_id=r.workspace_id;
ALTER TABLE automation_executions
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_automation_execution_rule_recent, DROP INDEX idx_automation_execution_rule_limit,
  ADD KEY idx_automation_execution_scope (organization_id,workspace_id,rule_id,updated_at);
