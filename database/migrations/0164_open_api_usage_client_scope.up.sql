-- Stop writers. A usage row may lose its duplicate scope only if its client agrees.
DROP TEMPORARY TABLE IF EXISTS scoutops_open_api_usage_guard;
CREATE TEMPORARY TABLE scoutops_open_api_usage_guard (id INT PRIMARY KEY);
INSERT INTO scoutops_open_api_usage_guard VALUES (1);
INSERT INTO scoutops_open_api_usage_guard
SELECT 1 FROM open_api_usage u LEFT JOIN platform_api_clients c ON c.id=u.client_id
WHERE c.id IS NULL OR NOT (u.organization_id <=> c.organization_id) LIMIT 1;
DROP TEMPORARY TABLE scoutops_open_api_usage_guard;
ALTER TABLE open_api_usage DROP FOREIGN KEY fk_open_usage_org,
  DROP INDEX idx_open_usage_org_time, DROP COLUMN organization_id;
