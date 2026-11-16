-- Stop writers. Restore coordinates from the retained parent foreign key.
ALTER TABLE opportunity_score_inputs ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE opportunity_score_inputs c JOIN opportunities o ON o.id=c.opportunity_id
SET c.organization_id=o.organization_id,c.workspace_id=o.workspace_id;
ALTER TABLE opportunity_score_inputs MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_score_input_parent_current,
  ADD KEY idx_score_input_current (organization_id,workspace_id,opportunity_id,is_current,dimension_code);
ALTER TABLE opportunity_refresh_jobs ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE opportunity_refresh_jobs c JOIN opportunities o ON o.id=c.opportunity_id
SET c.organization_id=o.organization_id,c.workspace_id=o.workspace_id;
ALTER TABLE opportunity_refresh_jobs MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL;
