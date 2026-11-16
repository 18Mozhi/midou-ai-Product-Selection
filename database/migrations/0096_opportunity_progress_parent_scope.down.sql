-- Stop writers. Reconstruct legacy coordinates from each retained opportunity.
ALTER TABLE automatic_selection_evaluations ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER opportunity_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE automatic_selection_evaluations j JOIN opportunities o ON o.id=j.opportunity_id
SET j.organization_id=o.organization_id,j.workspace_id=o.workspace_id;
ALTER TABLE automatic_selection_evaluations MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_automatic_selection_evaluation_scope (organization_id,workspace_id,updated_at);
ALTER TABLE opportunity_rule_matches ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE opportunity_rule_matches j JOIN opportunities o ON o.id=j.opportunity_id
SET j.organization_id=o.organization_id,j.workspace_id=o.workspace_id;
ALTER TABLE opportunity_rule_matches MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_opportunity_rule_scope (organization_id,workspace_id,matched_at);
