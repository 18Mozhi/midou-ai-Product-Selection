CREATE TEMPORARY TABLE scoutops_commercial_assignment_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_commercial_assignment_guard VALUES (1);
INSERT INTO scoutops_commercial_assignment_guard
SELECT 1 FROM organization_plan_assignments e LEFT JOIN organizations o
  ON BINARY o.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(e.historical_context,'$.organization_id'))
LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_retirement_scopes m ON m.run_id=c.source_run_id AND m.legacy_org_id=o.id
WHERE o.id IS NULL OR m.account_id IS NULL OR m.account_id<>e.account_id OR NOT (m.reason='exclusive_owner' OR (m.reason IN ('shared','unassigned') AND m.account_id=c.primary_account_id))
  OR EXISTS (SELECT 1 FROM account_retirement_scopes alt WHERE alt.run_id=m.run_id
    AND alt.legacy_org_id=m.legacy_org_id AND alt.account_id<>m.account_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_commercial_assignment_guard;
ALTER TABLE organization_plan_assignments ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id;
UPDATE organization_plan_assignments SET organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id'));
ALTER TABLE organization_plan_assignments MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_org_plan_assignment (organization_id),
  ADD CONSTRAINT fk_org_plan_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  DROP FOREIGN KEY fk_commercial_assignment_account, DROP INDEX uq_commercial_assignment_account,
  DROP COLUMN account_id, DROP COLUMN historical_context;
