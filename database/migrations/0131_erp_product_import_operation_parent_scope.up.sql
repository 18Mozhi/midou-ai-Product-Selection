-- Stop writers. An import operation inherits the scope of its original task.
DROP TEMPORARY TABLE IF EXISTS scoutops_erp_import_scope_guard;
CREATE TEMPORARY TABLE scoutops_erp_import_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_erp_import_scope_guard VALUES (1);
INSERT INTO scoutops_erp_import_scope_guard
SELECT 1 FROM erp_product_import_operations o LEFT JOIN collection_tasks t ON t.id=o.task_id
WHERE t.id IS NULL OR NOT (o.organization_id <=> t.organization_id AND o.workspace_id <=> t.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_erp_import_scope_guard;
ALTER TABLE erp_product_import_operations DROP INDEX idx_erp_product_import_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
