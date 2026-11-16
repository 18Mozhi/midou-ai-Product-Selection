-- Stop writers. Restore the exact legacy scope from the retained quote's candidate.
ALTER TABLE sourcing_purchase_tasks ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE sourcing_purchase_tasks p JOIN supplier_quotes q ON q.id=p.quote_id
JOIN sourcing_candidates c ON c.id=q.candidate_id
SET p.organization_id=c.organization_id,p.workspace_id=c.workspace_id;
ALTER TABLE sourcing_purchase_tasks MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_sourcing_purchase_delivery (organization_id,workspace_id,status,created_at);
