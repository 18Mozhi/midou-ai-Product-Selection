-- Stopped-writer historical rehearsal only. Preserve task IDs and replay lineage.
CREATE TEMPORARY TABLE scoutops_task_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_task_scope_guard VALUES (1);
INSERT INTO scoutops_task_scope_guard
SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'
  OR SUBSTRING_INDEX(VERSION(),'.',2)<>'5.7'
  OR NOT EXISTS (SELECT 1 FROM account_ownership_cutover WHERE slot='current' AND contract_version=25)
  OR EXISTS (SELECT 1 FROM information_schema.VIEWS WHERE TABLE_SCHEMA=DATABASE() AND LOWER(VIEW_DEFINITION) LIKE '%collection_tasks%');
INSERT INTO scoutops_task_scope_guard
SELECT 1 FROM collection_tasks t
JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
LEFT JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='collection_tasks' AND r.source_id=t.id
LEFT JOIN account_retirement_scopes s ON s.run_id=r.run_id AND s.legacy_org_id=r.legacy_org_id AND s.legacy_workspace_id=r.legacy_workspace_id
LEFT JOIN account_owned_records o ON o.source_table='collection_tasks' AND o.source_id=t.id
LEFT JOIN users u ON u.id=o.account_id
WHERE r.source_id IS NULL OR s.account_id IS NULL OR o.source_id IS NULL OR u.id IS NULL
  OR NOT (r.legacy_org_id<=>t.organization_id AND r.legacy_workspace_id<=>t.workspace_id)
  OR NOT (s.account_id<=>o.account_id AND s.reason<=>o.reason)
  OR (o.reason IN ('shared','unassigned') AND o.account_id<>cut.primary_account_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_task_scope_guard;
ALTER TABLE collection_tasks ADD COLUMN account_id CHAR(36) CHARACTER SET ascii NULL AFTER id;
UPDATE collection_tasks t JOIN account_owned_records o ON o.source_table='collection_tasks' AND o.source_id=t.id
SET t.account_id=o.account_id;
ALTER TABLE collection_tasks MODIFY COLUMN account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_collection_task_account_status (account_id,status,updated_at),
  ADD CONSTRAINT fk_collection_task_account FOREIGN KEY (account_id) REFERENCES users(id),
  DROP FOREIGN KEY fk_collection_task_organization, DROP FOREIGN KEY fk_collection_task_workspace,
  DROP INDEX idx_collection_task_scope_status, DROP INDEX fk_collection_task_workspace,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
