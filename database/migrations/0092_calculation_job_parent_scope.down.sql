-- Stop writers. Rebuild the former coordinates from the retained opportunity.
ALTER TABLE opportunity_score_jobs ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE opportunity_score_jobs j JOIN opportunities o ON o.id=j.opportunity_id
SET j.organization_id=o.organization_id,j.workspace_id=o.workspace_id;
ALTER TABLE opportunity_score_jobs MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL;
ALTER TABLE opportunity_profit_jobs ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE opportunity_profit_jobs j JOIN opportunities o ON o.id=j.opportunity_id
SET j.organization_id=o.organization_id,j.workspace_id=o.workspace_id;
ALTER TABLE opportunity_profit_jobs MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL;
