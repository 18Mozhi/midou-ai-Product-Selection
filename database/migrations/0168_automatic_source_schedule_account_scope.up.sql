CREATE TEMPORARY TABLE scoutops_source_schedule_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_source_schedule_guard VALUES (1);
INSERT INTO scoutops_source_schedule_guard
SELECT 1 FROM automatic_source_schedules s
LEFT JOIN workspaces w ON w.id=s.workspace_id AND w.organization_id=s.organization_id
LEFT JOIN organizations o ON o.id=w.organization_id
LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_retirement_scopes m ON m.run_id=c.source_run_id AND m.legacy_org_id=s.organization_id AND m.legacy_workspace_id=s.workspace_id
LEFT JOIN collection_tasks t ON t.id=s.last_task_id
LEFT JOIN account_owned_records a ON a.source_table='collection_tasks' AND a.source_id=t.id
WHERE o.id IS NULL OR m.account_id IS NULL
  OR (m.reason IN ('shared','unassigned') AND m.account_id<>c.primary_account_id)
  OR (s.last_task_id IS NOT NULL AND (t.id IS NULL OR t.organization_id<>s.organization_id
    OR t.workspace_id<>s.workspace_id OR NOT (a.account_id <=> m.account_id)))
LIMIT 1;
DROP TEMPORARY TABLE scoutops_source_schedule_guard;
ALTER TABLE automatic_source_schedules ADD COLUMN account_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN ownership_reason ENUM('shared','unassigned','exclusive_owner') NULL AFTER account_id,
  ADD COLUMN is_enabled TINYINT(1) NULL AFTER ownership_reason,
  ADD COLUMN historical_context JSON NULL AFTER is_enabled;
UPDATE automatic_source_schedules s JOIN workspaces w ON w.id=s.workspace_id AND w.organization_id=s.organization_id
JOIN organizations o ON o.id=w.organization_id
JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
JOIN account_retirement_scopes m ON m.run_id=c.source_run_id AND m.legacy_org_id=s.organization_id AND m.legacy_workspace_id=s.workspace_id
SET s.account_id=m.account_id,s.ownership_reason=m.reason,s.is_enabled=(o.status='active' AND w.status='active'),
    s.historical_context=JSON_OBJECT('organization_id',s.organization_id,'workspace_id',s.workspace_id);
ALTER TABLE automatic_source_schedules
  MODIFY COLUMN account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN ownership_reason ENUM('shared','unassigned','exclusive_owner') NOT NULL,
  MODIFY COLUMN is_enabled TINYINT(1) NOT NULL, MODIFY COLUMN historical_context JSON NOT NULL,
  ADD KEY idx_automatic_source_schedule_account (account_id,is_enabled,next_scheduled_at),
  ADD CONSTRAINT fk_automatic_source_schedule_account FOREIGN KEY (account_id) REFERENCES users(id),
  DROP FOREIGN KEY fk_automatic_source_schedule_org, DROP FOREIGN KEY fk_automatic_source_schedule_workspace,
  DROP INDEX uq_automatic_source_schedule_scope, DROP INDEX fk_automatic_source_schedule_workspace,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
