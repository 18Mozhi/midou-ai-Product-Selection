-- Historical evidence only. The account runtime does not register tenancy writers.
ALTER TABLE tenancy_audit_events ADD COLUMN historical_context JSON NULL AFTER id;
UPDATE tenancy_audit_events
SET historical_context=JSON_OBJECT('organization_id',organization_id,'workspace_id',workspace_id);
ALTER TABLE tenancy_audit_events
  MODIFY COLUMN historical_context JSON NOT NULL,
  DROP FOREIGN KEY fk_tenancy_audit_org, DROP INDEX idx_tenancy_audit_org_time,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
RENAME TABLE tenancy_audit_events TO historical_scope_audit_events;
