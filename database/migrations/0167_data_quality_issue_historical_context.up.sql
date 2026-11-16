CREATE TEMPORARY TABLE scoutops_quality_issue_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_quality_issue_guard VALUES (1);
INSERT INTO scoutops_quality_issue_guard
SELECT 1 FROM data_quality_issues q
LEFT JOIN workspaces w ON w.id=q.workspace_id AND w.organization_id=q.organization_id
LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_retirement_records r ON r.run_id=c.source_run_id AND r.source_table='data_quality_issues' AND r.source_id=q.id
LEFT JOIN account_retirement_scopes s ON s.run_id=r.run_id AND s.legacy_org_id=r.legacy_org_id AND s.legacy_workspace_id=r.legacy_workspace_id
LEFT JOIN account_owned_records a ON a.source_table=r.source_table AND a.source_id=r.source_id
  AND a.account_id=s.account_id AND a.reason=s.reason
WHERE w.id IS NULL OR a.source_id IS NULL OR BINARY r.legacy_org_id<>BINARY q.organization_id
  OR BINARY r.legacy_workspace_id<>BINARY q.workspace_id
  OR (a.reason IN ('shared','unassigned') AND a.account_id<>c.primary_account_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_quality_issue_guard;
ALTER TABLE data_quality_issues ADD COLUMN historical_context JSON NULL AFTER id;
UPDATE data_quality_issues SET historical_context=JSON_OBJECT('organization_id',organization_id,'workspace_id',workspace_id);
ALTER TABLE data_quality_issues MODIFY COLUMN historical_context JSON NOT NULL,
  DROP FOREIGN KEY fk_quality_issue_organization, DROP FOREIGN KEY fk_quality_issue_workspace,
  DROP INDEX idx_quality_issue_scope_status, DROP INDEX fk_quality_issue_workspace,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
