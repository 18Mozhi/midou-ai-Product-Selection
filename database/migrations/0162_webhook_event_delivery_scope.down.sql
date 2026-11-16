ALTER TABLE webhook_delivery_events ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER endpoint_id;
UPDATE webhook_delivery_events e JOIN webhook_deliveries d ON d.id=e.delivery_id
SET e.organization_id=d.organization_id;
ALTER TABLE webhook_delivery_events MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_webhook_event_org_time (organization_id,occurred_at),
  ADD CONSTRAINT fk_webhook_event_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
