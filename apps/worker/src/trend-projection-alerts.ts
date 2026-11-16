import { trendRuleScopeRelation } from "@scoutops/database";
import { appendTrendEvent } from "@scoutops/database";
import { appendAccountOpportunityEvent, appendOpportunityEvent } from "@scoutops/database";
import { appendOpportunityOutbox } from "@scoutops/database";
import { randomUUID } from "node:crypto";
import { appendTrendOutbox } from "@scoutops/database";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { TrendProjectionJob } from "./trend-projection-calculation.js";
import {
  registerTrendProjectionOwners,
  type TrendProjectionOwnership,
} from "./trend-projection-ownership.js";

export function matchesTrendMonitoringRule(
  rule: {
    id?: unknown;
    include_keywords_json: unknown;
    negative_keywords_json: unknown;
    market: unknown;
    language: unknown;
    category: unknown;
  },
  topic: { title: string; market: string; language: string; category: string | null },
  provenance?: {
    monitoringRuleId?: string | null | undefined;
    monitoringRuleQuery?: string | null | undefined;
  },
) {
  const include =
      typeof rule.include_keywords_json === "string"
        ? JSON.parse(rule.include_keywords_json)
        : rule.include_keywords_json,
    negative =
      typeof rule.negative_keywords_json === "string"
        ? JSON.parse(rule.negative_keywords_json)
        : rule.negative_keywords_json;
  const normalize = (value: unknown) =>
      String(value).normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US"),
    keywordMatched =
      Array.isArray(include) &&
      include.some((keyword: unknown) => topic.title.includes(normalize(keyword))),
    provenanceMatched =
      Array.isArray(include) &&
      String(rule.id ?? "") === provenance?.monitoringRuleId &&
      normalize(include.map((keyword: unknown) => String(keyword)).join(" OR ")) ===
        normalize(provenance?.monitoringRuleQuery ?? "");
  return (
    (keywordMatched || provenanceMatched) &&
    !(Array.isArray(negative) ? negative : []).some((keyword: unknown) =>
      topic.title.includes(normalize(keyword)),
    ) &&
    (!rule.market ||
      String(rule.market).toUpperCase() === "GLOBAL" ||
      String(rule.market).toUpperCase() === topic.market.toUpperCase()) &&
    (!rule.language ||
      String(rule.language).toLocaleLowerCase("en-US") === "multi" ||
      String(rule.language).toLocaleLowerCase("en-US") ===
        topic.language.toLocaleLowerCase("en-US")) &&
    (!rule.category ||
      (topic.category !== null &&
        String(rule.category).normalize("NFKC").toLocaleLowerCase("en-US") ===
          topic.category.normalize("NFKC").toLocaleLowerCase("en-US")))
  );
}

export class TrendProjectionAlerts {
  constructor(
    private readonly workerId: string,
    private readonly now: () => Date,
  ) {}

  async evaluateMonitoringRules(
    c: PoolConnection,
    job: TrendProjectionJob,
    topicId: string,
    title: string,
    market: string,
    language: string,
    category: string | null,
    now: Date,
    ownership: TrendProjectionOwnership = null,
  ) {
    const owner = ownership?.owner;
    const relation = owner ? "trend_monitoring_rules" : await trendRuleScopeRelation(c);
    if (!owner && relation !== "trend_monitoring_rules") return [];
    const base =
      "SELECT id,include_keywords_json,negative_keywords_json,market,language,category,created_by FROM trend_monitoring_rules WHERE organization_id=? AND workspace_id=? AND status='enabled'";
    const [rows] = await c.query<RowDataPacket[]>(
      owner
        ? "SELECT r.* FROM trend_monitoring_rules r JOIN account_owned_records o " +
            "ON o.source_table='trend_monitoring_rules' AND o.source_id=r.id " +
            "WHERE o.account_id=? AND r.status='enabled' FOR UPDATE"
        : base +
            (ownership
              ? " AND NOT EXISTS (SELECT 1 FROM account_owned_records o WHERE o.source_table='trend_monitoring_rules' AND o.source_id=trend_monitoring_rules.id)"
              : "") +
            " FOR UPDATE",
      owner ? [owner.account_id] : [job.organizationId, job.workspaceId],
    );
    const eligible = ownership
      ? rows.filter(
          (row) => !Object.hasOwn(row, "account_id") || row.account_id === owner?.account_id,
        )
      : rows;
    const matchedRuleIds: string[] = [];
    for (const row of eligible) {
      const matched = matchesTrendMonitoringRule(
        {
          id: row.id,
          include_keywords_json: row.include_keywords_json,
          negative_keywords_json: row.negative_keywords_json,
          market: row.market,
          language: row.language,
          category: row.category,
        },
        { title, market, language, category },
        {
          monitoringRuleId: job.monitoringRuleId,
          monitoringRuleQuery: job.monitoringRuleQuery,
        },
      );
      if (matched) {
        matchedRuleIds.push(String(row.id));
        await c.query(
          "INSERT IGNORE INTO account_trend_topic_follows (id,account_id,topic_id,created_at) VALUES (?,?,?,?)",
          [randomUUID(), owner?.account_id ?? row.created_by, topicId, now],
        );
        await this.writeTrendEvent(
          c,
          job,
          "trend.monitoring_rule.matched",
          "trend_topic",
          topicId,
          {
            rule_id: String(row.id),
            market,
            language,
            category,
          },
          ownership,
        );
      }
    }
    if (eligible.length)
      await c.query(
        "UPDATE trend_monitoring_rules SET last_evaluated_at=?,updated_at=updated_at WHERE status='enabled' AND id IN (?)",
        [now, eligible.map((row) => row.id)],
      );
    return matchedRuleIds;
  }

