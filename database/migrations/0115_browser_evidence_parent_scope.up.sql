-- Stop writers. Preserve the exact task, subquery, browser job and file provenance.
DROP TEMPORARY TABLE IF EXISTS scoutops_browser_evidence_scope_guard;
CREATE TEMPORARY TABLE scoutops_browser_evidence_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_browser_evidence_scope_guard VALUES (1);
INSERT INTO scoutops_browser_evidence_scope_guard
SELECT 1 FROM browser_evidence_artifacts a
LEFT JOIN collection_tasks t ON t.id=a.collection_task_id
  AND t.organization_id=a.organization_id AND t.workspace_id=a.workspace_id
LEFT JOIN collection_subqueries q ON q.id=a.collection_subquery_id AND q.task_id=t.id
  AND q.organization_id=t.organization_id AND q.workspace_id=t.workspace_id AND q.provider_id=a.provider_id
LEFT JOIN browser_collection_jobs j ON j.id=a.browser_job_id
  AND j.collection_task_id=t.id AND j.collection_subquery_id=q.id AND j.provider_id=a.provider_id
  AND j.organization_id=t.organization_id AND j.workspace_id=t.workspace_id
LEFT JOIN file_assets f ON f.id=a.file_asset_id AND f.category='evidence'
  AND f.organization_id=t.organization_id AND f.workspace_id=t.workspace_id
  AND f.size_bytes=a.size_bytes AND f.content_sha256=a.content_sha256
WHERE j.id IS NULL OR f.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_browser_evidence_scope_guard;
ALTER TABLE browser_evidence_artifacts
  DROP FOREIGN KEY fk_browser_evidence_organization,
  DROP FOREIGN KEY fk_browser_evidence_workspace,
  DROP INDEX idx_browser_evidence_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
