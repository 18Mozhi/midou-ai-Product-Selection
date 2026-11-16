-- Stop writers. Restore coordinates using the preserved opportunity foreign key.
ALTER TABLE ai_analysis_requests ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE ai_analysis_requests q JOIN opportunities o ON o.id=q.opportunity_id
SET q.organization_id=o.organization_id,q.workspace_id=o.workspace_id;
ALTER TABLE ai_analysis_requests MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_ai_request_opportunity_time,
  ADD KEY idx_ai_request_scope (organization_id,workspace_id,opportunity_id,created_at);
