CREATE TEMPORARY TABLE scoutops_platform_message_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_platform_message_guard VALUES (1);
INSERT INTO scoutops_platform_message_guard
SELECT 1 FROM platform_messages m LEFT JOIN organizations o
  ON BINARY o.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(m.historical_context,'$.organization_id'))
WHERE m.historical_context IS NOT NULL AND o.id IS NULL
LIMIT 1;
DROP TEMPORARY TABLE scoutops_platform_message_guard;
ALTER TABLE platform_messages ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER audience_type;
UPDATE platform_messages SET organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id'))
WHERE historical_context IS NOT NULL;
ALTER TABLE platform_messages ADD KEY idx_platform_messages_organization (organization_id,updated_at),
  ADD CONSTRAINT fk_platform_message_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  DROP COLUMN historical_context;
