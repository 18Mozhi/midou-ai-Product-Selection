ALTER TABLE approval_requests
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE approval_requests r JOIN approval_templates t ON t.id=r.template_id
SET r.organization_id=t.organization_id,r.workspace_id=t.workspace_id;
ALTER TABLE approval_requests
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_approval_request_status, DROP INDEX idx_approval_request_target,
  ADD KEY idx_approval_request_scope_status (organization_id,workspace_id,status,updated_at),
  ADD KEY idx_approval_request_resource (organization_id,workspace_id,resource_type,resource_id);
