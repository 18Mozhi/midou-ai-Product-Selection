import { randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

interface RuleRecommendationInput {
  organizationId: string;
  workspaceId: string;
  opportunityId: string;
  actorType: "worker" | "system";
  actorId: string;
  requestId: string;
  traceId: string;
  now: Date;
}

export async function refreshRuleRecommendation(
  connection: PoolConnection,
  input: RuleRecommendationInput,
) {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT o.recommendation_status,o.score_rule_version,o.decision_status,o.source_count," +
      "(SELECT MIN(r.recommendation_min_source_count) FROM opportunity_rule_matches m " +
      "JOIN trend_monitoring_rules r ON r.id=m.monitoring_rule_id AND " +
      "r.organization_id=m.organization_id AND r.workspace_id=m.workspace_id WHERE " +
      "m.opportunity_id=o.id AND m.organization_id=o.organization_id AND " +
      "m.workspace_id=o.workspace_id AND r.status='enabled' AND " +
      "o.source_count>=r.recommendation_min_source_count) matched_threshold " +
      "FROM opportunities o WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? FOR UPDATE",
    [input.opportunityId, input.organizationId, input.workspaceId],
  );
  const opportunity = rows[0];
  if (
    !opportunity ||
    opportunity.score_rule_version != null ||
    String(opportunity.decision_status) !== "pending"
  )
    return { changed: false } as const;
  const next = opportunity.matched_threshold == null ? "insufficient_data" : "recommend";
  if (String(opportunity.recommendation_status) === next) return { changed: false } as const;
  await connection.query(
    "UPDATE opportunities SET recommendation_status=?,version=version+1,updated_at=? " +
      "WHERE id=? AND organization_id=? AND workspace_id=?",
    [next, input.now, input.opportunityId, input.organizationId, input.workspaceId],
  );
  const eventId = randomUUID();
  const payload = {
    previous_status: String(opportunity.recommendation_status),
    recommendation_status: next,
    source_count: Number(opportunity.source_count),
    minimum_source_count:
      opportunity.matched_threshold == null ? null : Number(opportunity.matched_threshold),
    basis: "monitoring_rule_source_threshold",
  };
  await connection.query(
    "INSERT INTO opportunity_events (id,organization_id,workspace_id,event_type,resource_type," +
      "resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) VALUES " +
      "(?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      eventId,
      input.organizationId,
      input.workspaceId,
      "opportunity.rule_recommendation.changed",
      "opportunity",
      input.opportunityId,
      input.actorType,
      input.actorId,
      input.requestId,
      input.traceId,
      JSON.stringify(payload),
      input.now,
    ],
  );
  await connection.query(
    "INSERT INTO opportunity_outbox (id,organization_id,workspace_id,event_type,resource_type," +
      "resource_id,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at," +
      "updated_at) VALUES (?,?,?,?,?,?,?,'queued',0,?,?,?,?,?)",
    [
      eventId,
      input.organizationId,
      input.workspaceId,
      "opportunity.rule_recommendation.changed",
      "opportunity",
      input.opportunityId,
      JSON.stringify(payload),
      input.now,
      input.requestId,
      input.traceId,
      input.now,
      input.now,
    ],
  );
  return { changed: true, recommendationStatus: next } as const;
}
