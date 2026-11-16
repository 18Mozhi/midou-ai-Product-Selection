-- Stopped-writer rehearsal. Match the actual old index to its 0075 migration receipt.
CREATE TEMPORARY TABLE scoutops_competitor_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_competitor_scope_guard VALUES (1);
INSERT INTO scoutops_competitor_scope_guard
SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'
  OR SUBSTRING_INDEX(VERSION(),'.',2)<>'5.7'
  OR NOT EXISTS (SELECT 1 FROM account_ownership_cutover WHERE slot='current' AND contract_version=25)
  OR NOT ((SELECT GROUP_CONCAT(IF(SUB_PART IS NULL,COLUMN_NAME,'!') ORDER BY SEQ_IN_INDEX) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='competitors' AND INDEX_NAME='uq_competitor_identity' AND NON_UNIQUE=0)
    <=> IF(EXISTS (SELECT 1 FROM schema_migrations WHERE name='0075_competitor_opportunity_identity.up.sql'),
      'organization_id,workspace_id,market,source_site,external_id,opportunity_id','organization_id,workspace_id,market,source_site,external_id'));
INSERT INTO scoutops_competitor_scope_guard
SELECT 1 FROM competitors c
JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
LEFT JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='competitors' AND r.source_id=c.id
LEFT JOIN account_retirement_scopes s ON s.run_id=r.run_id AND s.legacy_org_id=r.legacy_org_id AND s.legacy_workspace_id=r.legacy_workspace_id
LEFT JOIN account_owned_records o ON o.source_table='competitors' AND o.source_id=c.id
LEFT JOIN users u ON u.id=o.account_id
LEFT JOIN account_owned_records p ON p.source_table='opportunities' AND p.source_id=c.opportunity_id
LEFT JOIN competitor_snapshots snap ON snap.id=c.latest_snapshot_id AND snap.competitor_id=c.id
LEFT JOIN account_owned_records so ON so.source_table='competitor_snapshots' AND so.source_id=snap.id
WHERE r.source_id IS NULL OR s.account_id IS NULL OR u.id IS NULL
  OR NOT (c.organization_id<=>r.legacy_org_id AND c.workspace_id<=>r.legacy_workspace_id)
  OR NOT (s.account_id<=>o.account_id AND s.reason<=>o.reason)
  OR (o.reason IN ('shared','unassigned') AND o.account_id<>cut.primary_account_id)
  OR (c.opportunity_id IS NOT NULL AND NOT(p.account_id<=>o.account_id))
  OR (c.latest_snapshot_id IS NOT NULL AND (snap.id IS NULL OR NOT(so.account_id<=>o.account_id)))
LIMIT 1;
INSERT INTO scoutops_competitor_scope_guard
SELECT 1 FROM competitors c JOIN account_owned_records o ON o.source_table='competitors' AND o.source_id=c.id
GROUP BY o.account_id,c.market,c.source_site,c.external_id,c.opportunity_id HAVING COUNT(*)>1
LIMIT 1;
DROP TEMPORARY TABLE scoutops_competitor_scope_guard;
ALTER TABLE competitors ADD COLUMN account_id CHAR(36) CHARACTER SET ascii NULL AFTER id;
UPDATE competitors c JOIN account_owned_records o ON o.source_table='competitors' AND o.source_id=c.id SET c.account_id=o.account_id;
ALTER TABLE competitors MODIFY COLUMN account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_competitor_account_identity (account_id,market,source_site,external_id,opportunity_id),
  ADD KEY idx_competitor_account_scope (account_id,status,updated_at),
  ADD KEY idx_competitor_account_active (account_id,deleted_at,status,updated_at),
  ADD CONSTRAINT fk_competitor_account FOREIGN KEY (account_id) REFERENCES users(id),
  DROP FOREIGN KEY fk_competitor_org, DROP FOREIGN KEY fk_competitor_workspace,
  DROP INDEX uq_competitor_identity, DROP INDEX idx_competitor_scope,
  DROP INDEX idx_competitor_active_scope, DROP INDEX fk_competitor_workspace,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
