-- Stop writers before applying. Only redundant coordinates are removed.
DROP TEMPORARY TABLE IF EXISTS scoutops_approval_template_node_scope_guard;
CREATE TEMPORARY TABLE scoutops_approval_template_node_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_approval_template_node_scope_guard VALUES (1);
INSERT INTO scoutops_approval_template_node_scope_guard
SELECT 1 FROM approval_template_nodes n
LEFT JOIN approval_template_versions v ON v.id=n.template_version_id
  AND v.organization_id=n.organization_id AND v.workspace_id=n.workspace_id
LEFT JOIN approval_templates t ON t.id=v.template_id
  AND t.organization_id=v.organization_id AND t.workspace_id=v.workspace_id
WHERE t.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_approval_template_node_scope_guard;
ALTER TABLE approval_template_nodes DROP INDEX idx_approval_node_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
