import type { Pool, RowDataPacket } from "mysql2/promise";

async function scopeColumns(
  db: Pick<Pool, "query">,
  table: "notification_deliveries" | "realtime_events",
) {
  const [rows] = await db.query<RowDataPacket[]>(
    `SHOW COLUMNS FROM ${table} WHERE Field IN ('organization_id','workspace_id')`,
  );
  if (rows.length === 0) return false;
  if (rows.length === 2) return true;
  throw new Error(`partial_inherited_scope_schema:${table}`);
}
export const notificationDeliveryScopeColumns = (db: Pick<Pool, "query">) =>
  scopeColumns(db, "notification_deliveries");
export const realtimeEventScopeColumns = (db: Pick<Pool, "query">) =>
  scopeColumns(db, "realtime_events");
