-- Stop writers. Restore coordinates from the retained opportunity FK.
ALTER TABLE opportunity_decisions ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE opportunity_decisions d JOIN opportunities o ON o.id=d.opportunity_id
SET d.organization_id=o.organization_id,d.workspace_id=o.workspace_id;
ALTER TABLE opportunity_decisions MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_opportunity_decisions_scope (organization_id,workspace_id,opportunity_id,created_at);
