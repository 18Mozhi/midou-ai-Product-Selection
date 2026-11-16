-- Rollback only when each original task can recover its own sealed coordinates.
CREATE TEMPORARY TABLE scoutops_business_task_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_business_task_scope_guard VALUES (1);
INSERT INTO scoutops_business_task_scope_guard
SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'
  OR SUBSTRING_INDEX(VERSION(),'.',2)<>'5.7'
  OR NOT EXISTS (SELECT 1 FROM account_ownership_cutover WHERE slot='current' AND contract_version=25);
INSERT INTO scoutops_business_task_scope_guard
SELECT 1 FROM tasks t
JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
LEFT JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='tasks' AND r.source_id=t.id
LEFT JOIN account_retirement_scopes s ON s.run_id=r.run_id AND s.legacy_org_id=r.legacy_org_id AND s.legacy_workspace_id=r.legacy_workspace_id
LEFT JOIN account_owned_records o ON o.source_table='tasks' AND o.source_id=t.id
LEFT JOIN workspaces w ON w.id=r.legacy_workspace_id AND w.organization_id=r.legacy_org_id
LEFT JOIN users u ON u.id=o.account_id
WHERE r.source_id IS NULL OR s.account_id IS NULL OR o.source_id IS NULL OR w.id IS NULL OR u.id IS NULL
  OR NOT (s.account_id<=>o.account_id AND s.reason<=>o.reason)
  OR (o.reason IN ('shared','unassigned') AND o.account_id<>cut.primary_account_id)
  OR NOT (t.account_id<=>o.account_id)
LIMIT 1;
-- A native delivery cannot be replayed on a legacy task table. Preserve audit
-- and delivery history; use the pre-migration snapshot if native writes exist.
INSERT INTO scoutops_business_task_scope_guard
SELECT 1 FROM outbox_events e
WHERE e.event_type LIKE 'task.%' AND JSON_CONTAINS_PATH(e.payload_json,'one','$.task_account_contract')
LIMIT 1;
DROP TEMPORARY TABLE scoutops_business_task_scope_guard;
ALTER TABLE tasks ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE tasks t JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='tasks' AND r.source_id=t.id
SET t.organization_id=r.legacy_org_id,t.workspace_id=r.legacy_workspace_id;
ALTER TABLE tasks MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_tasks_source (organization_id,workspace_id,source_type,source_ref_id),
  ADD KEY idx_tasks_scope_status_time (organization_id,workspace_id,status,updated_at),
  ADD KEY idx_tasks_assignee_due (organization_id,workspace_id,assignee_id,due_at),
  ADD KEY idx_tasks_scope_active (organization_id,workspace_id,deleted_at,status,updated_at),
  ADD KEY idx_tasks_collection_task (organization_id,workspace_id,collection_task_id),
  ADD KEY fk_tasks_workspace (workspace_id),
  ADD CONSTRAINT fk_tasks_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_tasks_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  DROP FOREIGN KEY fk_tasks_account, DROP INDEX uq_tasks_account_source, DROP INDEX idx_tasks_account_status,
  DROP INDEX idx_tasks_account_assignee_due, DROP INDEX idx_tasks_account_active, DROP INDEX idx_tasks_account_collection_task,
  DROP COLUMN account_id;
