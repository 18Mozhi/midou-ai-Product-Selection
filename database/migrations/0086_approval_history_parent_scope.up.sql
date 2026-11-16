-- Stop writers. Verify both child tables before the first ALTER.
DROP TEMPORARY TABLE IF EXISTS scoutops_approval_history_scope_guard;
CREATE TEMPORARY TABLE scoutops_approval_history_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_approval_history_scope_guard VALUES (1);
INSERT INTO scoutops_approval_history_scope_guard
SELECT 1 FROM approval_node_runs n LEFT JOIN approval_requests r ON r.id=n.approval_request_id
WHERE r.id IS NULL OR NOT (r.organization_id <=> n.organization_id AND r.workspace_id <=> n.workspace_id)
LIMIT 1;
INSERT INTO scoutops_approval_history_scope_guard
SELECT 1 FROM approval_actions a LEFT JOIN approval_requests r ON r.id=a.approval_request_id
LEFT JOIN approval_node_runs n ON n.id=a.node_run_id AND n.approval_request_id=r.id
WHERE r.id IS NULL OR n.id IS NULL
  OR NOT (r.organization_id <=> a.organization_id AND r.workspace_id <=> a.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_approval_history_scope_guard;
ALTER TABLE approval_actions DROP INDEX idx_approval_action_request,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE approval_node_runs DROP INDEX idx_approval_run_inbox,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
