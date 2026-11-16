CREATE TEMPORARY TABLE scoutops_file_asset_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_file_asset_guard VALUES (1);
INSERT INTO scoutops_file_asset_guard
SELECT 1 FROM file_assets f
LEFT JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25
LEFT JOIN account_retirement_scopes s ON s.run_id=c.source_run_id AND s.legacy_org_id=f.organization_id AND s.legacy_workspace_id=f.workspace_id
LEFT JOIN account_owned_records o ON o.source_table='file_assets' AND o.source_id=f.id
WHERE o.account_id IS NULL OR s.account_id IS NULL OR o.account_id<>s.account_id
  OR NOT (o.reason='exclusive_owner' OR (o.reason IN ('shared','unassigned') AND o.account_id=c.primary_account_id)) LIMIT 1;
INSERT INTO scoutops_file_asset_guard
SELECT 1 FROM file_assets f JOIN account_owned_records o ON o.source_table='file_assets' AND o.source_id=f.id
GROUP BY o.account_id,LEFT(f.relative_path,191) HAVING COUNT(*)>1 LIMIT 1;
DROP TEMPORARY TABLE scoutops_file_asset_guard;
ALTER TABLE file_assets ADD COLUMN account_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN historical_context JSON NULL AFTER account_id;
UPDATE file_assets f JOIN account_owned_records o ON o.source_table='file_assets' AND o.source_id=f.id
SET f.account_id=o.account_id,f.historical_context=JSON_OBJECT('organization_id',f.organization_id,'workspace_id',f.workspace_id);
ALTER TABLE file_assets MODIFY COLUMN account_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_file_asset_account_path (account_id,relative_path(191)),
  ADD KEY idx_file_asset_account_status (account_id,status,updated_at),
  ADD CONSTRAINT fk_file_asset_account FOREIGN KEY(account_id) REFERENCES users(id) ON DELETE RESTRICT,
  DROP INDEX uq_file_asset_org_path, DROP INDEX idx_file_asset_scope_status,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
