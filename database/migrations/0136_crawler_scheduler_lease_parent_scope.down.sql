-- Stop writers. Restore nullable coordinates from the exact task or run.
ALTER TABLE crawler_scheduler_leases
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER slot_no,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE crawler_scheduler_leases l LEFT JOIN collection_tasks t ON t.id=l.task_id
LEFT JOIN crawler_browser_runs r ON r.id=l.run_id
SET l.organization_id=COALESCE(t.organization_id,r.organization_id),
    l.workspace_id=COALESCE(t.workspace_id,r.workspace_id);
ALTER TABLE crawler_scheduler_leases
  ADD KEY idx_crawler_scheduler_scope (organization_id,workspace_id,expires_at),
  ADD CONSTRAINT fk_crawler_scheduler_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_crawler_scheduler_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE RESTRICT;
