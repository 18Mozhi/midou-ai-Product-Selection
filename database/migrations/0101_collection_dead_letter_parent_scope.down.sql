-- Stop writers. Restore coordinates from the retained collection task.
ALTER TABLE collection_dead_letters
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER attempt_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE collection_dead_letters d JOIN collection_tasks t ON t.id=d.task_id
SET d.organization_id=t.organization_id,d.workspace_id=t.workspace_id;
ALTER TABLE collection_dead_letters
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_collection_dead_created,
  ADD KEY idx_collection_dead_scope_status (organization_id,workspace_id,status,created_at),
  ADD CONSTRAINT fk_collection_dead_organization FOREIGN KEY (organization_id) REFERENCES organizations (id),
  ADD CONSTRAINT fk_collection_dead_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id);
