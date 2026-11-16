-- Stop writers. Reconstruct the former coordinates from the task, not the evidence creator.
ALTER TABLE collection_task_evidence_links
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE collection_task_evidence_links l JOIN collection_tasks t ON t.id=l.collection_task_id
SET l.organization_id=t.organization_id,l.workspace_id=t.workspace_id;
ALTER TABLE collection_task_evidence_links
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_collection_task_evidence_task_time,
  ADD KEY idx_collection_task_evidence_scope (organization_id,workspace_id,collection_task_id,created_at),
  ADD KEY fk_collection_task_evidence_workspace (workspace_id),
  ADD CONSTRAINT fk_collection_task_evidence_organization FOREIGN KEY (organization_id) REFERENCES organizations (id),
  ADD CONSTRAINT fk_collection_task_evidence_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id);
