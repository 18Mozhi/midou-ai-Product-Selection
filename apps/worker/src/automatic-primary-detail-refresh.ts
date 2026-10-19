import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { latestCompetitorDetailSnapshotSql, selectionPrimaryAsinSql } from "@scoutops/database";
import {
  activeCollectionScopeSql,
  automaticCollectionBacklogCountSql,
} from "./collection-source-scheduling-policy.js";
import {
  competitorRefreshNoActiveDetailSql,
  competitorRefreshObservedAtSql,
} from "./competitor-refresh-policy.js";

const reasons = (alias: "e" | "e_wait") =>
  `${alias}.status='waiting_evidence' AND ${alias}.last_error_code IN ` +
  "('amazon_competitor_snapshot_missing','amazon_sale_facts_incomplete')";
const waitingEvaluationSql =
  "EXISTS (SELECT 1 FROM automatic_selection_evaluations e_wait " +
  "WHERE e_wait.opportunity_id=o.id AND e_wait.organization_id=o.organization_id " +
  "AND e_wait.workspace_id=o.workspace_id AND " +
  reasons("e_wait") +
  ")";
const fields =
  "c.id,c.organization_id,c.workspace_id,c.external_id,c.product_url,o.created_by,o.id opportunity_id";
const joins =
  " LEFT JOIN competitor_snapshots s ON s.id=c.latest_snapshot_id AND s.competitor_id=c.id " +
  "AND s.organization_id=c.organization_id AND s.workspace_id=c.workspace_id ";

/** Reuse actual primary identity/detail proof; the evaluation reason is a scheduling hint only. */
export const automaticPrimaryRefreshEligibilitySql =
  activeCollectionScopeSql("c") +
  " AND o.source_type='trend_topic' AND o.decision_status='pending' " +
  "AND o.lifecycle_status NOT IN ('archived','deleted') " +
  "AND c.status='active' AND c.deleted_at IS NULL AND c.source_site='Amazon' AND c.market=o.market " +
  "AND c.external_id REGEXP '^[A-Z0-9]{10}$' " +
  "AND c.product_url REGEXP CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',c.external_id,'([/?#]|$)') " +
  "AND BINARY c.external_id=BINARY " +
  selectionPrimaryAsinSql +
  " AND (c.latest_snapshot_id IS NULL OR s.id IS NOT NULL) " +
  "AND " +
  latestCompetitorDetailSnapshotSql("c") +
  " IS NULL " +
  "AND " +
  competitorRefreshObservedAtSql +
  "<=? " +
  "AND NOT EXISTS (SELECT 1 FROM collection_subqueries recent " +
  "WHERE recent.organization_id=c.organization_id AND recent.workspace_id=c.workspace_id " +
  "AND recent.created_at>? AND JSON_UNQUOTE(JSON_EXTRACT(recent.target_json,'$.projection_type'))='competitor_snapshot' " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(recent.target_json,'$.competitor_id'))=BINARY c.id) " +
  "AND " +
  automaticCollectionBacklogCountSql +
  "<? AND " +
  competitorRefreshNoActiveDetailSql;

/** Ordinary admission read: do not range-lock the evaluation queue. */
export const automaticPrimaryRefreshCandidateSql =
  "SELECT " +
  fields +
  " FROM automatic_selection_evaluations e FORCE INDEX (idx_automatic_selection_evaluation_claim) " +
  "STRAIGHT_JOIN opportunities o FORCE INDEX (PRIMARY) ON o.id=e.opportunity_id " +
  "AND o.organization_id=e.organization_id AND o.workspace_id=e.workspace_id " +
  "STRAIGHT_JOIN competitors c ON c.opportunity_id=o.id AND c.organization_id=o.organization_id " +
  "AND c.workspace_id=o.workspace_id " +
  joins +
  "WHERE " +
  reasons("e") +
  " AND " +
  automaticPrimaryRefreshEligibilitySql +
  " ORDER BY FIELD(e.last_error_code,'amazon_competitor_snapshot_missing','amazon_sale_facts_incomplete')," +
  "e.evaluated_at,c.created_at,c.id LIMIT 1";

/** Keep the original competitor/opportunity locking order and recheck the selected scope. */
export const automaticPrimaryRefreshRecheckSql =
  "SELECT " +
  fields +
  " FROM competitors c FORCE INDEX (PRIMARY) " +
  "JOIN opportunities o FORCE INDEX (PRIMARY) ON o.id=c.opportunity_id " +
  "AND o.organization_id=c.organization_id AND o.workspace_id=c.workspace_id " +
  joins +
  "WHERE c.id=? AND c.organization_id=? AND c.workspace_id=? AND o.id=? AND " +
  waitingEvaluationSql +
  " AND " +
  automaticPrimaryRefreshEligibilitySql +
  " FOR UPDATE";

export async function findWaitingPrimaryDetailRefresh(
  connection: PoolConnection,
  before: Date,
  backlogLimit: number,
): Promise<RowDataPacket | undefined> {
  const params = [before, before, backlogLimit];
  const [candidates] = await connection.query<RowDataPacket[]>(
    automaticPrimaryRefreshCandidateSql,
    params,
  );
  const candidate = candidates[0];
  if (
    !candidate ||
    ![
      candidate.id,
      candidate.organization_id,
      candidate.workspace_id,
      candidate.opportunity_id,
    ].every((value) => typeof value === "string" && value.length > 0)
  )
    return undefined;
  const [rows] = await connection.query<RowDataPacket[]>(automaticPrimaryRefreshRecheckSql, [
    candidate.id,
    candidate.organization_id,
    candidate.workspace_id,
    candidate.opportunity_id,
    ...params,
  ]);
  return rows[0];
}
