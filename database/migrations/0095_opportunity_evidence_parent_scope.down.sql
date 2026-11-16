-- Stop writers. Restore exact legacy coordinates from the retained opportunity.
ALTER TABLE opportunity_evidence_links ADD COLUMN organization_id CHAR(36) CHARACTER SET ascii NULL AFTER id,
  ADD COLUMN workspace_id CHAR(36) CHARACTER SET ascii NULL AFTER organization_id;
UPDATE opportunity_evidence_links l JOIN opportunities o ON o.id=l.opportunity_id
SET l.organization_id=o.organization_id,l.workspace_id=o.workspace_id;
ALTER TABLE opportunity_evidence_links MODIFY COLUMN organization_id CHAR(36) CHARACTER SET ascii NOT NULL,
  MODIFY COLUMN workspace_id CHAR(36) CHARACTER SET ascii NOT NULL,
  DROP INDEX idx_opportunity_evidence_parent_time,
  ADD KEY idx_opportunity_evidence_scope (organization_id,workspace_id,opportunity_id,observed_at);
