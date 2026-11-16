import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export async function appendWebhookDeliveryEvent(
  db: Pick<PoolConnection, "query">,
  i: {
    id: string;
    deliveryId: string;
    fromStatus: string | null;
    toStatus: string;
    attempts: number;
    reason: string | null;
    actorId: string | null;
    requestId: string;
    traceId: string;
    occurredAt: Date;
  },
) {
  const [columns] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM webhook_delivery_events WHERE Field IN ('organization_id','delivery_id')",
  );
  if (!columns.some((column) => column.Field === "delivery_id"))
    throw new Error("webhook_delivery_event_shape_invalid");
  const legacy = columns.some((column) => column.Field === "organization_id");
  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO webhook_delivery_events(id,delivery_id,endpoint_id,${legacy ? "organization_id," : ""}` +
      "from_status,to_status,attempt_count,reason,actor_id,request_id,trace_id,occurred_at) " +
      `SELECT ?,d.id,d.endpoint_id,${legacy ? "d.organization_id," : ""}?,?,?,?,?,?,?,? FROM webhook_deliveries d WHERE d.id=?`,
    [
      i.id,
      i.fromStatus,
      i.toStatus,
      i.attempts,
      i.reason,
      i.actorId,
      i.requestId,
      i.traceId,
      i.occurredAt,
      i.deliveryId,
    ],
  );
  if (result.affectedRows !== 1) throw new Error("webhook_delivery_event_parent_missing");
}
