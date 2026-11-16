import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

// Only opportunity and completion receipts appear in product reads. Resolve their scope by the
// exact parent PK, without joining scoring, cost or rate tables into hot product reads.
export const opportunityEventReadRelation =
  "(SELECT ev.id,ev.event_type,ev.resource_type,ev.resource_id,ev.actor_type,ev.actor_id," +
  "ev.request_id,ev.trace_id,ev.payload_json,ev.occurred_at,ep.organization_id,ep.workspace_id " +
  "FROM opportunity_events ev JOIN opportunities ep ON ep.id=ev.resource_id " +
  "AND BINARY ev.resource_type IN ('opportunity','selection_pipeline'))";

const eventParents = new Map([
  ["opportunity", "opportunities"],
  ["selection_pipeline", "opportunities"],
  ["cost_rule", "cost_rules"],
  ["score_rule", "score_rules"],
  ["exchange_rate", "exchange_rate_quotes"],
]);

export async function appendOpportunityEvent(
  connection: Pick<PoolConnection, "query">,
  event: {
    id: string;
    organizationId: string;
    workspaceId: string;
    eventType: string;
    resourceType: string;
    resourceId: string;
    actorType: "user" | "worker" | "system";
    actorId: string;
    requestId: string;
    traceId: string;
    payloadJson: string;
    occurredAt: Date | "database_now";
  },
) {
  const [columns] = await connection.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM opportunity_events WHERE Field IN ('organization_id','workspace_id')",
  );
  if (columns.length === 1) throw new Error("partial_inherited_scope_schema:opportunity_events");
  const legacy = columns.length === 2;
  const now = event.occurredAt === "database_now";
  const parent = eventParents.get(event.resourceType);
  if (!parent) throw new Error("unknown_source_resource_type:opportunity_events");
  const insert = `INSERT INTO opportunity_events (id,${legacy ? "organization_id,workspace_id," : ""}event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at)`;
  const placeholders = `?,${legacy ? "?,?," : ""}?,?,?,?,?,?,?,?,${now ? "NOW(3)" : "?"}`;
  const values = [
    event.id,
    ...(legacy ? [event.organizationId, event.workspaceId] : []),
    event.eventType,
    event.resourceType,
    event.resourceId,
    event.actorType,
    event.actorId,
    event.requestId,
    event.traceId,
    event.payloadJson,
    ...(now ? [] : [event.occurredAt]),
  ];
  if (legacy)
    return connection.query<ResultSetHeader>(`${insert} VALUES (${placeholders})`, values);
  const result = await connection.query<ResultSetHeader>(
    `${insert} SELECT ${placeholders} FROM ${parent} WHERE id=? AND organization_id=? AND workspace_id=?`,
    [...values, event.resourceId, event.organizationId, event.workspaceId],
  );
  if (result[0].affectedRows !== 1)
    throw new Error("broken_source_link:opportunity_events.resource_id");
  return result;
}
