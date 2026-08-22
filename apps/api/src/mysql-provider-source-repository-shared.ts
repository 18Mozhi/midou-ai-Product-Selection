import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { ProviderSourceReplay, ProvisionedSource } from "./provider-source-service.js";

export const iso = (value: unknown) => new Date(value as string | Date).toISOString();
export const provisioned = (row: RowDataPacket): ProvisionedSource => ({
  id: String(row.id),
  code: String(row.code),
  status: row.status,
  version: Number(row.version),
  schedule_minutes: Number(row.schedule_minutes),
  timeout_ms: Number(row.timeout_ms),
  retry_limit: Number(row.retry_limit),
  updated_at: iso(row.updated_at),
  ...(row.concurrency_limit == null || row.active_subquery_count == null
    ? {}
    : {
        concurrency_snapshot: {
          configured_limit: Number(row.concurrency_limit),
          active_subquery_count: Number(row.active_subquery_count),
        },
      }),
  last_success: row.last_success_task_id
    ? {
        task_id: String(row.last_success_task_id),
        status: row.last_success_status,
        available_result_count: Number(row.last_success_result_count),
        finished_at: iso(row.last_success_finished_at),
      }
    : null,
});
export const providerSourceReplayFromRow = (row: RowDataPacket): ProviderSourceReplay => ({
  id: String(row.id),
  task_id: String(row.task_id),
  provider_id: String(row.provider_id),
  source_code: String(row.source_code),
  status: String(row.status),
  item_count: Number(row.item_count),
  error_code: row.error_code == null ? null : String(row.error_code),
  request_id: String(row.request_id),
  trace_id: String(row.trace_id),
  created_at: iso(row.created_at),
  updated_at: iso(row.updated_at),
});

export async function providerSourceByOperation(
  connection: PoolConnection,
  actorId: string,
  route: string,
  idempotencyKey: string,
) {
  const [rows] = await connection.query<RowDataPacket[]>(
    [
      "SELECT p.id,p.code,p.status,p.version,p.schedule_minutes,p.timeout_ms,p.retry_limit,p.updated_at ",
      "FROM provider_source_operations o JOIN providers p ON p.id=o.provider_id WHERE o.actor_id=? AND ",
      "o.route=? AND o.idempotency_key=? LIMIT 1",
    ].join(""),
    [actorId, route, idempotencyKey],
  );
  return rows[0] ? provisioned(rows[0]) : null;
}
