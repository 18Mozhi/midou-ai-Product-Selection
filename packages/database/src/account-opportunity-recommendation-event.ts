import type { PoolConnection } from "mysql2/promise";

/** The caller locks and verifies the opportunity, and registers both child owners in its transaction. */
export async function appendAccountOpportunityEvent(
  db: Pick<PoolConnection, "query">,
  event: {
    id: string;
    opportunityId: string;
    actorType: "user" | "worker" | "system";
    actorId: string;
    requestId: string;
    traceId: string;
    payloadJson: string;
    now: Date;
    eventType: string;
    outboxId?: string;
  },
) {
  const type = event.eventType;
  await db.query(
    "INSERT INTO opportunity_events (id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) " +
      "VALUES (?,?,'opportunity',?,?,?,?,?,?,?)",
    [
      event.id,
      type,
      event.opportunityId,
      event.actorType,
      event.actorId,
      event.requestId,
      event.traceId,
      event.payloadJson,
      event.now,
    ],
  );
  await db.query(
    "INSERT INTO opportunity_outbox (id,event_id,event_type,resource_type,resource_id,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) " +
      "VALUES (?,?,?,'opportunity',?,?,'queued',0,?,?,?,?,?)",
    [
      event.outboxId ?? event.id,
      event.id,
      type,
      event.opportunityId,
      event.payloadJson,
      event.now,
      event.requestId,
      event.traceId,
      event.now,
      event.now,
    ],
  );
}

export function appendAccountOpportunityRecommendationEvent(
  db: Parameters<typeof appendAccountOpportunityEvent>[0],
  event: Omit<Parameters<typeof appendAccountOpportunityEvent>[1], "eventType">,
) {
  return appendAccountOpportunityEvent(db, {
    ...event,
    eventType: "opportunity.rule_recommendation.changed",
  });
}
