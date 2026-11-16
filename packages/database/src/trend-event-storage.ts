import { trendRuleScopeRelation } from "./trend-rule-scope.js";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

// Product source proofs and topic audit reads refer only to topic events.
export const trendTopicEventReadRelation =
  "(SELECT ev.id,ev.event_type,ev.resource_type,ev.resource_id,ev.actor_type,ev.actor_id," +
  "ev.request_id,ev.trace_id,ev.payload_json,ev.occurred_at,ep.organization_id,ep.workspace_id " +
  "FROM trend_events ev JOIN trend_topics ep ON ep.id=ev.resource_id AND BINARY ev.resource_type='trend_topic')";

const parents = new Map([
  ["trend_topic", "trend_topics"],
  ["trend_topic_change_request", "trend_topic_change_requests"],
  ["trend_monitoring_rule", "trend_monitoring_rules"],
]);

export async function appendTrendEvent(
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
    occurredAt: Date;
  },
) {
  const [columns] = await connection.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM trend_events WHERE Field IN ('organization_id','workspace_id')",
  );
  if (columns.length === 1) throw new Error("partial_inherited_scope_schema:trend_events");
  const legacy = columns.length === 2;
  const parent = parents.get(event.resourceType);
  if (!parent) throw new Error("unknown_source_resource_type:trend_events");
  const insert = `INSERT INTO trend_events (id,${legacy ? "organization_id,workspace_id," : ""}event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at)`;
  const bind = `?,${legacy ? "?,?," : ""}?,?,?,?,?,?,?,?,?`;
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
    event.occurredAt,
  ];
  if (legacy) return connection.query<ResultSetHeader>(`${insert} VALUES (${bind})`, values);
  const source =
    parent === "trend_topic_change_requests"
      ? "trend_topic_change_requests c JOIN trend_topics t ON t.id=c.target_topic_id WHERE c.id=? AND t.organization_id=? AND t.workspace_id=?"
      : `${parent === "trend_monitoring_rules" ? (await trendRuleScopeRelation(connection)) + " r" : parent} WHERE id=? AND organization_id=? AND workspace_id=?`;
  const result = await connection.query<ResultSetHeader>(
    `${insert} SELECT ${bind} FROM ${source}`,
    [...values, event.resourceId, event.organizationId, event.workspaceId],
  );
  if (result[0].affectedRows !== 1) throw new Error("broken_source_link:trend_events.resource_id");
  return result;
}
