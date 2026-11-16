-- Stop writers. Validate both histories before persistent DDL.
DROP TEMPORARY TABLE IF EXISTS scoutops_ai_analysis_history_scope_guard;
CREATE TEMPORARY TABLE scoutops_ai_analysis_history_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_ai_analysis_history_scope_guard VALUES (1);
INSERT INTO scoutops_ai_analysis_history_scope_guard
SELECT 1 FROM ai_analysis_results r
LEFT JOIN ai_analysis_requests q ON q.id=r.request_id_fk
LEFT JOIN opportunities o ON o.id=q.opportunity_id
WHERE q.id IS NULL OR o.id IS NULL OR NOT (r.opportunity_id <=> q.opportunity_id)
  OR NOT (r.organization_id <=> q.organization_id AND r.workspace_id <=> q.workspace_id)
  OR NOT (q.organization_id <=> o.organization_id AND q.workspace_id <=> o.workspace_id)
LIMIT 1;
INSERT INTO scoutops_ai_analysis_history_scope_guard
SELECT 1 FROM ai_analysis_reviews v LEFT JOIN ai_analysis_results r ON r.id=v.result_id
WHERE r.id IS NULL OR NOT (v.organization_id <=> r.organization_id AND v.workspace_id <=> r.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_ai_analysis_history_scope_guard;
ALTER TABLE ai_analysis_reviews DROP INDEX idx_ai_review_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
ALTER TABLE ai_analysis_results DROP INDEX idx_ai_result_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
