import {
  accountPrimarySnapshotProofSql,
  sealedPrimaryRefreshAsinSql,
} from "./automatic-selection-evidence.js";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { latestCompetitorDetailSnapshotSql, selectionPrimaryAsinSql } from "@scoutops/database";
import {
  activeCollectionScopeSql,
  automaticCollectionBacklogCountSql,
} from "./collection-source-scheduling-policy.js";
import {
  sealedAccountCollectionBacklogCountSql as accountCollectionBacklogCountSql,
  activeAccountCollectionTaskStatusesSql as activeCollectionTaskStatusesSql,
} from "./collection-account-backlog.js";
import {
  competitorRefreshNoActiveDetailSql,
  competitorRefreshObservedAtSql,
} from "./competitor-refresh-policy.js";

const reasons = (alias: "e" | "e_wait") =>
  `${alias}.status='waiting_evidence' AND ${alias}.last_error_code IN ` +
  "('amazon_competitor_snapshot_missing','amazon_sale_facts_incomplete')";
const waitingEvaluationSql =
  "EXISTS (SELECT 1 FROM automatic_selection_evaluations e_wait " +
  "WHERE e_wait.opportunity_id=o.id AND " +
  reasons("e_wait") +
  ")";
const fields =
  "c.id,c.organization_id,c.workspace_id,c.external_id,c.product_url,o.created_by,o.id opportunity_id";
const joins =
  " LEFT JOIN competitor_snapshots s ON s.id=c.latest_snapshot_id AND s.competitor_id=c.id ";

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
  "AND NOT EXISTS (SELECT 1 FROM collection_subqueries recent JOIN collection_tasks recent_task ON recent_task.id=recent.task_id " +
  "WHERE recent_task.organization_id=c.organization_id AND recent_task.workspace_id=c.workspace_id " +
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

const sealedRefreshOwnerJoins =
  " JOIN account_owned_records owner ON owner.source_table='opportunities' AND owner.source_id=o.id " +
  "JOIN users refresh_user ON refresh_user.id=owner.account_id AND refresh_user.status='active' " +
  "JOIN account_ownership_cutover refresh_cut ON refresh_cut.slot='current' AND refresh_cut.contract_version=25 " +
  "AND (owner.reason='exclusive_owner' OR owner.account_id=refresh_cut.primary_account_id) " +
  "JOIN account_owned_records refresh_competitor ON refresh_competitor.source_table='competitors' " +
  "AND refresh_competitor.source_id=c.id AND refresh_competitor.account_id=owner.account_id ";
const sealedRefreshWorkFrom =
  " FROM collection_subqueries detail_query " +
  "JOIN collection_tasks detail_task ON detail_task.id=detail_query.task_id " +
  "JOIN account_owned_records detail_owner ON detail_owner.source_table='collection_tasks' " +
  "AND detail_owner.source_id=detail_task.id " +
  "JOIN account_owned_records detail_query_owner ON detail_query_owner.source_table='collection_subqueries' " +
  "AND detail_query_owner.source_id=detail_query.id AND detail_query_owner.account_id=detail_owner.account_id " +
  "WHERE JSON_UNQUOTE(JSON_EXTRACT(detail_query.target_json,'$.projection_type'))='competitor_snapshot' " +
  "AND (detail_query.created_at>? OR detail_task.status IN " +
  activeCollectionTaskStatusesSql +
  ") ";
const detailTarget =
  "BINARY JSON_UNQUOTE(JSON_EXTRACT(detail_query.target_json,'$.competitor_id'))";
const sealedRefreshNoWork =
  "NOT EXISTS (SELECT 1" +
  sealedRefreshWorkFrom +
  "AND detail_owner.account_id=owner.account_id AND " +
  detailTarget +
  "=BINARY c.id)";
// Aggregate once at admission; the single-row locking recheck below still uses
// the live task tables. The binary key preserves exact historical ID matching.
const sealedRefreshWorkJoin =
  " LEFT JOIN (SELECT detail_owner.account_id," +
  detailTarget +
  " competitor_id" +
  sealedRefreshWorkFrom +
  "GROUP BY detail_owner.account_id,competitor_id) detail_work " +
  "ON detail_work.account_id=owner.account_id AND detail_work.competitor_id=BINARY c.id ";
const sealedRefreshBase =
  "o.source_type='trend_topic' AND o.lifecycle_status NOT IN ('archived','deleted') " +
  "AND c.status='active' AND c.deleted_at IS NULL AND c.source_site='Amazon' " +
  "AND c.external_id REGEXP '^[A-Z0-9]{10}$' " +
  "AND c.product_url REGEXP CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',c.external_id,'([/?#]|$)') " +
  "AND " +
  competitorRefreshObservedAtSql +
  "<=? AND ";
const sealedPrimaryRefreshOnly =
  "o.decision_status='pending' AND c.market=o.market AND BINARY c.external_id=BINARY " +
  sealedPrimaryRefreshAsinSql +
  " AND (c.latest_snapshot_id IS NULL OR s.id IS NOT NULL) " +
  "AND NOT EXISTS (SELECT 1 FROM competitor_snapshots s WHERE s.competitor_id=c.id AND " +
  accountPrimarySnapshotProofSql +
  ") AND ";
