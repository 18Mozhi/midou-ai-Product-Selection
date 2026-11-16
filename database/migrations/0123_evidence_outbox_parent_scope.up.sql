-- Stop writers. 0122 verified event scope; do not choose a single event where history is ambiguous.
DROP TEMPORARY TABLE IF EXISTS scoutops_evidence_delivery_scope_guard;
CREATE TEMPORARY TABLE scoutops_evidence_delivery_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_evidence_delivery_scope_guard VALUES (1);
INSERT INTO scoutops_evidence_delivery_scope_guard
SELECT 1 FROM evidence_data_outbox o
LEFT JOIN raw_evidence r ON BINARY o.resource_type='raw_evidence' AND r.id=o.resource_id
LEFT JOIN browser_evidence_artifacts b ON BINARY o.resource_type='browser_evidence_artifact' AND b.id=o.resource_id
LEFT JOIN collection_tasks t ON t.id=b.collection_task_id
LEFT JOIN data_quality_issues i ON BINARY o.resource_type='data_quality_issue' AND i.id=o.resource_id
LEFT JOIN reconciliation_runs c ON BINARY o.resource_type='reconciliation_run' AND c.id=o.resource_id
WHERE NOT (o.organization_id <=> COALESCE(r.organization_id,t.organization_id,i.organization_id,c.organization_id))
   OR NOT (o.workspace_id <=> COALESCE(r.workspace_id,t.workspace_id,i.workspace_id,c.workspace_id))
   OR NOT EXISTS (
     SELECT 1 FROM evidence_data_events e
     WHERE e.resource_type=o.resource_type AND e.resource_id=o.resource_id
       AND e.event_type=o.event_type AND e.request_id=o.request_id AND e.trace_id=o.trace_id
       AND BINARY e.resource_type=BINARY o.resource_type AND BINARY e.resource_id=BINARY o.resource_id
       AND BINARY e.event_type=BINARY o.event_type AND BINARY e.request_id=BINARY o.request_id
       AND BINARY e.trace_id=BINARY o.trace_id
   )
LIMIT 1;
DROP TEMPORARY TABLE scoutops_evidence_delivery_scope_guard;
ALTER TABLE evidence_data_outbox DROP INDEX idx_evidence_outbox_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
