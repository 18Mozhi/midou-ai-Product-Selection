ALTER TABLE trend_outbox
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE trend_outbox o JOIN trend_events e ON e.id=o.id
SET o.organization_id=e.organization_id,o.workspace_id=e.workspace_id;
ALTER TABLE trend_outbox
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_trend_outbox_scope (organization_id,workspace_id,created_at),
  DROP FOREIGN KEY fk_trend_outbox_original_event;
