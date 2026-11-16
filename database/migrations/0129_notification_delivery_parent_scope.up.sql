-- Stop writers. The original notification determines the scope and recipient.
DROP TEMPORARY TABLE IF EXISTS scoutops_notification_delivery_scope_guard;
CREATE TEMPORARY TABLE scoutops_notification_delivery_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_notification_delivery_scope_guard VALUES (1);
INSERT INTO scoutops_notification_delivery_scope_guard
SELECT 1 FROM notification_deliveries d LEFT JOIN notifications n ON n.id=d.notification_id
WHERE n.id IS NULL OR NOT (d.organization_id <=> n.organization_id
  AND d.workspace_id <=> n.workspace_id AND d.recipient_id <=> n.recipient_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_notification_delivery_scope_guard;
ALTER TABLE notification_deliveries DROP COLUMN organization_id, DROP COLUMN workspace_id;
