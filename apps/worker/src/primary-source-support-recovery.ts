import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { automaticEvaluationCandidatePresenceSql } from "./automatic-selection-evaluation-admission.js";
import { PRIMARY_SOURCE_SUPPORT_REVISION } from "./primary-source-support.js";

const eligible =
  "e.status IN ('succeeded','waiting_evidence','waiting_profit') AND " +
  "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.result_json,'$.primary_source_support_revision')),'')<>? " +
  "AND EXISTS (SELECT 1 FROM opportunities o " +
  "JOIN organizations g ON g.id=o.organization_id AND g.status='active' " +
  "JOIN workspaces w ON w.id=o.workspace_id AND w.organization_id=o.organization_id AND w.status='active' " +
  "WHERE o.id=e.opportunity_id AND o.organization_id=e.organization_id AND o.workspace_id=e.workspace_id " +
  "AND o.decision_status='pending' AND o.lifecycle_status NOT IN ('archived','deleted') " +
  `AND ${automaticEvaluationCandidatePresenceSql})`;
export const primarySourceRecoveryCandidatesSql =
  "SELECT e.opportunity_id,e.organization_id,e.workspace_id FROM automatic_selection_evaluations e WHERE " +
  eligible +
  " ORDER BY e.available_at,e.opportunity_id LIMIT 100";
export const primarySourceRecoveryUpdateSql =
  "UPDATE automatic_selection_evaluations e SET " +
  "e.result_json=JSON_SET(COALESCE(e.result_json,JSON_OBJECT()),'$.primary_source_support_revision',?)," +
  "e.status='queued',e.attempt_count=0,e.available_at=?,e.last_error_code=NULL,e.updated_at=? " +
  "WHERE e.opportunity_id=? AND e.organization_id=? AND e.workspace_id=? AND " +
  eligible;

/** Once per revision, through ordinary evaluation leases, never crawler replay. */
export async function recoverPrimarySourceEvaluations(pool: Pool, now: Date) {
  const [rows] = await pool.query<RowDataPacket[]>(primarySourceRecoveryCandidatesSql, [
    PRIMARY_SOURCE_SUPPORT_REVISION,
  ]);
  let recovered = 0;
  for (const row of rows) {
    const [result] = await pool.query<ResultSetHeader>(primarySourceRecoveryUpdateSql, [
      PRIMARY_SOURCE_SUPPORT_REVISION,
      now,
      now,
      row.opportunity_id,
      row.organization_id,
      row.workspace_id,
      PRIMARY_SOURCE_SUPPORT_REVISION,
    ]);
    recovered += result.affectedRows;
  }
  return recovered;
}
