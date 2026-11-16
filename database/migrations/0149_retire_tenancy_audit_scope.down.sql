-- Fail before persistent DDL if any archived scope cannot be restored.
CREATE TEMPORARY TABLE scoutops_historical_scope_restore_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_historical_scope_restore_guard VALUES (1);
INSERT INTO scoutops_historical_scope_restore_guard
SELECT 1 FROM historical_scope_audit_events h
LEFT JOIN organizations o
  ON BINARY o.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.organization_id'))
WHERE o.id IS NULL
   OR NOT (JSON_TYPE(JSON_EXTRACT(h.historical_context,'$.organization_id')) <=> 'STRING')
   OR (NOT (JSON_TYPE(JSON_EXTRACT(h.historical_context,'$.workspace_id')) <=> 'NULL')
       AND (NOT (JSON_TYPE(JSON_EXTRACT(h.historical_context,'$.workspace_id')) <=> 'STRING')
         OR CHAR_LENGTH(JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.workspace_id'))) > 36))
LIMIT 1;
DROP TEMPORARY TABLE scoutops_historical_scope_restore_guard;
ALTER TABLE historical_scope_audit_events
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE historical_scope_audit_events
SET organization_id=IF(JSON_TYPE(JSON_EXTRACT(historical_context,'$.organization_id'))='STRING',JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),NULL),
    workspace_id=IF(JSON_TYPE(JSON_EXTRACT(historical_context,'$.workspace_id'))='STRING',JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.workspace_id')),NULL);
ALTER TABLE historical_scope_audit_events
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_tenancy_audit_org_time (organization_id,occurred_at),
  ADD CONSTRAINT fk_tenancy_audit_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT,
  DROP COLUMN historical_context;
RENAME TABLE historical_scope_audit_events TO tenancy_audit_events;
