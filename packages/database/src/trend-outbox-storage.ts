import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export async function appendTrendOutbox(
  connection: Pick<PoolConnection, "query">,
  event: {
    id: string;
    organizationId: string;
    workspaceId: string;
    eventType: string;
    resourceType: string;
    resourceId: string;
    payloadJson: string;
    requestId: string;
    traceId: string;
    createdAt: Date;
  },
) {
  const [columns] = await connection.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM trend_outbox WHERE Field IN ('organization_id','workspace_id')",
  );
  if (columns.length === 1) throw new Error("partial_inherited_scope_schema:trend_outbox");
  const legacy = columns.length === 2;
  await connection.query(
    `INSERT INTO trend_outbox (id,${legacy ? "organization_id,workspace_id," : ""}event_type,resource_type,resource_id,payload_json,
     status,attempt_count,available_at,request_id,trace_id,created_at,updated_at)
     VALUES (?,${legacy ? "?,?," : ""}?,?,?,?,'queued',0,?,?,?,?,?)`,
    [
      event.id,
      ...(legacy ? [event.organizationId, event.workspaceId] : []),
      event.eventType,
      event.resourceType,
      event.resourceId,
      event.payloadJson,
      event.createdAt,
      event.requestId,
      event.traceId,
      event.createdAt,
      event.createdAt,
    ],
  );
}
