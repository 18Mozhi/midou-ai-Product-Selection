UPDATE `opportunities`
SET `recommendation_status`='insufficient_data',
    `version`=`version`+1,
    `updated_at`=UTC_TIMESTAMP(3)
WHERE `decision_status`='pending'
  AND `score_rule_version` IS NULL
  AND `recommendation_status`='recommend';
