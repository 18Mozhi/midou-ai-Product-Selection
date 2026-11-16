import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export async function appendOpportunityOutbox(
  connection: Pick<PoolConnection, "query">,
  event: {
    id: string;
    eventId: string;
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
    "SHOW COLUMNS FROM opportunity_outbox WHERE Field IN ('organization_id','workspace_id','event_id')",
  );
  const fields = new Set(columns.map((column) => String(column.Field)));
  const legacy = fields.size === 2 && fields.has("organization_id") && fields.has("workspace_id");
  if (!legacy && !(fields.size === 1 && fields.has("event_id")))
    throw new Error("partial_inherited_scope_schema:opportunity_outbox");
  await connection.query(
    `INSERT INTO opportunity_outbox (id,${legacy ? "organization_id,workspace_id" : "event_id"},event_type,resource_type,resource_id,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at)
     VALUES (?,${legacy ? "?,?" : "?"},?,?,?,?,'queued',0,?,?,?,?,?)`,
    [
      event.id,
      ...(legacy ? [event.organizationId, event.workspaceId] : [event.eventId]),
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
