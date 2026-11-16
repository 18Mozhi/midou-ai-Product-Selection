-- Stop writers; a keyword may inherit its topic's scope only if the old coordinates agree.
DROP TEMPORARY TABLE IF EXISTS scoutops_trend_keyword_scope_guard;
CREATE TEMPORARY TABLE scoutops_trend_keyword_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_trend_keyword_scope_guard VALUES (1);
INSERT INTO scoutops_trend_keyword_scope_guard
SELECT 1 FROM trend_topic_keywords k LEFT JOIN trend_topics t ON t.id=k.topic_id
WHERE t.id IS NULL OR NOT (k.organization_id <=> t.organization_id)
  OR NOT (k.workspace_id <=> t.workspace_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_trend_keyword_scope_guard;
ALTER TABLE trend_topic_keywords
  DROP FOREIGN KEY fk_trend_keyword_org,
  DROP FOREIGN KEY fk_trend_keyword_workspace,
  DROP INDEX idx_trend_keyword_scope,
  DROP COLUMN organization_id,
  DROP COLUMN workspace_id;
