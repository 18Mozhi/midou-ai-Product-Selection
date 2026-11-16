-- Stop projection writers. Do not drop scope until every job matches its original record.
DROP TEMPORARY TABLE IF EXISTS scoutops_trend_projection_scope_guard;
CREATE TEMPORARY TABLE scoutops_trend_projection_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_trend_projection_scope_guard VALUES (1);
INSERT INTO scoutops_trend_projection_scope_guard
SELECT 1 FROM trend_projection_jobs j LEFT JOIN normalized_records n ON n.id=j.normalized_record_id
  AND n.organization_id=j.organization_id AND n.workspace_id=j.workspace_id
WHERE n.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_trend_projection_scope_guard;
ALTER TABLE trend_projection_jobs
  DROP FOREIGN KEY fk_trend_projection_org,
  DROP FOREIGN KEY fk_trend_projection_workspace,
  DROP INDEX idx_trend_projection_scope,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
