-- Stop writers. Reconstruct both old coordinates through the retained task FKs.
ALTER TABLE task_events ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE task_events e JOIN tasks t ON t.id=e.task_id
SET e.organization_id=t.organization_id,e.workspace_id=t.workspace_id;
ALTER TABLE task_events MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_task_events_scope_task (organization_id,workspace_id,task_id,created_at);
ALTER TABLE task_comments ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE task_comments c JOIN tasks t ON t.id=c.task_id
SET c.organization_id=t.organization_id,c.workspace_id=t.workspace_id;
ALTER TABLE task_comments MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_task_comments_task_time (organization_id,workspace_id,task_id,created_at);
