-- Preserve original scope strictly as audit context, not as an authorization relation.
ALTER TABLE authorization_decisions ADD COLUMN historical_context JSON NULL AFTER actor_id;
UPDATE authorization_decisions
SET historical_context=JSON_OBJECT('organization_id',organization_id,'workspace_id',workspace_id,'team_id',team_id)
WHERE organization_id IS NOT NULL OR workspace_id IS NOT NULL OR team_id IS NOT NULL;
ALTER TABLE authorization_decisions DROP INDEX idx_authz_org_outcome_time,
  DROP COLUMN organization_id, DROP COLUMN workspace_id, DROP COLUMN team_id;
