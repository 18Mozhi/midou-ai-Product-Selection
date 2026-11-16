-- Stop writers. Reconstruct the original coordinates using the retained task FK.
ALTER TABLE collection_subqueries ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER task_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE collection_subqueries q JOIN collection_tasks t ON t.id=q.task_id
SET q.organization_id=t.organization_id,q.workspace_id=t.workspace_id;
ALTER TABLE collection_subqueries
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_collection_subquery_scope_status (organization_id,workspace_id,status),
  ADD CONSTRAINT fk_collection_subquery_organization FOREIGN KEY (organization_id) REFERENCES organizations (id),
  ADD CONSTRAINT fk_collection_subquery_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id);
