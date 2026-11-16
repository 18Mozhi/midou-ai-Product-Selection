-- Stop writers. Preserve each event's original typed resource.
DROP TEMPORARY TABLE IF EXISTS scoutops_sourcing_event_scope_guard;
CREATE TEMPORARY TABLE scoutops_sourcing_event_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_sourcing_event_scope_guard VALUES (1);
INSERT INTO scoutops_sourcing_event_scope_guard
SELECT 1 FROM sourcing_events e
LEFT JOIN sourcing_searches s ON e.event_type IN ('sourcing.search.queued','sourcing.search.refreshed','sourcing.search.deleted','sourcing.search.projected','sourcing.search.seeded_from_opportunity','sourcing.search.circuit_requeued') AND s.id=e.resource_id
LEFT JOIN sourcing_comparisons m ON e.event_type='sourcing.comparison.created' AND m.id=e.resource_id
LEFT JOIN sourcing_purchase_tasks p ON e.event_type IN ('sourcing.purchase_task.queued','sourcing.purchase_task.account_rehearsal.queued') AND p.id=e.resource_id
LEFT JOIN supplier_quotes q ON q.id=COALESCE(m.anchor_quote_id,p.quote_id,IF(e.event_type='supplier_quote.confirmed',e.resource_id,NULL))
LEFT JOIN sourcing_candidates c ON c.id=q.candidate_id
LEFT JOIN sourcing_searches qs ON qs.id=c.search_id
WHERE NOT (e.organization_id <=> COALESCE(s.organization_id,qs.organization_id))
   OR NOT (e.workspace_id <=> COALESCE(s.workspace_id,qs.workspace_id))
LIMIT 1;
DROP TEMPORARY TABLE scoutops_sourcing_event_scope_guard;
ALTER TABLE sourcing_events DROP INDEX idx_sourcing_event_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id,
  ADD KEY idx_sourcing_event_resource_recent (event_type,resource_id,created_at);
