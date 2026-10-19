import { opportunityListPrimaryAsinSql } from "./opportunity-list-projection.js";
import {
  opportunityPrimaryAsinSql,
  opportunityRecommendationFactsSql,
} from "./opportunity-selection-policy.js";

/** Necessary scalar facts only; original full gates remain in the outer WHERE. */
export const opportunityRecommendedListSourceSql =
  "(SELECT o.*," +
  opportunityListPrimaryAsinSql +
  " filter_primary_asin FROM " +
  "(SELECT o.* FROM opportunities o WHERE o.organization_id=? AND o.workspace_id=? " +
  "AND o.decision_status='pending' AND " +
  opportunityRecommendationFactsSql +
  " LIMIT 18446744073709551615) o LIMIT 18446744073709551615) o";

/** Fixed internal predicate only: each repeated identity retains exactly the same proof. */
export const reuseRecommendedFilterIdentitySql = (sql: string) =>
  sql.replaceAll(opportunityPrimaryAsinSql, "o.filter_primary_asin");
