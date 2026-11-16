CREATE TEMPORARY TABLE scoutops_membership_role_archive_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_membership_role_archive_guard VALUES (1);
INSERT INTO scoutops_membership_role_archive_guard
SELECT 1 FROM historical_membership_role_assignments a
LEFT JOIN memberships m ON m.id=a.membership_id
LEFT JOIN roles r ON r.code=a.role_code
LEFT JOIN users u ON u.id=a.created_by
WHERE m.id IS NULL OR r.code IS NULL OR u.id IS NULL
  OR EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='membership_role_assignments')
LIMIT 1;
DROP TEMPORARY TABLE scoutops_membership_role_archive_guard;
ALTER TABLE historical_membership_role_assignments
  ADD KEY idx_membership_roles_role (role_code,membership_id),
  ADD KEY fk_membership_roles_creator (created_by),
  ADD CONSTRAINT fk_membership_roles_membership FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_membership_roles_role FOREIGN KEY (role_code) REFERENCES roles(code) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_membership_roles_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
RENAME TABLE historical_membership_role_assignments TO membership_role_assignments;
