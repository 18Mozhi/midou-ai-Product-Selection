import type { Pool, RowDataPacket } from "mysql2/promise";

export async function readPlatformScaleMetrics(pool: Pool) {
  const [[organizations], [users], [providers]] = await Promise.all([
    pool.query<RowDataPacket[]>("SELECT COUNT(*) total FROM organizations WHERE status='active'"),
    pool.query<RowDataPacket[]>("SELECT COUNT(*) total FROM users WHERE status='active'"),
    pool.query<RowDataPacket[]>("SELECT COUNT(*) total FROM providers WHERE status='enabled'"),
  ]);
  return {
    organizations: organizations[0],
    users: users[0],
    providers: providers[0],
  };
}
