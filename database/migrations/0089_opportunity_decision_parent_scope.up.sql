-- Stop writers. Refuse to remove duplicate coordinates if the parent does not agree.
DROP TEMPORARY TABLE IF EXISTS scoutops_opportunity_decision_scope_guard;
CREATE TEMPORARY TABLE scoutops_opportunity_decision_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_opportunity_decision_scope_guard VALUES (1);
INSERT INTO scoutops_opportunity_decision_scope_guard
SELECT 1 FROM opportunity_decisions d LEFT JOIN opportunities o ON o.id=d.opportunity_id
WHERE o.id IS NULL OR NOT (o.organization_id <=> d.organization_id AND o.workspace_id <=> d.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_opportunity_decision_scope_guard;
ALTER TABLE opportunity_decisions DROP INDEX idx_opportunity_decisions_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
