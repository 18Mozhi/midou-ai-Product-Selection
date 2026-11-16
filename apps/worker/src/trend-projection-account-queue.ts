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
const source =
  "FROM normalized_records n JOIN providers p ON p.id=n.provider_id " +
  sourceJoins +
  "LEFT JOIN trend_projection_jobs j ON j.normalized_record_id=n.id " +
  "WHERE n.status='active' AND j.id IS NULL AND " +
  sourceOwner +
  " AND ";

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

const discoveredSource =
  source +
  "p.code='amazon_product' AND t.status IN ('succeeded','completed_with_warnings') " +
  "AND EXISTS (SELECT 1 FROM collection_subqueries cs WHERE " +
  originalSubquery +
  " AND " +
  subqueryOwned +
  " AND " +
  targetType("cs") +
  "='intelligence_product_discovery'" +
  " AND n.id=(SELECT MIN(n_first.id) FROM collection_task_evidence_links l_first " +
  "JOIN normalized_records n_first ON n_first.id=l_first.normalized_record_id " +
  "AND n_first.raw_evidence_id=l_first.raw_evidence_id AND n_first.provider_id=l_first.provider_id " +
  "AND n_first.status='active' " +
  "JOIN raw_evidence e_first ON e_first.id=n_first.raw_evidence_id AND e_first.provider_id=n_first.provider_id " +
  "AND e_first.account_id=n_first.account_id " +
  "JOIN collection_tasks t_first ON t_first.id=e_first.collection_task_id AND t_first.account_id=e_first.account_id " +
  "WHERE l_first.collection_task_id=t.id AND n_first.provider_id=n.provider_id AND n_first.account_id=n.account_id AND " +
  own("collection_task_evidence_links", "l_first.id", "t_first.account_id") +
  " AND " +
  own("collection_tasks", "t_first.id", "t_first.account_id") +
  " AND " +
  own("normalized_records", "n_first.id", "t_first.account_id") +
  " AND " +
  own("raw_evidence", "e_first.id", "t_first.account_id") +
  "))";

/** Bound scans stay lock-free; every insert rechecks the current exact source. */
export async function enqueueNativeTrendProjection(pool: Pool, now: Date) {
  for (const sql of [ordinarySource, discoveredSource]) {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT n.id,n.account_id " + sql + " ORDER BY n.created_at,n.id LIMIT 100",
    );
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
