-- Stop writers. Verify all cost inputs and reviews before persistent DDL.
DROP TEMPORARY TABLE IF EXISTS scoutops_cost_facts_scope_guard;
CREATE TEMPORARY TABLE scoutops_cost_facts_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_cost_facts_scope_guard VALUES (1);
INSERT INTO scoutops_cost_facts_scope_guard
SELECT 1 FROM opportunity_cost_inputs i LEFT JOIN opportunities o ON o.id=i.opportunity_id
WHERE o.id IS NULL OR NOT (o.organization_id <=> i.organization_id AND o.workspace_id <=> i.workspace_id)
LIMIT 1;
INSERT INTO scoutops_cost_facts_scope_guard
SELECT 1 FROM opportunity_cost_input_reviews r
LEFT JOIN opportunities o ON o.id=r.opportunity_id
LEFT JOIN opportunity_cost_inputs i ON i.id=r.cost_input_id AND i.opportunity_id=r.opportunity_id
WHERE o.id IS NULL OR i.id IS NULL
  OR NOT (o.organization_id <=> r.organization_id AND o.workspace_id <=> r.workspace_id)
  OR NOT (i.organization_id <=> r.organization_id AND i.workspace_id <=> r.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_cost_facts_scope_guard;
ALTER TABLE opportunity_cost_input_reviews DROP FOREIGN KEY fk_cost_review_org,
  DROP FOREIGN KEY fk_cost_review_workspace, DROP INDEX idx_cost_review_queue,
  DROP INDEX fk_cost_review_reviewer, ADD KEY idx_cost_review_reviewer_queue (reviewer_id,status,due_at),
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE opportunity_cost_inputs DROP INDEX idx_cost_input_current,
  ADD KEY idx_cost_input_parent_current (opportunity_id,platform,is_current,input_type),
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
