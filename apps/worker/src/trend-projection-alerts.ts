import { randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { TrendProjectionJob } from "./trend-projection-calculation.js";

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
  ) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT id,include_keywords_json,negative_keywords_json,market,language,category,created_by FROM trend_monitoring_rules WHERE organization_id=? AND workspace_id=? AND status='enabled' FOR UPDATE",
      [job.organizationId, job.workspaceId],
    );
    const matchedRuleIds: string[] = [];
    for (const row of rows) {
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
          "INSERT IGNORE INTO trend_topic_follows (id,organization_id,workspace_id,topic_id,user_id,created_at) VALUES (?,?,?,?,?,?)",
          [randomUUID(), job.organizationId, job.workspaceId, topicId, row.created_by, now],
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
        );
      }
    }
    if (rows.length)
      await c.query(
        "UPDATE trend_monitoring_rules SET last_evaluated_at=?,updated_at=updated_at WHERE organization_id=? AND workspace_id=? AND status='enabled'",
        [now, job.organizationId, job.workspaceId],
      );
    return matchedRuleIds;
  }

  async writeOpportunityDiscovery(
    c: PoolConnection,
    job: TrendProjectionJob,
    opportunityId: string,
    payload: unknown,
    now: Date,
  ) {
    await c.query(
      "INSERT INTO opportunity_events (id,organization_id,workspace_id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) VALUES (?,?,?,'opportunity.candidate.discovered','opportunity',?,'worker',?,?,?,?,?)",
      [
        randomUUID(),
        job.organizationId,
        job.workspaceId,
        opportunityId,
        this.workerId,
        job.requestId,
        job.traceId,
        JSON.stringify(payload),
        now,
      ],
    );
    await c.query(
      "INSERT INTO opportunity_outbox (id,organization_id,workspace_id,event_type,resource_type,resource_id,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES (?,?,?,'opportunity.candidate.discovered','opportunity',?,?,'queued',0,?,?,?,?,?)",
      [
        randomUUID(),
        job.organizationId,
        job.workspaceId,
        opportunityId,
        JSON.stringify(payload),
        now,
        job.requestId,
        job.traceId,
        now,
        now,
      ],
    );
  }

  async writeTrendEvent(
    c: PoolConnection,
    job: TrendProjectionJob,
    eventType: string,
    resourceType: string,
    resourceId: string,
    payload: unknown,
  ) {
    const now = this.now(),
      eventId = randomUUID();
    await c.query(
      "INSERT INTO trend_events (id,organization_id,workspace_id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) VALUES (?,?,?,?,?,?,'worker',?,?,?,?,?)",
      [
        eventId,
        job.organizationId,
        job.workspaceId,
        eventType,
        resourceType,
        resourceId,
        this.workerId,
        job.requestId,
        job.traceId,
        JSON.stringify(payload),
        now,
      ],
    );
    await c.query(
      "INSERT INTO trend_outbox (id,organization_id,workspace_id,event_type,resource_type,resource_id,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'queued',0,?,?,?,?,?)",
      [
        eventId,
        job.organizationId,
        job.workspaceId,
        eventType,
        resourceType,
        resourceId,
        JSON.stringify(payload),
        now,
        job.requestId,
        job.traceId,
        now,
        now,
      ],
    );
  }
}
