-- Restore the original coordinates from the retained task on the stopped-writer rehearsal.
CREATE TEMPORARY TABLE scoutops_sourcing_search_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_sourcing_search_scope_guard VALUES (1);
INSERT INTO scoutops_sourcing_search_scope_guard
SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'
  OR SUBSTRING_INDEX(VERSION(),'.',2)<>'5.7'
  OR NOT EXISTS (SELECT 1 FROM account_ownership_cutover WHERE slot='current' AND contract_version=25);
INSERT INTO scoutops_sourcing_search_scope_guard
SELECT 1 FROM sourcing_searches s
LEFT JOIN collection_tasks t ON t.id=s.collection_task_id
LEFT JOIN account_owned_records so ON so.source_table='sourcing_searches' AND so.source_id=s.id
LEFT JOIN account_owned_records tor ON tor.source_table='collection_tasks' AND tor.source_id=t.id
JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
WHERE t.id IS NULL OR t.organization_id IS NULL OR t.workspace_id IS NULL
  OR so.account_id IS NULL OR NOT (so.account_id<=>tor.account_id)
  OR NOT (so.reason='exclusive_owner' OR (so.reason IN ('shared','unassigned') AND so.account_id=cut.primary_account_id))
LIMIT 1;
DROP TEMPORARY TABLE scoutops_sourcing_search_scope_guard;
ALTER TABLE sourcing_searches
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE sourcing_searches s JOIN collection_tasks t ON t.id=s.collection_task_id
SET s.organization_id=t.organization_id,s.workspace_id=t.workspace_id;
ALTER TABLE sourcing_searches
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_sourcing_search_scope (organization_id,workspace_id,created_at),
  ADD KEY idx_sourcing_search_active_scope (organization_id,workspace_id,deleted_at,created_at);
