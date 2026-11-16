ALTER TABLE webhook_deliveries ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER endpoint_id;
UPDATE webhook_deliveries d JOIN webhook_endpoints e ON e.id=d.endpoint_id
SET d.organization_id=e.organization_id;
ALTER TABLE webhook_deliveries MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_webhook_delivery_endpoint_time,
  ADD KEY idx_webhook_delivery_org_time (organization_id,created_at),
  ADD CONSTRAINT fk_webhook_delivery_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
