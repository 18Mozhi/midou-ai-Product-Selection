import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { selectionCandidateSql } from "@scoutops/database";

export const SUPPLY_DEVICE_FIT_REVISION = "iphone-coupled-device-fit-v1";
const eligible =
  "e.status IN ('succeeded','waiting_evidence') AND " +
  "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.result_json,'$.supply_device_fit_revision')),'')<>? " +
  "AND EXISTS (SELECT 1 FROM opportunities o " +
  "JOIN organizations g ON g.id=o.organization_id AND g.status='active' " +
  "JOIN workspaces w ON w.id=o.workspace_id AND w.organization_id=o.organization_id AND w.status='active' " +
  "JOIN opportunity_cost_inputs ci ON ci.opportunity_id=o.id AND ci.organization_id=o.organization_id " +
  "AND ci.workspace_id=o.workspace_id AND ci.platform='amazon' AND ci.input_type='purchase_price' " +
  "AND ci.is_current=1 AND ci.source_type='automatic_crawler_evidence' " +
  "AND ci.confirmation_mode='automatic_evidence' AND ci.source_ref_id REGEXP '^1688:[0-9]{1,40}:p75:[0-9]+$' " +
  "WHERE o.id=e.opportunity_id AND o.organization_id=e.organization_id AND o.workspace_id=e.workspace_id " +
  "AND o.decision_status='pending' AND o.lifecycle_status NOT IN ('archived','deleted') " +
  `AND ${selectionCandidateSql})`;

export const deviceFitRecoveryCandidatesSql =
  "SELECT e.opportunity_id,e.organization_id,e.workspace_id FROM automatic_selection_evaluations e WHERE " +
  eligible +
  " ORDER BY e.available_at,e.opportunity_id LIMIT 100";
export const deviceFitRecoveryUpdateSql =
  "UPDATE automatic_selection_evaluations e SET " +
  "e.result_json=JSON_SET(COALESCE(e.result_json,JSON_OBJECT()),'$.supply_device_fit_revision',?)," +
  "e.status='queued',e.attempt_count=0,e.available_at=?,e.last_error_code=NULL,e.updated_at=? " +
  "WHERE e.opportunity_id=? AND e.organization_id=? AND e.workspace_id=? AND " +
  eligible;

/** One revision-bound re-evaluation through ordinary leases; no crawler replay or price rewrite. */
export async function recoverDeviceFitEvaluations(pool: Pool, now: Date) {
  const [rows] = await pool.query<RowDataPacket[]>(deviceFitRecoveryCandidatesSql, [
    SUPPLY_DEVICE_FIT_REVISION,
  ]);
  let recovered = 0;
  for (const row of rows) {
    const [result] = await pool.query<ResultSetHeader>(deviceFitRecoveryUpdateSql, [
      SUPPLY_DEVICE_FIT_REVISION,
      now,
      now,
      row.opportunity_id,
      row.organization_id,
      row.workspace_id,
      SUPPLY_DEVICE_FIT_REVISION,
    ]);
    recovered += result.affectedRows;
  }
  return recovered;
}
