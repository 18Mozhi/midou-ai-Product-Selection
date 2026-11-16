ALTER TABLE approval_template_versions
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER template_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE approval_template_versions v JOIN approval_templates t ON t.id=v.template_id
SET v.organization_id=t.organization_id,v.workspace_id=t.workspace_id;
ALTER TABLE approval_template_versions
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_approval_version_scope (organization_id,workspace_id,status);
