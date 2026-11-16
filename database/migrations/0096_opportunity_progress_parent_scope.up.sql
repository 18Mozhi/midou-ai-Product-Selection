-- Stop writers. Verify original rule links and queue rows before persistent DDL.
DROP TEMPORARY TABLE IF EXISTS scoutops_opportunity_progress_scope_guard;
CREATE TEMPORARY TABLE scoutops_opportunity_progress_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_opportunity_progress_scope_guard VALUES (1);
INSERT INTO scoutops_opportunity_progress_scope_guard
SELECT 1 FROM opportunity_rule_matches m
LEFT JOIN opportunities o ON o.id=m.opportunity_id
LEFT JOIN trend_monitoring_rules r ON r.id=m.monitoring_rule_id
LEFT JOIN trend_topics t ON t.id=m.topic_id
WHERE o.id IS NULL OR r.id IS NULL OR t.id IS NULL
  OR NOT (o.organization_id <=> m.organization_id AND o.workspace_id <=> m.workspace_id)
  OR NOT (r.organization_id <=> m.organization_id AND r.workspace_id <=> m.workspace_id)
  OR NOT (t.organization_id <=> m.organization_id AND t.workspace_id <=> m.workspace_id)
LIMIT 1;
INSERT INTO scoutops_opportunity_progress_scope_guard
SELECT 1 FROM automatic_selection_evaluations e LEFT JOIN opportunities o ON o.id=e.opportunity_id
WHERE o.id IS NULL OR NOT (o.organization_id <=> e.organization_id AND o.workspace_id <=> e.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_opportunity_progress_scope_guard;
ALTER TABLE opportunity_rule_matches DROP INDEX idx_opportunity_rule_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE automatic_selection_evaluations DROP INDEX idx_automatic_selection_evaluation_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
