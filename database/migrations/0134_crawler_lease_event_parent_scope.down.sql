-- Stop writers. Restore scope from the original run.
ALTER TABLE crawler_profile_lease_events ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER run_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE crawler_profile_lease_events e JOIN crawler_browser_runs r ON r.id=e.run_id
SET e.organization_id=r.organization_id,e.workspace_id=r.workspace_id;
ALTER TABLE crawler_profile_lease_events
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD CONSTRAINT fk_crawler_lease_event_organization FOREIGN KEY (organization_id) REFERENCES organizations (id),
  ADD CONSTRAINT fk_crawler_lease_event_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id);
