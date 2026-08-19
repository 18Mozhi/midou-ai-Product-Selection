import { randomUUID } from "node:crypto";
import type {
  Pool,
  PoolConnection,
  RowDataPacket,
  ResultSetHeader,
} from "mysql2/promise";
import {
  TrendServiceError,
  type TrendMonitoringRule,
  type TrendRepository,
  type TrendTopicSummary,
} from "./trend-service.js";

const iso = (value: unknown) =>
  value instanceof Date
    ? value.toISOString()
    : new Date(String(value)).toISOString();
const json = <T>(value: unknown): T =>
  typeof value === "string" ? (JSON.parse(value) as T) : (value as T);
const topic = (row: RowDataPacket): TrendTopicSummary => ({
  id: String(row.id),
  title: String(row.title),
  category: row.category == null ? null : String(row.category),
  market: String(row.market),
  language: String(row.language),
  status: row.status,
  signal_count: Number(row.signal_count),
  source_count: Number(row.source_count),
  heat: { value: Number(row.heat_value), unit: "signals" },
  momentum_percent:
    row.momentum_percent == null ? null : Number(row.momentum_percent),
  confidence: {
    score: row.confidence_score == null ? null : Number(row.confidence_score),
    status: row.confidence_status,
  },
  first_seen_at: iso(row.first_seen_at),
  last_seen_at: iso(row.last_seen_at),
  source_fresh_at: iso(row.source_fresh_at),
  followed: Boolean(row.followed),
  version: Number(row.version),
});
const rule = (row: RowDataPacket): TrendMonitoringRule => ({
  id: String(row.id),
  name: String(row.name),
  include_keywords: json<string[]>(row.include_keywords_json),
  negative_keywords: json<string[]>(row.negative_keywords_json),
  market: String(row.market),
  language: String(row.language),
  category: row.category == null ? null : String(row.category),
  notification_channel: "in_app",
  collection_interval_minutes: Number(row.collection_interval_minutes),
  status: row.status,
  last_evaluated_at:
    row.last_evaluated_at == null ? null : iso(row.last_evaluated_at),
  last_collection_at:
    row.last_collection_at == null ? null : iso(row.last_collection_at),
  next_collection_at:
    row.next_collection_at == null ? null : iso(row.next_collection_at),
  last_collection_task_id:
    row.last_collection_task_id == null
      ? null
      : String(row.last_collection_task_id),
  version: Number(row.version),
  created_at: iso(row.created_at),
  updated_at: iso(row.updated_at),
});

