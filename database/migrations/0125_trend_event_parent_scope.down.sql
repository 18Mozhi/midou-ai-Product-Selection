-- Stop writers. Restore coordinates from the same typed parent before rolling back 0118.
ALTER TABLE trend_events ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE trend_events e
LEFT JOIN trend_topics t ON BINARY e.resource_type='trend_topic' AND t.id=e.resource_id
LEFT JOIN trend_topic_change_requests c ON BINARY e.resource_type='trend_topic_change_request' AND c.id=e.resource_id
LEFT JOIN trend_monitoring_rules r ON BINARY e.resource_type='trend_monitoring_rule' AND r.id=e.resource_id
SET e.organization_id=COALESCE(t.organization_id,c.organization_id,r.organization_id),
    e.workspace_id=COALESCE(t.workspace_id,c.workspace_id,r.workspace_id);
ALTER TABLE trend_events MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_trend_event_scope_time (organization_id,workspace_id,occurred_at);
