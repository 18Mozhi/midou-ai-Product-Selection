-- Stop writers; restore original coordinates without altering event or delivery history.
ALTER TABLE ai_analysis_events ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE ai_analysis_events e
LEFT JOIN ai_analysis_results r
  ON e.event_type IN ('ai.analysis.completed','ai.analysis.reviewed') AND r.id=e.resource_id
LEFT JOIN ai_analysis_requests q
  ON q.id=CASE WHEN e.event_type='ai.analysis.queued' THEN e.resource_id ELSE r.request_id_fk END
LEFT JOIN opportunities o ON o.id=q.opportunity_id
SET e.organization_id=o.organization_id,e.workspace_id=o.workspace_id;
ALTER TABLE ai_analysis_events MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_ai_event_scope (organization_id,workspace_id,created_at);
ALTER TABLE ai_analysis_outbox ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE ai_analysis_outbox d JOIN ai_analysis_events e ON e.id=d.id
SET d.organization_id=e.organization_id,d.workspace_id=e.workspace_id;
ALTER TABLE ai_analysis_outbox MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL;
