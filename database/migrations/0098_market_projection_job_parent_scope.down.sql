-- Stop writers. Restore the original coordinates from the retained job parent.
ALTER TABLE sourcing_projection_jobs ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE sourcing_projection_jobs j JOIN sourcing_searches p ON p.id=j.search_id
SET j.organization_id=p.organization_id,j.workspace_id=p.workspace_id;
ALTER TABLE sourcing_projection_jobs MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL;
ALTER TABLE competitor_snapshot_jobs ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE competitor_snapshot_jobs j JOIN competitors p ON p.id=j.competitor_id
SET j.organization_id=p.organization_id,j.workspace_id=p.workspace_id;
ALTER TABLE competitor_snapshot_jobs MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL;
