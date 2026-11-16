// Match the retired API/Worker startup gate, before any persistent cutover work.
// Counts are operational observations, not authority to alter historical runs.
export async function readStandaloneCrawlerCutoverPreflight(connection) {
  const [[state]] = await connection.query(`SELECT
    (SELECT COUNT(*) FROM crawler_browser_runs run
      LEFT JOIN browser_collection_jobs job ON job.crawler_run_id=run.id
      WHERE run.status='running' AND job.id IS NULL) standalone_running,
    (SELECT COUNT(*) FROM crawler_profile_leases lease
      LEFT JOIN browser_collection_jobs job ON job.crawler_run_id=lease.run_id
      WHERE lease.expires_at>UTC_TIMESTAMP(3) AND job.id IS NULL) standalone_active_leases`);
  const { standalone_running: running, standalone_active_leases: leases } = state ?? {};
  if (
    ![running, leases].every(
      (value) =>
        (typeof value === "string" || typeof value === "number") &&
        /^\d+$/.test(String(value)) &&
        Number.isSafeInteger(Number(value)),
    )
  )
    throw new Error("account_cutover_crawler_preflight_invalid_result");
  return { running: Number(running), leases: Number(leases) };
}

export async function assertStandaloneCrawlerCutoverPreflight(connection) {
  const counts = await readStandaloneCrawlerCutoverPreflight(connection);
  if (counts.running !== 0 || counts.leases !== 0)
    throw new Error("account_cutover_standalone_crawler_not_drained");
  return counts;
}
