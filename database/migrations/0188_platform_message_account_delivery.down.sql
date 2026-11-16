CREATE TEMPORARY TABLE scoutops_platform_message_delivery_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_platform_message_delivery_guard VALUES (1);
INSERT INTO scoutops_platform_message_delivery_guard
SELECT 1 FROM outbox_events e WHERE e.organization_id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_platform_message_delivery_guard;
ALTER TABLE outbox_events MODIFY organization_id CHAR(36) CHARACTER SET ascii NOT NULL;
