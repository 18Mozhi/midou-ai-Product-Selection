ALTER TABLE platform_messages ADD COLUMN historical_context JSON NULL AFTER audience_type;
UPDATE platform_messages m LEFT JOIN organizations o ON o.id=m.organization_id
SET m.historical_context=JSON_OBJECT('organization_id',m.organization_id,'organization_name',o.name)
WHERE m.organization_id IS NOT NULL;
ALTER TABLE platform_messages DROP FOREIGN KEY fk_platform_message_organization,
  DROP INDEX idx_platform_messages_organization, DROP COLUMN organization_id;
