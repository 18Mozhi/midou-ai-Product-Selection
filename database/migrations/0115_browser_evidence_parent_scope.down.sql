ALTER TABLE browser_evidence_artifacts
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE browser_evidence_artifacts a JOIN collection_tasks t ON t.id=a.collection_task_id
SET a.organization_id=t.organization_id,a.workspace_id=t.workspace_id;
ALTER TABLE browser_evidence_artifacts
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_browser_evidence_scope (organization_id,workspace_id,captured_at),
  ADD KEY fk_browser_evidence_workspace (workspace_id),
  ADD CONSTRAINT fk_browser_evidence_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_browser_evidence_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
