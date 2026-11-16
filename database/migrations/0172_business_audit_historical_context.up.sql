ALTER TABLE audit_logs ADD COLUMN historical_context JSON NULL AFTER id;
UPDATE audit_logs SET historical_context=JSON_OBJECT('organization_id',organization_id,'workspace_id',workspace_id);
ALTER TABLE audit_logs MODIFY COLUMN historical_context JSON NOT NULL,
  DROP INDEX idx_audit_scope_time, DROP INDEX idx_audit_resource_time,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
