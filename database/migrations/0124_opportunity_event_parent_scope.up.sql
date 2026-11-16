-- Stop writers. A pipeline receipt points to its original opportunity.
DROP TEMPORARY TABLE IF EXISTS scoutops_opportunity_event_parent_guard;
CREATE TEMPORARY TABLE scoutops_opportunity_event_parent_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_opportunity_event_parent_guard VALUES (1);
INSERT INTO scoutops_opportunity_event_parent_guard
SELECT 1 FROM opportunity_events e
LEFT JOIN opportunities o ON BINARY e.resource_type IN ('opportunity','selection_pipeline') AND o.id=e.resource_id
LEFT JOIN cost_rules c ON BINARY e.resource_type='cost_rule' AND c.id=e.resource_id
LEFT JOIN score_rules s ON BINARY e.resource_type='score_rule' AND s.id=e.resource_id
LEFT JOIN exchange_rate_quotes x ON BINARY e.resource_type='exchange_rate' AND x.id=e.resource_id
WHERE NOT (e.organization_id <=> COALESCE(o.organization_id,c.organization_id,s.organization_id,x.organization_id))
   OR NOT (e.workspace_id <=> COALESCE(o.workspace_id,c.workspace_id,s.workspace_id,x.workspace_id))
LIMIT 1;
DROP TEMPORARY TABLE scoutops_opportunity_event_parent_guard;
ALTER TABLE opportunity_events DROP INDEX idx_opportunity_event_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id,
  ADD KEY idx_opportunity_event_resource_time (resource_type,resource_id,event_type,occurred_at);
