CREATE TEMPORARY TABLE scoutops_notification_parent_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_notification_parent_guard VALUES (1);
INSERT INTO scoutops_notification_parent_guard
SELECT 1 FROM notifications n LEFT JOIN outbox_events e ON e.id=n.source_event_id
WHERE e.id IS NULL OR e.organization_id IS NULL OR e.workspace_id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_notification_parent_guard;
ALTER TABLE notifications ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE notifications n JOIN outbox_events e ON e.id=n.source_event_id
SET n.organization_id=e.organization_id,n.workspace_id=e.workspace_id;
ALTER TABLE notifications MODIFY organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_notification_inbox, DROP INDEX idx_notification_workflow, DROP INDEX idx_notification_root_cause,
  ADD INDEX idx_notification_inbox (organization_id,workspace_id,recipient_id,read_at,created_at),
  ADD INDEX idx_notification_workflow (organization_id,workspace_id,recipient_id,workflow_status,updated_at),
  ADD INDEX idx_notification_root_cause (organization_id,workspace_id,recipient_id,root_cause_key,created_at);
