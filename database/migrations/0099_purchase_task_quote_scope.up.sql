-- Stop writers. Verify the original purchase-to-quote-to-candidate chain before DDL.
DROP TEMPORARY TABLE IF EXISTS scoutops_purchase_scope_guard;
CREATE TEMPORARY TABLE scoutops_purchase_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_purchase_scope_guard VALUES (1);
INSERT INTO scoutops_purchase_scope_guard
SELECT 1 FROM sourcing_purchase_tasks p
LEFT JOIN supplier_quotes q ON q.id=p.quote_id
LEFT JOIN sourcing_candidates c ON c.id=q.candidate_id
WHERE q.id IS NULL OR c.id IS NULL
  OR NOT (c.organization_id <=> p.organization_id AND c.workspace_id <=> p.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_purchase_scope_guard;
ALTER TABLE sourcing_purchase_tasks DROP INDEX idx_sourcing_purchase_delivery,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
