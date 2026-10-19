import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { selectionCandidateSql } from "@scoutops/database";

export const SUPPLY_TITLE_CLASSIFIER_REVISION = "supply-title-eligible-citations-v1";

const eligible =
  "e.status='waiting_evidence' AND " +
  "JSON_UNQUOTE(JSON_EXTRACT(e.result_json,'$.supply_title_classification_error'))='supply_title_classification_failed' " +
  "AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.result_json,'$.supply_title_classifier_revision')),'')<>? " +
  "AND EXISTS (SELECT 1 FROM opportunities o " +
  "JOIN organizations g ON g.id=o.organization_id AND g.status='active' " +
  "JOIN workspaces w ON w.id=o.workspace_id AND w.organization_id=o.organization_id AND w.status='active' " +
  "WHERE o.id=e.opportunity_id AND o.organization_id=e.organization_id AND o.workspace_id=e.workspace_id " +
  "AND o.decision_status='pending' AND o.lifecycle_status NOT IN ('archived','deleted') " +
  `AND ${selectionCandidateSql})`;

export const supplyClassifierRecoveryCandidatesSql =
  "SELECT e.opportunity_id,e.organization_id,e.workspace_id FROM automatic_selection_evaluations e WHERE " +
  eligible +
  " ORDER BY e.available_at,e.opportunity_id LIMIT 100";

export const supplyClassifierRecoveryUpdateSql =
  "UPDATE automatic_selection_evaluations e SET " +
  "e.result_json=JSON_SET(COALESCE(e.result_json,JSON_OBJECT()),'$.supply_title_classifier_revision',?)," +
  "e.status='queued',e.attempt_count=0,e.available_at=?,e.last_error_code=NULL,e.updated_at=? " +
  "WHERE e.opportunity_id=? AND e.organization_id=? AND e.workspace_id=? AND " +
  eligible;

/** Consistent scan, then atomic scoped recheck; never take over a leased evaluation. */
export async function recoverSupplyClassifierEvaluations(pool: Pool, now: Date) {
  const [rows] = await pool.query<RowDataPacket[]>(supplyClassifierRecoveryCandidatesSql, [
    SUPPLY_TITLE_CLASSIFIER_REVISION,
  ]);
  let recovered = 0;
  for (const row of rows) {
    const [result] = await pool.query<ResultSetHeader>(supplyClassifierRecoveryUpdateSql, [
      SUPPLY_TITLE_CLASSIFIER_REVISION,
      now,
      now,
      row.opportunity_id,
      row.organization_id,
      row.workspace_id,
      SUPPLY_TITLE_CLASSIFIER_REVISION,
    ]);
    recovered += result.affectedRows;
  }
  return recovered;
}
