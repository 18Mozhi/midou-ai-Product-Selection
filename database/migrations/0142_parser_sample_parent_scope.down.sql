-- Restore the original coordinates from the exact task.
ALTER TABLE provider_parser_samples
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE provider_parser_samples s
JOIN browser_collection_jobs j ON j.id=s.browser_job_id AND j.provider_id=s.provider_id
JOIN collection_tasks t ON t.id=j.collection_task_id
SET s.organization_id=t.organization_id,s.workspace_id=t.workspace_id;
ALTER TABLE provider_parser_samples
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_provider_parser_sample_scope (organization_id,workspace_id,provider_id,status),
  ADD CONSTRAINT fk_provider_parser_sample_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_provider_parser_sample_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
