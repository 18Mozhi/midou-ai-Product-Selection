-- Platform-wide nodes and heartbeats have no organization or workspace owner.
-- Refuse to erase a non-null historical coordinate.
DROP TEMPORARY TABLE IF EXISTS scoutops_runtime_platform_guard;
CREATE TEMPORARY TABLE scoutops_runtime_platform_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_runtime_platform_guard VALUES (1);
INSERT INTO scoutops_runtime_platform_guard
SELECT 1 FROM runtime_nodes WHERE organization_id IS NOT NULL OR workspace_id IS NOT NULL LIMIT 1;
INSERT INTO scoutops_runtime_platform_guard
SELECT 1 FROM runtime_node_heartbeats WHERE organization_id IS NOT NULL OR workspace_id IS NOT NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_runtime_platform_guard;
ALTER TABLE runtime_node_heartbeats
  DROP FOREIGN KEY fk_runtime_heartbeats_organization, DROP FOREIGN KEY fk_runtime_heartbeats_workspace,
  DROP INDEX idx_runtime_heartbeats_scope_time, DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE runtime_nodes
  DROP FOREIGN KEY fk_runtime_nodes_organization, DROP FOREIGN KEY fk_runtime_nodes_workspace,
  DROP INDEX idx_runtime_nodes_scope, DROP COLUMN organization_id, DROP COLUMN workspace_id;
