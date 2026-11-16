-- Stop writers. Verify the opportunity, original rule and optional task before persistent DDL.
DROP TEMPORARY TABLE IF EXISTS scoutops_calculation_jobs_scope_guard;
CREATE TEMPORARY TABLE scoutops_calculation_jobs_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_calculation_jobs_scope_guard VALUES (1);
INSERT INTO scoutops_calculation_jobs_scope_guard
SELECT 1 FROM opportunity_score_jobs j
LEFT JOIN opportunities o ON o.id=j.opportunity_id
LEFT JOIN score_rules r ON r.id=j.score_rule_id
LEFT JOIN tasks task ON task.id=j.trigger_task_id
WHERE o.id IS NULL OR r.id IS NULL
  OR NOT (o.organization_id <=> j.organization_id AND o.workspace_id <=> j.workspace_id)
  OR NOT (r.organization_id <=> j.organization_id AND r.workspace_id <=> j.workspace_id)
  OR (j.trigger_task_id IS NOT NULL AND (task.id IS NULL OR NOT (task.organization_id <=> j.organization_id AND task.workspace_id <=> j.workspace_id)))
LIMIT 1;
INSERT INTO scoutops_calculation_jobs_scope_guard
SELECT 1 FROM opportunity_profit_jobs j
LEFT JOIN opportunities o ON o.id=j.opportunity_id
LEFT JOIN cost_rules r ON r.id=j.cost_rule_id
WHERE o.id IS NULL OR r.id IS NULL
  OR NOT (o.organization_id <=> j.organization_id AND o.workspace_id <=> j.workspace_id)
  OR NOT (r.organization_id <=> j.organization_id AND r.workspace_id <=> j.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_calculation_jobs_scope_guard;
ALTER TABLE opportunity_score_jobs DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE opportunity_profit_jobs DROP COLUMN organization_id, DROP COLUMN workspace_id;
