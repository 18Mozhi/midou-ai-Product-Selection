UPDATE `automatic_selection_evaluations` e
JOIN `schema_migrations` m
  ON m.`name`='0072_automatic_quality_evaluation.up.sql'
SET
  e.`available_at`=TIMESTAMPADD(
    SECOND,
    TIMESTAMPDIFF(SECOND,NOW(3),UTC_TIMESTAMP(3)),
    e.`available_at`
  ),
  e.`created_at`=TIMESTAMPADD(
    SECOND,
    TIMESTAMPDIFF(SECOND,NOW(3),UTC_TIMESTAMP(3)),
    e.`created_at`
  ),
  e.`updated_at`=TIMESTAMPADD(
    SECOND,
    TIMESTAMPDIFF(SECOND,NOW(3),UTC_TIMESTAMP(3)),
    e.`updated_at`
  )
WHERE e.`status`='queued'
  AND e.`attempt_count`=0
  AND e.`lease_owner` IS NULL
  AND e.`lease_expires_at` IS NULL
  AND e.`last_error_code` IS NULL
  AND e.`evidence_fingerprint` IS NULL
  AND e.`result_json` IS NULL
  AND e.`evaluated_at` IS NULL
  AND ABS(
    TIMESTAMPDIFF(
      MICROSECOND,
      e.`created_at`,
      TIMESTAMPADD(
        SECOND,
        TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(3),NOW(3)),
        m.`applied_at`
      )
    )
  )<=1000000;
