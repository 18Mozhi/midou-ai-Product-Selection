import type { Pool, RowDataPacket } from "mysql2/promise";

export async function readPlatformStorageMetrics(pool: Pool, since: Date) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT COALESCE(SUM(CASE WHEN status='active' THEN size_bytes ELSE 0 END)," +
      "0) total_bytes,COALESCE(SUM(CASE WHEN status='active' AND created_at>=? THEN size_bytes " +
      "ELSE 0 END),0) growth_bytes FROM file_assets",
    [since],
  );
  return rows[0];
}
