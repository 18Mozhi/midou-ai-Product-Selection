CREATE TEMPORARY TABLE scoutops_notification_parent_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_notification_parent_guard VALUES (1);
INSERT INTO scoutops_notification_parent_guard
SELECT 1 FROM notifications n LEFT JOIN outbox_events e ON e.id=n.source_event_id
WHERE e.id IS NULL OR NOT (n.organization_id <=> e.organization_id AND n.workspace_id <=> e.workspace_id) LIMIT 1;
DROP TEMPORARY TABLE scoutops_notification_parent_guard;
ALTER TABLE notifications DROP INDEX idx_notification_inbox, DROP INDEX idx_notification_workflow,
  DROP INDEX idx_notification_root_cause, DROP COLUMN organization_id, DROP COLUMN workspace_id,
  ADD INDEX idx_notification_inbox (recipient_id,read_at,created_at),
  ADD INDEX idx_notification_workflow (recipient_id,workflow_status,updated_at),
  ADD INDEX idx_notification_root_cause (recipient_id,root_cause_key,created_at);
