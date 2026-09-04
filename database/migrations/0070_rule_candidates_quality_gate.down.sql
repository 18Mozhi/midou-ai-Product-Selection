UPDATE `opportunities` o
SET o.`recommendation_status`='recommend',
    o.`version`=o.`version`+1,
    o.`updated_at`=UTC_TIMESTAMP(3)
WHERE o.`decision_status`='pending'
  AND o.`score_rule_version` IS NULL
  AND EXISTS (
    SELECT 1
    FROM `opportunity_rule_matches` m
    JOIN `trend_monitoring_rules` r
      ON r.`id`=m.`monitoring_rule_id`
      AND r.`organization_id`=m.`organization_id`
      AND r.`workspace_id`=m.`workspace_id`
    WHERE m.`opportunity_id`=o.`id`
      AND m.`organization_id`=o.`organization_id`
      AND m.`workspace_id`=o.`workspace_id`
      AND r.`status`='enabled'
      AND o.`source_count`>=r.`recommendation_min_source_count`
  );
