import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import {
  TrendServiceError,
  normalizeTrendTitle,
  type TrendMonitoringRule,
  type TrendRepository,
  type TrendTopicChangeRequest,
  type TrendTopicDetail,
  type TrendTopicSummary,
} from "./trend-service.js";

const iso = (value: unknown) =>
  value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
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
  momentum_percent: row.momentum_percent == null ? null : Number(row.momentum_percent),
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
  recommendation_min_source_count: Number(row.recommendation_min_source_count),
  status: row.status,
  last_evaluated_at: row.last_evaluated_at == null ? null : iso(row.last_evaluated_at),
  last_collection_at: row.last_collection_at == null ? null : iso(row.last_collection_at),
  next_collection_at: row.next_collection_at == null ? null : iso(row.next_collection_at),
  last_collection_task_id:
    row.last_collection_task_id == null ? null : String(row.last_collection_task_id),
  last_failed_sources: [],
  version: Number(row.version),
  created_at: iso(row.created_at),
  updated_at: iso(row.updated_at),
});
const changeRequest = (
  row: RowDataPacket,
  sourceTopics: TrendTopicChangeRequest["source_topics"],
): TrendTopicChangeRequest => ({
  id: String(row.id),
  operation: row.operation,
  target_topic: {
    id: String(row.target_topic_id),
    title: String(row.target_title),
    market: String(row.target_market),
    language: String(row.target_language),
    version: Number(row.target_version),
  },
  source_topics: sourceTopics,
  signal_ids: json<string[]>(row.signal_ids_json),
  new_title: row.new_title == null ? null : String(row.new_title),
  new_category: row.new_category == null ? null : String(row.new_category),
  reason: String(row.reason),
  status: row.status,
  result_topic_id: row.result_topic_id == null ? null : String(row.result_topic_id),
  proposed_by: String(row.proposed_by),
  decided_by: row.decided_by == null ? null : String(row.decided_by),
  decision_reason: row.decision_reason == null ? null : String(row.decision_reason),
  decided_at: row.decided_at == null ? null : iso(row.decided_at),
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
    } else clauses.push("t.status<>'archived'");
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
        `SELECT t.*,EXISTS(
          SELECT 1 FROM trend_topic_follows f
          WHERE f.topic_id=t.id AND f.user_id=?
         ) followed
         FROM trend_topics t WHERE ${where}
         ORDER BY t.last_seen_at DESC,t.id ASC LIMIT ? OFFSET ?`,
        [input.actorId, ...params, input.pageSize, offset],
      ),
    ]);
    return { items: rows.map(topic), total: Number(count[0]?.total ?? 0) };
  }

  async get(input: Parameters<TrendRepository["get"]>[0]) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT t.*,EXISTS(SELECT 1 FROM trend_topic_follows f WHERE f.topic_id=t.id AND f.user_id=?) " +
        "followed FROM trend_topics t WHERE t.id=? AND t.organization_id=? AND t.workspace_id=? " +
        "LIMIT 1",
      [input.actorId, input.topicId, input.organizationId, input.workspaceId],
    );
    if (!rows[0]) return null;
    const [[keywordRows], [signalRows], [timelineRows], [timelineSourceRows], [relevanceRows]] =
      await Promise.all([
        this.pool.query<RowDataPacket[]>(
          "SELECT keyword,keyword_type,language,market FROM trend_topic_keywords WHERE topic_id=? " +
            "AND organization_id=? AND workspace_id=? ORDER BY FIELD(keyword_type,'primary'," +
            "'related','negative'),keyword",
          [input.topicId, input.organizationId, input.workspaceId],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT id,title,publisher,canonical_url,published_at,observed_at,provider_id," +
            "raw_evidence_id FROM trend_signals WHERE topic_id=? AND organization_id=? AND workspace_id=? " +
            "ORDER BY published_at DESC LIMIT 100",
          [input.topicId, input.organizationId, input.workspaceId],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT DATE_FORMAT(published_at,'%Y-%m-%dT%H:00:00.000Z') at,\n                  COUNT(*) " +
            "signal_count,\n                  COUNT(DISTINCT provider_id) source_count\n           " +
            "  FROM trend_signals\n            WHERE topic_id=? AND organization_id=? AND workspace_id=?\n" +
            "            GROUP BY DATE_FORMAT(published_at,'%Y-%m-%dT%H:00:00.000Z')\n            " +
            "ORDER BY MIN(published_at)",
          [input.topicId, input.organizationId, input.workspaceId],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT provider_id,\n                  MAX(publisher) source_label,\n                 " +
            " DATE_FORMAT(published_at,'%Y-%m-%dT%H:00:00.000Z') at,\n                  COUNT(*) signal_count\n" +
            "             FROM trend_signals\n            WHERE topic_id=? AND organization_id=? AND " +
            "workspace_id=?\n            GROUP BY provider_id,\n                     DATE_FORMAT(published_at," +
            "'%Y-%m-%dT%H:00:00.000Z')\n            ORDER BY provider_id,MIN(published_at)",
          [input.topicId, input.organizationId, input.workspaceId],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT actor_id,payload_json,occurred_at FROM trend_events WHERE organization_id=? " +
            "AND workspace_id=? AND resource_type='trend_topic' AND resource_id=? " +
            "AND event_type='trend.topic.relevance_changed' ORDER BY occurred_at DESC,id DESC LIMIT 50",
          [input.organizationId, input.workspaceId, input.topicId],
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
    const timelineSources = new Map<string, TrendTopicDetail["timeline_sources"][number]>();
    for (const row of timelineSourceRows) {
      const sourceId = String(row.provider_id),
        current = timelineSources.get(sourceId) ?? {
          source_id: sourceId,
          source_label: String(row.source_label),
          points: [],
        };
      current.points.push({
        at: String(row.at),
        signal_count: Number(row.signal_count),
      });
      timelineSources.set(sourceId, current);
    }
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
      timeline_sources: [...timelineSources.values()],
      evidence,
      data_quality: {
        coverage_status:
          evidence.length > 0 ? ("covered" as const) : ("insufficient_data" as const),
        evidence_count: evidence.length,
        source_count: summary.source_count,
        stale: summary.status === "stale",
      },
      relevance_history: relevanceRows.map((row) => {
        const payload = json<{ status: "active" | "irrelevant"; reason: string; version: number }>(
          row.payload_json,
        );
        return {
          status: payload.status,
          reason: payload.reason,
          version: Number(payload.version),
          actor_id: String(row.actor_id),
          occurred_at: iso(row.occurred_at),
        };
      }),
    };
  }

  async listRules(input: Parameters<TrendRepository["listRules"]>[0]) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM trend_monitoring_rules WHERE organization_id=? AND workspace_id=? ORDER BY updated_at DESC,id",
      [input.organizationId, input.workspaceId],
    );
    const items = rows.map(rule),
      taskIds = items
        .map((item) => item.last_collection_task_id)
        .filter((value): value is string => Boolean(value));
    if (!taskIds.length) return items;
    const placeholders = taskIds.map(() => "?").join(","),
      [failureRows] = await this.pool.query<RowDataPacket[]>(
        `SELECT s.task_id,p.name FROM collection_subqueries s JOIN providers p ON p.id=s.provider_id
         WHERE s.organization_id=? AND s.workspace_id=? AND s.task_id IN (${placeholders})
           AND s.status IN ('failed','blocked') ORDER BY s.task_id,s.ordinal`,
        [input.organizationId, input.workspaceId, ...taskIds],
      ),
      failures = new Map<string, string[]>();
    for (const row of failureRows) {
      const taskId = String(row.task_id),
        names = failures.get(taskId) ?? [];
      names.push(String(row.name));
      failures.set(taskId, names);
    }
    return items.map((item) => ({
      ...item,
      last_failed_sources: item.last_collection_task_id
        ? (failures.get(item.last_collection_task_id) ?? [])
        : [],
    }));
  }

  async listChangeRequests(input: Parameters<TrendRepository["listChangeRequests"]>[0]) {
    const params: unknown[] = [input.organizationId, input.workspaceId],
      status = input.status ? " AND c.status=?" : "";
    if (input.status) params.push(input.status);
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT c.*,t.title target_title,t.market target_market,t.language target_language," +
        "t.version target_version FROM trend_topic_change_requests c JOIN trend_topics t ON " +
        "t.id=c.target_topic_id AND t.organization_id=c.organization_id AND " +
        `t.workspace_id=c.workspace_id WHERE c.organization_id=? AND c.workspace_id=?${status} ` +
        "ORDER BY FIELD(c.status,'pending','rejected','confirmed'),c.created_at DESC,c.id DESC LIMIT 100",
      params,
    );
    return Promise.all(
      rows.map(async (row) => {
        const ids = json<string[]>(row.source_topic_ids_json);
        if (!ids.length) return changeRequest(row, []);
        const [sources] = await this.pool.query<RowDataPacket[]>(
          `SELECT id,title,market,language,version FROM trend_topics WHERE organization_id=? AND ` +
            `workspace_id=? AND id IN (${ids.map(() => "?").join(",")}) ORDER BY title,id`,
          [input.organizationId, input.workspaceId, ...ids],
        );
        return changeRequest(
          row,
          sources.map((source) => ({
            id: String(source.id),
            title: String(source.title),
            market: String(source.market),
            language: String(source.language),
            version: Number(source.version),
          })),
        );
      }),
    );
  }

  async proposeTopicChange(input: Parameters<TrendRepository["proposeTopicChange"]>[0]) {
    return this.write(input, input.requestIdValue, async (c) => {
      const topicIds = [input.targetTopicId, ...input.sourceTopicIds],
        [topics] = await c.query<RowDataPacket[]>(
          `SELECT id,title,market,language,status,version FROM trend_topics WHERE organization_id=? AND ` +
            `workspace_id=? AND id IN (${topicIds.map(() => "?").join(",")}) ORDER BY id FOR UPDATE`,
          [input.organizationId, input.workspaceId, ...topicIds],
        );
      if (topics.length !== topicIds.length)
        throw new TrendServiceError(
          "trend_change_topic_not_found",
          404,
          "刷新主题列表后重新选择。",
        );
      const byId = new Map(topics.map((item) => [String(item.id), item])),
        target = byId.get(input.targetTopicId)!;
      for (const topicId of topicIds) {
        const current = byId.get(topicId)!;
        if (current.status !== "active")
          throw new TrendServiceError("trend_change_topic_inactive", 409, "只能治理当前活动主题。");
        if (Number(current.version) !== input.expectedVersions[topicId])
          throw new TrendServiceError(
            "trend_change_topic_version_conflict",
            409,
            "主题已变化，刷新确认队列后重新提议。",
          );
        if (current.market !== target.market || current.language !== target.language)
          throw new TrendServiceError(
            "trend_change_scope_mismatch",
            409,
            "只能合并相同市场和语言的主题。",
          );
      }
      if (input.operation === "split") {
        const [signals] = await c.query<RowDataPacket[]>(
          `SELECT id FROM trend_signals WHERE organization_id=? AND workspace_id=? AND topic_id=? ` +
            `AND id IN (${input.signalIds.map(() => "?").join(",")}) FOR UPDATE`,
          [input.organizationId, input.workspaceId, input.targetTopicId, ...input.signalIds],
        );
        const [counts] = await c.query<RowDataPacket[]>(
          "SELECT COUNT(*) total FROM trend_signals WHERE organization_id=? AND workspace_id=? AND topic_id=?",
          [input.organizationId, input.workspaceId, input.targetTopicId],
        );
        if (
          signals.length !== input.signalIds.length ||
          signals.length >= Number(counts[0]?.total ?? 0)
        )
          throw new TrendServiceError(
            "trend_split_signal_invalid",
            409,
            "拆分必须选择当前主题的部分证据，并至少保留一条原主题证据。",
          );
      }
      const now = this.now();
      await c.query(
        "INSERT INTO trend_topic_change_requests (id,organization_id,workspace_id,operation," +
          "target_topic_id,source_topic_ids_json,signal_ids_json,new_title,new_category," +
          "expected_versions_json,reason,status,result_topic_id,proposed_by,decided_by," +
          "decision_reason,decided_at,request_id,trace_id,version,created_at,updated_at) VALUES " +
          "(?,?,?,?,?,?,?,?,?,?,?,'pending',NULL,?,NULL,NULL,NULL,?,?,1,?,?)",
        [
          input.requestIdValue,
          input.organizationId,
          input.workspaceId,
          input.operation,
          input.targetTopicId,
          JSON.stringify(input.sourceTopicIds),
          JSON.stringify(input.signalIds),
          input.newTitle,
          input.newCategory,
          JSON.stringify(input.expectedVersions),
          input.reason,
          input.actorId,
          input.requestId,
          input.traceId,
          now,
          now,
        ],
      );
      await this.event(
        c,
        input,
        "trend.topic_change.proposed",
        "trend_topic_change_request",
        input.requestIdValue,
        {
          operation: input.operation,
          target_topic_id: input.targetTopicId,
          source_topic_ids: input.sourceTopicIds,
          signal_ids: input.signalIds,
        },
        "user",
      );
      return changeRequest(
        {
          id: input.requestIdValue,
          operation: input.operation,
          target_topic_id: input.targetTopicId,
          target_title: target.title,
          target_market: target.market,
          target_language: target.language,
          target_version: target.version,
          source_topic_ids_json: input.sourceTopicIds,
          signal_ids_json: input.signalIds,
          new_title: input.newTitle,
          new_category: input.newCategory,
          reason: input.reason,
          status: "pending",
          result_topic_id: null,
          proposed_by: input.actorId,
          decided_by: null,
          decision_reason: null,
          decided_at: null,
          version: 1,
          created_at: now,
          updated_at: now,
        } as RowDataPacket,
        input.sourceTopicIds.map((id) => {
          const source = byId.get(id)!;
          return {
            id,
            title: String(source.title),
            market: String(source.market),
            language: String(source.language),
            version: Number(source.version),
          };
        }),
      );
    });
  }

  async decideTopicChange(input: Parameters<TrendRepository["decideTopicChange"]>[0]) {
    return this.write(input, input.changeRequestId, async (c) => {
      const [requests] = await c.query<RowDataPacket[]>(
          "SELECT c.*,t.title target_title,t.market target_market,t.language target_language," +
            "t.version target_version FROM trend_topic_change_requests c JOIN trend_topics t ON " +
            "t.id=c.target_topic_id WHERE c.id=? AND c.organization_id=? AND c.workspace_id=? FOR UPDATE",
          [input.changeRequestId, input.organizationId, input.workspaceId],
        ),
        request = requests[0];
      if (!request)
        throw new TrendServiceError("trend_change_request_not_found", 404, "刷新主题确认队列。");
      if (request.status !== "pending" || Number(request.version) !== input.expectedVersion)
        throw new TrendServiceError(
          "trend_change_request_conflict",
          409,
          "该提议已处理或版本已变化，请刷新确认队列。",
        );
      if (String(request.proposed_by) === input.actorId)
        throw new TrendServiceError(
          "trend_change_self_confirmation_forbidden",
          403,
          "提议人与确认人必须是两个不同的活动用户。",
        );
      const now = this.now(),
        sourceIds = json<string[]>(request.source_topic_ids_json),
        signalIds = json<string[]>(request.signal_ids_json),
        expectedVersions = json<Record<string, number>>(request.expected_versions_json),
        topicIds = [String(request.target_topic_id), ...sourceIds],
        [topics] = await c.query<RowDataPacket[]>(
          `SELECT * FROM trend_topics WHERE organization_id=? AND workspace_id=? AND id IN ` +
            `(${topicIds.map(() => "?").join(",")}) ORDER BY id FOR UPDATE`,
          [input.organizationId, input.workspaceId, ...topicIds],
        );
      const byId = new Map(topics.map((item) => [String(item.id), item]));
      if (topics.length !== topicIds.length)
        throw new TrendServiceError(
          "trend_change_topic_not_found",
          404,
          "涉及主题已不存在，驳回提议或刷新后重建。",
        );
      if (input.decision === "confirm")
        for (const topicId of topicIds) {
          const current = byId.get(topicId)!;
          if (current.status !== "active" || Number(current.version) !== expectedVersions[topicId])
            throw new TrendServiceError(
              "trend_change_topic_version_conflict",
              409,
              "涉及主题已变化，当前提议不能确认。",
            );
        }
      let resultTopicId: string | null = null;
      if (input.decision === "confirm" && request.operation === "merge") {
        await this.confirmMerge(c, input, String(request.target_topic_id), sourceIds, now);
        resultTopicId = String(request.target_topic_id);
      } else if (input.decision === "confirm") {
        resultTopicId = input.splitTopicId;
        await this.confirmSplit(c, input, request, signalIds, resultTopicId, now);
      }
      const status = input.decision === "confirm" ? "confirmed" : "rejected";
      await c.query(
        "UPDATE trend_topic_change_requests SET status=?,result_topic_id=?,decided_by=?," +
          "decision_reason=?,decided_at=?,version=version+1,updated_at=? WHERE id=?",
        [status, resultTopicId, input.actorId, input.reason, now, now, input.changeRequestId],
      );
      await this.event(
        c,
        input,
        `trend.topic_change.${status}`,
        "trend_topic_change_request",
        input.changeRequestId,
        { operation: request.operation, result_topic_id: resultTopicId, reason: input.reason },
        "user",
      );
      return changeRequest(
        {
          ...request,
          status,
          result_topic_id: resultTopicId,
          decided_by: input.actorId,
          decision_reason: input.reason,
          decided_at: now,
          version: input.expectedVersion + 1,
          updated_at: now,
        } as RowDataPacket,
        sourceIds.map((id) => {
          const source = byId.get(id)!;
          return {
            id,
            title: String(source.title),
            market: String(source.market),
            language: String(source.language),
            version: Number(source.version),
          };
        }),
      );
    });
  }

  async setFollow(input: Parameters<TrendRepository["setFollow"]>[0]) {
    return this.write(input, input.topicId, async (c) => {
      await this.requireTopic(c, input.topicId, input.organizationId, input.workspaceId);
      if (input.followed)
        await c.query(
          "INSERT IGNORE INTO trend_topic_follows (id,organization_id,workspace_id," +
            "topic_id,user_id,created_at) VALUES (?,?,?,?,?,?)",
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
          [input.organizationId, input.workspaceId, input.topicId, input.actorId],
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
      await this.requireTopic(c, input.topicId, input.organizationId, input.workspaceId);
      const [update] = await c.query<ResultSetHeader>(
        "UPDATE trend_topics SET status=?,version=version+1,updated_at=? WHERE id=? AND organization_id=? " +
          "AND workspace_id=? AND version=?",
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
        throw new TrendServiceError("trend_version_conflict", 409, "刷新主题详情后重新提交。");
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
          "INSERT INTO trend_monitoring_rules (id,organization_id,workspace_id,name," +
            "include_keywords_json,negative_keywords_json,market,language,category,notification_channel," +
            "collection_interval_minutes,recommendation_min_source_count,status,last_evaluated_at,next_collection_at," +
            "version,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?," +
            "?,?,?,'in_app',?,?,'enabled',NULL,?,1,?,?,?,?)",
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
            value.recommendation_min_source_count,
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
      if (!rows[0]) throw new TrendServiceError("trend_rule_not_found", 404, "刷新监控规则列表。");
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
        "UPDATE trend_monitoring_rules SET status=?,collection_interval_minutes=?," +
          "recommendation_min_source_count=?," +
          "next_collection_at=IF(?='enabled',?,NULL),updated_by=?,version=version+1," +
          "updated_at=? WHERE id=? AND organization_id=? AND workspace_id=? AND version=?",
        [
          input.status,
          input.collectionIntervalMinutes,
          input.recommendationMinSourceCount,
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
        throw new TrendServiceError("trend_rule_version_conflict", 409, "刷新监控规则后重新提交。");
      const [affectedOpportunities] = await c.query<RowDataPacket[]>(
        "SELECT o.id,o.recommendation_status,o.source_count,(SELECT MIN(" +
          "r.recommendation_min_source_count) FROM opportunity_rule_matches m JOIN " +
          "trend_monitoring_rules r ON r.id=m.monitoring_rule_id AND " +
          "r.organization_id=m.organization_id AND r.workspace_id=m.workspace_id WHERE " +
          "m.opportunity_id=o.id AND m.organization_id=o.organization_id AND " +
          "m.workspace_id=o.workspace_id AND r.status='enabled' AND " +
          "o.source_count>=r.recommendation_min_source_count) matched_threshold FROM " +
          "opportunities o JOIN opportunity_rule_matches affected ON " +
          "affected.opportunity_id=o.id AND affected.organization_id=o.organization_id AND " +
          "affected.workspace_id=o.workspace_id WHERE o.organization_id=? AND " +
          "o.workspace_id=? AND affected.monitoring_rule_id=? AND " +
          "o.decision_status='pending' AND o.score_rule_version IS NULL FOR UPDATE",
        [input.organizationId, input.workspaceId, input.ruleId],
      );
      let recommendationUpdates = 0;
      for (const opportunity of affectedOpportunities) {
        const recommendationStatus =
          opportunity.matched_threshold == null ? "insufficient_data" : "recommend";
        if (String(opportunity.recommendation_status) === recommendationStatus) continue;
        const now = this.now();
        await c.query(
          "UPDATE opportunities SET recommendation_status=?,version=version+1,updated_at=? " +
            "WHERE id=? AND organization_id=? AND workspace_id=?",
          [recommendationStatus, now, opportunity.id, input.organizationId, input.workspaceId],
        );
        await this.opportunityRecommendationEvent(c, input, opportunity, recommendationStatus, now);
        recommendationUpdates += 1;
      }
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM trend_monitoring_rules WHERE id=? AND organization_id=? AND workspace_id=?",
        [input.ruleId, input.organizationId, input.workspaceId],
      );
      if (!rows[0]) throw new TrendServiceError("trend_rule_not_found", 404, "刷新监控规则列表。");
      const result = rule(rows[0]);
      await this.event(
        c,
        input,
        "trend.monitoring_rule.status_changed",
        "trend_monitoring_rule",
        input.ruleId,
        {
          status: result.status,
          version: result.version,
          recommendation_updates: recommendationUpdates,
        },
        "user",
      );
      return result;
    });
  }

  private async confirmMerge(
    c: PoolConnection,
    input: Parameters<TrendRepository["decideTopicChange"]>[0],
    targetTopicId: string,
    sourceTopicIds: string[],
    now: Date,
  ) {
    const allTopicIds = [targetTopicId, ...sourceTopicIds],
      placeholders = allTopicIds.map(() => "?").join(","),
      [opportunities] = await c.query<RowDataPacket[]>(
        `SELECT id,source_ref_id FROM opportunities WHERE organization_id=? AND workspace_id=? ` +
          `AND source_type='trend_topic' AND source_ref_id IN (${placeholders}) FOR UPDATE`,
        [input.organizationId, input.workspaceId, ...allTopicIds],
      );
    if (opportunities.length > 1)
      throw new TrendServiceError(
        "trend_change_opportunity_conflict",
        409,
        "多个主题已经生成机会；先在机会工作台人工处理，再确认合并。",
      );
    await c.query(
      `UPDATE trend_signals SET topic_id=? WHERE organization_id=? AND workspace_id=? AND ` +
        `topic_id IN (${sourceTopicIds.map(() => "?").join(",")})`,
      [targetTopicId, input.organizationId, input.workspaceId, ...sourceTopicIds],
    );
    await c.query(
      `INSERT IGNORE INTO trend_topic_keywords (id,organization_id,workspace_id,topic_id,keyword,` +
        `keyword_type,language,market,created_at) SELECT UUID(),organization_id,workspace_id,?,keyword,` +
        `keyword_type,language,market,? FROM trend_topic_keywords WHERE organization_id=? AND ` +
        `workspace_id=? AND topic_id IN (${sourceTopicIds.map(() => "?").join(",")})`,
      [targetTopicId, now, input.organizationId, input.workspaceId, ...sourceTopicIds],
    );
    await c.query(
      `INSERT IGNORE INTO trend_topic_follows (id,organization_id,workspace_id,topic_id,user_id,created_at) ` +
        `SELECT UUID(),organization_id,workspace_id,?,user_id,? FROM trend_topic_follows WHERE ` +
        `organization_id=? AND workspace_id=? AND topic_id IN ` +
        `(${sourceTopicIds.map(() => "?").join(",")})`,
      [targetTopicId, now, input.organizationId, input.workspaceId, ...sourceTopicIds],
    );
    await c.query(
      `DELETE FROM trend_topic_keywords WHERE organization_id=? AND workspace_id=? AND topic_id IN ` +
        `(${sourceTopicIds.map(() => "?").join(",")})`,
      [input.organizationId, input.workspaceId, ...sourceTopicIds],
    );
    await c.query(
      `DELETE FROM trend_topic_follows WHERE organization_id=? AND workspace_id=? AND topic_id IN ` +
        `(${sourceTopicIds.map(() => "?").join(",")})`,
      [input.organizationId, input.workspaceId, ...sourceTopicIds],
    );
    if (opportunities[0] && String(opportunities[0].source_ref_id) !== targetTopicId)
      await c.query(
        "UPDATE opportunities SET source_ref_id=?,version=version+1,updated_at=? WHERE id=? AND organization_id=? AND workspace_id=?",
        [targetTopicId, now, String(opportunities[0].id), input.organizationId, input.workspaceId],
      );
    await c.query(
      `UPDATE trend_topics SET status='archived',signal_count=0,source_count=0,heat_value=0,` +
        `version=version+1,updated_at=? WHERE organization_id=? AND workspace_id=? AND id IN ` +
        `(${sourceTopicIds.map(() => "?").join(",")})`,
      [now, input.organizationId, input.workspaceId, ...sourceTopicIds],
    );
    await this.refreshTopicMetrics(c, targetTopicId, now);
  }

  private async confirmSplit(
    c: PoolConnection,
    input: Parameters<TrendRepository["decideTopicChange"]>[0],
    request: RowDataPacket,
    signalIds: string[],
    resultTopicId: string,
    now: Date,
  ) {
    const sourceTopicId = String(request.target_topic_id),
      [signals] = await c.query<RowDataPacket[]>(
        `SELECT * FROM trend_signals WHERE organization_id=? AND workspace_id=? AND topic_id=? AND id IN ` +
          `(${signalIds.map(() => "?").join(",")}) ORDER BY id FOR UPDATE`,
        [input.organizationId, input.workspaceId, sourceTopicId, ...signalIds],
      ),
      [counts] = await c.query<RowDataPacket[]>(
        "SELECT COUNT(*) total FROM trend_signals WHERE organization_id=? AND workspace_id=? AND topic_id=?",
        [input.organizationId, input.workspaceId, sourceTopicId],
      );
    if (signals.length !== signalIds.length || signals.length >= Number(counts[0]?.total ?? 0))
      throw new TrendServiceError(
        "trend_split_signal_invalid",
        409,
        "所选证据已变化，刷新主题详情后重新提议。",
      );
    const title = String(request.new_title),
      normalizedTitle = normalizeTrendTitle(title),
      key = createHash("sha256")
        .update(
          `${String(request.target_market)}\u0000${String(request.target_language)}\u0000${normalizedTitle}`,
        )
        .digest("hex"),
      firstSeen = signals.reduce(
        (value, item) =>
          new Date(item.published_at) < new Date(value) ? item.published_at : value,
        signals[0]!.published_at,
      ),
      lastSeen = signals.reduce(
        (value, item) =>
          new Date(item.published_at) > new Date(value) ? item.published_at : value,
        signals[0]!.published_at,
      ),
      freshAt = signals.reduce(
        (value, item) => (new Date(item.observed_at) > new Date(value) ? item.observed_at : value),
        signals[0]!.observed_at,
      ),
      sourceCount = new Set(signals.map((item) => String(item.provider_id))).size;
    try {
      await c.query(
        "INSERT INTO trend_topics (id,organization_id,workspace_id,topic_key,title,category,market," +
          "language,status,signal_count,source_count,heat_value,heat_unit,momentum_percent," +
          "confidence_score,confidence_status,first_seen_at,last_seen_at,source_fresh_at,version," +
          "created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'active',?,?,?,'signals',NULL," +
          "NULL,'insufficient_data',?,?,?,1,?,?,?)",
        [
          resultTopicId,
          input.organizationId,
          input.workspaceId,
          key,
          title,
          request.new_category,
          request.target_market,
          request.target_language,
          signals.length,
          sourceCount,
          signals.length,
          firstSeen,
          lastSeen,
          freshAt,
          request.proposed_by,
          now,
          now,
        ],
      );
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new TrendServiceError(
          "trend_split_title_conflict",
          409,
          "新主题名称已存在；修改名称后重新提议。",
        );
      throw error;
    }
    await c.query(
      "INSERT INTO trend_topic_keywords (id,organization_id,workspace_id,topic_id,keyword," +
        "keyword_type,language,market,created_at) VALUES (?,?,?,?,?,'primary',?,?,?)",
      [
        randomUUID(),
        input.organizationId,
        input.workspaceId,
        resultTopicId,
        normalizedTitle,
        request.target_language,
        request.target_market,
        now,
      ],
    );
    await c.query(
      `UPDATE trend_signals SET topic_id=? WHERE organization_id=? AND workspace_id=? AND topic_id=? ` +
        `AND id IN (${signalIds.map(() => "?").join(",")})`,
      [resultTopicId, input.organizationId, input.workspaceId, sourceTopicId, ...signalIds],
    );
    await this.refreshTopicMetrics(c, sourceTopicId, now);
  }

  private async refreshTopicMetrics(c: PoolConnection, topicId: string, now: Date) {
    const [rows] = await c.query<RowDataPacket[]>(
        "SELECT COUNT(*) signal_count,COUNT(DISTINCT provider_id) source_count," +
          "MIN(published_at) first_seen_at,MAX(published_at) last_seen_at," +
          "MAX(observed_at) source_fresh_at FROM trend_signals WHERE topic_id=?",
        [topicId],
      ),
      row = rows[0];
    if (!row || Number(row.signal_count) < 1)
      throw new TrendServiceError(
        "trend_change_empty_topic",
        409,
        "治理操作不能产生没有证据的活动主题。",
      );
    await c.query(
      "UPDATE trend_topics SET signal_count=?,source_count=?,heat_value=?,first_seen_at=?," +
        "last_seen_at=?,source_fresh_at=?,version=version+1,updated_at=? WHERE id=?",
      [
        Number(row.signal_count),
        Number(row.source_count),
        Number(row.signal_count),
        row.first_seen_at,
        row.last_seen_at,
        row.source_fresh_at,
        now,
        topicId,
      ],
    );
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
        "INSERT INTO trend_operations (id,actor_id,route,idempotency_key,resource_id," +
          "result_json,created_at) VALUES (?,?,?,?,?,?,?)",
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
      "INSERT INTO trend_events (id,organization_id,workspace_id,event_type,resource_type," +
        "resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) VALUES " +
        "(?,?,?,?,?,?,?,?,?,?,?,?)",
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
      "INSERT INTO trend_outbox (id,organization_id,workspace_id,event_type,resource_type," +
        "resource_id,payload_json,status,attempt_count,available_at,request_id,trace_id," +
        "created_at,updated_at) VALUES (?,?,?,?,?,?,?,'queued',0,?,?,?,?,?)",
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

  private async opportunityRecommendationEvent(
    c: PoolConnection,
    input: {
      organizationId: string;
      workspaceId: string;
      actorId: string;
      requestId: string;
      traceId: string;
    },
    opportunity: RowDataPacket,
    recommendationStatus: "recommend" | "insufficient_data",
    now: Date,
  ) {
    const eventId = randomUUID();
    const payload = JSON.stringify({
      previous_status: String(opportunity.recommendation_status),
      recommendation_status: recommendationStatus,
      source_count: Number(opportunity.source_count),
      minimum_source_count:
        opportunity.matched_threshold == null ? null : Number(opportunity.matched_threshold),
      basis: "monitoring_rule_source_threshold",
    });
    await c.query(
      "INSERT INTO opportunity_events (id,organization_id,workspace_id,event_type,resource_type," +
        "resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) VALUES " +
        "(?,?,?,?,'opportunity',?,?,?,?,?,?,?)",
      [
        eventId,
        input.organizationId,
        input.workspaceId,
        "opportunity.rule_recommendation.changed",
        opportunity.id,
        "user",
        input.actorId,
        input.requestId,
        input.traceId,
        payload,
        now,
      ],
    );
    await c.query(
      "INSERT INTO opportunity_outbox (id,organization_id,workspace_id,event_type,resource_type," +
        "resource_id,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at," +
        "updated_at) VALUES (?,?,?,?,'opportunity',?,?,'queued',0,?,?,?,?,?)",
      [
        eventId,
        input.organizationId,
        input.workspaceId,
        "opportunity.rule_recommendation.changed",
        opportunity.id,
        payload,
        now,
        input.requestId,
        input.traceId,
        now,
        now,
      ],
    );
  }
}
