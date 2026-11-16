-- Stop legacy writers. Preserve old selections without retaining any live session or tenancy link.
CREATE TEMPORARY TABLE scoutops_session_context_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_session_context_guard VALUES (1);
INSERT INTO scoutops_session_context_guard
SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='user_session_contexts'
LIMIT 1;
DROP TEMPORARY TABLE scoutops_session_context_guard;
ALTER TABLE user_session_contexts ADD COLUMN historical_context JSON NULL AFTER user_id;
UPDATE user_session_contexts SET historical_context=JSON_OBJECT('organization_id',organization_id,'workspace_id',workspace_id);
ALTER TABLE user_session_contexts
  MODIFY COLUMN historical_context JSON NOT NULL,
  DROP FOREIGN KEY fk_context_session, DROP FOREIGN KEY fk_context_user,
  DROP FOREIGN KEY fk_context_org, DROP FOREIGN KEY fk_context_workspace,
  DROP INDEX idx_session_context_scope, DROP INDEX fk_context_user, DROP INDEX fk_context_workspace,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
RENAME TABLE user_session_contexts TO historical_session_selections;
