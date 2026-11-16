-- Validate historical coordinates and references before persistent DDL.
CREATE TEMPORARY TABLE scoutops_org_admin_archive_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_org_admin_archive_guard VALUES (1);
INSERT INTO scoutops_org_admin_archive_guard
SELECT 1 FROM historical_admin_operations h
WHERE NOT (JSON_TYPE(JSON_EXTRACT(h.historical_context,'$.organization_id')) <=> 'STRING')
   OR CHAR_LENGTH(JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.organization_id'))) > 36
LIMIT 1;
INSERT INTO scoutops_org_admin_archive_guard
SELECT 1 FROM historical_admin_operations
GROUP BY BINARY JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),actor_id,route_key,idempotency_key
HAVING COUNT(*)>1 LIMIT 1;
INSERT INTO scoutops_org_admin_archive_guard
SELECT 1 FROM historical_invitations h
LEFT JOIN organizations o ON BINARY o.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(h.historical_context,'$.organization_id'))
LEFT JOIN roles r ON r.code=h.role_code
LEFT JOIN memberships m ON m.id=h.accepted_membership_id
WHERE o.id IS NULL OR r.code IS NULL OR (h.accepted_membership_id IS NOT NULL AND m.id IS NULL)
   OR NOT (JSON_TYPE(JSON_EXTRACT(h.historical_context,'$.organization_id')) <=> 'STRING')
LIMIT 1;
DROP TEMPORARY TABLE scoutops_org_admin_archive_guard;
ALTER TABLE historical_admin_operations ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id;
ALTER TABLE historical_invitations ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id;
UPDATE historical_admin_operations SET organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id'));
UPDATE historical_invitations SET organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id'));
ALTER TABLE historical_admin_operations MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP COLUMN historical_context,
  ADD UNIQUE KEY uq_org_admin_operation (organization_id,actor_id,route_key,idempotency_key),
  ADD KEY idx_org_admin_operation_resource (organization_id,resource_id);
ALTER TABLE historical_invitations MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP COLUMN historical_context,
  ADD KEY idx_org_invitation_status (organization_id,status,expires_at),
  ADD KEY idx_org_invitation_email (organization_id,email_normalized,status),
  ADD KEY fk_org_invitation_role (role_code), ADD KEY fk_org_invitation_membership (accepted_membership_id),
  ADD CONSTRAINT fk_org_invitation_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_org_invitation_role FOREIGN KEY (role_code) REFERENCES roles(code) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_org_invitation_membership FOREIGN KEY (accepted_membership_id) REFERENCES memberships(id) ON DELETE RESTRICT;
RENAME TABLE historical_admin_operations TO organization_admin_operations,
  historical_invitations TO organization_invitations;
