import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { selectionCandidateExistsSql } from "@scoutops/database";

/** Same presence proof; use existing evidence/key indexes rather than sorting historical identities. */
export const automaticEvaluationCandidatePresenceSql = selectionCandidateExistsSql
  .replace(
    "JOIN normalized_records n_primary ON",
    "STRAIGHT_JOIN normalized_records n_primary FORCE INDEX (idx_normalized_evidence) ON",
  )
  .replace(
    "JOIN normalized_records n_primary_current ON",
    "STRAIGHT_JOIN normalized_records n_primary_current FORCE INDEX (uq_normalized_scope_record_version) ON",
  );

const eligible =
  "o.decision_status='pending' AND o.lifecycle_status NOT IN ('archived','deleted') AND " +
  automaticEvaluationCandidatePresenceSql;
export const automaticEvaluationAdmissionCandidatesSql =
  "SELECT o.id,o.organization_id,o.workspace_id FROM opportunities o " +
  "LEFT JOIN automatic_selection_evaluations e ON e.opportunity_id=o.id " +
  "WHERE e.opportunity_id IS NULL AND " +
  eligible +
  " LIMIT 100";
export const automaticEvaluationAdmissionInsertSql =
  "INSERT IGNORE INTO automatic_selection_evaluations " +
  "(opportunity_id,organization_id,workspace_id,status,attempt_count,available_at,created_at,updated_at) " +
  "SELECT o.id,o.organization_id,o.workspace_id,'queued',0,?,?,? FROM opportunities o " +
  "WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? AND " +
  eligible;

/** Consistent candidate read, then per-resource atomic eligibility check; duplicate queue rows remain untouched. */
export async function enqueueMissingSelectionEvaluations(pool: Pool, now: Date) {
  const [rows] = await pool.query<RowDataPacket[]>(automaticEvaluationAdmissionCandidatesSql);
  let admitted = 0;
  for (const row of rows) {
    const [result] = await pool.query<ResultSetHeader>(automaticEvaluationAdmissionInsertSql, [
      now,
      now,
      now,
      row.id,
      row.organization_id,
      row.workspace_id,
    ]);
    admitted += result.affectedRows;
  }
  return admitted;
}
