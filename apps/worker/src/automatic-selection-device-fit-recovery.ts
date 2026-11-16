import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { accountEvaluationRecoverySql, nativeEvaluationRecoverySql } from "./automatic-selection-recovery-evidence.js";
import { selectionCandidateSql } from "@scoutops/database";

export const SUPPLY_DEVICE_FIT_REVISION = "iphone-coupled-device-fit-v1";
const eligible =
  "e.status IN ('succeeded','waiting_evidence') AND " +
  "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.result_json,'$.supply_device_fit_revision')),'')<>? " +
  "AND EXISTS (SELECT 1 FROM opportunities o " +
  "JOIN organizations g ON g.id=o.organization_id AND g.status='active' " +
  "JOIN workspaces w ON w.id=o.workspace_id AND w.organization_id=o.organization_id AND w.status='active' " +
  "JOIN opportunity_cost_inputs ci ON ci.opportunity_id=o.id " +
  "AND ci.platform='amazon' AND ci.input_type='purchase_price' " +
  "AND ci.is_current=1 AND ci.source_type='automatic_crawler_evidence' " +
  "AND ci.confirmation_mode='automatic_evidence' AND ci.source_ref_id REGEXP '^1688:[0-9]{1,40}:p75:[0-9]+$' " +
  "WHERE o.id=e.opportunity_id " +
  "AND o.decision_status='pending' AND o.lifecycle_status NOT IN ('archived','deleted') " +
  `AND ${selectionCandidateSql})`;

export const deviceFitRecoveryCandidatesSql =
  "SELECT e.opportunity_id,p.organization_id,p.workspace_id FROM automatic_selection_evaluations e JOIN opportunities p ON p.id=e.opportunity_id WHERE " +
  eligible +
  " ORDER BY e.available_at,e.opportunity_id LIMIT 100";
export const deviceFitRecoveryUpdateSql =
  "UPDATE automatic_selection_evaluations e SET " +
  "e.result_json=JSON_SET(COALESCE(e.result_json,JSON_OBJECT()),'$.supply_device_fit_revision',?)," +
  "e.status='queued',e.attempt_count=0,e.available_at=?,e.last_error_code=NULL,e.updated_at=? " +
  "WHERE e.opportunity_id=? AND EXISTS (SELECT 1 FROM opportunities p WHERE p.id=e.opportunity_id AND p.organization_id=? AND p.workspace_id=?) AND " +
  eligible;

/** One revision-bound re-evaluation through ordinary leases; no crawler replay or price rewrite. */
export async function recoverDeviceFitEvaluations(pool: Pool, now: Date, native = false, accountParent = false) {
  const [rows] = await pool.query<RowDataPacket[]>(accountParent ? deviceFitAccountRecoverySql.candidates :
    native ? deviceFitNativeRecoverySql.candidates : deviceFitRecoveryCandidatesSql, [
    SUPPLY_DEVICE_FIT_REVISION,
  ]);
  let recovered = 0;
  for (const row of rows) {
    const [result] = await pool.query<ResultSetHeader>(accountParent ? deviceFitAccountRecoverySql.update :
      native ? deviceFitNativeRecoverySql.update : deviceFitRecoveryUpdateSql, [
      SUPPLY_DEVICE_FIT_REVISION,
      now,
      now,
      row.opportunity_id,
      ...(accountParent ? [SUPPLY_DEVICE_FIT_REVISION, row.account_id] : [row.organization_id, row.workspace_id, SUPPLY_DEVICE_FIT_REVISION,
        ...(native ? [row.account_id] : [])]),
    ]);
    recovered += result.affectedRows;
  }
  return recovered;
}

export const deviceFitNativeRecoverySql = nativeEvaluationRecoverySql(
  deviceFitRecoveryCandidatesSql, deviceFitRecoveryUpdateSql, selectionCandidateSql,
);
export const deviceFitAccountRecoverySql = accountEvaluationRecoverySql(
  deviceFitRecoveryCandidatesSql, deviceFitRecoveryUpdateSql, selectionCandidateSql,
);
