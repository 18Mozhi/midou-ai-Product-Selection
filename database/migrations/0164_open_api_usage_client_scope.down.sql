ALTER TABLE open_api_usage ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER client_id;
UPDATE open_api_usage u JOIN platform_api_clients c ON c.id=u.client_id SET u.organization_id=c.organization_id;
ALTER TABLE open_api_usage MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_open_usage_org_time (organization_id,occurred_at),
  ADD CONSTRAINT fk_open_usage_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
