-- Restore only exact sealed coordinates, and reject old-key collisions before DDL.
CREATE TEMPORARY TABLE scoutops_competitor_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_competitor_scope_guard VALUES (1);
INSERT INTO scoutops_competitor_scope_guard
SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'
  OR SUBSTRING_INDEX(VERSION(),'.',2)<>'5.7'
  OR NOT EXISTS (SELECT 1 FROM account_ownership_cutover WHERE slot='current' AND contract_version=25);
INSERT INTO scoutops_competitor_scope_guard
SELECT 1 FROM competitors c
JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
LEFT JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='competitors' AND r.source_id=c.id
LEFT JOIN account_retirement_scopes s ON s.run_id=r.run_id AND s.legacy_org_id=r.legacy_org_id AND s.legacy_workspace_id=r.legacy_workspace_id
LEFT JOIN account_owned_records o ON o.source_table='competitors' AND o.source_id=c.id
LEFT JOIN workspaces w ON w.id=r.legacy_workspace_id AND w.organization_id=r.legacy_org_id
WHERE r.source_id IS NULL OR s.account_id IS NULL OR w.id IS NULL
  OR NOT (c.account_id<=>o.account_id AND c.account_id<=>s.account_id AND o.reason<=>s.reason)
  OR (o.reason IN ('shared','unassigned') AND o.account_id<>cut.primary_account_id)
LIMIT 1;
INSERT INTO scoutops_competitor_scope_guard
SELECT 1 FROM competitors c JOIN account_ownership_cutover cut ON cut.slot='current'
JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='competitors' AND r.source_id=c.id
JOIN (SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE name='0075_competitor_opportunity_identity.up.sql') has_0075) legacy
  ON legacy.has_0075=0 OR c.opportunity_id IS NOT NULL
GROUP BY r.legacy_org_id,r.legacy_workspace_id,c.market,c.source_site,c.external_id,
  IF(legacy.has_0075,c.opportunity_id,NULL) HAVING COUNT(*)>1
LIMIT 1;
INSERT INTO scoutops_competitor_scope_guard
SELECT 1 FROM outbox_events e
WHERE e.event_type='competitor.threshold.triggered'
  AND JSON_CONTAINS_PATH(e.payload_json,'one','$.competitor_account_contract')
LIMIT 1;
DROP TEMPORARY TABLE scoutops_competitor_scope_guard;
ALTER TABLE competitors ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE competitors c JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='competitors' AND r.source_id=c.id
SET c.organization_id=r.legacy_org_id,c.workspace_id=r.legacy_workspace_id;
SET @scoutops_competitor_has_0075 = EXISTS (SELECT 1 FROM schema_migrations WHERE name='0075_competitor_opportunity_identity.up.sql');
SET @scoutops_competitor_restore_ddl = CONCAT('ALTER TABLE competitors MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_competitor_identity (organization_id,workspace_id,market,source_site,external_id',IF(@scoutops_competitor_has_0075,',opportunity_id',''),'),
  ADD KEY idx_competitor_scope (organization_id,workspace_id,status,updated_at),
  ADD KEY idx_competitor_active_scope (organization_id,workspace_id,deleted_at,status,updated_at),
  ADD KEY fk_competitor_workspace (workspace_id),
  ADD CONSTRAINT fk_competitor_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_competitor_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  DROP FOREIGN KEY fk_competitor_account,
  DROP INDEX uq_competitor_account_identity, DROP INDEX idx_competitor_account_scope, DROP INDEX idx_competitor_account_active,
  DROP COLUMN account_id');
PREPARE scoutops_competitor_restore_index FROM @scoutops_competitor_restore_ddl;
EXECUTE scoutops_competitor_restore_index;
DEALLOCATE PREPARE scoutops_competitor_restore_index;
