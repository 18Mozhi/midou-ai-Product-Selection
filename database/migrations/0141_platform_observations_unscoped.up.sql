-- Freeze writers. Do not erase any non-null historical coordinates.
DROP TEMPORARY TABLE IF EXISTS scoutops_platform_observation_guard;
CREATE TEMPORARY TABLE scoutops_platform_observation_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_platform_observation_guard VALUES (1);
INSERT INTO scoutops_platform_observation_guard
SELECT 1 FROM load_balancer_observations WHERE organization_id IS NOT NULL OR workspace_id IS NOT NULL LIMIT 1;
INSERT INTO scoutops_platform_observation_guard
SELECT 1 FROM redis_resilience_observations WHERE organization_id IS NOT NULL OR workspace_id IS NOT NULL LIMIT 1;
INSERT INTO scoutops_platform_observation_guard
SELECT 1 FROM mysql_resilience_observations WHERE organization_id IS NOT NULL OR workspace_id IS NOT NULL LIMIT 1;
INSERT INTO scoutops_platform_observation_guard
SELECT 1 FROM file_resilience_observations WHERE organization_id IS NOT NULL OR workspace_id IS NOT NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_platform_observation_guard;
ALTER TABLE load_balancer_observations
  DROP FOREIGN KEY fk_load_balancer_organization, DROP FOREIGN KEY fk_load_balancer_workspace,
  DROP INDEX idx_load_balancer_scope_time, DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE redis_resilience_observations
  DROP FOREIGN KEY fk_redis_resilience_organization, DROP FOREIGN KEY fk_redis_resilience_workspace,
  DROP INDEX idx_redis_resilience_scope_time, DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE mysql_resilience_observations
  DROP FOREIGN KEY fk_mysql_resilience_organization, DROP FOREIGN KEY fk_mysql_resilience_workspace,
  DROP INDEX idx_mysql_resilience_scope_time, DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE file_resilience_observations
  DROP FOREIGN KEY fk_file_resilience_organization, DROP FOREIGN KEY fk_file_resilience_workspace,
  DROP INDEX idx_file_resilience_scope_time, DROP COLUMN organization_id, DROP COLUMN workspace_id;
