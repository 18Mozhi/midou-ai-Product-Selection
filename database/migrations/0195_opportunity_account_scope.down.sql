-- Restore each sealed historical coordinate. Reject collisions before DDL.
CREATE TEMPORARY TABLE scoutops_opportunity_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_opportunity_scope_guard VALUES (1);
INSERT INTO scoutops_opportunity_scope_guard
SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'
  OR SUBSTRING_INDEX(VERSION(),'.',2)<>'5.7'
  OR NOT EXISTS (SELECT 1 FROM account_ownership_cutover WHERE slot='current' AND contract_version=25);
INSERT INTO scoutops_opportunity_scope_guard
SELECT 1 FROM opportunities t
JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
LEFT JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='opportunities' AND r.source_id=t.id
LEFT JOIN account_retirement_scopes s ON s.run_id=r.run_id AND s.legacy_org_id=r.legacy_org_id AND s.legacy_workspace_id=r.legacy_workspace_id
LEFT JOIN account_owned_records o ON o.source_table='opportunities' AND o.source_id=t.id
LEFT JOIN workspaces w ON w.id=r.legacy_workspace_id AND w.organization_id=r.legacy_org_id
LEFT JOIN users u ON u.id=o.account_id
WHERE r.source_id IS NULL OR s.account_id IS NULL OR o.source_id IS NULL OR w.id IS NULL OR u.id IS NULL
  OR NOT (s.account_id<=>o.account_id AND s.reason<=>o.reason)
  OR (o.reason IN ('shared','unassigned') AND o.account_id<>cut.primary_account_id)
  OR NOT (t.account_id<=>o.account_id)
LIMIT 1;
INSERT INTO scoutops_opportunity_scope_guard
SELECT 1 FROM opportunities t JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='opportunities' AND r.source_id=t.id
WHERE t.source_ref_id IS NOT NULL
GROUP BY r.legacy_org_id,r.legacy_workspace_id,t.source_type,t.source_ref_id HAVING COUNT(*)>1
LIMIT 1;
DROP TEMPORARY TABLE scoutops_opportunity_scope_guard;
ALTER TABLE opportunities ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE opportunities t JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='opportunities' AND r.source_id=t.id
SET t.organization_id=r.legacy_org_id,t.workspace_id=r.legacy_workspace_id;
ALTER TABLE opportunities MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_opportunity_source (organization_id,workspace_id,source_type,source_ref_id),
  ADD KEY idx_opportunity_scope_updated (organization_id,workspace_id,updated_at,id),
  ADD KEY idx_opportunity_scope_decision (organization_id,workspace_id,decision_status,updated_at),
  ADD KEY idx_opportunity_scope_lifecycle_age (organization_id,workspace_id,lifecycle_status,lifecycle_entered_at),
  ADD KEY fk_opportunity_workspace (workspace_id),
  ADD CONSTRAINT fk_opportunity_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_opportunity_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  DROP FOREIGN KEY fk_opportunity_account,
  DROP INDEX uq_opportunity_account_source, DROP INDEX idx_opportunity_account_updated,
  DROP INDEX idx_opportunity_account_decision, DROP INDEX idx_opportunity_account_lifecycle_age,
  DROP COLUMN account_id;
