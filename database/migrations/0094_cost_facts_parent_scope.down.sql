-- Stop writers. Restore exact legacy coordinates from the retained opportunity.
ALTER TABLE opportunity_cost_inputs ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE opportunity_cost_inputs h JOIN opportunities o ON o.id=h.opportunity_id
SET h.organization_id=o.organization_id,h.workspace_id=o.workspace_id;
ALTER TABLE opportunity_cost_inputs MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_cost_input_parent_current,
  ADD KEY idx_cost_input_current (organization_id,workspace_id,opportunity_id,platform,is_current,input_type);
ALTER TABLE opportunity_cost_input_reviews ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE opportunity_cost_input_reviews h JOIN opportunities o ON o.id=h.opportunity_id
SET h.organization_id=o.organization_id,h.workspace_id=o.workspace_id;
ALTER TABLE opportunity_cost_input_reviews MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_cost_review_reviewer_queue,
  ADD KEY idx_cost_review_queue (organization_id,workspace_id,reviewer_id,status,due_at),
  ADD KEY fk_cost_review_reviewer (reviewer_id),
  ADD CONSTRAINT fk_cost_review_org FOREIGN KEY (organization_id) REFERENCES organizations (id),
  ADD CONSTRAINT fk_cost_review_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id);
