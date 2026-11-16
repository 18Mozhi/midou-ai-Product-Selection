-- Stop writers. A reference may reuse evidence captured by another task,
-- but its task, query, evidence and normalized record must agree on scope.
DROP TEMPORARY TABLE IF EXISTS scoutops_collection_evidence_scope_guard;
CREATE TEMPORARY TABLE scoutops_collection_evidence_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_collection_evidence_scope_guard VALUES (1);
INSERT INTO scoutops_collection_evidence_scope_guard
SELECT 1 FROM collection_task_evidence_links l
LEFT JOIN collection_tasks t ON t.id=l.collection_task_id
  AND t.organization_id=l.organization_id AND t.workspace_id=l.workspace_id
LEFT JOIN collection_subqueries q ON q.id=l.collection_subquery_id AND q.task_id=l.collection_task_id
  AND q.provider_id=l.provider_id AND q.organization_id=l.organization_id AND q.workspace_id=l.workspace_id
LEFT JOIN raw_evidence e ON e.id=l.raw_evidence_id
  AND e.provider_id=l.provider_id AND e.organization_id=l.organization_id AND e.workspace_id=l.workspace_id
LEFT JOIN normalized_records n ON n.id=l.normalized_record_id AND n.raw_evidence_id=l.raw_evidence_id
  AND n.provider_id=l.provider_id AND n.organization_id=l.organization_id AND n.workspace_id=l.workspace_id
WHERE t.id IS NULL OR q.id IS NULL OR e.id IS NULL OR n.id IS NULL
LIMIT 1;
DROP TEMPORARY TABLE scoutops_collection_evidence_scope_guard;
ALTER TABLE collection_task_evidence_links
  DROP FOREIGN KEY fk_collection_task_evidence_organization,
  DROP FOREIGN KEY fk_collection_task_evidence_workspace,
  DROP INDEX idx_collection_task_evidence_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id,
  ADD KEY idx_collection_task_evidence_task_time (collection_task_id,created_at);
