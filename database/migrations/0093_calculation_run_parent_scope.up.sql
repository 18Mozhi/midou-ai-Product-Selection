-- Stop writers. Verify both histories against the original opportunity and rule before persistent DDL.
DROP TEMPORARY TABLE IF EXISTS scoutops_calculation_runs_scope_guard;
CREATE TEMPORARY TABLE scoutops_calculation_runs_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_calculation_runs_scope_guard VALUES (1);
INSERT INTO scoutops_calculation_runs_scope_guard
SELECT 1 FROM opportunity_score_runs h
LEFT JOIN opportunities o ON o.id=h.opportunity_id
LEFT JOIN score_rules r ON r.id=h.score_rule_id
WHERE o.id IS NULL OR r.id IS NULL
  OR NOT (o.organization_id <=> h.organization_id AND o.workspace_id <=> h.workspace_id)
  OR NOT (r.organization_id <=> h.organization_id AND r.workspace_id <=> h.workspace_id)
LIMIT 1;
INSERT INTO scoutops_calculation_runs_scope_guard
SELECT 1 FROM opportunity_profit_runs h
LEFT JOIN opportunities o ON o.id=h.opportunity_id
LEFT JOIN cost_rules r ON r.id=h.cost_rule_id
WHERE o.id IS NULL OR r.id IS NULL
  OR NOT (o.organization_id <=> h.organization_id AND o.workspace_id <=> h.workspace_id)
  OR NOT (r.organization_id <=> h.organization_id AND r.workspace_id <=> h.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_calculation_runs_scope_guard;
ALTER TABLE opportunity_score_runs DROP INDEX idx_score_run_scope, DROP INDEX fk_score_run_opportunity,
  ADD KEY idx_score_run_parent_time (opportunity_id,scored_at),
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE opportunity_profit_runs DROP INDEX idx_profit_run_scope, DROP INDEX fk_profit_run_opportunity,
  ADD KEY idx_profit_run_parent_time (opportunity_id,calculated_at),
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
