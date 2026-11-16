-- Stop writers. Preserve every event and its typed original resource.
DROP TEMPORARY TABLE IF EXISTS scoutops_trend_event_parent_guard;
CREATE TEMPORARY TABLE scoutops_trend_event_parent_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_trend_event_parent_guard VALUES (1);
INSERT INTO scoutops_trend_event_parent_guard
SELECT 1 FROM trend_events e
LEFT JOIN trend_topics t ON BINARY e.resource_type='trend_topic' AND t.id=e.resource_id
LEFT JOIN trend_topic_change_requests c ON BINARY e.resource_type='trend_topic_change_request' AND c.id=e.resource_id
LEFT JOIN trend_monitoring_rules r ON BINARY e.resource_type='trend_monitoring_rule' AND r.id=e.resource_id
WHERE NOT (e.organization_id <=> COALESCE(t.organization_id,c.organization_id,r.organization_id))
   OR NOT (e.workspace_id <=> COALESCE(t.workspace_id,c.workspace_id,r.workspace_id))
LIMIT 1;
DROP TEMPORARY TABLE scoutops_trend_event_parent_guard;
ALTER TABLE trend_events DROP INDEX idx_trend_event_scope_time,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
