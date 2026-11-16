import type { PoolConnection, RowDataPacket } from "mysql2/promise";

async function hasLegacyEvidenceScope(
  connection: Pick<PoolConnection, "query">,
  table: "evidence_data_events" | "evidence_data_outbox",
) {
  const [scope] = await connection.query<RowDataPacket[]>(
    `SHOW COLUMNS FROM ${table} WHERE Field IN ('organization_id','workspace_id')`,
  );
  if (scope.length === 1) throw new Error(`partial_inherited_scope_schema:${table}`);
  return scope.length === 2;
}

export async function appendEvidenceDataEvent(
  connection: Pick<PoolConnection, "query">,
  event: {
    id: string;
    organizationId: string;
    workspaceId: string;
    eventType: string;
    requireInheritedScope?: boolean;
    resourceType: string;
    resourceId: string;
    actorType: "user" | "worker" | "system";
    actorId: string;
    requestId: string;
    traceId: string;
    payloadJson: string;
    occurredAt: Date;
  },
) {
  const legacy = await hasLegacyEvidenceScope(connection, "evidence_data_events");
  if (legacy && event.requireInheritedScope)
    throw new Error("account_evidence_inherited_scope_required:evidence_data_events");
  const actor = { user: "'user'", worker: "'worker'", system: "'system'" }[event.actorType];
  if (!actor) throw new Error("invalid_evidence_event_actor_type");
  return connection.query(
    `INSERT INTO evidence_data_events (id,${legacy ? "organization_id,workspace_id," : ""}event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at)
     VALUES (?,${legacy ? "?,?," : ""}?,?,?,${actor},?,?,?,?,?)`,
    [
      event.id,
      ...(legacy ? [event.organizationId, event.workspaceId] : []),
      event.eventType,
      event.resourceType,
      event.resourceId,
      event.actorId,
      event.requestId,
      event.traceId,
      event.payloadJson,
      event.occurredAt,
    ],
  );
}

export async function appendEvidenceDataOutbox(
  connection: Pick<PoolConnection, "query">,
  delivery: {
    id: string;
    organizationId: string;
    workspaceId: string;
    eventType: string;
    requireInheritedScope?: boolean;
    resourceType: string;
    resourceId: string;
    requestId: string;
    traceId: string;
    payloadJson: string;
    createdAt: Date;
  },
) {
  const legacy = await hasLegacyEvidenceScope(connection, "evidence_data_outbox");
  if (legacy && delivery.requireInheritedScope)
    throw new Error("account_evidence_inherited_scope_required:evidence_data_outbox");
  return connection.query(
    `INSERT INTO evidence_data_outbox (id,${legacy ? "organization_id,workspace_id," : ""}event_type,resource_type,resource_id,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at)
     VALUES (?,${legacy ? "?,?," : ""}?,?,?,?,'queued',0,?,?,?,?,?)`,
    [
      delivery.id,
      ...(legacy ? [delivery.organizationId, delivery.workspaceId] : []),
      delivery.eventType,
      delivery.resourceType,
      delivery.resourceId,
      delivery.payloadJson,
      delivery.createdAt,
      delivery.requestId,
      delivery.traceId,
      delivery.createdAt,
      delivery.createdAt,
    ],
  );
}
