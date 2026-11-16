-- Stop writers. Restore the original coordinates from the retained task.
ALTER TABLE collection_task_outbox ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER task_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE collection_task_outbox h JOIN collection_tasks t ON t.id=h.task_id
SET h.organization_id=t.organization_id,h.workspace_id=t.workspace_id;
ALTER TABLE collection_task_outbox MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_collection_outbox_scope (organization_id,workspace_id,created_at);
ALTER TABLE collection_task_events ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER task_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE collection_task_events h JOIN collection_tasks t ON t.id=h.task_id
SET h.organization_id=t.organization_id,h.workspace_id=t.workspace_id;
ALTER TABLE collection_task_events MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_collection_event_scope_time (organization_id,workspace_id,occurred_at);
