import {
  appendAccountOpportunityRecommendationEvent,
  appendOpportunityEvent,
  trendRuleScopeRelation,
} from "@scoutops/database";
import { appendOpportunityOutbox } from "@scoutops/database";
import { randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  registerCalculationOwners,
  type CalculationOwnership,
} from "./opportunity-calculation-ownership.js";
import { nativeOpportunityStorage } from "./opportunity-storage.js";

interface RuleRecommendationInput {
  organizationId: string;
  workspaceId: string;
  opportunityId: string;
  actorType: "worker" | "system";
  actorId: string;
  requestId: string;
  traceId: string;
  now: Date;
  ownership?: CalculationOwnership;
}

export async function refreshRuleRecommendation(
  connection: PoolConnection,
  input: RuleRecommendationInput,
) {
  const owner = input.ownership?.owner;
  if (!owner && (await trendRuleScopeRelation(connection)) !== "trend_monitoring_rules")
    return { changed: false } as const;
  const nativeOpportunity = owner && (await nativeOpportunityStorage(connection));
  const [nativeOwnerColumns] = owner
    ? await connection.query<RowDataPacket[]>(
        "SHOW COLUMNS FROM trend_monitoring_rules WHERE Field='account_id'",
      )
    : [[]];
  const owned = (source: string, column: string) =>
    input.ownership
      ? " AND " +
        (owner ? "" : "NOT ") +
        `EXISTS (SELECT 1 FROM account_owned_records a WHERE a.source_table='${source}' AND a.source_id=${column}` +
        (owner ? " AND a.account_id=?" : "") +
        (source === "opportunities" && nativeOpportunity ? " AND o.account_id=a.account_id" : "") +
        (source === "trend_monitoring_rules" && nativeOwnerColumns.length
          ? " AND r.account_id=a.account_id"
          : "") +
        ")"
      : "";
  const parentScope =
    owned("opportunities", "o.id") + (owner ? "" : " AND o.organization_id=? AND o.workspace_id=?");
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT o.recommendation_status,o.score_rule_version,o.decision_status,o.source_count," +
      "(SELECT MIN(r.recommendation_min_source_count) FROM opportunity_rule_matches m " +
      "JOIN trend_monitoring_rules r ON r.id=m.monitoring_rule_id AND " +
      "r.status='enabled' WHERE m.opportunity_id=o.id AND " +
      (owner ? "" : "r.organization_id=o.organization_id AND r.workspace_id=o.workspace_id AND ") +
      "o.source_count>=r.recommendation_min_source_count" +
      owned("opportunity_rule_matches", "m.id") +
      owned("trend_monitoring_rules", "r.id") +
      ") matched_threshold " +
      "FROM opportunities o WHERE o.id=?" +
      parentScope +
      " FOR UPDATE",
    owner
      ? [owner.account_id, owner.account_id, input.opportunityId, owner.account_id]
      : [input.opportunityId, input.organizationId, input.workspaceId],
  );
  const opportunity = rows[0];
  if (
    !opportunity ||
    opportunity.score_rule_version != null ||
    String(opportunity.decision_status) !== "pending"
  )
    return { changed: false } as const;
  const next = "insufficient_data";
  if (String(opportunity.recommendation_status) === next) return { changed: false } as const;
  const { organizationId, workspaceId } = input;
  await connection.query(
    owner
      ? "UPDATE opportunities o SET recommendation_status=?,version=version+1,updated_at=? WHERE o.id=?" +
          parentScope
      : "UPDATE opportunities SET recommendation_status=?,version=version+1,updated_at=? WHERE id=?" +
          owned("opportunities", "opportunities.id") +
          " AND organization_id=? AND workspace_id=?",
    owner
      ? [next, input.now, input.opportunityId, owner.account_id]
      : [next, input.now, input.opportunityId, organizationId, workspaceId],
  );
  const eventId = randomUUID();
  const payload = {
    previous_status: String(opportunity.recommendation_status),
    recommendation_status: next,
    source_count: Number(opportunity.source_count),
    minimum_source_count:
      opportunity.matched_threshold == null ? null : Number(opportunity.matched_threshold),
    basis: "monitoring_rule_candidate_threshold",
  };
  if (owner) {
    await appendAccountOpportunityRecommendationEvent(connection, {
      id: eventId,
      opportunityId: input.opportunityId,
      actorType: input.actorType,
      actorId: input.actorId,
      requestId: input.requestId,
      traceId: input.traceId,
      payloadJson: JSON.stringify(payload),
      now: input.now,
    });
    await registerCalculationOwners(connection, input.ownership ?? null, [
      ["opportunity_events", eventId],
      ["opportunity_outbox", eventId],
    ]);
    return { changed: true, recommendationStatus: next } as const;
  }
  await appendOpportunityEvent(connection, {
    id: eventId,
    organizationId,
    workspaceId,
    eventType: "opportunity.rule_recommendation.changed",
    resourceType: "opportunity",
    resourceId: input.opportunityId,
    actorType: input.actorType,
    actorId: input.actorId,
    requestId: input.requestId,
    traceId: input.traceId,
    payloadJson: JSON.stringify(payload),
    occurredAt: input.now,
  });
  await appendOpportunityOutbox(connection, {
    id: eventId,
    eventId,
    organizationId,
    workspaceId,
    eventType: "opportunity.rule_recommendation.changed",
    resourceType: "opportunity",
    resourceId: input.opportunityId,
    payloadJson: JSON.stringify(payload),
    createdAt: input.now,
    requestId: input.requestId,
    traceId: input.traceId,
  });
  return { changed: true, recommendationStatus: next } as const;
}
