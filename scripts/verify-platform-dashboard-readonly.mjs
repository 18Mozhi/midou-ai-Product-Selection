import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { readPlatformCollectionMetrics } from "../apps/api/dist/mysql-platform-dashboard-collection-metrics.js";
import { readPlatformStorageMetrics } from "../apps/api/dist/mysql-platform-dashboard-storage-metrics.js";
import { readPlatformScaleMetrics } from "../apps/api/dist/mysql-platform-dashboard-scale-metrics.js";
import { readPlatformRiskMetrics } from "../apps/api/dist/mysql-platform-dashboard-risk-metrics.js";

const pool = createDatabasePool(loadRuntimeConfig(process.env, "api"));
let connection;
try {
  connection = await pool.getConnection();
  await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
  const now = new Date(),
    since = new Date(now.getTime() - 24 * 60 * 60 * 1000),
    collection = await readPlatformCollectionMetrics(connection, {
      now,
      since,
      windowMinutes: 1440,
    }),
    storage = await readPlatformStorageMetrics(connection, since),
    scale = await readPlatformScaleMetrics(connection);
  await readPlatformRiskMetrics(connection, 20);
  const [counts] = await connection.query(
    "SELECT status,COUNT(*) total FROM collection_tasks WHERE updated_at>=? GROUP BY status",
    [since],
  );
  const [[files]] = await connection.query(
    "SELECT COALESCE(SUM(size_bytes),0) growth FROM file_assets WHERE status='active' AND created_at>=?",
    [since],
  );
  const count = (states) =>
    counts
      .filter((row) => states.includes(row.status))
      .reduce((total, row) => total + Number(row.total), 0);
  if (
    Number(collection.tasks?.success_count ?? 0) !==
      count(["succeeded", "succeeded_empty", "completed_with_warnings"]) ||
    Number(collection.tasks?.failed_count ?? 0) !== count(["failed_terminal", "dead_letter"]) ||
    Number(storage?.growth_bytes ?? 0) !== Number(files.growth) ||
    Number(scale.organizations?.total ?? 0) < 1 ||
    Number(scale.users?.total ?? 0) < 1
  )
    throw new Error("production dashboard factual snapshot mismatch");
  console.log(
    JSON.stringify({
      status: "passed",
      production_dashboard_snapshot: "consistent_read_only",
      terminal_counts: "matched",
      file_growth: "matched",
      writes: 0,
    }),
  );
} finally {
  try {
    if (connection) await connection.rollback();
  } finally {
    connection?.release();
    await pool.end();
  }
}
