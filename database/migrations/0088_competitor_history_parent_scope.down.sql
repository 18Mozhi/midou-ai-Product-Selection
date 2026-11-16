-- Stop writers. Restore coordinates through retained competitor foreign keys.
ALTER TABLE competitor_alerts ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE competitor_alerts h JOIN competitors c ON c.id=h.competitor_id
SET h.organization_id=c.organization_id,h.workspace_id=c.workspace_id;
ALTER TABLE competitor_alerts MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_competitor_alert_delivery (organization_id,workspace_id,notification_status,task_status);
ALTER TABLE competitor_changes ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE competitor_changes h JOIN competitors c ON c.id=h.competitor_id
SET h.organization_id=c.organization_id,h.workspace_id=c.workspace_id;
ALTER TABLE competitor_changes MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL;
ALTER TABLE competitor_snapshots ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER competitor_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE competitor_snapshots h JOIN competitors c ON c.id=h.competitor_id
SET h.organization_id=c.organization_id,h.workspace_id=c.workspace_id;
ALTER TABLE competitor_snapshots MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL;
