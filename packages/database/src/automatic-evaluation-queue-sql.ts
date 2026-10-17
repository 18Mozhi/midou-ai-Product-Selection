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

/** Fixed terminal statement; all job values remain bound parameters. */
export const automaticEvaluationCompleteSql =
  `UPDATE automatic_selection_evaluations SET status=IF(${automaticEvaluationPendingSql},'queued',?),attempt_count=0,lease_owner=NULL,` +
  `available_at=IF(${automaticEvaluationPendingSql},?,available_at),` +
  `lease_expires_at=NULL,last_error_code=IF(${automaticEvaluationPendingSql},NULL,?),evidence_fingerprint=?,result_json=?,evaluated_at=?,` +
  "updated_at=? WHERE opportunity_id=? AND lease_owner=?";

/** Fixed terminal statement; all job values remain bound parameters. */
export const automaticEvaluationFailureSql =
  `UPDATE automatic_selection_evaluations SET status=IF(${automaticEvaluationPendingSql},'queued',?),` +
  `available_at=IF(${automaticEvaluationPendingSql},?,?),attempt_count=IF(${automaticEvaluationPendingSql},0,attempt_count),lease_owner=NULL,` +
  `lease_expires_at=NULL,last_error_code=IF(${automaticEvaluationPendingSql},NULL,?),updated_at=?,` +
  "result_json=JSON_REMOVE(result_json,'$.requeue_requested') WHERE opportunity_id=? AND lease_owner=?";