const sealedFields = fields + ",owner.account_id";
// Fetch cheap candidates in the exact original priority order. On MySQL 5.7
// even two candidates caused the compound dependent-evidence scan to time out.
export const sealedPrimaryRefreshCandidateSql =
  "SELECT " +
  sealedFields +
  " FROM automatic_selection_evaluations e " +
  "JOIN opportunities o ON o.id=e.opportunity_id JOIN competitors c ON c.opportunity_id=o.id " +
  sealedRefreshOwnerJoins +
  joins +
  sealedRefreshWorkJoin +
  "WHERE " +
  reasons("e") +
  " AND " +
  "o.decision_status='pending' AND c.market=o.market AND (c.latest_snapshot_id IS NULL OR s.id IS NOT NULL) AND " +
  sealedRefreshBase +
  "detail_work.account_id IS NULL AND " +
  accountCollectionBacklogCountSql +
  "<? " +
  "ORDER BY FIELD(e.last_error_code,'amazon_competitor_snapshot_missing','amazon_sale_facts_incomplete'),e.evaluated_at,c.created_at,c.id";
export const sealedPeriodicDetailRefreshSql =
  "SELECT " +
  sealedFields +
  " FROM competitors c JOIN opportunities o ON o.id=c.opportunity_id " +
  sealedRefreshOwnerJoins +
  joins +
  sealedRefreshWorkJoin +
  "WHERE " +
  sealedRefreshBase +
  "detail_work.account_id IS NULL AND " +
  accountCollectionBacklogCountSql +
  "<?" +
  " ORDER BY (c.latest_snapshot_id IS NOT NULL)," +
  competitorRefreshObservedAtSql +
  ",c.id LIMIT 1";
export function sealedDetailRefreshRecheckSql(primary: boolean, lock = true) {
  return (
    "SELECT " +
    sealedFields +
    " FROM competitors c FORCE INDEX (PRIMARY) JOIN opportunities o ON o.id=c.opportunity_id " +
    sealedRefreshOwnerJoins +
    joins +
    "WHERE c.id=? AND o.id=? AND owner.account_id=? AND " +
    (primary ? waitingEvaluationSql + " AND " + sealedPrimaryRefreshOnly : "") +
    sealedRefreshBase +
    sealedRefreshNoWork +
    " AND " +
    accountCollectionBacklogCountSql +
    "<?" +
    (lock ? " FOR UPDATE" : "")
  );
}

function nativeRefreshSql(sql: string) {
  return sql
    .replace("c.id,c.organization_id,c.workspace_id,", "c.id,")
    .replace(
      "refresh_competitor.account_id=owner.account_id ",
      "refresh_competitor.account_id=owner.account_id AND c.account_id=owner.account_id ",
    )
    .replaceAll(
      "detail_owner.source_id=detail_task.id ",
      "detail_owner.source_id=detail_task.id AND detail_task.account_id=detail_owner.account_id ",
    )
    .replace(
      "task_owner.source_id=backlog.id",
      "task_owner.source_id=backlog.id AND backlog.account_id=task_owner.account_id",
    )
    .replaceAll(
      "JOIN collection_tasks n_first_origin_task ON n_first_origin_task.id=n_first_origin.collection_task_id ",
      "JOIN collection_tasks n_first_origin_task ON n_first_origin_task.id=n_first_origin.collection_task_id AND n_first_origin_task.account_id=owner.account_id ",
    )
    .replaceAll(
      "JOIN collection_tasks n_first_current_task ON n_first_current_task.id=n_first_current.collection_task_id ",
      "JOIN collection_tasks n_first_current_task ON n_first_current_task.id=n_first_current.collection_task_id AND n_first_current_task.account_id=owner.account_id ",
    )
    .replace(
      "JOIN collection_tasks t ON t.id=q.task_id ",
      "JOIN collection_tasks t ON t.id=q.task_id AND t.account_id=owner.account_id ",
    );
}

export async function findSealedDetailRefresh(
  connection: PoolConnection,
  before: Date,
  backlogLimit: number,
  nativeCompetitor = false,
) {
  const statement = (sql: string) => (nativeCompetitor ? nativeRefreshSql(sql) : sql);
  const params = [before, before, backlogLimit];
  const recheck = async (candidate: RowDataPacket, primary: boolean, lock = true) => {
    const [[locked]] = await connection.query<RowDataPacket[]>(
      statement(sealedDetailRefreshRecheckSql(primary, lock)),
      [candidate.id, candidate.opportunity_id, candidate.account_id, ...params],
    );
    return locked;
  };
  const [candidates] = await connection.query<RowDataPacket[]>(
    statement(sealedPrimaryRefreshCandidateSql),
    params,
  );
  for (const candidate of candidates) {
    if (!(await recheck(candidate, true, false))) continue;
    const locked = await recheck(candidate, true);
    if (locked) return locked;
  }
  const [[periodic]] = await connection.query<RowDataPacket[]>(
    statement(sealedPeriodicDetailRefreshSql),
    params,
  );
  return periodic ? recheck(periodic, false) : undefined;
}

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
