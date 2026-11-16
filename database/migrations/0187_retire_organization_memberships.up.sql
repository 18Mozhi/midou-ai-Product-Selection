-- Stop all legacy writers. No active relationship may still reference memberships.
CREATE TEMPORARY TABLE scoutops_membership_archive_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_membership_archive_guard VALUES (1);
INSERT INTO scoutops_membership_archive_guard
SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='memberships'
LIMIT 1;
INSERT INTO scoutops_membership_archive_guard
SELECT 1 FROM information_schema.TABLES
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='historical_organization_memberships'
LIMIT 1;
DROP TEMPORARY TABLE scoutops_membership_archive_guard;
ALTER TABLE memberships
  DROP FOREIGN KEY fk_memberships_org,
  DROP FOREIGN KEY fk_memberships_user,
  DROP INDEX idx_memberships_user_status,
  DROP INDEX uq_memberships_org_user,
  CHANGE COLUMN organization_id historical_organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_historical_memberships_org_user (historical_organization_id,user_id);
RENAME TABLE memberships TO historical_organization_memberships;
