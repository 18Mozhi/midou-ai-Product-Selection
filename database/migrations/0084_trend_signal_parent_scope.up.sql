-- Stop writers; require the original signal, topic, normalized record and evidence to agree.
DROP TEMPORARY TABLE IF EXISTS scoutops_trend_signal_scope_guard;
CREATE TEMPORARY TABLE scoutops_trend_signal_scope_guard (id INT PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO scoutops_trend_signal_scope_guard VALUES (1);
INSERT INTO scoutops_trend_signal_scope_guard
SELECT 1 FROM trend_signals s
LEFT JOIN trend_topics t ON t.id=s.topic_id
LEFT JOIN normalized_records n ON n.id=s.normalized_record_id
LEFT JOIN raw_evidence e ON e.id=s.raw_evidence_id
WHERE t.id IS NULL OR n.id IS NULL OR e.id IS NULL
  OR NOT (t.organization_id <=> s.organization_id AND t.workspace_id <=> s.workspace_id)
  OR NOT (n.organization_id <=> s.organization_id AND n.workspace_id <=> s.workspace_id)
  OR NOT (e.organization_id <=> s.organization_id AND e.workspace_id <=> s.workspace_id)
  OR NOT (n.raw_evidence_id <=> s.raw_evidence_id)
  OR NOT (n.provider_id <=> s.provider_id AND e.provider_id <=> s.provider_id)
LIMIT 1;
DROP TEMPORARY TABLE scoutops_trend_signal_scope_guard;
ALTER TABLE trend_signals
  DROP FOREIGN KEY fk_trend_signal_org,
  DROP FOREIGN KEY fk_trend_signal_workspace,
  DROP INDEX idx_trend_signal_scope_time,
  DROP COLUMN organization_id,
  DROP COLUMN workspace_id;
-- Legacy readers derive coordinates from the still-scoped parent. No duplicate scope is stored.
CREATE SQL SECURITY INVOKER VIEW trend_signals_with_topic_scope AS
SELECT s.*,t.organization_id,t.workspace_id
FROM trend_signals s JOIN trend_topics t ON t.id=s.topic_id;
