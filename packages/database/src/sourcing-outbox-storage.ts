import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export async function hasLegacySourcingEventScope(connection: Pick<PoolConnection, "query">) {
  const [columns] = await connection.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM sourcing_events WHERE Field IN ('organization_id','workspace_id')",
  );
  if (columns.length === 1) throw new Error("partial_inherited_scope_schema:sourcing_events");
  return columns.length === 2;
}

export async function appendSourcingEvent(
  connection: Pick<PoolConnection, "query">,
  event: {
    id: string;
    organizationId?: string;
    workspaceId?: string;
    eventType: string;
    resourceId: string;
    actorId: string;
    payloadJson: string;
    requestId: string;
    traceId: string;
    createdAt: Date;
  },
) {
  const legacy = await hasLegacySourcingEventScope(connection);
  if (legacy && (!event.organizationId || !event.workspaceId))
    throw new Error("legacy_sourcing_event_scope_required");
  await connection.query(
    `INSERT INTO sourcing_events (id,${legacy ? "organization_id,workspace_id," : ""}event_type,resource_id,actor_id,payload_json,request_id,trace_id,created_at)
     VALUES (?,${legacy ? "?,?," : ""}?,?,?,?,?,?,?)`,
    [
      event.id,
      ...(legacy ? [event.organizationId, event.workspaceId] : []),
      event.eventType,
      event.resourceId,
      event.actorId,
      event.payloadJson,
      event.requestId,
      event.traceId,
      event.createdAt,
    ],
  );
}

export async function hasLegacySourcingOutboxScope(connection: Pick<PoolConnection, "query">) {
  const [columns] = await connection.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM sourcing_outbox WHERE Field IN ('organization_id','workspace_id')",
  );
  if (columns.length === 1) throw new Error("partial_inherited_scope_schema:sourcing_outbox");
  return columns.length === 2;
}

export async function appendSourcingOutbox(
  connection: Pick<PoolConnection, "query">,
  event: {
    id: string;
    organizationId?: string;
    workspaceId?: string;
    eventType: string;
    resourceId: string;
    payloadJson: string;
    createdAt: Date;
  },
) {
  const legacy = await hasLegacySourcingOutboxScope(connection);
  if (legacy && (!event.organizationId || !event.workspaceId))
    throw new Error("legacy_sourcing_outbox_scope_required");
  await connection.query(
    `INSERT INTO sourcing_outbox (id,${legacy ? "organization_id,workspace_id," : ""}event_type,resource_id,payload_json,status,available_at,created_at)
     VALUES (?,${legacy ? "?,?," : ""}?,?,?,'queued',?,?)`,
    [
      event.id,
      ...(legacy ? [event.organizationId, event.workspaceId] : []),
      event.eventType,
      event.resourceId,
      event.payloadJson,
      event.createdAt,
      event.createdAt,
    ],
  );
}
