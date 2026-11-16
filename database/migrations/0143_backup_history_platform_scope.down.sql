-- The forward guard proved that all original scope coordinates were NULL.
ALTER TABLE backup_recovery_assets
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER asset_kind,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id,
  ADD KEY idx_backup_assets_scope (organization_id,workspace_id,created_at),
  ADD CONSTRAINT fk_backup_assets_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_backup_assets_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
ALTER TABLE backup_recovery_runs
  MODIFY COLUMN scope_type ENUM('platform','organization','workspace') NOT NULL DEFAULT 'platform',
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER scope_type,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id,
  ADD KEY idx_backup_runs_scope_started (organization_id,workspace_id,started_at),
  ADD CONSTRAINT fk_backup_runs_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_backup_runs_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
