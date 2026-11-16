CREATE TEMPORARY TABLE scoutops_platform_audit_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_platform_audit_guard VALUES (1);
INSERT INTO scoutops_platform_audit_guard
SELECT 1 FROM platform_audit_events e LEFT JOIN organizations o
  ON BINARY o.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(e.historical_context,'$.organization_id'))
LEFT JOIN workspaces w ON BINARY w.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(e.historical_context,'$.workspace_id'))
WHERE (JSON_TYPE(JSON_EXTRACT(e.historical_context,'$.organization_id'))='STRING' AND o.id IS NULL)
   OR (JSON_TYPE(JSON_EXTRACT(e.historical_context,'$.workspace_id'))='STRING' AND w.id IS NULL)
   OR COALESCE(JSON_TYPE(JSON_EXTRACT(e.historical_context,'$.organization_id')),'NULL') NOT IN ('NULL','STRING')
   OR COALESCE(JSON_TYPE(JSON_EXTRACT(e.historical_context,'$.workspace_id')),'NULL') NOT IN ('NULL','STRING')
LIMIT 1;
DROP TEMPORARY TABLE scoutops_platform_audit_guard;
ALTER TABLE platform_audit_events ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE platform_audit_events SET
  organization_id=IF(JSON_TYPE(JSON_EXTRACT(historical_context,'$.organization_id'))='STRING',JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),NULL),
  workspace_id=IF(JSON_TYPE(JSON_EXTRACT(historical_context,'$.workspace_id'))='STRING',JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.workspace_id')),NULL);
ALTER TABLE platform_audit_events
  ADD KEY idx_platform_audit_scope_time (organization_id,occurred_at,id),
  ADD KEY fk_platform_audit_workspace (workspace_id),
  ADD CONSTRAINT fk_platform_audit_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_platform_audit_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT,
  DROP COLUMN historical_context;
