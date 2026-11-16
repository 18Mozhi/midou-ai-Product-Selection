-- Stop writers. Retain the original request, target, result and JSON snapshots.
DROP TEMPORARY TABLE IF EXISTS scoutops_trend_change_scope_guard;
CREATE TEMPORARY TABLE scoutops_trend_change_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_trend_change_scope_guard VALUES (1);
INSERT INTO scoutops_trend_change_scope_guard
SELECT 1 FROM trend_topic_change_requests c
LEFT JOIN trend_topics t ON t.id=c.target_topic_id
LEFT JOIN trend_topics r ON r.id=c.result_topic_id
WHERE t.id IS NULL OR NOT (t.organization_id <=> c.organization_id AND t.workspace_id <=> c.workspace_id)
   OR (c.result_topic_id IS NOT NULL AND (r.id IS NULL
       OR NOT (r.organization_id <=> t.organization_id AND r.workspace_id <=> t.workspace_id)))
LIMIT 1;
DROP TEMPORARY TABLE scoutops_trend_change_scope_guard;
ALTER TABLE trend_topic_change_requests
  DROP FOREIGN KEY fk_trend_change_org, DROP FOREIGN KEY fk_trend_change_workspace,
  DROP INDEX idx_trend_change_queue,
  DROP COLUMN organization_id, DROP COLUMN workspace_id;
