import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { selectionCandidateSql } from "@scoutops/database";

const eligible =
  "e.status='succeeded' AND JSON_UNQUOTE(JSON_EXTRACT(e.result_json,'$.skipped')) " +
  "IN ('not_rule_candidate','primary_product_missing_or_not_pending') AND EXISTS (" +
  "SELECT 1 FROM opportunities o JOIN organizations g ON g.id=o.organization_id AND g.status='active' " +
  "JOIN workspaces w ON w.id=o.workspace_id AND w.organization_id=o.organization_id AND w.status='active' " +
  "WHERE o.id=e.opportunity_id AND o.organization_id=e.organization_id AND o.workspace_id=e.workspace_id " +
  "AND o.decision_status='pending' AND o.lifecycle_status NOT IN ('archived','deleted') " +
  `AND ${selectionCandidateSql})`;

export const skippedSelectionRecoveryCandidatesSql =
  "SELECT e.opportunity_id,e.organization_id,e.workspace_id FROM automatic_selection_evaluations e WHERE " +
  eligible +
  " ORDER BY e.available_at,e.opportunity_id LIMIT 100";
export const skippedSelectionRecoveryUpdateSql =
  "UPDATE automatic_selection_evaluations e SET status='queued',attempt_count=0,available_at=?," +
  "result_json=NULL,last_error_code=NULL,updated_at=? WHERE e.opportunity_id=? " +
  "AND e.organization_id=? AND e.workspace_id=? AND " +
  eligible;

/** Ordinary candidate read, then scoped atomic recheck; never revive a real success or take a lease. */
export async function recoverSkippedSelectionEvaluations(pool: Pool, now: Date) {
  const [rows] = await pool.query<RowDataPacket[]>(skippedSelectionRecoveryCandidatesSql);
  let recovered = 0;
  for (const row of rows) {
    const [result] = await pool.query<ResultSetHeader>(skippedSelectionRecoveryUpdateSql, [
      now,
      now,
      row.opportunity_id,
      row.organization_id,
      row.workspace_id,
    ]);
    recovered += result.affectedRows;
  }
  return recovered;
}
