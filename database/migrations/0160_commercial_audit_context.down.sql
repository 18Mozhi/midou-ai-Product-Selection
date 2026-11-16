-- Refuse to restore either FK if any stored organization no longer exists.
DROP TEMPORARY TABLE IF EXISTS scoutops_commercial_audit_rollback_guard;
CREATE TEMPORARY TABLE scoutops_commercial_audit_rollback_guard (id INT PRIMARY KEY);
INSERT INTO scoutops_commercial_audit_rollback_guard VALUES (1);
INSERT INTO scoutops_commercial_audit_rollback_guard
SELECT 1 FROM commercial_events e
LEFT JOIN organizations o ON o.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(e.historical_context,'$.organization_id')) USING ascii)
WHERE e.historical_context IS NOT NULL AND o.id IS NULL LIMIT 1;
INSERT INTO scoutops_commercial_audit_rollback_guard
SELECT 1 FROM commercial_views v
LEFT JOIN organizations o ON o.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(v.historical_context,'$.organization_id')) USING ascii)
WHERE v.historical_context IS NOT NULL AND o.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_commercial_audit_rollback_guard;
ALTER TABLE commercial_events ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id;
ALTER TABLE commercial_views ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER actor_id;
UPDATE commercial_events SET organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')) WHERE historical_context IS NOT NULL;
UPDATE commercial_views SET organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')) WHERE historical_context IS NOT NULL;
ALTER TABLE commercial_events DROP COLUMN historical_context,
  ADD KEY idx_commercial_event_org_time (organization_id,occurred_at),
  ADD CONSTRAINT fk_commercial_event_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE commercial_views DROP COLUMN historical_context,
  ADD KEY fk_commercial_view_org (organization_id),
  ADD CONSTRAINT fk_commercial_view_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
