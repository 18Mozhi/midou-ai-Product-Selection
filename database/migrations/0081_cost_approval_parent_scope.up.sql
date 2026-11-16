-- Stop writers before running. Refuse to erase an independent or invalid legacy scope.
DROP TEMPORARY TABLE IF EXISTS scoutops_cost_approval_scope_guard;
CREATE TEMPORARY TABLE scoutops_cost_approval_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_cost_approval_scope_guard VALUES (1);
INSERT INTO scoutops_cost_approval_scope_guard
SELECT 1 FROM cost_rule_approvals a LEFT JOIN cost_rules r ON r.id=a.cost_rule_id
WHERE r.id IS NULL OR NOT (r.organization_id <=> a.organization_id)
  OR NOT (r.workspace_id <=> a.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_cost_approval_scope_guard;
ALTER TABLE cost_rule_approvals
  DROP INDEX idx_cost_rule_approval_scope,
  DROP COLUMN organization_id,
  DROP COLUMN workspace_id;
