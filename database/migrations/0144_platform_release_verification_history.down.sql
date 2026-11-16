-- Forward validation proved all original legacy coordinates were NULL.
ALTER TABLE runtime_config_releases
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id,
  ADD KEY idx_config_org_status_updated (organization_id,status,updated_at);
ALTER TABLE verification_runs
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id,
  ADD KEY idx_verification_org_started (organization_id,started_at);
