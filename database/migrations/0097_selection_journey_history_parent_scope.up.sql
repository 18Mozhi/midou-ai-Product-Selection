-- Stop writers. Verify all three histories before persistent DDL.
DROP TEMPORARY TABLE IF EXISTS scoutops_selection_journey_history_scope_guard;
CREATE TEMPORARY TABLE scoutops_selection_journey_history_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_selection_journey_history_scope_guard VALUES (1);
INSERT INTO scoutops_selection_journey_history_scope_guard
SELECT 1 FROM selection_journey_decisions h LEFT JOIN selection_journeys j ON j.id=h.journey_id
LEFT JOIN opportunities o ON o.id=h.opportunity_id
LEFT JOIN raw_evidence r ON r.id=h.selected_raw_evidence_id
WHERE j.id IS NULL OR NOT (j.organization_id <=> h.organization_id AND j.workspace_id <=> h.workspace_id)
  OR (h.opportunity_id IS NOT NULL AND (o.id IS NULL OR
      NOT (o.organization_id <=> h.organization_id AND o.workspace_id <=> h.workspace_id)))
  OR (h.selected_raw_evidence_id IS NOT NULL AND (r.id IS NULL OR
      NOT (r.organization_id <=> h.organization_id AND r.workspace_id <=> h.workspace_id)))
LIMIT 1;
INSERT INTO scoutops_selection_journey_history_scope_guard
SELECT 1 FROM selection_journey_events h LEFT JOIN selection_journeys j ON j.id=h.journey_id
WHERE j.id IS NULL OR NOT (j.organization_id <=> h.organization_id AND j.workspace_id <=> h.workspace_id)
LIMIT 1;
INSERT INTO scoutops_selection_journey_history_scope_guard
SELECT 1 FROM selection_journey_outbox h LEFT JOIN selection_journeys j ON j.id=h.journey_id
WHERE j.id IS NULL OR NOT (j.organization_id <=> h.organization_id AND j.workspace_id <=> h.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_selection_journey_history_scope_guard;
ALTER TABLE selection_journey_decisions DROP INDEX idx_selection_decision_scope_time, DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE selection_journey_events DROP INDEX idx_selection_event_scope_time, DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE selection_journey_outbox DROP COLUMN organization_id, DROP COLUMN workspace_id;
