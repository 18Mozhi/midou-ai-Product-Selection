ALTER TABLE cost_rule_approvals
  MODIFY COLUMN approval_role ENUM('selection_manager','primary_account','organization_admin') NOT NULL;
UPDATE cost_rule_approvals SET approval_role='organization_admin' WHERE approval_role='primary_account';
ALTER TABLE cost_rule_approvals
  MODIFY COLUMN approval_role ENUM('selection_manager','organization_admin') NOT NULL;
