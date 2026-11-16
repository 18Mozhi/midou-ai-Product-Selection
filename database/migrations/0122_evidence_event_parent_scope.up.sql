-- Stop writers. Keep the original evidence and audit record, removing only duplicate scope.
DROP TEMPORARY TABLE IF EXISTS scoutops_evidence_event_parent_guard;
CREATE TEMPORARY TABLE scoutops_evidence_event_parent_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_evidence_event_parent_guard VALUES (1);
INSERT INTO scoutops_evidence_event_parent_guard
SELECT 1 FROM evidence_data_events e
LEFT JOIN raw_evidence r ON BINARY e.resource_type='raw_evidence' AND r.id=e.resource_id
LEFT JOIN browser_evidence_artifacts b ON BINARY e.resource_type='browser_evidence_artifact' AND b.id=e.resource_id
LEFT JOIN collection_tasks t ON t.id=b.collection_task_id
LEFT JOIN data_quality_issues i ON BINARY e.resource_type='data_quality_issue' AND i.id=e.resource_id
LEFT JOIN reconciliation_runs c ON BINARY e.resource_type='reconciliation_run' AND c.id=e.resource_id
WHERE NOT (e.organization_id <=> COALESCE(r.organization_id,t.organization_id,i.organization_id,c.organization_id))
   OR NOT (e.workspace_id <=> COALESCE(r.workspace_id,t.workspace_id,i.workspace_id,c.workspace_id))
LIMIT 1;
DROP TEMPORARY TABLE scoutops_evidence_event_parent_guard;
ALTER TABLE evidence_data_events DROP INDEX idx_evidence_event_scope_time,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
