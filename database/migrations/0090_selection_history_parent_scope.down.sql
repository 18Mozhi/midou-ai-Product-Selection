-- Stop writers. Restore coordinates from retained parent foreign keys.
ALTER TABLE opportunity_operating_facts ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE opportunity_operating_facts h JOIN opportunities p ON p.id=h.opportunity_id
SET h.organization_id=p.organization_id,h.workspace_id=p.workspace_id;
ALTER TABLE opportunity_operating_facts MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_operating_fact_scope_time (organization_id,workspace_id,opportunity_id,period_end,created_at),
  ADD CONSTRAINT fk_operating_fact_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_operating_fact_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE RESTRICT;
ALTER TABLE score_rule_actions ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE score_rule_actions h JOIN score_rules p ON p.id=h.score_rule_id
SET h.organization_id=p.organization_id,h.workspace_id=p.workspace_id;
ALTER TABLE score_rule_actions MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_score_rule_action_scope (organization_id,workspace_id,score_rule_id,created_at);
