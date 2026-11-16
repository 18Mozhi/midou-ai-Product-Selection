-- Stop writers. Restore the original coordinates from the retained notification FK.
ALTER TABLE realtime_events ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE realtime_events r JOIN notifications n ON n.id=r.notification_id
SET r.organization_id=n.organization_id,r.workspace_id=n.workspace_id;
ALTER TABLE realtime_events MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD INDEX idx_realtime_replay (organization_id,workspace_id,recipient_id,id);
