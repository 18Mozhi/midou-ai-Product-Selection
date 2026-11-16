import type { PoolConnection, RowDataPacket } from "mysql2/promise";

export async function aiAnalysisHistoryHasLegacyScope(
  db: Pick<PoolConnection, "query">,
  table:
    | "ai_analysis_requests"
    | "ai_analysis_results"
    | "ai_analysis_reviews"
    | "ai_analysis_events"
    | "ai_analysis_outbox",
) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM ?? WHERE Field IN ('organization_id','workspace_id')",
    [table],
  );
  if (rows.length !== 0 && rows.length !== 2)
    throw new Error(`partial_inherited_scope_schema:${table}`);
  return rows.length === 2;
}

type AiDelivery = {
  id: string;
  type: "ai.analysis.queued" | "ai.analysis.completed" | "ai.analysis.reviewed";
  resourceId: string;
  actorId: string;
  payload: unknown;
  requestId: string;
  traceId: string;
  now: Date;
  organizationId: string;
  workspaceId: string;
};

// Both rows must be written in the caller's transaction with the same typed resource and payload.
export async function appendAiAnalysisDelivery(db: Pick<PoolConnection, "query">, i: AiDelivery) {
  const eventsLegacy = await aiAnalysisHistoryHasLegacyScope(db, "ai_analysis_events");
  const outboxLegacy = await aiAnalysisHistoryHasLegacyScope(db, "ai_analysis_outbox");
  if (eventsLegacy !== outboxLegacy)
    throw new Error("partial_inherited_scope_schema:ai_analysis_delivery");
  const cols = eventsLegacy ? "organization_id,workspace_id," : "";
  const params = eventsLegacy ? "?,?," : "";
  const base = [
    i.id,
    ...(eventsLegacy ? [i.organizationId, i.workspaceId] : []),
    i.type,
    i.resourceId,
  ];
  const payload = JSON.stringify(i.payload);
  await db.query(
    `INSERT INTO ai_analysis_events (id,${cols}event_type,resource_id,actor_id,payload_json,request_id,trace_id,created_at) VALUES (?,${params}?,?,?,?,?,?,?)`,
    [...base, i.actorId, payload, i.requestId, i.traceId, i.now],
  );
  await db.query(
    `INSERT INTO ai_analysis_outbox (id,${cols}event_type,resource_id,payload_json,status,available_at,created_at) VALUES (?,${params}?,?,?,'queued',?,?)`,
    [...base, payload, i.now, i.now],
  );
}
