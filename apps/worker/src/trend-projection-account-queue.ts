import { randomUUID } from "node:crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { eligibleTaskOwnerFromSql } from "./collection-account-backlog.js";

const own = (table: string, id: string, account: string) =>
  `EXISTS (SELECT 1 FROM account_owned_records a WHERE a.source_table='${table}' AND a.source_id=${id} AND a.account_id=${account})`;

const sourceJoins =
  "JOIN raw_evidence e ON e.id=n.raw_evidence_id AND e.provider_id=n.provider_id AND e.account_id=n.account_id " +
  "JOIN collection_tasks t ON t.id=e.collection_task_id AND t.account_id=e.account_id ";
const sourceOwner =
  "EXISTS (SELECT 1 " +
  eligibleTaskOwnerFromSql +
  " AND task_owner.source_id=t.id AND task_owner.account_id=t.account_id) AND " +
  own("normalized_records", "n.id", "t.account_id") +
  " AND " +
  own("raw_evidence", "e.id", "t.account_id");

export const nativeTrendProjectionScopeSql =
  "EXISTS (SELECT 1 FROM normalized_records n " +
  sourceJoins +
  "WHERE n.id=trend_projection_jobs.normalized_record_id AND " +
  sourceOwner +
  " AND " +
  own("trend_projection_jobs", "trend_projection_jobs.id", "t.account_id") +
  ")";

const targetType = (alias: string) =>
  `JSON_UNQUOTE(JSON_EXTRACT(${alias}.target_json,'$.projection_type'))`;
const originalSubquery =
  "cs.id=e.collection_subquery_id AND cs.task_id=t.id AND cs.provider_id=n.provider_id";
const subqueryOwned = own("collection_subqueries", "cs.id", "t.account_id");
const sourceTail =
  " JOIN providers p ON p.id=n.provider_id " +
  sourceJoins +
  "LEFT JOIN trend_projection_jobs j ON j.normalized_record_id=n.id " +
  "WHERE n.status='active' AND j.id IS NULL AND " +
  sourceOwner +
  " AND ";
const source = "FROM normalized_records n" + sourceTail;

const ordinarySource =
  source +
  "(p.code NOT IN ('1688_search','amazon_product','dhgate_supplier_search','made_in_china_search','ec21_supplier_search') " +
  "OR (p.code='amazon_product' AND EXISTS (SELECT 1 FROM collection_subqueries cs WHERE " +
  originalSubquery +
  " AND " +
  subqueryOwned +
  " AND " +
  targetType("cs") +
  "='rule_product_discovery')))";

const discoveredEligibility =
  "p.code='amazon_product' AND t.status IN ('succeeded','completed_with_warnings') " +
  "AND EXISTS (SELECT 1 FROM collection_subqueries cs WHERE " +
  originalSubquery +
  " AND " +
  subqueryOwned +
  " AND " +
  targetType("cs") +
  "='intelligence_product_discovery')";
const firstEvidenceJoins =
  "JOIN normalized_records n_first ON n_first.id=l_first.normalized_record_id " +
  "AND n_first.raw_evidence_id=l_first.raw_evidence_id AND n_first.provider_id=l_first.provider_id " +
  "AND n_first.status='active' " +
  "JOIN raw_evidence e_first ON e_first.id=n_first.raw_evidence_id AND e_first.provider_id=n_first.provider_id " +
  "AND e_first.account_id=n_first.account_id " +
  "JOIN collection_tasks t_first ON t_first.id=e_first.collection_task_id AND t_first.account_id=e_first.account_id ";
const firstEvidenceOwner =
  own("collection_task_evidence_links", "l_first.id", "t_first.account_id") +
  " AND " +
  own("collection_tasks", "t_first.id", "t_first.account_id") +
  " AND " +
  own("normalized_records", "n_first.id", "t_first.account_id") +
  " AND " +
  own("raw_evidence", "e_first.id", "t_first.account_id");

