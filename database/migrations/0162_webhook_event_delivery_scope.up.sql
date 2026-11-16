-- Stop API and Worker writers. Verify historical coordinates before removing the duplicate.
DROP TEMPORARY TABLE IF EXISTS scoutops_webhook_event_guard;
CREATE TEMPORARY TABLE scoutops_webhook_event_guard (id INT PRIMARY KEY);
INSERT INTO scoutops_webhook_event_guard VALUES (1);
INSERT INTO scoutops_webhook_event_guard
SELECT 1 FROM webhook_delivery_events e
LEFT JOIN webhook_deliveries d ON d.id=e.delivery_id
LEFT JOIN webhook_endpoints w ON w.id=e.endpoint_id
WHERE d.id IS NULL OR w.id IS NULL OR NOT (e.endpoint_id <=> d.endpoint_id)
  OR NOT (e.organization_id <=> d.organization_id AND e.organization_id <=> w.organization_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_webhook_event_guard;
ALTER TABLE webhook_delivery_events DROP FOREIGN KEY fk_webhook_event_org,
  DROP INDEX idx_webhook_event_org_time, DROP COLUMN organization_id;
