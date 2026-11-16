CREATE TEMPORARY TABLE scoutops_business_audit_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_business_audit_guard VALUES (1);
INSERT INTO scoutops_business_audit_guard
SELECT 1 FROM audit_logs a
WHERE COALESCE(JSON_TYPE(JSON_EXTRACT(a.historical_context,'$.organization_id')),'NULL')<>'STRING'
  OR CHAR_LENGTH(JSON_UNQUOTE(JSON_EXTRACT(a.historical_context,'$.organization_id')))>36
  OR COALESCE(JSON_TYPE(JSON_EXTRACT(a.historical_context,'$.workspace_id')),'NULL') NOT IN ('NULL','STRING')
  OR CHAR_LENGTH(JSON_UNQUOTE(JSON_EXTRACT(a.historical_context,'$.workspace_id')))>36
  OR BINARY JSON_UNQUOTE(JSON_EXTRACT(a.historical_context,'$.organization_id'))<>BINARY CONVERT(JSON_UNQUOTE(JSON_EXTRACT(a.historical_context,'$.organization_id')) USING ascii)
  OR BINARY JSON_UNQUOTE(JSON_EXTRACT(a.historical_context,'$.workspace_id'))<>BINARY CONVERT(JSON_UNQUOTE(JSON_EXTRACT(a.historical_context,'$.workspace_id')) USING ascii)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_business_audit_guard;
ALTER TABLE audit_logs ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE audit_logs SET organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),
  workspace_id=IF(JSON_TYPE(JSON_EXTRACT(historical_context,'$.workspace_id'))='STRING',JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.workspace_id')),NULL);
ALTER TABLE audit_logs MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_audit_scope_time (organization_id,workspace_id,occurred_at),
  ADD KEY idx_audit_resource_time (organization_id,resource_type,resource_id,occurred_at),
  DROP COLUMN historical_context;
