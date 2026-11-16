import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export async function hasLegacyCompetitorEventScope(
  connection: Pick<Pool, "query"> | Pick<PoolConnection, "query">,
) {
  const [columns] = await connection.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM competitor_events WHERE Field IN ('organization_id','workspace_id')",
  );
  if (columns.length === 1) throw new Error("partial_inherited_scope_schema:competitor_events");
  return columns.length === 2;
}

export async function appendCompetitorEvent(
  connection: Pick<PoolConnection, "query">,
  event: {
    id: string;
    organizationId?: string;
    workspaceId?: string;
    parentId: string;
    eventType: string;
    actorId: string;
    payloadJson: string;
    requestId: string;
    traceId: string;
    createdAt: Date;
  },
) {
  const legacy = await hasLegacyCompetitorEventScope(connection);
  if (legacy && (!event.organizationId || !event.workspaceId))
    throw new Error("legacy_scope_required:competitor_events");
  await connection.query(
    `INSERT INTO competitor_events (id,${legacy ? "organization_id,workspace_id," : ""}competitor_id,event_type,actor_id,payload_json,request_id,trace_id,created_at)
     VALUES (?,${legacy ? "?,?," : ""}?,?,?,?,?,?,?)`,
    [
      event.id,
      ...(legacy ? [event.organizationId, event.workspaceId] : []),
      event.parentId,
      event.eventType,
      event.actorId,
      event.payloadJson,
      event.requestId,
      event.traceId,
      event.createdAt,
    ],
  );
}

export async function hasLegacyCompetitorOutboxScope(connection: Pick<PoolConnection, "query">) {
  const [columns] = await connection.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM competitor_outbox WHERE Field IN ('organization_id','workspace_id')",
  );
  if (columns.length === 1) throw new Error("partial_inherited_scope_schema:competitor_outbox");
  return columns.length === 2;
}

export async function appendCompetitorOutbox(
  connection: Pick<PoolConnection, "query">,
  event: {
    id: string;
    organizationId?: string;
    workspaceId?: string;
    parentId: string;
    eventType: string;
    payloadJson: string;
    createdAt: Date;
  },
) {
  const legacy = await hasLegacyCompetitorOutboxScope(connection);
  if (legacy && (!event.organizationId || !event.workspaceId))
    throw new Error("legacy_scope_required:competitor_outbox");
  await connection.query(
    `INSERT INTO competitor_outbox (id,${legacy ? "organization_id,workspace_id," : ""}aggregate_id,event_type,payload_json,status,available_at,created_at)
     VALUES (?,${legacy ? "?,?," : ""}?,?,?,'pending',?,?)`,
    [
      event.id,
      ...(legacy ? [event.organizationId, event.workspaceId] : []),
      event.parentId,
      event.eventType,
      event.payloadJson,
      event.createdAt,
      event.createdAt,
    ],
  );
}
