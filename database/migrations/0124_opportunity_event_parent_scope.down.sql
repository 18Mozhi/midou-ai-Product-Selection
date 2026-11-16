-- Stop writers. Restore coordinates from the same typed parent.
ALTER TABLE opportunity_events ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE opportunity_events e
LEFT JOIN opportunities o ON BINARY e.resource_type IN ('opportunity','selection_pipeline') AND o.id=e.resource_id
LEFT JOIN cost_rules c ON BINARY e.resource_type='cost_rule' AND c.id=e.resource_id
LEFT JOIN score_rules s ON BINARY e.resource_type='score_rule' AND s.id=e.resource_id
LEFT JOIN exchange_rate_quotes x ON BINARY e.resource_type='exchange_rate' AND x.id=e.resource_id
SET e.organization_id=COALESCE(o.organization_id,c.organization_id,s.organization_id,x.organization_id),
    e.workspace_id=COALESCE(o.workspace_id,c.workspace_id,s.workspace_id,x.workspace_id);
ALTER TABLE opportunity_events MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_opportunity_event_resource_time,
  ADD KEY idx_opportunity_event_scope (organization_id,workspace_id,resource_type,resource_id,occurred_at);
