-- Refuse rollback before DDL if a task has no exact historical coordinates.
CREATE TEMPORARY TABLE scoutops_task_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_task_scope_guard VALUES (1);
INSERT INTO scoutops_task_scope_guard
SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'
  OR SUBSTRING_INDEX(VERSION(),'.',2)<>'5.7'
  OR NOT EXISTS (SELECT 1 FROM account_ownership_cutover WHERE slot='current' AND contract_version=25);
INSERT INTO scoutops_task_scope_guard
SELECT 1 FROM collection_tasks t
JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
LEFT JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='collection_tasks' AND r.source_id=t.id
LEFT JOIN account_retirement_scopes s ON s.run_id=r.run_id AND s.legacy_org_id=r.legacy_org_id AND s.legacy_workspace_id=r.legacy_workspace_id
LEFT JOIN account_owned_records o ON o.source_table='collection_tasks' AND o.source_id=t.id
LEFT JOIN workspaces w ON w.id=r.legacy_workspace_id AND w.organization_id=r.legacy_org_id
LEFT JOIN organizations g ON g.id=r.legacy_org_id
WHERE r.source_id IS NULL OR s.account_id IS NULL OR o.source_id IS NULL OR w.id IS NULL OR g.id IS NULL
  OR NOT (t.account_id<=>o.account_id AND t.account_id<=>s.account_id AND o.reason<=>s.reason)
  OR (o.reason IN ('shared','unassigned') AND o.account_id<>cut.primary_account_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_task_scope_guard;
ALTER TABLE collection_tasks ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE collection_tasks t
JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='collection_tasks' AND r.source_id=t.id
SET t.organization_id=r.legacy_org_id,t.workspace_id=r.legacy_workspace_id;
ALTER TABLE collection_tasks MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_collection_task_scope_status (organization_id,workspace_id,status,updated_at),
  ADD KEY fk_collection_task_workspace (workspace_id),
  ADD CONSTRAINT fk_collection_task_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_collection_task_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  DROP FOREIGN KEY fk_collection_task_account, DROP INDEX idx_collection_task_account_status, DROP COLUMN account_id;
