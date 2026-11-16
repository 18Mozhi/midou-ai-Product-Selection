CREATE TEMPORARY TABLE scoutops_source_schedule_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_source_schedule_guard VALUES (1);
INSERT INTO scoutops_source_schedule_guard
SELECT 1 FROM automatic_source_schedules r LEFT JOIN workspaces w
  ON BINARY w.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(r.historical_context,'$.workspace_id'))
  AND BINARY w.organization_id=BINARY JSON_UNQUOTE(JSON_EXTRACT(r.historical_context,'$.organization_id'))
LEFT JOIN organizations o ON o.id=w.organization_id
LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_retirement_scopes m ON m.run_id=c.source_run_id AND m.legacy_org_id=w.organization_id AND m.legacy_workspace_id=w.id
LEFT JOIN collection_tasks t ON t.id=r.last_task_id
LEFT JOIN automatic_source_schedules duplicate_scope ON duplicate_scope.id<r.id
  AND BINARY JSON_UNQUOTE(JSON_EXTRACT(duplicate_scope.historical_context,'$.workspace_id'))=BINARY w.id
  AND BINARY JSON_UNQUOTE(JSON_EXTRACT(duplicate_scope.historical_context,'$.organization_id'))=BINARY w.organization_id
WHERE w.id IS NULL OR duplicate_scope.id IS NOT NULL
  OR NOT (r.account_id <=> m.account_id AND r.ownership_reason <=> m.reason)
  OR r.is_enabled<>(o.status='active' AND w.status='active')
  OR (r.last_task_id IS NOT NULL AND (t.id IS NULL OR t.organization_id<>w.organization_id OR t.workspace_id<>w.id))
LIMIT 1;
DROP TEMPORARY TABLE scoutops_source_schedule_guard;
ALTER TABLE automatic_source_schedules ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE automatic_source_schedules SET organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),
  workspace_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.workspace_id'));
ALTER TABLE automatic_source_schedules
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_automatic_source_schedule_scope (organization_id,workspace_id),
  ADD KEY fk_automatic_source_schedule_workspace (workspace_id),
  ADD CONSTRAINT fk_automatic_source_schedule_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_automatic_source_schedule_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  DROP FOREIGN KEY fk_automatic_source_schedule_account, DROP INDEX idx_automatic_source_schedule_account,
  DROP COLUMN account_id, DROP COLUMN ownership_reason, DROP COLUMN is_enabled, DROP COLUMN historical_context;
