-- Stop writers. Verify both retained references before removing the duplicate coordinates.
DROP TEMPORARY TABLE IF EXISTS scoutops_approval_escalation_scope_guard;
CREATE TEMPORARY TABLE scoutops_approval_escalation_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_approval_escalation_scope_guard VALUES (1);
INSERT INTO scoutops_approval_escalation_scope_guard
SELECT 1 FROM approval_escalation_jobs j
LEFT JOIN approval_requests r ON r.id=j.approval_request_id
  AND r.organization_id=j.organization_id AND r.workspace_id=j.workspace_id
LEFT JOIN approval_node_runs n ON n.id=j.node_run_id AND n.approval_request_id=j.approval_request_id
WHERE r.id IS NULL OR n.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_approval_escalation_scope_guard;
ALTER TABLE approval_escalation_jobs DROP COLUMN organization_id, DROP COLUMN workspace_id;