const discoveredSource =
  source +
  discoveredEligibility +
  " AND n.id=(SELECT MIN(n_first.id) FROM collection_task_evidence_links l_first " +
  firstEvidenceJoins +
  "WHERE l_first.collection_task_id=t.id AND n_first.provider_id=n.provider_id AND n_first.account_id=n.account_id AND " +
  firstEvidenceOwner +
  ")";

const discoveredTasks =
  "SELECT DISTINCT origin.id task_id,p_seed.id provider_id,origin.account_id " +
  "FROM providers p_seed STRAIGHT_JOIN collection_subqueries cs_seed ON cs_seed.provider_id=p_seed.id " +
  "JOIN collection_tasks origin ON origin.id=cs_seed.task_id " +
  "WHERE p_seed.code='amazon_product' AND origin.status IN ('succeeded','completed_with_warnings') AND " +
  targetType("cs_seed") +
  "='intelligence_product_discovery' AND " +
  own("collection_subqueries", "cs_seed.id", "origin.account_id");

// Aggregate the same owned evidence set once per originating task, then do
// point reads for the winners. Do not filter out already projected records
// inside MIN: doing so would promote a second record for a completed task.
export const nativeTrendDiscoveredCandidatesSql =
  "SELECT STRAIGHT_JOIN n.id,n.account_id FROM (" +
  "SELECT STRAIGHT_JOIN seed.task_id,seed.provider_id,seed.account_id,MIN(n_first.id) normalized_record_id FROM (" +
  discoveredTasks +
  ") seed STRAIGHT_JOIN collection_task_evidence_links l_first ON l_first.collection_task_id=seed.task_id " +
  firstEvidenceJoins +
  "WHERE n_first.provider_id=seed.provider_id AND n_first.account_id=seed.account_id AND " +
  firstEvidenceOwner +
  " GROUP BY seed.task_id,seed.provider_id,seed.account_id) winner " +
  "JOIN normalized_records n ON n.id=winner.normalized_record_id AND n.provider_id=winner.provider_id AND n.account_id=winner.account_id" +
  sourceTail +
  "t.id=winner.task_id AND " +
  discoveredEligibility +
  " ORDER BY n.created_at,n.id LIMIT 100";

/** Bound scans stay lock-free; every insert rechecks the current exact source. */
export async function enqueueNativeTrendProjection(pool: Pool, now: Date) {
  for (const [sql, candidates] of [
    [ordinarySource, "SELECT n.id,n.account_id " + ordinarySource + " ORDER BY n.created_at,n.id LIMIT 100"],
    [discoveredSource, nativeTrendDiscoveredCandidatesSql],
  ] as const) {
    const [rows] = await pool.query<RowDataPacket[]>(candidates);
    for (const row of rows) {
      const c = await pool.getConnection();
      try {
        await c.beginTransaction();
        const id = randomUUID();
        const [insert] = await c.query<ResultSetHeader>(
          "INSERT IGNORE INTO trend_projection_jobs " +
            "(id,normalized_record_id,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) " +
            "SELECT ?,n.id,'scheduled',0,?,n.request_id,n.trace_id,?,? " +
            sql +
            " AND n.id=? AND n.account_id=? LIMIT 1",
          [id, now, now, now, row.id, row.account_id],
        );
        if (insert.affectedRows === 1) {
          const [owned] = await c.query<ResultSetHeader>(
            "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) " +
              "SELECT 'trend_projection_jobs',?,o.account_id,o.reason FROM account_owned_records o " +
              "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
              "WHERE o.source_table='normalized_records' AND o.source_id=? AND o.account_id=? " +
              "AND (o.reason='exclusive_owner' OR (o.reason IN ('shared','unassigned') AND o.account_id=cut.primary_account_id))",
            [id, row.id, row.account_id],
          );
          if (owned.affectedRows !== 1) throw new Error("trend_projection_job_owner_mismatch");
        }
        await c.commit();
      } catch (error) {
        await c.rollback();
        throw error;
      } finally {
        c.release();
      }
    }
  }
}
