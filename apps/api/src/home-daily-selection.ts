import {
  selectionScopedPrimaryIdentitiesSql,
  selectionCompletionSourceNotRejectedSql,
} from "@scoutops/database";
import { homeQualityGateSql } from "./home-selection-sql.js";

/** User target uses the current workspace and Beijing calendar day; stored timestamps are UTC. */
export function dailySelectionWindow(now: Date) {
  const date = new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
  const start = new Date(`${date}T00:00:00+08:00`);
  return { date, start, end: new Date(start.getTime() + 86_400_000) };
}

/** Fragments are code-owned SQL, never request parameters. */
export const dailySelectionCountSql = (dailySql: string, historicalSql: string) =>
  "SELECT COUNT(DISTINCT daily.main_asin) discovered_count," +
  "COUNT(DISTINCT CASE WHEN daily.quality_passed=1 THEN daily.main_asin END) qualified_count " +
  `FROM (${dailySql}) daily WHERE daily.main_asin IS NOT NULL ` +
  `AND NOT EXISTS (SELECT 1 FROM (${historicalSql}) historical WHERE BINARY historical.main_asin=BINARY daily.main_asin)`;

export const dailySelectionProductionSql = dailySelectionCountSql(
  "SELECT daily_identity.main_asin," +
    homeQualityGateSql +
    " quality_passed FROM (" +
    selectionScopedPrimaryIdentitiesSql("daily") +
    ") daily_identity " +
    "JOIN opportunities o ON o.id=daily_identity.opportunity_id",
  selectionScopedPrimaryIdentitiesSql("historical"),
);

/** First verified full-pipeline completion per workspace ASIN; repeated refreshes never create a new day. */
export const dailySelectionCompletedSql =
  "SELECT COUNT(*) completed_count FROM (SELECT " +
  "UPPER(JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.main_asin'))) main_asin," +
  "MIN(occurred_at) completed_at FROM opportunity_events completion_receipt " +
  "WHERE organization_id=? AND workspace_id=? AND resource_type='selection_pipeline' " +
  "AND event_type='opportunity.selection_pipeline_completed' AND actor_type='worker' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.contract')) IN ('selection-pipeline-v1','selection-pipeline-v2') " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.main_asin')) REGEXP '^[A-Za-z0-9]{10}$' " +
  "AND " +
  selectionCompletionSourceNotRejectedSql("completion_receipt") +
  " " +
  "GROUP BY UPPER(JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.main_asin')))) completed " +
  "WHERE completed.completed_at>=? AND completed.completed_at<?";
