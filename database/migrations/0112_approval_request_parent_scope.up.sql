-- Apply after 0111 with writers stopped. Check the exact template, version and business target.
DROP TEMPORARY TABLE IF EXISTS scoutops_approval_request_scope_guard;
CREATE TEMPORARY TABLE scoutops_approval_request_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_approval_request_scope_guard VALUES (1);
INSERT INTO scoutops_approval_request_scope_guard
SELECT 1 FROM approval_requests r
LEFT JOIN approval_templates t ON t.id=r.template_id AND t.resource_type=r.resource_type
  AND t.organization_id=r.organization_id AND t.workspace_id=r.workspace_id
LEFT JOIN approval_template_versions v ON v.id=r.template_version_id AND v.template_id=t.id
LEFT JOIN tasks b ON r.resource_type='task' AND b.id=r.resource_id
  AND b.organization_id=r.organization_id AND b.workspace_id=r.workspace_id
LEFT JOIN opportunity_decisions d ON r.resource_type='opportunity_decision' AND d.id=r.resource_id
LEFT JOIN opportunities o ON o.id=d.opportunity_id
  AND o.organization_id=r.organization_id AND o.workspace_id=r.workspace_id
WHERE v.id IS NULL OR (b.id IS NULL AND o.id IS NULL) LIMIT 1;
DROP TEMPORARY TABLE scoutops_approval_request_scope_guard;
ALTER TABLE approval_requests
  DROP INDEX idx_approval_request_scope_status, DROP INDEX idx_approval_request_resource,
  DROP COLUMN organization_id, DROP COLUMN workspace_id,
  ADD KEY idx_approval_request_status (status,updated_at),
  ADD KEY idx_approval_request_target (resource_type,resource_id);
