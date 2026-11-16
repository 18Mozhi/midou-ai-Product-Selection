ALTER TABLE sourcing_comparisons
  ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE sourcing_comparisons c JOIN supplier_quotes q ON q.id=c.anchor_quote_id
JOIN sourcing_candidates a ON a.id=q.candidate_id JOIN sourcing_searches s ON s.id=a.search_id
SET c.organization_id=s.organization_id,c.workspace_id=s.workspace_id;
ALTER TABLE sourcing_comparisons
  MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  ADD KEY idx_sourcing_comparison_scope (organization_id,workspace_id,created_at),
  DROP FOREIGN KEY fk_sourcing_comparison_anchor_quote,
  DROP INDEX fk_sourcing_comparison_anchor_quote,
  DROP INDEX idx_sourcing_comparison_created,
  DROP COLUMN anchor_quote_id;
