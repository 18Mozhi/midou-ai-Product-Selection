-- Stop writers. The old organization is provenance, not an audit ownership relation.
ALTER TABLE commercial_events ADD COLUMN historical_context JSON NULL AFTER organization_id;
ALTER TABLE commercial_views ADD COLUMN historical_context JSON NULL AFTER organization_id;
UPDATE commercial_events SET historical_context=JSON_OBJECT('organization_id',organization_id) WHERE organization_id IS NOT NULL;
UPDATE commercial_views SET historical_context=JSON_OBJECT('organization_id',organization_id) WHERE organization_id IS NOT NULL;
ALTER TABLE commercial_events DROP FOREIGN KEY fk_commercial_event_org,
  DROP INDEX idx_commercial_event_org_time, DROP COLUMN organization_id;
ALTER TABLE commercial_views DROP FOREIGN KEY fk_commercial_view_org,
  DROP INDEX fk_commercial_view_org, DROP COLUMN organization_id;
