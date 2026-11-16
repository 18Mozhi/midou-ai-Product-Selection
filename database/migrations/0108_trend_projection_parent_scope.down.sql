-- Stop writers. Reconstruct scope from the retained normalized record.
ALTER TABLE trend_projection_jobs
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE trend_projection_jobs j JOIN normalized_records n ON n.id=j.normalized_record_id
SET j.organization_id=n.organization_id,j.workspace_id=n.workspace_id;
ALTER TABLE trend_projection_jobs
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_trend_projection_scope (organization_id,workspace_id,created_at),
  ADD KEY fk_trend_projection_workspace (workspace_id),
  ADD CONSTRAINT fk_trend_projection_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_trend_projection_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
