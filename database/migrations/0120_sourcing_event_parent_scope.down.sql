ALTER TABLE sourcing_events
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE sourcing_events e
LEFT JOIN sourcing_searches s ON e.event_type IN ('sourcing.search.queued','sourcing.search.refreshed','sourcing.search.deleted','sourcing.search.projected','sourcing.search.seeded_from_opportunity','sourcing.search.circuit_requeued') AND s.id=e.resource_id
LEFT JOIN sourcing_comparisons m ON e.event_type='sourcing.comparison.created' AND m.id=e.resource_id
LEFT JOIN sourcing_purchase_tasks p ON e.event_type IN ('sourcing.purchase_task.queued','sourcing.purchase_task.account_rehearsal.queued') AND p.id=e.resource_id
LEFT JOIN supplier_quotes q ON q.id=COALESCE(m.anchor_quote_id,p.quote_id,IF(e.event_type='supplier_quote.confirmed',e.resource_id,NULL))
LEFT JOIN sourcing_candidates c ON c.id=q.candidate_id
LEFT JOIN sourcing_searches qs ON qs.id=c.search_id
SET e.organization_id=COALESCE(s.organization_id,qs.organization_id),
    e.workspace_id=COALESCE(s.workspace_id,qs.workspace_id);
ALTER TABLE sourcing_events
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_sourcing_event_resource_recent,
  ADD KEY idx_sourcing_event_scope (organization_id,workspace_id,created_at);
