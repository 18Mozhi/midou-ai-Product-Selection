import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { selectionCandidateExistsSql } from "@scoutops/database";
import { hasNativeNormalizedAccountScope } from "./automatic-selection-evidence.js";

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
  "(opportunity_id,status,attempt_count,available_at,created_at,updated_at) " +
  "SELECT o.id,'queued',0,?,?,? FROM opportunities o " +
  "WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? AND " +
  eligible;

// One exact owner per source row (ledger primary key). The same predicate is
// used before admission, during insertion, and under the evaluation parent lock.
const ownedJoin = (table: string, id: string, alias: string) =>
  `STRAIGHT_JOIN account_owned_records ${alias} FORCE INDEX (PRIMARY) ON ${alias}.source_table='${table}'
    AND ${alias}.source_id=${id} AND ${alias}.account_id=seed_e.account_id `;
export const nativeAutomaticEvaluationCandidatePresenceSql = automaticEvaluationCandidatePresenceSql
  .replace(
    "FROM opportunity_evidence_links l_primary ",
    "FROM opportunity_evidence_links l_primary FORCE INDEX (uq_opportunity_evidence) ",
  )
  .replace("uq_normalized_scope_record_version", "uq_normalized_account_record_version")
  .replace(
    "n_primary_current.organization_id=n_primary.organization_id AND n_primary_current.workspace_id=n_primary.workspace_id",
    "n_primary_current.account_id=n_primary.account_id",
  )
  .replace("JOIN providers p_primary", "STRAIGHT_JOIN providers p_primary")
  .replace(
    "WHERE l_primary.opportunity_id=o.id AND n_primary.organization_id=o.organization_id AND n_primary.workspace_id=o.workspace_id",
    `STRAIGHT_JOIN raw_evidence seed_e ON seed_e.id=l_primary.raw_evidence_id
      AND seed_e.provider_id=n_primary.provider_id AND seed_e.account_id=n_primary.account_id
    STRAIGHT_JOIN raw_evidence active_e ON active_e.id=n_primary_current.raw_evidence_id
      AND active_e.provider_id=n_primary_current.provider_id AND active_e.account_id=seed_e.account_id
    STRAIGHT_JOIN collection_tasks seed_t ON seed_t.id=seed_e.collection_task_id
    STRAIGHT_JOIN collection_tasks active_t ON active_t.id=active_e.collection_task_id
      AND active_t.organization_id=seed_t.organization_id AND active_t.workspace_id=seed_t.workspace_id
    ${ownedJoin("opportunity_evidence_links", "l_primary.id", "link_owner")}
    ${ownedJoin("raw_evidence", "seed_e.id", "seed_raw_owner")}
    ${ownedJoin("raw_evidence", "active_e.id", "active_raw_owner")}
    ${ownedJoin("normalized_records", "n_primary.id", "seed_owner")}
    ${ownedJoin("normalized_records", "n_primary_current.id", "active_owner")}
    ${ownedJoin("collection_tasks", "seed_t.id", "seed_task_owner")}
    ${ownedJoin("collection_tasks", "active_t.id", "active_task_owner")}
    WHERE l_primary.opportunity_id=o.id AND seed_t.organization_id=o.organization_id
      AND seed_t.workspace_id=o.workspace_id AND seed_e.account_id=ao.account_id`,
  );
export const nativeAutomaticEvaluationParentSql =
  "opportunities o JOIN account_owned_records ao ON ao.source_table='opportunities' AND ao.source_id=o.id " +
  "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
  "AND (ao.reason='exclusive_owner' OR (ao.reason IN ('shared','unassigned') AND ao.account_id=cut.primary_account_id)) ";
const nativeParent = nativeAutomaticEvaluationParentSql;
const nativeEligible = eligible.replace(
  automaticEvaluationCandidatePresenceSql,
  () => nativeAutomaticEvaluationCandidatePresenceSql,
);
export const nativeAutomaticEvaluationAdmissionCandidatesSql =
  automaticEvaluationAdmissionCandidatesSql
    .replace(
      "o.workspace_id FROM opportunities o ",
      `o.workspace_id,ao.account_id FROM ${nativeParent}`,
    )
    .replace(eligible, () => nativeEligible);
