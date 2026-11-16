-- Stop writers. Preserve every historical row; refuse to discard any real legacy scope.
DROP TEMPORARY TABLE IF EXISTS scoutops_backup_history_scope_guard;
CREATE TEMPORARY TABLE scoutops_backup_history_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_backup_history_scope_guard VALUES (1);
INSERT INTO scoutops_backup_history_scope_guard
SELECT 1 FROM backup_recovery_runs
WHERE scope_type <> 'platform' OR organization_id IS NOT NULL OR workspace_id IS NOT NULL LIMIT 1;
INSERT INTO scoutops_backup_history_scope_guard
SELECT 1 FROM backup_recovery_assets
WHERE organization_id IS NOT NULL OR workspace_id IS NOT NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_backup_history_scope_guard;
ALTER TABLE backup_recovery_runs
  DROP FOREIGN KEY fk_backup_runs_organization, DROP FOREIGN KEY fk_backup_runs_workspace,
  DROP INDEX idx_backup_runs_scope_started, DROP COLUMN organization_id, DROP COLUMN workspace_id,
  MODIFY COLUMN scope_type ENUM('platform') NOT NULL DEFAULT 'platform';
ALTER TABLE backup_recovery_assets
  DROP FOREIGN KEY fk_backup_assets_organization, DROP FOREIGN KEY fk_backup_assets_workspace,
  DROP INDEX idx_backup_assets_scope, DROP COLUMN organization_id, DROP COLUMN workspace_id;
