-- Stop writers. Restore original coordinates from the retained task FK.
ALTER TABLE browser_collection_jobs ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE browser_collection_jobs j JOIN collection_tasks t ON t.id=j.collection_task_id
SET j.organization_id=t.organization_id,j.workspace_id=t.workspace_id;
ALTER TABLE browser_collection_jobs
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_browser_collection_scope (organization_id,workspace_id,updated_at),
  ADD CONSTRAINT fk_browser_collection_organization FOREIGN KEY (organization_id) REFERENCES organizations (id),
  ADD CONSTRAINT fk_browser_collection_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id);
