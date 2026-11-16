-- Stop writers. Validate both histories before changing either persistent table.
DROP TEMPORARY TABLE IF EXISTS scoutops_selection_history_scope_guard;
CREATE TEMPORARY TABLE scoutops_selection_history_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_selection_history_scope_guard VALUES (1);
INSERT INTO scoutops_selection_history_scope_guard
SELECT 1 FROM score_rule_actions h LEFT JOIN score_rules p ON p.id=h.score_rule_id
WHERE p.id IS NULL OR NOT (p.organization_id <=> h.organization_id AND p.workspace_id <=> h.workspace_id)
LIMIT 1;
INSERT INTO scoutops_selection_history_scope_guard
SELECT 1 FROM opportunity_operating_facts h LEFT JOIN opportunities p ON p.id=h.opportunity_id
WHERE p.id IS NULL OR NOT (p.organization_id <=> h.organization_id AND p.workspace_id <=> h.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_selection_history_scope_guard;
ALTER TABLE score_rule_actions DROP INDEX idx_score_rule_action_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE opportunity_operating_facts DROP FOREIGN KEY fk_operating_fact_org, DROP FOREIGN KEY fk_operating_fact_workspace,
  DROP INDEX idx_operating_fact_scope_time,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
