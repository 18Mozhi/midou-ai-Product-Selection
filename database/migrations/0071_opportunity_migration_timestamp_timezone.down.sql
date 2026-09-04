UPDATE `opportunities` o
SET o.`updated_at`=TIMESTAMPADD(
  SECOND,
  TIMESTAMPDIFF(SECOND,NOW(3),UTC_TIMESTAMP(3)),
  o.`updated_at`
)
WHERE o.`decision_status`='pending'
  AND o.`score_rule_version` IS NULL
  AND o.`recommendation_status`='insufficient_data'
  AND ABS(
    TIMESTAMPDIFF(
      MICROSECOND,
      o.`updated_at`,
      TIMESTAMPADD(
        SECOND,
        TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(3),NOW(3)),
        (
          SELECT m.`applied_at`
          FROM `schema_migrations` m
          WHERE m.`name`='0070_rule_candidates_quality_gate.up.sql'
        )
      )
    )
  )<=1000000;
