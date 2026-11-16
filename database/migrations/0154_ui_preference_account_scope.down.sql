-- Fail before any persistent DDL if account-only writes cannot be represented in the original schema.
CREATE TEMPORARY TABLE scoutops_ui_preference_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_ui_preference_scope_guard VALUES (1);
INSERT INTO scoutops_ui_preference_scope_guard
SELECT 1 FROM user_ui_preferences h
LEFT JOIN organizations g ON BINARY g.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.organization_id'))
LEFT JOIN workspaces w ON BINARY w.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.workspace_id')) AND w.organization_id=g.id
WHERE h.historical_context IS NULL OR g.id IS NULL OR w.id IS NULL
   OR NOT (JSON_TYPE(JSON_EXTRACT(h.historical_context,'$.organization_id')) <=> 'STRING')
   OR NOT (JSON_TYPE(JSON_EXTRACT(h.historical_context,'$.workspace_id')) <=> 'STRING')
LIMIT 1;
INSERT INTO scoutops_ui_preference_scope_guard
SELECT 1 FROM user_ui_preference_audit_events h
LEFT JOIN organizations g ON BINARY g.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.organization_id'))
LEFT JOIN workspaces w ON BINARY w.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.workspace_id')) AND w.organization_id=g.id
WHERE h.historical_context IS NULL OR g.id IS NULL OR w.id IS NULL
   OR NOT (JSON_TYPE(JSON_EXTRACT(h.historical_context,'$.organization_id')) <=> 'STRING')
   OR NOT (JSON_TYPE(JSON_EXTRACT(h.historical_context,'$.workspace_id')) <=> 'STRING')
LIMIT 1;
INSERT INTO scoutops_ui_preference_scope_guard
SELECT 1 FROM user_ui_preference_operations h
LEFT JOIN organizations g ON BINARY g.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.organization_id'))
LEFT JOIN workspaces w ON BINARY w.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.workspace_id')) AND w.organization_id=g.id
WHERE h.historical_context IS NULL OR g.id IS NULL OR w.id IS NULL
   OR NOT (JSON_TYPE(JSON_EXTRACT(h.historical_context,'$.organization_id')) <=> 'STRING')
   OR NOT (JSON_TYPE(JSON_EXTRACT(h.historical_context,'$.workspace_id')) <=> 'STRING')
LIMIT 1;
DROP TEMPORARY TABLE scoutops_ui_preference_scope_guard;
ALTER TABLE user_ui_preferences
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER user_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE user_ui_preferences h SET h.organization_id=JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.organization_id')), h.workspace_id=JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.workspace_id'));
ALTER TABLE user_ui_preferences
  DROP INDEX uq_ui_preference_account,
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP COLUMN historical_context,
  ADD UNIQUE KEY uq_ui_preference_scope (user_id,organization_id,workspace_id),
  ADD KEY idx_ui_preference_org_workspace (organization_id,workspace_id,updated_at),
  ADD CONSTRAINT fk_ui_preference_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_ui_preference_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE RESTRICT;
ALTER TABLE user_ui_preference_audit_events
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER user_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE user_ui_preference_audit_events h SET h.organization_id=JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.organization_id')), h.workspace_id=JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.workspace_id'));
ALTER TABLE user_ui_preference_audit_events
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP COLUMN historical_context,
  ADD KEY idx_ui_preference_audit_scope (organization_id,workspace_id,occurred_at,id),
  ADD CONSTRAINT fk_ui_preference_audit_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_ui_preference_audit_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE RESTRICT;
ALTER TABLE user_ui_preference_operations
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER user_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE user_ui_preference_operations h SET h.organization_id=JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.organization_id')), h.workspace_id=JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.workspace_id'));
ALTER TABLE user_ui_preference_operations
  DROP INDEX uq_ui_preference_account_operation,
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP COLUMN historical_context,
  ADD UNIQUE KEY uq_ui_preference_operation (user_id,organization_id,workspace_id,key_hash);
