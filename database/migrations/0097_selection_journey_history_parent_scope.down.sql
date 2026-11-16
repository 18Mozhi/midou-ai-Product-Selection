-- Stop writers. Reconstruct legacy coordinates from the original journey.
ALTER TABLE selection_journey_outbox ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER journey_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE selection_journey_outbox h JOIN selection_journeys j ON j.id=h.journey_id
SET h.organization_id=j.organization_id,h.workspace_id=j.workspace_id;
ALTER TABLE selection_journey_outbox MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL;
ALTER TABLE selection_journey_events ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER journey_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE selection_journey_events h JOIN selection_journeys j ON j.id=h.journey_id
SET h.organization_id=j.organization_id,h.workspace_id=j.workspace_id;
ALTER TABLE selection_journey_events MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_selection_event_scope_time (organization_id,workspace_id,occurred_at);
ALTER TABLE selection_journey_decisions ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER journey_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE selection_journey_decisions h JOIN selection_journeys j ON j.id=h.journey_id
SET h.organization_id=j.organization_id,h.workspace_id=j.workspace_id;
ALTER TABLE selection_journey_decisions MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_selection_decision_scope_time (organization_id,workspace_id,created_at);
