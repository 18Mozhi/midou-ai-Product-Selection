-- Stop writers. Restore coordinates from the retained search.
ALTER TABLE sourcing_candidates ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE sourcing_candidates c JOIN sourcing_searches s ON s.id=c.search_id
SET c.organization_id=s.organization_id,c.workspace_id=s.workspace_id;
ALTER TABLE sourcing_candidates MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_sourcing_candidate_parent_status,
  ADD KEY idx_sourcing_candidate_scope (organization_id,workspace_id,search_id,status);
