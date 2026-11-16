-- Stop writers. Validate the exact rule, triggering notification and any retained action.
DROP TEMPORARY TABLE IF EXISTS scoutops_automation_execution_scope_guard;
CREATE TEMPORARY TABLE scoutops_automation_execution_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_automation_execution_scope_guard VALUES (1);
INSERT INTO scoutops_automation_execution_scope_guard
SELECT 1 FROM automation_executions x
LEFT JOIN automation_rules r ON r.id=x.rule_id
  AND r.organization_id=x.organization_id AND r.workspace_id=x.workspace_id
LEFT JOIN notifications n ON n.id=x.notification_id
  AND n.organization_id=x.organization_id AND n.workspace_id=x.workspace_id
LEFT JOIN tasks t ON x.action_resource_type='task' AND t.id=x.action_resource_id
  AND t.organization_id=x.organization_id AND t.workspace_id=x.workspace_id
  AND t.source_type='automation' AND t.source_ref_id=x.id
LEFT JOIN outbox_events a ON x.action_resource_type='notification' AND a.id=x.action_resource_id
  AND a.organization_id=x.organization_id AND a.workspace_id=x.workspace_id
  AND a.event_type='automation.notification.queued'
  AND BINARY JSON_UNQUOTE(JSON_EXTRACT(a.payload_json,'$.automation_execution_id'))=BINARY x.id
WHERE r.id IS NULL OR n.id IS NULL
  OR (x.action_resource_type='task' AND t.id IS NULL)
  OR (x.action_resource_type='notification' AND a.id IS NULL)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_automation_execution_scope_guard;
ALTER TABLE automation_executions
  DROP INDEX idx_automation_execution_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id,
  ADD KEY idx_automation_execution_rule_recent (rule_id,created_at,id),
  ADD KEY idx_automation_execution_rule_limit (rule_id,status,updated_at);
