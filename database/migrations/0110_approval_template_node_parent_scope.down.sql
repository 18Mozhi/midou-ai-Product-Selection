ALTER TABLE approval_template_nodes
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER template_version_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE approval_template_nodes n JOIN approval_template_versions v ON v.id=n.template_version_id
SET n.organization_id=v.organization_id,n.workspace_id=v.workspace_id;
ALTER TABLE approval_template_nodes
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_approval_node_scope (organization_id,workspace_id,approver_id);