export class MySqlTrendRepository implements TrendRepository {
  constructor(
    private readonly pool: Pool,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(input: Parameters<TrendRepository["list"]>[0]) {
    const clauses = ["t.organization_id=?", "t.workspace_id=?"],
      params: unknown[] = [input.organizationId, input.workspaceId];
    if (input.query) {
      clauses.push(
        "(t.title LIKE ? OR EXISTS (SELECT 1 FROM trend_topic_keywords k WHERE k.topic_id=t.id AND k.keyword LIKE ?))",
      );
      params.push(`%${input.query}%`, `%${input.query}%`);
    }
    if (input.market) {
      clauses.push("t.market=?");
      params.push(input.market);
    }
    if (input.category) {
      clauses.push("t.category=?");
      params.push(input.category);
    }
    if (input.status) {
      clauses.push("t.status=?");
      params.push(input.status);
    }
    if (input.followed !== undefined)
      (clauses.push(
        `${input.followed ? "" : "NOT "}EXISTS (SELECT 1 FROM trend_topic_follows f WHERE f.topic_id=t.id AND f.user_id=?)`,
      ),
        params.push(input.actorId));
    const where = clauses.join(" AND "),
      offset = (input.page - 1) * input.pageSize;
    const [[count], [rows]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) total FROM trend_topics t WHERE ${where}`,
        params,
      ),
      this.pool.query<RowDataPacket[]>(
        `SELECT t.*,EXISTS(SELECT 1 FROM trend_topic_follows f WHERE f.topic_id=t.id AND f.user_id=?) followed FROM trend_topics t WHERE ${where} ORDER BY t.last_seen_at DESC,t.id ASC LIMIT ? OFFSET ?`,
        [input.actorId, ...params, input.pageSize, offset],
      ),
    ]);
    return { items: rows.map(topic), total: Number(count[0]?.total ?? 0) };
  }

  async get(input: Parameters<TrendRepository["get"]>[0]) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT t.*,EXISTS(SELECT 1 FROM trend_topic_follows f WHERE f.topic_id=t.id AND f.user_id=?) followed FROM trend_topics t WHERE t.id=? AND t.organization_id=? AND t.workspace_id=? LIMIT 1",
      [input.actorId, input.topicId, input.organizationId, input.workspaceId],
    );
    if (!rows[0]) return null;
    const [[keywordRows], [signalRows], [timelineRows]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        "SELECT keyword,keyword_type,language,market FROM trend_topic_keywords WHERE topic_id=? AND organization_id=? AND workspace_id=? ORDER BY FIELD(keyword_type,'primary','related','negative'),keyword",
        [input.topicId, input.organizationId, input.workspaceId],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT id,title,publisher,canonical_url,published_at,observed_at,provider_id,raw_evidence_id FROM trend_signals WHERE topic_id=? AND organization_id=? AND workspace_id=? ORDER BY published_at DESC LIMIT 100",
        [input.topicId, input.organizationId, input.workspaceId],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT DATE_FORMAT(published_at,'%Y-%m-%dT%H:00:00.000Z') at,COUNT(*) signal_count,COUNT(DISTINCT provider_id) source_count FROM trend_signals WHERE topic_id=? AND organization_id=? AND workspace_id=? GROUP BY DATE_FORMAT(published_at,'%Y-%m-%dT%H:00:00.000Z') ORDER BY MIN(published_at)",
        [input.topicId, input.organizationId, input.workspaceId],
      ),
    ]);
    const summary = topic(rows[0]),
      evidence = signalRows.map((row) => ({
        id: String(row.id),
        title: String(row.title),
        publisher: String(row.publisher),
        canonical_url: String(row.canonical_url),
        published_at: iso(row.published_at),
        observed_at: iso(row.observed_at),
        provider_id: String(row.provider_id),
        raw_evidence_id: String(row.raw_evidence_id),
      }));
    return {
      ...summary,
      keywords: keywordRows.map((row) => ({
        keyword: String(row.keyword),
        type: row.keyword_type,
        language: String(row.language),
        market: String(row.market),
      })),
      timeline: timelineRows.map((row) => ({
        at: String(row.at),
        signal_count: Number(row.signal_count),
        source_count: Number(row.source_count),
      })),
      evidence,
      data_quality: {
        coverage_status:
          evidence.length > 0
            ? ("covered" as const)
            : ("insufficient_data" as const),
        evidence_count: evidence.length,
        source_count: summary.source_count,
        stale: summary.status === "stale",
      },
    };
  }

  async listRules(input: Parameters<TrendRepository["listRules"]>[0]) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM trend_monitoring_rules WHERE organization_id=? AND workspace_id=? ORDER BY updated_at DESC,id",
      [input.organizationId, input.workspaceId],
    );
    return rows.map(rule);
  }

  async setFollow(input: Parameters<TrendRepository["setFollow"]>[0]) {
    return this.write(input, input.topicId, async (c) => {
      await this.requireTopic(
        c,
        input.topicId,
        input.organizationId,
        input.workspaceId,
      );
      if (input.followed)
        await c.query(
          "INSERT IGNORE INTO trend_topic_follows (id,organization_id,workspace_id,topic_id,user_id,created_at) VALUES (?,?,?,?,?,?)",
          [
            randomUUID(),
            input.organizationId,
            input.workspaceId,
            input.topicId,
            input.actorId,
            this.now(),
          ],
        );
      else
        await c.query(
          "DELETE FROM trend_topic_follows WHERE organization_id=? AND workspace_id=? AND topic_id=? AND user_id=?",
          [
            input.organizationId,
            input.workspaceId,
            input.topicId,
            input.actorId,
          ],
        );
      const result = { topic_id: input.topicId, followed: input.followed };
      await this.event(
        c,
        input,
        input.followed ? "trend.topic.followed" : "trend.topic.unfollowed",
        "trend_topic",
        input.topicId,
        result,
        "user",
      );
      return result;
    });
  }

  async setRelevance(input: Parameters<TrendRepository["setRelevance"]>[0]) {
    return this.write(input, input.topicId, async (c) => {
      await this.requireTopic(
        c,
        input.topicId,
        input.organizationId,
        input.workspaceId,
      );
      const [update] = await c.query<ResultSetHeader>(
        "UPDATE trend_topics SET status=?,version=version+1,updated_at=? WHERE id=? AND organization_id=? AND workspace_id=? AND version=?",
        [
          input.status,
          this.now(),
          input.topicId,
          input.organizationId,
          input.workspaceId,
          input.expectedVersion,
        ],
      );
      if (update.affectedRows !== 1)
        throw new TrendServiceError(
          "trend_version_conflict",
          409,
          "刷新主题详情后重新提交。",
        );
      const result = {
        topic_id: input.topicId,
        status: input.status,
        version: input.expectedVersion + 1,
      };
      await this.event(
        c,
        input,
        "trend.topic.relevance_changed",
        "trend_topic",
        input.topicId,
        { ...result, reason: input.reason },
        "user",
      );
      return result;
    });
  }

  async createRule(input: Parameters<TrendRepository["createRule"]>[0]) {
    return this.write(input, input.ruleId, async (c) => {
      const now = this.now(),
        value = input.rule;
      try {
        await c.query(
          "INSERT INTO trend_monitoring_rules (id,organization_id,workspace_id,name,include_keywords_json,negative_keywords_json,market,language,category,notification_channel,collection_interval_minutes,status,last_evaluated_at,next_collection_at,version,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'in_app',?,'enabled',NULL,?,1,?,?,?,?)",
          [
            input.ruleId,
            input.organizationId,
            input.workspaceId,
            value.name,
            JSON.stringify(value.include_keywords),
            JSON.stringify(value.negative_keywords),
            value.market,
            value.language,
            value.category,
            value.collection_interval_minutes,
            now,
            input.actorId,
            input.actorId,
            now,
            now,
          ],
        );
      } catch (error) {
        if ((error as { code?: string }).code === "ER_DUP_ENTRY")
          throw new TrendServiceError(
            "trend_rule_name_conflict",
            409,
            "在当前工作区使用其他规则名称。",
          );
        throw error;
      }
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM trend_monitoring_rules WHERE id=?",
        [input.ruleId],
      );
      if (!rows[0])
        throw new TrendServiceError(
          "trend_rule_not_found",
          404,
          "刷新监控规则列表。",
        );
      const result = rule(rows[0]);
      await this.event(
        c,
        input,
        "trend.monitoring_rule.created",
        "trend_monitoring_rule",
        input.ruleId,
        { status: result.status, version: result.version },
        "user",
      );
      return result;
    });
  }

  async updateRule(input: Parameters<TrendRepository["updateRule"]>[0]) {
    return this.write(input, input.ruleId, async (c) => {
      const [update] = await c.query<ResultSetHeader>(
        "UPDATE trend_monitoring_rules SET status=?,collection_interval_minutes=?,next_collection_at=IF(?='enabled',?,NULL),updated_by=?,version=version+1,updated_at=? WHERE id=? AND organization_id=? AND workspace_id=? AND version=?",
        [
          input.status,
          input.collectionIntervalMinutes,
          input.status,
          this.now(),
          input.actorId,
          this.now(),
          input.ruleId,
          input.organizationId,
          input.workspaceId,
          input.expectedVersion,
        ],
      );
      if (update.affectedRows !== 1)
        throw new TrendServiceError(
          "trend_rule_version_conflict",
          409,
          "刷新监控规则后重新提交。",
        );
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM trend_monitoring_rules WHERE id=? AND organization_id=? AND workspace_id=?",
        [input.ruleId, input.organizationId, input.workspaceId],
      );
      if (!rows[0])
        throw new TrendServiceError(
          "trend_rule_not_found",
          404,
          "刷新监控规则列表。",
        );
      const result = rule(rows[0]);
      await this.event(
        c,
        input,
        "trend.monitoring_rule.status_changed",
        "trend_monitoring_rule",
        input.ruleId,
        { status: result.status, version: result.version },
        "user",
      );
      return result;
    });
  }

  private async write<T>(
    input: {
      actorId: string;
      route: string;
      idempotencyKey: string;
      organizationId: string;
      workspaceId: string;
      requestId: string;
      traceId: string;
    },
    resourceId: string,
    action: (connection: PoolConnection) => Promise<T>,
  ) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [replayed] = await c.query<RowDataPacket[]>(
        "SELECT result_json FROM trend_operations WHERE actor_id=? AND route=? AND idempotency_key=? LIMIT 1",
        [input.actorId, input.route, input.idempotencyKey],
      );
      if (replayed[0]) {
        await c.commit();
        return json<T>(replayed[0].result_json);
      }
      const result = await action(c);
      await c.query(
        "INSERT INTO trend_operations (id,actor_id,route,idempotency_key,resource_id,result_json,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomUUID(),
          input.actorId,
          input.route,
          input.idempotencyKey,
          resourceId,
          JSON.stringify(result),
          this.now(),
        ],
      );
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }

  private async requireTopic(
    c: PoolConnection,
    topicId: string,
    organizationId: string,
    workspaceId: string,
  ) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT id FROM trend_topics WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
      [topicId, organizationId, workspaceId],
    );
    if (!rows[0])
      throw new TrendServiceError(
        "trend_topic_not_found",
        404,
        "刷新趋势列表；该主题可能不在当前工作区。",
      );
  }

  private async event(
    c: PoolConnection,
    input: {
      organizationId: string;
      workspaceId: string;
      actorId: string;
      requestId: string;
      traceId: string;
    },
    eventType: string,
    resourceType: string,
    resourceId: string,
    payload: unknown,
    actorType: "user" | "worker" | "system",
  ) {
    const now = this.now(),
      eventId = randomUUID();
    await c.query(
      "INSERT INTO trend_events (id,organization_id,workspace_id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        eventId,
        input.organizationId,
        input.workspaceId,
        eventType,
        resourceType,
        resourceId,
        actorType,
        input.actorId,
        input.requestId,
        input.traceId,
        JSON.stringify(payload),
        now,
      ],
    );
    await c.query(
      "INSERT INTO trend_outbox (id,organization_id,workspace_id,event_type,resource_type,resource_id,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'queued',0,?,?,?,?,?)",
      [
        eventId,
        input.organizationId,
        input.workspaceId,
        eventType,
        resourceType,
        resourceId,
        JSON.stringify(payload),
        now,
        input.requestId,
        input.traceId,
        now,
        now,
      ],
    );
  }
}
