-- Stop writers. Reject any request whose coordinates disagree with its exact opportunity.
DROP TEMPORARY TABLE IF EXISTS scoutops_ai_request_scope_guard;
CREATE TEMPORARY TABLE scoutops_ai_request_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_ai_request_scope_guard VALUES (1);
INSERT INTO scoutops_ai_request_scope_guard
SELECT 1 FROM ai_analysis_requests q LEFT JOIN opportunities o ON o.id=q.opportunity_id
WHERE o.id IS NULL OR NOT (q.organization_id <=> o.organization_id AND q.workspace_id <=> o.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_ai_request_scope_guard;
ALTER TABLE ai_analysis_requests DROP INDEX idx_ai_request_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id,
  ADD KEY idx_ai_request_opportunity_time (opportunity_id,created_at);
