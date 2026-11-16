-- Stop legacy authorization writers. The 0105/0106 manager grants already use accounts.
CREATE TEMPORARY TABLE scoutops_membership_role_archive_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_membership_role_archive_guard VALUES (1);
INSERT INTO scoutops_membership_role_archive_guard
SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='membership_role_assignments'
LIMIT 1;
INSERT INTO scoutops_membership_role_archive_guard
SELECT 1 FROM information_schema.TABLES
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='historical_membership_role_assignments'
LIMIT 1;
DROP TEMPORARY TABLE scoutops_membership_role_archive_guard;
ALTER TABLE membership_role_assignments
  DROP FOREIGN KEY fk_membership_roles_membership,
  DROP FOREIGN KEY fk_membership_roles_role,
  DROP FOREIGN KEY fk_membership_roles_creator,
  DROP INDEX idx_membership_roles_role,
  DROP INDEX fk_membership_roles_creator;
RENAME TABLE membership_role_assignments TO historical_membership_role_assignments;
