-- Stop legacy authorization writers. Preserve original grants as history only.
CREATE TEMPORARY TABLE scoutops_membership_scope_archive_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_membership_scope_archive_guard VALUES (1);
INSERT INTO scoutops_membership_scope_archive_guard
SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='membership_data_scopes'
LIMIT 1;
INSERT INTO scoutops_membership_scope_archive_guard
SELECT 1 FROM information_schema.TABLES
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='historical_membership_data_scopes'
LIMIT 1;
DROP TEMPORARY TABLE scoutops_membership_scope_archive_guard;
ALTER TABLE membership_data_scopes
  DROP FOREIGN KEY fk_membership_scopes_membership,
  DROP FOREIGN KEY fk_membership_scopes_workspace,
  DROP FOREIGN KEY fk_membership_scopes_creator,
  DROP INDEX idx_membership_scope_workspace,
  DROP INDEX fk_membership_scopes_creator,
  CHANGE COLUMN workspace_id historical_workspace_id CHAR(36) CHARACTER SET ascii NULL;
RENAME TABLE membership_data_scopes TO historical_membership_data_scopes;
