-- Apply after 0110 with writers stopped. Preserve version and request links.
DROP TEMPORARY TABLE IF EXISTS scoutops_approval_template_version_scope_guard;
CREATE TEMPORARY TABLE scoutops_approval_template_version_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_approval_template_version_scope_guard VALUES (1);
INSERT INTO scoutops_approval_template_version_scope_guard
SELECT 1 FROM approval_template_versions v
LEFT JOIN approval_templates t ON t.id=v.template_id
  AND t.organization_id=v.organization_id AND t.workspace_id=v.workspace_id
WHERE t.id IS NULL LIMIT 1;
INSERT INTO scoutops_approval_template_version_scope_guard
SELECT 1 FROM approval_requests r
LEFT JOIN approval_template_versions v ON v.id=r.template_version_id AND v.template_id=r.template_id
  AND v.organization_id=r.organization_id AND v.workspace_id=r.workspace_id
WHERE v.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_approval_template_version_scope_guard;
ALTER TABLE approval_template_versions DROP INDEX idx_approval_version_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
