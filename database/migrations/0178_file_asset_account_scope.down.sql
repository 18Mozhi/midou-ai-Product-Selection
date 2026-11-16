CREATE TEMPORARY TABLE scoutops_file_asset_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_file_asset_guard VALUES (1);
INSERT INTO scoutops_file_asset_guard
SELECT 1 FROM file_assets f LEFT JOIN workspaces w
  ON BINARY w.id=BINARY JSON_UNQUOTE(JSON_EXTRACT(f.historical_context,'$.workspace_id'))
  AND BINARY w.organization_id=BINARY JSON_UNQUOTE(JSON_EXTRACT(f.historical_context,'$.organization_id'))
LEFT JOIN account_owned_records o ON o.source_table='file_assets' AND o.source_id=f.id
LEFT JOIN (
  SELECT BINARY JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')) org,LEFT(relative_path,191) path_prefix
  FROM file_assets GROUP BY org,path_prefix HAVING COUNT(*)>1
) d ON d.org=BINARY w.organization_id AND d.path_prefix=LEFT(f.relative_path,191)
WHERE w.id IS NULL OR o.account_id IS NULL OR o.account_id<>f.account_id
  OR d.org IS NOT NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_file_asset_guard;
ALTER TABLE file_assets ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE file_assets SET organization_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.organization_id')),
  workspace_id=JSON_UNQUOTE(JSON_EXTRACT(historical_context,'$.workspace_id'));
ALTER TABLE file_assets MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD UNIQUE KEY uq_file_asset_org_path (organization_id,relative_path(191)),
  ADD KEY idx_file_asset_scope_status (organization_id,workspace_id,status,updated_at),
  DROP FOREIGN KEY fk_file_asset_account, DROP INDEX uq_file_asset_account_path,
  DROP INDEX idx_file_asset_account_status, DROP COLUMN account_id, DROP COLUMN historical_context;
