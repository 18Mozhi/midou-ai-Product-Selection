-- Writers must be stopped. Never choose between multiple existing preferences or replay keys for one user.
CREATE TEMPORARY TABLE scoutops_ui_preference_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_ui_preference_scope_guard VALUES (1);
INSERT INTO scoutops_ui_preference_scope_guard
SELECT 1 FROM user_ui_preferences GROUP BY user_id HAVING COUNT(*)>1
LIMIT 1;
INSERT INTO scoutops_ui_preference_scope_guard
SELECT 1 FROM user_ui_preference_operations GROUP BY user_id,key_hash HAVING COUNT(*)>1
LIMIT 1;
INSERT INTO scoutops_ui_preference_scope_guard
SELECT 1 FROM user_ui_preference_audit_events h LEFT JOIN user_ui_preferences p ON p.id=h.preference_id
WHERE p.id IS NULL OR p.user_id<>h.user_id OR p.organization_id<>h.organization_id OR p.workspace_id<>h.workspace_id
LIMIT 1;
INSERT INTO scoutops_ui_preference_scope_guard
SELECT 1 FROM user_ui_preference_operations h LEFT JOIN user_ui_preferences p ON p.id=h.preference_id
WHERE p.id IS NULL OR p.user_id<>h.user_id OR p.organization_id<>h.organization_id OR p.workspace_id<>h.workspace_id
LIMIT 1;
DROP TEMPORARY TABLE scoutops_ui_preference_scope_guard;
ALTER TABLE user_ui_preferences ADD COLUMN historical_context JSON NULL AFTER user_id;
UPDATE user_ui_preferences SET historical_context=JSON_OBJECT('organization_id',organization_id,'workspace_id',workspace_id);
ALTER TABLE user_ui_preferences
  DROP FOREIGN KEY fk_ui_preference_org,
  DROP FOREIGN KEY fk_ui_preference_workspace,
  DROP INDEX uq_ui_preference_scope,
  DROP INDEX idx_ui_preference_org_workspace,
  DROP COLUMN organization_id,
  DROP COLUMN workspace_id,
  ADD UNIQUE KEY uq_ui_preference_account (user_id);
ALTER TABLE user_ui_preference_audit_events ADD COLUMN historical_context JSON NULL AFTER user_id;
UPDATE user_ui_preference_audit_events SET historical_context=JSON_OBJECT('organization_id',organization_id,'workspace_id',workspace_id);
ALTER TABLE user_ui_preference_audit_events
  DROP FOREIGN KEY fk_ui_preference_audit_org,
  DROP FOREIGN KEY fk_ui_preference_audit_workspace,
  DROP INDEX idx_ui_preference_audit_scope,
  DROP COLUMN organization_id,
  DROP COLUMN workspace_id;
ALTER TABLE user_ui_preference_operations ADD COLUMN historical_context JSON NULL AFTER user_id;
UPDATE user_ui_preference_operations SET historical_context=JSON_OBJECT('organization_id',organization_id,'workspace_id',workspace_id);
ALTER TABLE user_ui_preference_operations
  DROP INDEX uq_ui_preference_operation,
  DROP COLUMN organization_id,
  DROP COLUMN workspace_id,
  ADD UNIQUE KEY uq_ui_preference_account_operation (user_id,key_hash);
