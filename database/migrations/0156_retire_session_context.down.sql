-- Verify all historical references before persistent DDL. Do not recreate sessions or scope.
CREATE TEMPORARY TABLE scoutops_session_context_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_session_context_guard VALUES (1);
INSERT INTO scoutops_session_context_guard
SELECT 1 FROM historical_session_selections h
LEFT JOIN user_sessions s ON s.id=h.session_id AND s.user_id=h.user_id
LEFT JOIN users u ON u.id=h.user_id
LEFT JOIN organizations o ON BINARY o.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.organization_id'))
LEFT JOIN workspaces w ON BINARY w.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.workspace_id'))
WHERE s.id IS NULL OR u.id IS NULL OR o.id IS NULL OR w.id IS NULL
   OR NOT (JSON_TYPE(JSON_EXTRACT(h.historical_context,'$.organization_id')) <=> 'STRING')
   OR NOT (JSON_TYPE(JSON_EXTRACT(h.historical_context,'$.workspace_id')) <=> 'STRING')
LIMIT 1;
DROP TEMPORARY TABLE scoutops_session_context_guard;
ALTER TABLE historical_session_selections
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER user_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE historical_session_selections SET
  organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),
  workspace_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.workspace_id'));
ALTER TABLE historical_session_selections
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_session_context_scope (organization_id,workspace_id,user_id),
  ADD CONSTRAINT fk_context_session FOREIGN KEY (session_id) REFERENCES user_sessions (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_context_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_context_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_context_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE RESTRICT,
  DROP COLUMN historical_context;
RENAME TABLE historical_session_selections TO user_session_contexts;
