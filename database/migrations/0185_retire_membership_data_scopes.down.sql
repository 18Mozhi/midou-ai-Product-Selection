CREATE TEMPORARY TABLE scoutops_membership_scope_archive_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_membership_scope_archive_guard VALUES (1);
INSERT INTO scoutops_membership_scope_archive_guard
SELECT 1 FROM historical_membership_data_scopes s
LEFT JOIN memberships m ON m.id=s.membership_id
LEFT JOIN workspaces w ON w.id=s.historical_workspace_id
LEFT JOIN users u ON u.id=s.created_by
WHERE m.id IS NULL OR u.id IS NULL OR (s.historical_workspace_id IS NOT NULL AND w.id IS NULL)
  OR EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='membership_data_scopes')
LIMIT 1;
DROP TEMPORARY TABLE scoutops_membership_scope_archive_guard;
ALTER TABLE historical_membership_data_scopes
  CHANGE COLUMN historical_workspace_id workspace_id CHAR(36) CHARACTER SET ascii NULL,
  ADD KEY idx_membership_scope_workspace (workspace_id,membership_id),
  ADD KEY fk_membership_scopes_creator (created_by),
  ADD CONSTRAINT fk_membership_scopes_membership FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_membership_scopes_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_membership_scopes_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
RENAME TABLE historical_membership_data_scopes TO membership_data_scopes;
