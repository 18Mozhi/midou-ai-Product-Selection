CREATE TEMPORARY TABLE scoutops_membership_archive_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_membership_archive_guard VALUES (1);
INSERT INTO scoutops_membership_archive_guard
SELECT 1 FROM historical_organization_memberships m
LEFT JOIN organizations o ON o.id=m.historical_organization_id
LEFT JOIN users u ON u.id=m.user_id
WHERE o.id IS NULL OR u.id IS NULL
  OR EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='memberships')
LIMIT 1;
DROP TEMPORARY TABLE scoutops_membership_archive_guard;
ALTER TABLE historical_organization_memberships
  DROP INDEX uq_historical_memberships_org_user,
  CHANGE COLUMN historical_organization_id organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_memberships_org_user (organization_id,user_id),
  ADD KEY idx_memberships_user_status (user_id,status,organization_id),
  ADD CONSTRAINT fk_memberships_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_memberships_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
RENAME TABLE historical_organization_memberships TO memberships;
