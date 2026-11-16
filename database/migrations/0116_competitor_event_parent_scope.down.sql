ALTER TABLE competitor_events
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE competitor_events e JOIN competitor_monitor_rules r ON r.id=e.competitor_id
SET e.organization_id=r.organization_id,e.workspace_id=r.workspace_id
WHERE e.event_type='competitor.rule.created';
UPDATE competitor_events e JOIN competitors c ON c.id=e.competitor_id
SET e.organization_id=c.organization_id,e.workspace_id=c.workspace_id
WHERE e.event_type<>'competitor.rule.created';
ALTER TABLE competitor_events
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_competitor_event_parent_recent,
  ADD KEY idx_competitor_event_scope (organization_id,workspace_id,competitor_id,created_at);
