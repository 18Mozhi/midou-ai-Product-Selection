-- Keep approval IDs, actors, decisions and event history; replace only the live role.
ALTER TABLE cost_rule_approvals
  MODIFY COLUMN approval_role ENUM('selection_manager','organization_admin','primary_account') NOT NULL;
UPDATE cost_rule_approvals SET approval_role='primary_account' WHERE approval_role='organization_admin';
ALTER TABLE cost_rule_approvals
  MODIFY COLUMN approval_role ENUM('selection_manager','primary_account') NOT NULL;
