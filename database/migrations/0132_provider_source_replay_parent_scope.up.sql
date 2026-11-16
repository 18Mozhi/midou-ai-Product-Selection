-- Stop writers. Verify the original task before dropping either scope FK.
DROP TEMPORARY TABLE IF EXISTS scoutops_provider_replay_scope_guard;
CREATE TEMPORARY TABLE scoutops_provider_replay_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_provider_replay_scope_guard VALUES (1);
INSERT INTO scoutops_provider_replay_scope_guard
SELECT 1 FROM provider_source_replay_runs r LEFT JOIN collection_tasks t ON t.id=r.task_id
WHERE t.id IS NULL OR NOT (r.organization_id <=> t.organization_id AND r.workspace_id <=> t.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_provider_replay_scope_guard;
ALTER TABLE provider_source_replay_runs
  DROP FOREIGN KEY fk_provider_source_replay_org,
  DROP FOREIGN KEY fk_provider_source_replay_workspace,
  DROP INDEX idx_provider_source_replay_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
