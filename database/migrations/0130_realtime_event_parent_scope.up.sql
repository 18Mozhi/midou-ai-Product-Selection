-- Stop writers. Preserve the original notification, recipient and cursor.
DROP TEMPORARY TABLE IF EXISTS scoutops_realtime_scope_guard;
CREATE TEMPORARY TABLE scoutops_realtime_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_realtime_scope_guard VALUES (1);
INSERT INTO scoutops_realtime_scope_guard
SELECT 1 FROM realtime_events r LEFT JOIN notifications n ON n.id=r.notification_id
WHERE n.id IS NULL OR NOT (r.organization_id <=> n.organization_id
  AND r.workspace_id <=> n.workspace_id AND r.recipient_id <=> n.recipient_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_realtime_scope_guard;
ALTER TABLE realtime_events DROP INDEX idx_realtime_replay,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
