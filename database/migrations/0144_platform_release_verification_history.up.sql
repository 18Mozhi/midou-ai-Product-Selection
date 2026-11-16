-- Stop writers. Fail before persistent DDL if any original scope must be retained.
DROP TEMPORARY TABLE IF EXISTS scoutops_release_verification_scope_guard;
CREATE TEMPORARY TABLE scoutops_release_verification_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_release_verification_scope_guard VALUES (1);
INSERT INTO scoutops_release_verification_scope_guard
SELECT 1 FROM verification_runs WHERE organization_id IS NOT NULL OR workspace_id IS NOT NULL LIMIT 1;
INSERT INTO scoutops_release_verification_scope_guard
SELECT 1 FROM runtime_config_releases WHERE organization_id IS NOT NULL OR workspace_id IS NOT NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_release_verification_scope_guard;
ALTER TABLE verification_runs
  DROP INDEX idx_verification_org_started, DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE runtime_config_releases
  DROP INDEX idx_config_org_status_updated, DROP COLUMN organization_id, DROP COLUMN workspace_id;
