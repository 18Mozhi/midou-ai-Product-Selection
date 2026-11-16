ALTER TABLE competitor_outbox
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE competitor_outbox o JOIN competitor_events e ON e.id=o.id AND e.event_type=o.event_type AND e.competitor_id=o.aggregate_id
JOIN competitor_monitor_rules r ON r.id=e.competitor_id
SET o.organization_id=r.organization_id,o.workspace_id=r.workspace_id
WHERE o.event_type='competitor.rule.created';
UPDATE competitor_outbox o JOIN competitor_events e ON e.id=o.id AND e.event_type=o.event_type AND e.competitor_id=o.aggregate_id
JOIN competitors c ON c.id=e.competitor_id
SET o.organization_id=c.organization_id,o.workspace_id=c.workspace_id
WHERE o.event_type NOT IN ('competitor.rule.created','competitor.threshold.triggered');
UPDATE competitor_outbox o JOIN competitor_alerts a ON a.id=o.id AND a.competitor_id=o.aggregate_id
JOIN competitors c ON c.id=a.competitor_id
SET o.organization_id=c.organization_id,o.workspace_id=c.workspace_id
WHERE o.event_type='competitor.threshold.triggered';
ALTER TABLE competitor_outbox
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL;
