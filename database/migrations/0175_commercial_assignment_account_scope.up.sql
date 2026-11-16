CREATE TEMPORARY TABLE scoutops_commercial_assignment_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_commercial_assignment_guard VALUES (1);
INSERT INTO scoutops_commercial_assignment_guard
SELECT 1 FROM organization_plan_assignments e LEFT JOIN organizations o ON o.id=e.organization_id
LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_retirement_scopes m ON m.run_id=c.source_run_id AND m.legacy_org_id=o.id
WHERE o.id IS NULL OR m.account_id IS NULL OR NOT (m.reason='exclusive_owner' OR (m.reason IN ('shared','unassigned') AND m.account_id=c.primary_account_id))
  OR EXISTS (SELECT 1 FROM account_retirement_scopes alt WHERE alt.run_id=m.run_id
    AND alt.legacy_org_id=m.legacy_org_id AND alt.account_id<>m.account_id)
  OR EXISTS (SELECT 1 FROM organization_plan_assignments other_assignment
    JOIN account_retirement_scopes other_scope ON other_scope.legacy_org_id=other_assignment.organization_id
    WHERE other_scope.run_id=m.run_id AND other_scope.account_id=m.account_id AND other_assignment.id<>e.id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_commercial_assignment_guard;
ALTER TABLE organization_plan_assignments ADD COLUMN account_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN historical_context JSON NULL AFTER account_id;
UPDATE organization_plan_assignments e JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
JOIN account_retirement_scopes m ON m.run_id=c.source_run_id AND m.legacy_org_id=e.organization_id
SET e.account_id=m.account_id,e.historical_context=JSON_OBJECT('organization_id',e.organization_id);
ALTER TABLE organization_plan_assignments MODIFY COLUMN account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN historical_context JSON NOT NULL,
  ADD UNIQUE KEY uq_commercial_assignment_account (account_id),
  ADD CONSTRAINT fk_commercial_assignment_account FOREIGN KEY (account_id) REFERENCES users(id) ON DELETE RESTRICT,
  DROP FOREIGN KEY fk_org_plan_org, DROP INDEX uq_org_plan_assignment, DROP COLUMN organization_id;