export const nativeAutomaticEvaluationAdmissionInsertSql = automaticEvaluationAdmissionInsertSql
  .replace("FROM opportunities o ", `FROM ${nativeParent}`)
  .replace(eligible, () => `ao.account_id=? AND ${nativeEligible}`);
export const nativeAutomaticEvaluationLockSql = `SELECT o.* FROM ${nativeParent}WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? AND ${nativeEligible} FOR UPDATE`;

export const accountAutomaticEvaluationPresenceSql = nativeAutomaticEvaluationCandidatePresenceSql
  .replace(
    "seed_t.id=seed_e.collection_task_id",
    "seed_t.id=seed_e.collection_task_id AND seed_t.account_id=seed_e.account_id",
  )
  .replace(
    "active_t.organization_id=seed_t.organization_id AND active_t.workspace_id=seed_t.workspace_id",
    "active_t.account_id=seed_e.account_id",
  )
  .replace(
    / AND seed_t\.organization_id=o\.organization_id\s+AND seed_t\.workspace_id=o\.workspace_id/,
    "",
  );
export const accountAutomaticEvaluationParentSql =
  nativeParent +
  "JOIN users active_owner_account ON active_owner_account.id=ao.account_id AND active_owner_account.status='active' ";
const accountEligible = eligible.replace(
  automaticEvaluationCandidatePresenceSql,
  () => accountAutomaticEvaluationPresenceSql,
);
const accountBinding = "o.account_id=ao.account_id";
export const accountAutomaticEvaluationQueries = {
  candidates: `SELECT o.id,ao.account_id FROM ${accountAutomaticEvaluationParentSql}
    LEFT JOIN automatic_selection_evaluations e ON e.opportunity_id=o.id
    WHERE e.opportunity_id IS NULL AND ${accountBinding} AND ${accountEligible} LIMIT 100`,
  insert: `INSERT IGNORE INTO automatic_selection_evaluations
    (opportunity_id,status,attempt_count,available_at,created_at,updated_at)
    SELECT o.id,'queued',0,?,?,? FROM ${accountAutomaticEvaluationParentSql}
    WHERE o.id=? AND ao.account_id=? AND ${accountBinding} AND ${accountEligible}`,
  lock: `SELECT o.* FROM ${accountAutomaticEvaluationParentSql}
    WHERE o.id=? AND ao.account_id=? AND ${accountBinding} AND ${accountEligible} FOR UPDATE`,
};

/** Consistent candidate read, then per-resource atomic eligibility check; duplicate queue rows remain untouched. */
export async function enqueueMissingSelectionEvaluations(
  pool: Pool,
  now: Date,
  nativeEvidence?: boolean,
  accountParent = false,
) {
  const native = nativeEvidence ?? (await hasNativeNormalizedAccountScope(pool));
  const [rows] = await pool.query<RowDataPacket[]>(
    accountParent
      ? accountAutomaticEvaluationQueries.candidates
      : native
        ? nativeAutomaticEvaluationAdmissionCandidatesSql
        : automaticEvaluationAdmissionCandidatesSql,
  );
  let admitted = 0;
  for (const row of rows) {
    const [result] = await pool.query<ResultSetHeader>(
      accountParent
        ? accountAutomaticEvaluationQueries.insert
        : native
          ? nativeAutomaticEvaluationAdmissionInsertSql
          : automaticEvaluationAdmissionInsertSql,
      [
        now,
        now,
        now,
        row.id,
        ...(accountParent
          ? [row.account_id]
          : [row.organization_id, row.workspace_id, ...(native ? [row.account_id] : [])]),
      ],
    );
    admitted += result.affectedRows;
  }
  return admitted;
}
