import type { Pool, RowDataPacket } from "mysql2/promise";

export async function readPlatformCollectionMetrics(
  pool: Pool,
  input: { since: Date; now: Date; windowMinutes: number },
) {
  const [[tasks], [queues], [providers], [trend]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      "SELECT SUM(status IN ('succeeded','succeeded_empty','completed_with_warnings')) success_count," +
        "SUM(status IN ('failed_terminal','dead_letter')) failed_count,SUM(status IN ('queued'," +
        "'leased','running','parsing','validating','retry_scheduled')) queue_backlog," +
        "SUM(lease_expires_at IS NOT NULL AND lease_expires_at<? AND status IN ('leased'," +
        "'running')) expired_leases FROM collection_tasks WHERE updated_at>=?",
      [input.now, input.since],
    ),
    pool.query<RowDataPacket[]>(
      "SELECT status,COUNT(*) total FROM collection_tasks WHERE status IN ('queued'," +
        "'leased','running','parsing','validating','retry_scheduled','failed_terminal'," +
        "'dead_letter') GROUP BY status ORDER BY status",
    ),
    pool.query<RowDataPacket[]>(
      "SELECT p.id,p.code,p.name,COUNT(s.id) observed_count,SUM(s.status IN ('succeeded'," +
        "'succeeded_empty')) success_count,SUM(s.status IN ('failed','blocked')) failed_count," +
        "MAX(s.updated_at) last_observed_at FROM providers p LEFT JOIN collection_subqueries " +
        "s ON s.provider_id=p.id AND s.updated_at>=? WHERE p.status='enabled' GROUP BY p.id," +
        "p.code,p.name ORDER BY p.name",
      [input.since],
    ),
    pool.query<RowDataPacket[]>(
      "SELECT DATE_FORMAT(updated_at,IF(?<=1440,'%Y-%m-%d %H:00:00','%Y-%m-%d 00:00:00')) bucket," +
        "SUM(status IN ('succeeded','succeeded_empty','completed_with_warnings')) succeeded," +
        "SUM(status IN ('failed_terminal','dead_letter')) failed FROM collection_tasks WHERE " +
        "updated_at>=? GROUP BY bucket ORDER BY bucket",
      [input.windowMinutes, input.since],
    ),
  ]);
  return { tasks: tasks[0], queues, providers, trend };
}
