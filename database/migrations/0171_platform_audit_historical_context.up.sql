ALTER TABLE platform_audit_events ADD COLUMN historical_context JSON NULL AFTER id;
UPDATE platform_audit_events
SET historical_context=JSON_OBJECT('organization_id',organization_id,'workspace_id',workspace_id)
WHERE organization_id IS NOT NULL OR workspace_id IS NOT NULL;
ALTER TABLE platform_audit_events
  DROP FOREIGN KEY fk_platform_audit_org, DROP FOREIGN KEY fk_platform_audit_workspace,
  DROP INDEX idx_platform_audit_scope_time, DROP INDEX fk_platform_audit_workspace,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
