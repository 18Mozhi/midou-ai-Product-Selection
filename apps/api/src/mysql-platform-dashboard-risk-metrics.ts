import type { Pool, RowDataPacket } from "mysql2/promise";

export async function readPlatformRiskMetrics(pool: Pool, errorLimit: number) {
  const [[quality], [alerts], [activity]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      "SELECT SUM(status='open') open_count,SUM(status='open' AND severity='critical') critical_count FROM data_quality_issues",
    ),
    pool.query<RowDataPacket[]>(
      "SELECT id,organization_id,workspace_id,'quality' kind,severity,metric_code code," +
        "updated_at observed_at FROM data_quality_issues WHERE status='open' UNION ALL SELECT " +
        "id,organization_id,workspace_id,'task' kind,IF(status='dead_letter','critical'," +
        "'warning') severity,COALESCE(last_error_code,status) code,updated_at observed_at FROM " +
        "collection_tasks WHERE status IN ('failed_terminal','dead_letter') ORDER BY observed_at " +
        "DESC LIMIT ?",
      [errorLimit],
    ),
    pool.query<RowDataPacket[]>(
      "SELECT action,outcome,resource_type,request_id,occurred_at FROM platform_audit_events ORDER BY occurred_at DESC LIMIT 10",
    ),
  ]);
  return { quality: quality[0], alerts, activity };
}
