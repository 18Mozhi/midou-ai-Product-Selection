-- Stop writers. Verify every original link against its opportunity, raw evidence and signal.
DROP TEMPORARY TABLE IF EXISTS scoutops_opportunity_evidence_scope_guard;
CREATE TEMPORARY TABLE scoutops_opportunity_evidence_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_opportunity_evidence_scope_guard VALUES (1);
INSERT INTO scoutops_opportunity_evidence_scope_guard
SELECT 1 FROM opportunity_evidence_links l
LEFT JOIN opportunities o ON o.id=l.opportunity_id
LEFT JOIN raw_evidence r ON r.id=l.raw_evidence_id
LEFT JOIN trend_signals_with_topic_scope s ON s.id=l.evidence_id AND l.evidence_type='trend_signal'
WHERE o.id IS NULL OR r.id IS NULL OR s.id IS NULL
  OR NOT (o.organization_id <=> l.organization_id AND o.workspace_id <=> l.workspace_id)
  OR NOT (r.organization_id <=> l.organization_id AND r.workspace_id <=> l.workspace_id)
  OR NOT (s.organization_id <=> l.organization_id AND s.workspace_id <=> l.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_opportunity_evidence_scope_guard;
ALTER TABLE opportunity_evidence_links DROP INDEX idx_opportunity_evidence_scope,
  ADD KEY idx_opportunity_evidence_parent_time (opportunity_id,observed_at),
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
