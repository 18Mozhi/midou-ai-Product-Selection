-- Stop writers before running. The parent FK guarantees one source for both restored fields.
ALTER TABLE cost_rule_approvals
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE cost_rule_approvals a JOIN cost_rules r ON r.id=a.cost_rule_id
SET a.organization_id=r.organization_id,a.workspace_id=r.workspace_id;
ALTER TABLE cost_rule_approvals
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD INDEX idx_cost_rule_approval_scope (organization_id,workspace_id,cost_rule_id,created_at);
