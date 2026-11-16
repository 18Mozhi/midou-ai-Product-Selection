-- Stop writers. Restore the original coordinates from the exact request.
ALTER TABLE ai_analysis_results ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE ai_analysis_results r JOIN ai_analysis_requests q ON q.id=r.request_id_fk
SET r.organization_id=q.organization_id,r.workspace_id=q.workspace_id;
ALTER TABLE ai_analysis_results MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_ai_result_scope (organization_id,workspace_id,opportunity_id,created_at);
ALTER TABLE ai_analysis_reviews ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE ai_analysis_reviews v JOIN ai_analysis_results r ON r.id=v.result_id
SET v.organization_id=r.organization_id,v.workspace_id=r.workspace_id;
ALTER TABLE ai_analysis_reviews MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_ai_review_scope (organization_id,workspace_id,created_at);
