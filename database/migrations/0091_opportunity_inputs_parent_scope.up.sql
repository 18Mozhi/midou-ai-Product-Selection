-- Stop writers. Verify both histories against the retained opportunity before any persistent DDL.
DROP TEMPORARY TABLE IF EXISTS scoutops_opportunity_inputs_scope_guard;
CREATE TEMPORARY TABLE scoutops_opportunity_inputs_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_opportunity_inputs_scope_guard VALUES (1);
INSERT INTO scoutops_opportunity_inputs_scope_guard
SELECT 1 FROM opportunity_refresh_jobs c LEFT JOIN opportunities o ON o.id=c.opportunity_id
WHERE o.id IS NULL OR NOT (o.organization_id <=> c.organization_id AND o.workspace_id <=> c.workspace_id)
LIMIT 1;
INSERT INTO scoutops_opportunity_inputs_scope_guard
SELECT 1 FROM opportunity_score_inputs c LEFT JOIN opportunities o ON o.id=c.opportunity_id
WHERE o.id IS NULL OR NOT (o.organization_id <=> c.organization_id AND o.workspace_id <=> c.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_opportunity_inputs_scope_guard;
ALTER TABLE opportunity_refresh_jobs DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE opportunity_score_inputs DROP INDEX idx_score_input_current,
  ADD KEY idx_score_input_parent_current (opportunity_id,is_current,dimension_code),
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
