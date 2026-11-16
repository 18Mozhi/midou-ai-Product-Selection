ALTER TABLE sourcing_outbox
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE sourcing_outbox o JOIN sourcing_events e ON e.id=o.id
SET o.organization_id=e.organization_id,o.workspace_id=e.workspace_id;
ALTER TABLE sourcing_outbox
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP FOREIGN KEY fk_sourcing_outbox_original_event;
