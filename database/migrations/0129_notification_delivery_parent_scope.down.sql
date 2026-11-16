-- Stop writers. Restore coordinates from the retained notification FK.
ALTER TABLE notification_deliveries ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE notification_deliveries d JOIN notifications n ON n.id=d.notification_id
SET d.organization_id=n.organization_id,d.workspace_id=n.workspace_id;
ALTER TABLE notification_deliveries MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL;
