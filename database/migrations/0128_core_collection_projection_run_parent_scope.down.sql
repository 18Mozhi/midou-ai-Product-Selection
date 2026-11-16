-- Stop writers. Restore exact original coordinates from the retained task FK.
ALTER TABLE core_collection_projection_runs
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE core_collection_projection_runs r JOIN collection_tasks t ON t.id=r.collection_task_id
SET r.organization_id=t.organization_id,r.workspace_id=t.workspace_id;
ALTER TABLE core_collection_projection_runs
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD INDEX idx_core_projection_scope (organization_id,workspace_id,projection_type,status,started_at);
