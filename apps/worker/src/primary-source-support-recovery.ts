import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { accountEvaluationRecoverySql, nativeEvaluationRecoverySql } from "./automatic-selection-recovery-evidence.js";
import { automaticEvaluationCandidatePresenceSql } from "./automatic-selection-evaluation-admission.js";
import { PRIMARY_SOURCE_SUPPORT_REVISION } from "./primary-source-support.js";

const eligible =
  "e.status IN ('succeeded','waiting_evidence','waiting_profit') AND " +
  "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.result_json,'$.primary_source_support_revision')),'')<>? " +
  "AND EXISTS (SELECT 1 FROM opportunities o " +
  "JOIN organizations g ON g.id=o.organization_id AND g.status='active' " +
  "JOIN workspaces w ON w.id=o.workspace_id AND w.organization_id=o.organization_id AND w.status='active' " +
  "WHERE o.id=e.opportunity_id " +
  "AND o.decision_status='pending' AND o.lifecycle_status NOT IN ('archived','deleted') " +
  `AND ${automaticEvaluationCandidatePresenceSql})`;
export const primarySourceRecoveryCandidatesSql =
  "SELECT e.opportunity_id,p.organization_id,p.workspace_id FROM automatic_selection_evaluations e JOIN opportunities p ON p.id=e.opportunity_id WHERE " +
  eligible +
  " ORDER BY e.available_at,e.opportunity_id LIMIT 100";
export const primarySourceRecoveryUpdateSql =
  "UPDATE automatic_selection_evaluations e SET " +
  "e.result_json=JSON_SET(COALESCE(e.result_json,JSON_OBJECT()),'$.primary_source_support_revision',?)," +
  "e.status='queued',e.attempt_count=0,e.available_at=?,e.last_error_code=NULL,e.updated_at=? " +
  "WHERE e.opportunity_id=? AND EXISTS (SELECT 1 FROM opportunities p WHERE p.id=e.opportunity_id AND p.organization_id=? AND p.workspace_id=?) AND " +
  eligible;

/** Once per revision, through ordinary evaluation leases, never crawler replay. */
export async function recoverPrimarySourceEvaluations(pool: Pool, now: Date, native = false, accountParent = false) {
  const [rows] = await pool.query<RowDataPacket[]>(accountParent ? primarySourceAccountRecoverySql.candidates :
    native ? primarySourceNativeRecoverySql.candidates : primarySourceRecoveryCandidatesSql, [
    PRIMARY_SOURCE_SUPPORT_REVISION,
  ]);
  let recovered = 0;
  for (const row of rows) {
    const [result] = await pool.query<ResultSetHeader>(accountParent ? primarySourceAccountRecoverySql.update :
      native ? primarySourceNativeRecoverySql.update : primarySourceRecoveryUpdateSql, [
      PRIMARY_SOURCE_SUPPORT_REVISION,
      now,
      now,
      row.opportunity_id,
      ...(accountParent ? [PRIMARY_SOURCE_SUPPORT_REVISION, row.account_id] : [row.organization_id, row.workspace_id, PRIMARY_SOURCE_SUPPORT_REVISION,
        ...(native ? [row.account_id] : [])]),
    ]);
    recovered += result.affectedRows;
  }
  return recovered;
}

export const primarySourceNativeRecoverySql = nativeEvaluationRecoverySql(
  primarySourceRecoveryCandidatesSql, primarySourceRecoveryUpdateSql, automaticEvaluationCandidatePresenceSql,
);
export const primarySourceAccountRecoverySql = accountEvaluationRecoverySql(
  primarySourceRecoveryCandidatesSql, primarySourceRecoveryUpdateSql, automaticEvaluationCandidatePresenceSql,
);
