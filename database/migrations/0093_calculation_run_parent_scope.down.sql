-- Stop writers. Reconstruct the former scope from each retained parent opportunity.
ALTER TABLE opportunity_profit_runs ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE opportunity_profit_runs h JOIN opportunities o ON o.id=h.opportunity_id
SET h.organization_id=o.organization_id,h.workspace_id=o.workspace_id;
ALTER TABLE opportunity_profit_runs MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_profit_run_parent_time,
  ADD KEY idx_profit_run_scope (organization_id,workspace_id,opportunity_id,calculated_at),
  ADD KEY fk_profit_run_opportunity (opportunity_id);
ALTER TABLE opportunity_score_runs ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE opportunity_score_runs h JOIN opportunities o ON o.id=h.opportunity_id
SET h.organization_id=o.organization_id,h.workspace_id=o.workspace_id;
ALTER TABLE opportunity_score_runs MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_score_run_parent_time,
  ADD KEY idx_score_run_scope (organization_id,workspace_id,opportunity_id,scored_at),
  ADD KEY fk_score_run_opportunity (opportunity_id);