  async writeOpportunityDiscovery(
    c: PoolConnection,
    job: TrendProjectionJob,
    opportunityId: string,
    payload: unknown,
    now: Date,
    ownership: TrendProjectionOwnership = null,
    native = false,
  ) {
    const eventId = randomUUID(),
      outboxId = randomUUID();
    if (native) {
      if (!ownership?.owner) throw new Error("opportunity_discovery_owner_missing");
      await appendAccountOpportunityEvent(c, {
        id: eventId,
        outboxId,
        opportunityId,
        eventType: "opportunity.candidate.discovered",
        actorType: "worker",
        actorId: this.workerId,
        requestId: job.requestId,
        traceId: job.traceId,
        payloadJson: JSON.stringify(payload),
        now,
      });
      await registerTrendProjectionOwners(c, ownership, [
        ["opportunity_events", eventId],
        ["opportunity_outbox", outboxId],
      ]);
      return;
    }
    await appendOpportunityEvent(c, {
      id: eventId,
      organizationId: job.organizationId,
      workspaceId: job.workspaceId,
      eventType: "opportunity.candidate.discovered",
      resourceType: "opportunity",
      resourceId: opportunityId,
      actorType: "worker",
      actorId: this.workerId,
      requestId: job.requestId,
      traceId: job.traceId,
      payloadJson: JSON.stringify(payload),
      occurredAt: now,
    });
    await appendOpportunityOutbox(c, {
      id: outboxId,
      eventId,
      organizationId: job.organizationId,
      workspaceId: job.workspaceId,
      eventType: "opportunity.candidate.discovered",
      resourceType: "opportunity",
      resourceId: opportunityId,
      payloadJson: JSON.stringify(payload),
      createdAt: now,
      requestId: job.requestId,
      traceId: job.traceId,
    });
    await registerTrendProjectionOwners(c, ownership, [
      ["opportunity_events", eventId],
      ["opportunity_outbox", outboxId],
    ]);
  }

  async writeTrendEvent(
    c: PoolConnection,
    job: TrendProjectionJob,
    eventType: string,
    resourceType: string,
    resourceId: string,
    payload: unknown,
    ownership: TrendProjectionOwnership = null,
  ) {
    const now = this.now(),
      eventId = randomUUID();
    const owner = ownership?.owner;
    if (owner && resourceType === "trend_topic") {
      const payloadJson = JSON.stringify(payload);
      const [insert] = await c.query<ResultSetHeader>(
        "INSERT INTO trend_events (id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) " +
          "SELECT ?,?,'trend_topic',t.id,'worker',?,?,?,?,? FROM trend_topics t JOIN account_owned_records a " +
          "ON a.source_table='trend_topics' AND a.source_id=t.id WHERE t.id=? AND a.account_id=?",
        [
          eventId,
          eventType,
          this.workerId,
          job.requestId,
          job.traceId,
          payloadJson,
          now,
          resourceId,
          owner.account_id,
        ],
      );
      if (insert.affectedRows !== 1) throw new Error("trend_event_parent_owner_mismatch");
      await c.query(
        "INSERT INTO trend_outbox (id,event_type,resource_type,resource_id,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) " +
          "VALUES (?,?,?,?,?,'queued',0,?,?,?,?,?)",
        [
          eventId,
          eventType,
          resourceType,
          resourceId,
          payloadJson,
          now,
          job.requestId,
          job.traceId,
          now,
          now,
        ],
      );
      await registerTrendProjectionOwners(c, ownership, [
        ["trend_events", eventId],
        ["trend_outbox", eventId],
      ]);
      return;
    }
    await appendTrendEvent(c, {
      id: eventId,
      organizationId: job.organizationId,
      workspaceId: job.workspaceId,
      eventType,
      resourceType,
      resourceId,
      actorType: "worker",
      actorId: this.workerId,
      requestId: job.requestId,
      traceId: job.traceId,
      payloadJson: JSON.stringify(payload),
      occurredAt: now,
    });
    await appendTrendOutbox(c, {
      id: eventId,
      organizationId: job.organizationId,
      workspaceId: job.workspaceId,
      eventType,
      resourceType,
      resourceId,
      payloadJson: JSON.stringify(payload),
      requestId: job.requestId,
      traceId: job.traceId,
      createdAt: now,
    });
    await registerTrendProjectionOwners(c, ownership, [
      ["trend_events", eventId],
      ["trend_outbox", eventId],
    ]);
  }
}
