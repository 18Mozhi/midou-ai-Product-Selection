-- Rehearsal only. Stop follow writers and require an exact two-way match.
DROP TEMPORARY TABLE IF EXISTS scoutops_trend_follow_guard;
CREATE TEMPORARY TABLE scoutops_trend_follow_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_trend_follow_guard VALUES (1);
INSERT INTO scoutops_trend_follow_guard
SELECT 1 FROM trend_topic_follows f
LEFT JOIN trend_topics t ON t.id=f.topic_id AND t.organization_id=f.organization_id AND t.workspace_id=f.workspace_id
LEFT JOIN account_trend_topic_follows a ON a.id=f.id AND a.account_id=f.user_id
  AND a.topic_id=f.topic_id AND a.created_at=f.created_at
WHERE t.id IS NULL OR a.id IS NULL LIMIT 1;
INSERT INTO scoutops_trend_follow_guard
SELECT 1 FROM account_trend_topic_follows a LEFT JOIN trend_topic_follows f ON f.id=a.id
WHERE f.id IS NULL LIMIT 1;
DROP TEMPORARY TABLE scoutops_trend_follow_guard;
DROP TABLE trend_topic_follows;
