-- Stop legacy writers. Preserve operations and invitations without keeping their runtime tables.
CREATE TEMPORARY TABLE scoutops_org_admin_archive_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_org_admin_archive_guard VALUES (1);
INSERT INTO scoutops_org_admin_archive_guard
SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA=DATABASE()
  AND REFERENCED_TABLE_NAME IN ('organization_admin_operations','organization_invitations')
LIMIT 1;
DROP TEMPORARY TABLE scoutops_org_admin_archive_guard;
ALTER TABLE organization_admin_operations ADD COLUMN historical_context JSON NULL AFTER id;
ALTER TABLE organization_invitations ADD COLUMN historical_context JSON NULL AFTER id;
UPDATE organization_admin_operations SET historical_context=JSON_OBJECT('organization_id',organization_id);
UPDATE organization_invitations SET historical_context=JSON_OBJECT('organization_id',organization_id);
ALTER TABLE organization_admin_operations MODIFY COLUMN historical_context JSON NOT NULL,
  DROP INDEX uq_org_admin_operation, DROP INDEX idx_org_admin_operation_resource, DROP COLUMN organization_id;
ALTER TABLE organization_invitations MODIFY COLUMN historical_context JSON NOT NULL,
  DROP FOREIGN KEY fk_org_invitation_org, DROP FOREIGN KEY fk_org_invitation_role,
  DROP FOREIGN KEY fk_org_invitation_membership,
  DROP INDEX idx_org_invitation_status, DROP INDEX idx_org_invitation_email,
  DROP INDEX fk_org_invitation_role, DROP INDEX fk_org_invitation_membership, DROP COLUMN organization_id;
RENAME TABLE organization_admin_operations TO historical_admin_operations,
  organization_invitations TO historical_invitations;
