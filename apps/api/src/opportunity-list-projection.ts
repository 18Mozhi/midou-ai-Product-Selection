import { opportunityPrimaryRecordsSql } from "./opportunity-primary-product.js";
import {
  opportunityPrimaryAsinSql,
  opportunitySelectionProjectionSql,
} from "./opportunity-selection-policy.js";

// Independent scoped derived tables materialize once instead of scanning every historical version
// for each linked seed. The original join proofs, field selection and ordering are retained.
const scopedActiveVersionsSql = (alias: "n" | "n_primary_current") =>
  "(SELECT active_version.* FROM normalized_records active_version FORCE INDEX (idx_normalized_scope_status) " +
  "WHERE active_version.organization_id=? AND active_version.workspace_id=? " +
  "AND active_version.status='active' LIMIT 18446744073709551615) " +
  alias;

export const opportunityListPrimaryAsinSql = opportunityPrimaryAsinSql
  .replace(
    "FROM opportunity_evidence_links l_primary JOIN normalized_records n_primary ON",
    "FROM opportunity_evidence_links l_primary STRAIGHT_JOIN normalized_records n_primary FORCE INDEX (idx_normalized_evidence) ON",
  )
  .replace(
    "JOIN normalized_records n_primary_current ON",
    () => "STRAIGHT_JOIN " + scopedActiveVersionsSql("n_primary_current") + " ON",
  );

export const opportunityListPrimaryRecordsSql = opportunityPrimaryRecordsSql.replace(
  "STRAIGHT_JOIN normalized_records n FORCE INDEX (uq_normalized_scope_record_version) ON",
  () => "STRAIGHT_JOIN " + scopedActiveVersionsSql("n") + " ON",
);

export const reuseListPrimaryIdentitySql = (sql: string) =>
  sql.replaceAll(opportunityPrimaryAsinSql, "o.primary_fact_asin");
export const opportunityListSelectionProjectionSql = reuseListPrimaryIdentitySql(
  opportunitySelectionProjectionSql,
);
