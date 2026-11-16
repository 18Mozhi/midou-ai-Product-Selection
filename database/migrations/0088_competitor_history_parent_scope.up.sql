-- Stop writers. Verify all three histories before removing duplicate coordinates.
DROP TEMPORARY TABLE IF EXISTS scoutops_competitor_history_scope_guard;
CREATE TEMPORARY TABLE scoutops_competitor_history_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_competitor_history_scope_guard VALUES (1);
INSERT INTO scoutops_competitor_history_scope_guard
SELECT 1 FROM competitor_snapshots s LEFT JOIN competitors c ON c.id=s.competitor_id
WHERE c.id IS NULL OR NOT (s.organization_id <=> c.organization_id AND s.workspace_id <=> c.workspace_id)
LIMIT 1;
INSERT INTO scoutops_competitor_history_scope_guard
SELECT 1 FROM competitor_changes d LEFT JOIN competitors c ON c.id=d.competitor_id
LEFT JOIN competitor_snapshots s ON s.id=d.snapshot_id AND s.competitor_id=c.id
WHERE c.id IS NULL OR s.id IS NULL OR NOT (d.organization_id <=> c.organization_id AND d.workspace_id <=> c.workspace_id)
LIMIT 1;
INSERT INTO scoutops_competitor_history_scope_guard
SELECT 1 FROM competitor_alerts a LEFT JOIN competitors c ON c.id=a.competitor_id
LEFT JOIN competitor_changes d ON d.id=a.change_id AND d.competitor_id=c.id
LEFT JOIN competitor_monitor_rules r ON r.id=a.rule_id AND (r.competitor_id IS NULL OR r.competitor_id=c.id)
WHERE c.id IS NULL OR d.id IS NULL OR r.id IS NULL
  OR NOT (a.organization_id <=> c.organization_id AND a.workspace_id <=> c.workspace_id)
  OR NOT (r.organization_id <=> c.organization_id AND r.workspace_id <=> c.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_competitor_history_scope_guard;
ALTER TABLE competitor_snapshots
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE competitor_changes
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE competitor_alerts DROP INDEX idx_competitor_alert_delivery,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
