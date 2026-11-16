-- Stop writers. Restore the exact coordinates from the original approval request.
ALTER TABLE approval_escalation_jobs
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE approval_escalation_jobs j JOIN approval_requests r ON r.id=j.approval_request_id
SET j.organization_id=r.organization_id,j.workspace_id=r.workspace_id;
ALTER TABLE approval_escalation_jobs
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL;
