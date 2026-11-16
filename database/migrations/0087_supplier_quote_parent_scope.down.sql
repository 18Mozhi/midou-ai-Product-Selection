-- Stop writers. Restore original coordinates from the retained candidate FK.
ALTER TABLE supplier_quotes ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE supplier_quotes q JOIN sourcing_candidates c ON c.id=q.candidate_id
SET q.organization_id=c.organization_id,q.workspace_id=c.workspace_id;
ALTER TABLE supplier_quotes MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_supplier_quote_current (organization_id,workspace_id,is_current,created_at);
