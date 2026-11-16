-- Stop writers. Reconstruct the old scope from the same typed resource.
ALTER TABLE evidence_data_events ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE evidence_data_events e
LEFT JOIN raw_evidence r ON BINARY e.resource_type='raw_evidence' AND r.id=e.resource_id
LEFT JOIN browser_evidence_artifacts b ON BINARY e.resource_type='browser_evidence_artifact' AND b.id=e.resource_id
LEFT JOIN collection_tasks t ON t.id=b.collection_task_id
LEFT JOIN data_quality_issues i ON BINARY e.resource_type='data_quality_issue' AND i.id=e.resource_id
LEFT JOIN reconciliation_runs c ON BINARY e.resource_type='reconciliation_run' AND c.id=e.resource_id
SET e.organization_id=COALESCE(r.organization_id,t.organization_id,i.organization_id,c.organization_id),
    e.workspace_id=COALESCE(r.workspace_id,t.workspace_id,i.workspace_id,c.workspace_id);
ALTER TABLE evidence_data_events MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_evidence_event_scope_time (organization_id,workspace_id,occurred_at);
