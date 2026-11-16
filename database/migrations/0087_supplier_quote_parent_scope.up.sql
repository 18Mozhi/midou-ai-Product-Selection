-- Stop writers. Refuse to erase the old coordinates unless quote, candidate and evidence agree.
DROP TEMPORARY TABLE IF EXISTS scoutops_supplier_quote_scope_guard;
CREATE TEMPORARY TABLE scoutops_supplier_quote_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_supplier_quote_scope_guard VALUES (1);
INSERT INTO scoutops_supplier_quote_scope_guard
SELECT 1 FROM supplier_quotes q
LEFT JOIN sourcing_candidates c ON c.id=q.candidate_id
LEFT JOIN raw_evidence e ON e.id=q.evidence_id
WHERE c.id IS NULL OR e.id IS NULL
  OR NOT (q.organization_id <=> c.organization_id AND q.workspace_id <=> c.workspace_id)
  OR NOT (q.organization_id <=> e.organization_id AND q.workspace_id <=> e.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_supplier_quote_scope_guard;
ALTER TABLE supplier_quotes DROP INDEX idx_supplier_quote_current,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
