-- Stop writers. A lease event must refer to the original run and profile.
DROP TEMPORARY TABLE IF EXISTS scoutops_crawler_lease_scope_guard;
CREATE TEMPORARY TABLE scoutops_crawler_lease_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_crawler_lease_scope_guard VALUES (1);
INSERT INTO scoutops_crawler_lease_scope_guard
SELECT 1 FROM crawler_profile_lease_events e LEFT JOIN crawler_browser_runs r ON r.id=e.run_id
WHERE r.id IS NULL OR NOT (e.crawler_profile_id <=> r.crawler_profile_id
  AND e.organization_id <=> r.organization_id AND e.workspace_id <=> r.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_crawler_lease_scope_guard;
ALTER TABLE crawler_profile_lease_events
  DROP FOREIGN KEY fk_crawler_lease_event_organization,
  DROP FOREIGN KEY fk_crawler_lease_event_workspace,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
