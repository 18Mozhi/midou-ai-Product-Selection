-- Stop writers. The original task restores both columns and the scope constraints.
ALTER TABLE provider_source_replay_runs ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE provider_source_replay_runs r JOIN collection_tasks t ON t.id=r.task_id
SET r.organization_id=t.organization_id,r.workspace_id=t.workspace_id;
ALTER TABLE provider_source_replay_runs
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD INDEX idx_provider_source_replay_scope (organization_id,workspace_id,created_at),
  ADD CONSTRAINT fk_provider_source_replay_org FOREIGN KEY (organization_id) REFERENCES organizations (id),
  ADD CONSTRAINT fk_provider_source_replay_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id);
