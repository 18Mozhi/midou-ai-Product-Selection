-- Stop writers. Recover the original coordinates without changing delivery identity.
ALTER TABLE opportunity_outbox ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE opportunity_outbox o JOIN opportunity_events e ON e.id=o.event_id
SET o.organization_id=e.organization_id,o.workspace_id=e.workspace_id;
ALTER TABLE opportunity_outbox MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP FOREIGN KEY fk_opportunity_delivery_event, DROP INDEX idx_opportunity_delivery_event, DROP COLUMN event_id;
