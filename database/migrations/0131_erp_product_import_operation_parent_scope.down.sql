-- Stop writers. Restore scope from the retained collection-task FK.
ALTER TABLE erp_product_import_operations ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE erp_product_import_operations o JOIN collection_tasks t ON t.id=o.task_id
SET o.organization_id=t.organization_id,o.workspace_id=t.workspace_id;
ALTER TABLE erp_product_import_operations MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD INDEX idx_erp_product_import_scope (organization_id,workspace_id,created_at);
