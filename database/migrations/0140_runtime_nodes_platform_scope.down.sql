-- The forward guard proves the original coordinates were NULL.
ALTER TABLE runtime_nodes
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id,
  ADD KEY idx_runtime_nodes_scope (organization_id,workspace_id),
  ADD CONSTRAINT fk_runtime_nodes_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_runtime_nodes_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;
ALTER TABLE runtime_node_heartbeats
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER runtime_node_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id,
  ADD KEY idx_runtime_heartbeats_scope_time (organization_id,workspace_id,observed_at),
  ADD CONSTRAINT fk_runtime_heartbeats_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_runtime_heartbeats_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;
