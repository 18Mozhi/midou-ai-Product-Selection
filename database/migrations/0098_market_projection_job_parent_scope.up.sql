-- Stop writers. Check both job families before any persistent DDL.
DROP TEMPORARY TABLE IF EXISTS scoutops_market_projection_scope_guard;
CREATE TEMPORARY TABLE scoutops_market_projection_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_market_projection_scope_guard VALUES (1);
INSERT INTO scoutops_market_projection_scope_guard
SELECT 1 FROM competitor_snapshot_jobs j LEFT JOIN competitors c ON c.id=j.competitor_id
LEFT JOIN competitor_snapshots s ON s.id=j.snapshot_id AND s.competitor_id=j.competitor_id
WHERE c.id IS NULL OR s.id IS NULL
  OR NOT (c.organization_id <=> j.organization_id AND c.workspace_id <=> j.workspace_id)
LIMIT 1;
INSERT INTO scoutops_market_projection_scope_guard
SELECT 1 FROM sourcing_projection_jobs j LEFT JOIN sourcing_searches s ON s.id=j.search_id
WHERE s.id IS NULL OR NOT (s.organization_id <=> j.organization_id AND s.workspace_id <=> j.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_market_projection_scope_guard;
ALTER TABLE competitor_snapshot_jobs DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE sourcing_projection_jobs DROP COLUMN organization_id, DROP COLUMN workspace_id;
