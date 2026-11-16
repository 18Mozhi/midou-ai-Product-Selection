-- Stop writers. The endpoint must agree with every existing delivery before removing scope.
DROP TEMPORARY TABLE IF EXISTS scoutops_webhook_delivery_guard;
CREATE TEMPORARY TABLE scoutops_webhook_delivery_guard (id INT PRIMARY KEY);
INSERT INTO scoutops_webhook_delivery_guard VALUES (1);
INSERT INTO scoutops_webhook_delivery_guard
SELECT 1 FROM webhook_deliveries d
LEFT JOIN webhook_endpoints e ON e.id=d.endpoint_id
WHERE e.id IS NULL OR NOT (d.organization_id <=> e.organization_id) LIMIT 1;
DROP TEMPORARY TABLE scoutops_webhook_delivery_guard;
ALTER TABLE webhook_deliveries DROP FOREIGN KEY fk_webhook_delivery_org,
  DROP INDEX idx_webhook_delivery_org_time,
  ADD KEY idx_webhook_delivery_endpoint_time (endpoint_id,created_at),
  DROP COLUMN organization_id;
