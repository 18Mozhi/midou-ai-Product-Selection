-- Stop writers. Restore original coordinates through retained request foreign keys.
ALTER TABLE approval_node_runs ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER approval_request_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE approval_node_runs n JOIN approval_requests r ON r.id=n.approval_request_id
SET n.organization_id=r.organization_id,n.workspace_id=r.workspace_id;
ALTER TABLE approval_node_runs MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_approval_run_inbox (organization_id,workspace_id,active_approver_id,status,due_at);
ALTER TABLE approval_actions ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE approval_actions a JOIN approval_requests r ON r.id=a.approval_request_id
SET a.organization_id=r.organization_id,a.workspace_id=r.workspace_id;
ALTER TABLE approval_actions MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_approval_action_request (organization_id,workspace_id,approval_request_id,created_at);
