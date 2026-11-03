import { opportunityPrimaryRecordsSql } from "./opportunity-primary-product.js";
import {
  opportunityPrimaryAsinSql,
  opportunitySelectionProjectionSql,
} from "./opportunity-selection-policy.js";

// Independent scoped derived tables materialize once instead of scanning every historical version
// for each linked seed. The original join proofs, field selection and ordering are retained.
export const scopedActiveVersionsSql = (alias: "n" | "n_primary_current") => {
  const fields =
    alias === "n"
      ? [
          "asin",
          "canonical_url",
          "price",
          "currency",
          "rating_value",
          "review_count",
          "image_url",
          "sales_badge_text",
          "sales_badge_quantity_lower_bound",
          "sales_badge_period",
          "sponsored",
          "best_seller_rank",
          "best_seller_rank_text",
        ]
      : ["asin", "canonical_url"];
  // Only columns referenced by the original outer proofs/projection. Do not copy review bodies
  // and unrelated payloads into MySQL 5.7 materialized temporary tables on every list read.
  const payload =
    "JSON_OBJECT(" +
    fields.map((key) => `'${key}',JSON_EXTRACT(active_version.payload_json,'$.${key}')`).join(",") +
    ") payload_json";
  return (
    "(SELECT active_version.id,active_version.organization_id,active_version.workspace_id," +
    "active_version.provider_id,active_version.record_key,active_version.status,active_version.created_at," +
    payload +
    " FROM normalized_records active_version FORCE INDEX (idx_normalized_scope_status) " +
    "WHERE active_version.organization_id=? AND active_version.workspace_id=? " +
    "AND active_version.status='active' LIMIT 18446744073709551615) " +
    alias
  );
};

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
