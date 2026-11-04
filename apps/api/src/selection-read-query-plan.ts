import { selectionCompetitorRelevanceSql, selectionPrimaryAsinSql } from "@scoutops/database";

// MySQL 5.7 otherwise starts from every active product version, repeating large
// classification JSON checks for each competitor. Start at the scoped receipts,
// then use their existing subquery UUID to reach the exact evidence by primary key.
// Keep every original predicate, including the BINARY UUID equality and latest-event proofs.
const from = "EXISTS (SELECT 1 FROM collection_subqueries q_relation ";
const eventJoin = "JOIN opportunity_events e_relation ON ";
const eventIndex = selectionCompetitorRelevanceSql.indexOf(eventJoin);
const whereIndex = selectionCompetitorRelevanceSql.indexOf("WHERE e_relation.resource_id");
if (!selectionCompetitorRelevanceSql.startsWith(from) || eventIndex < 0 || whereIndex < 0)
  throw new Error("selection_read_query_shape_changed");
export const selectionReadRelevanceSql =
  "EXISTS (SELECT 1 FROM opportunity_events e_relation STRAIGHT_JOIN collection_subqueries q_relation " +
  "ON q_relation.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(e_relation.payload_json,'$.subquery_id')) USING ascii) " +
  selectionCompetitorRelevanceSql
    .slice(from.length, eventIndex)
    .replaceAll("JOIN ", "STRAIGHT_JOIN ") +
  "WHERE " +
  selectionCompetitorRelevanceSql.slice(eventIndex + eventJoin.length, whereIndex) +
  "AND " +
  selectionCompetitorRelevanceSql.slice(whereIndex + "WHERE ".length);

export function optimizeSelectionReadSql(sql: string) {
  for (const identity of [null, "o.primary_fact_asin", "o.filter_primary_asin"]) {
    const original = identity
      ? selectionCompetitorRelevanceSql.replaceAll(selectionPrimaryAsinSql, identity)
      : selectionCompetitorRelevanceSql;
    const optimized = identity
      ? selectionReadRelevanceSql.replaceAll(selectionPrimaryAsinSql, identity)
      : selectionReadRelevanceSql;
    sql = sql.replaceAll(original, () => optimized);
  }
  return sql;
}
