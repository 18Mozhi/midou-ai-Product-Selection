-- Stop writers. Reject broken parent and provenance links before removing duplicate scope.
DROP TEMPORARY TABLE IF EXISTS scoutops_sourcing_candidate_scope_guard;
CREATE TEMPORARY TABLE scoutops_sourcing_candidate_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_sourcing_candidate_scope_guard VALUES (1);
INSERT INTO scoutops_sourcing_candidate_scope_guard
SELECT 1 FROM sourcing_candidates c
LEFT JOIN sourcing_searches s ON s.id=c.search_id
LEFT JOIN normalized_records n ON n.id=c.normalized_record_id
LEFT JOIN raw_evidence r ON r.id=c.raw_evidence_id
WHERE s.id IS NULL OR n.id IS NULL OR r.id IS NULL
  OR NOT (s.organization_id <=> c.organization_id AND s.workspace_id <=> c.workspace_id)
  OR NOT (n.organization_id <=> c.organization_id AND n.workspace_id <=> c.workspace_id)
  OR NOT (r.organization_id <=> c.organization_id AND r.workspace_id <=> c.workspace_id)
  OR NOT (n.raw_evidence_id <=> r.id AND n.provider_id <=> c.provider_id AND r.provider_id <=> c.provider_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_sourcing_candidate_scope_guard;
ALTER TABLE sourcing_candidates DROP INDEX idx_sourcing_candidate_scope,
  ADD KEY idx_sourcing_candidate_parent_status (search_id,status),
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
