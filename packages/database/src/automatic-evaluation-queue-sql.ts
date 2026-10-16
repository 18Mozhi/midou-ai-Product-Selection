/** One coalesced wakeup while a leased evaluation finishes; no lease takeover. */
export const automaticEvaluationPendingSql =
  "COALESCE(JSON_EXTRACT(result_json,'$.requeue_requested')=1,0)";

/** Shared by evidence projection, scoring-rule and cost-rule producers. */
export const automaticEvaluationEnqueueUpdateSql =
  "ON DUPLICATE KEY UPDATE " +
  "result_json=IF(status='leased',JSON_SET(COALESCE(result_json,JSON_OBJECT()),'$.requeue_requested',1),result_json)," +
  "status=IF(status='leased',status,'queued'),attempt_count=IF(status='leased',attempt_count,0)," +
  "available_at=IF(status='leased',available_at,VALUES(available_at))," +
  "last_error_code=IF(status='leased',last_error_code,NULL),updated_at=VALUES(updated_at)";
