-- Apply after 0116 with writers stopped. Keep event/alert pairing and delivery state.
DROP TEMPORARY TABLE IF EXISTS scoutops_competitor_outbox_scope_guard;
CREATE TEMPORARY TABLE scoutops_competitor_outbox_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_competitor_outbox_scope_guard VALUES (1);
INSERT INTO scoutops_competitor_outbox_scope_guard
SELECT 1 FROM competitor_outbox o
LEFT JOIN competitor_events e ON o.event_type<>'competitor.threshold.triggered'
  AND e.id=o.id AND e.event_type=o.event_type AND e.competitor_id=o.aggregate_id
LEFT JOIN competitor_monitor_rules r ON e.event_type='competitor.rule.created' AND r.id=e.competitor_id
  AND r.organization_id=o.organization_id AND r.workspace_id=o.workspace_id
LEFT JOIN competitor_alerts a ON o.event_type='competitor.threshold.triggered'
  AND a.id=o.id AND a.competitor_id=o.aggregate_id
  AND BINARY JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.change_id'))=BINARY a.change_id
LEFT JOIN competitors c ON c.id=COALESCE(a.competitor_id,IF(e.event_type<>'competitor.rule.created',e.competitor_id,NULL))
  AND c.organization_id=o.organization_id AND c.workspace_id=o.workspace_id
WHERE r.id IS NULL AND c.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_competitor_outbox_scope_guard;
ALTER TABLE competitor_outbox DROP COLUMN organization_id, DROP COLUMN workspace_id;
