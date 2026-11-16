-- Stop writers. Rule creation and competitor events retain their original distinct parents.
DROP TEMPORARY TABLE IF EXISTS scoutops_competitor_event_scope_guard;
CREATE TEMPORARY TABLE scoutops_competitor_event_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_competitor_event_scope_guard VALUES (1);
INSERT INTO scoutops_competitor_event_scope_guard
SELECT 1 FROM competitor_events e
LEFT JOIN competitor_monitor_rules r ON e.event_type='competitor.rule.created' AND r.id=e.competitor_id
  AND r.organization_id=e.organization_id AND r.workspace_id=e.workspace_id
LEFT JOIN competitors c ON e.event_type<>'competitor.rule.created' AND c.id=e.competitor_id
  AND c.organization_id=e.organization_id AND c.workspace_id=e.workspace_id
WHERE r.id IS NULL AND c.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_competitor_event_scope_guard;
ALTER TABLE competitor_events DROP INDEX idx_competitor_event_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id,
  ADD KEY idx_competitor_event_parent_recent (competitor_id,event_type,created_at,id);
