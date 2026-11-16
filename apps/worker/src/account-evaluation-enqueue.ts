import { automaticEvaluationEnqueueUpdateSql } from "@scoutops/database";
import type { PoolConnection } from "mysql2/promise";

/** Enqueue only the locked opportunity whose ownership was verified by the caller. */
export async function queueOwnedSelectionEvaluation(
  connection: Pick<PoolConnection, "query">,
  opportunityId: string,
  accountId: string,
  native: boolean,
  now: Date,
) {
  await connection.query(
    "INSERT INTO automatic_selection_evaluations " +
      "(opportunity_id,status,attempt_count,available_at,created_at,updated_at) " +
      "SELECT o.id,'queued',0,?,?,? FROM opportunities o JOIN account_owned_records a " +
      "ON a.source_table='opportunities' AND a.source_id=o.id AND a.account_id=? " +
      "WHERE o.id=? " +
      (native ? "AND o.account_id=a.account_id " : "") +
      automaticEvaluationEnqueueUpdateSql,
    [now, now, now, accountId, opportunityId],
  );
}
