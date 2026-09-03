UPDATE `opportunities` o
SET o.recommendation_status='insufficient_data',o.version=o.version+1,o.updated_at=UTC_TIMESTAMP(3)
WHERE o.decision_status='pending'
  AND o.score_rule_version IS NULL
  AND EXISTS (
    SELECT 1 FROM `opportunity_rule_matches` m WHERE m.opportunity_id=o.id
  );

ALTER TABLE `trend_monitoring_rules`
  DROP COLUMN `recommendation_min_source_count`;
