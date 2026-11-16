ALTER TABLE authorization_decisions
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER actor_id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id,
  ADD COLUMN team_id CHAR(36) CHARACTER SET ascii NULL AFTER workspace_id;
UPDATE authorization_decisions
SET organization_id=IF(JSON_TYPE(JSON_EXTRACT(historical_context,'$.organization_id'))='STRING',JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),NULL),
    workspace_id=IF(JSON_TYPE(JSON_EXTRACT(historical_context,'$.workspace_id'))='STRING',JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.workspace_id')),NULL),
    team_id=IF(JSON_TYPE(JSON_EXTRACT(historical_context,'$.team_id'))='STRING',JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.team_id')),NULL)
WHERE historical_context IS NOT NULL;
ALTER TABLE authorization_decisions DROP COLUMN historical_context,
  ADD KEY idx_authz_org_outcome_time (organization_id,outcome,occurred_at);
