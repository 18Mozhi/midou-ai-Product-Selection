-- The forward guard proves the original coordinates were NULL.
ALTER TABLE file_resilience_observations
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id,
  ADD KEY idx_file_resilience_scope_time (organization_id,workspace_id,observed_at),
  ADD CONSTRAINT fk_file_resilience_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_file_resilience_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;
ALTER TABLE mysql_resilience_observations
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id,
  ADD KEY idx_mysql_resilience_scope_time (organization_id,workspace_id,observed_at),
  ADD CONSTRAINT fk_mysql_resilience_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_mysql_resilience_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;
ALTER TABLE redis_resilience_observations
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id,
  ADD KEY idx_redis_resilience_scope_time (organization_id,workspace_id,observed_at),
  ADD CONSTRAINT fk_redis_resilience_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_redis_resilience_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;
ALTER TABLE load_balancer_observations
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id,
  ADD KEY idx_load_balancer_scope_time (organization_id,workspace_id,observed_at),
  ADD CONSTRAINT fk_load_balancer_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_load_balancer_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;
