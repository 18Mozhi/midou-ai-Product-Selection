import { trendRuleScopeRelation } from "@scoutops/database";
import { trendTopicEventReadRelation } from "@scoutops/database";
import { appendTrendEvent } from "@scoutops/database";
import {
  appendAccountOpportunityRecommendationEvent,
  appendOpportunityEvent,
} from "@scoutops/database";
import { appendOpportunityOutbox } from "@scoutops/database";
import { createHash, randomUUID } from "node:crypto";
import { appendTrendOutbox } from "@scoutops/database";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import {
  TrendServiceError,
  normalizeTrendTitle,
  type TrendMonitoringRule,
  type TrendRepository,
  type TrendTopicChangeRequest,
  type TrendTopicDetail,
  type TrendTopicSummary,
  type TrendTopicWriteContext,
  type TrendWriteContext,
} from "./trend-service.js";

import { rehearsalOwns, requireAccountReadRehearsal } from "./account-read-rehearsal.js";

const accountTopicFields =
  "t.id,t.topic_key,t.title,t.category,t.market,t.language,t.status,t.signal_count,t.source_count," +
  "t.heat_value,t.momentum_percent,t.confidence_score,t.confidence_status," +
  "t.first_seen_at,t.last_seen_at,t.source_fresh_at,t.version";
const accountTopicSource =
  "trend_topics t JOIN account_owned_records ao ON ao.source_table='trend_topics' AND ao.source_id=t.id " +
  "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25";
const accountTopicReason =
  "(ao.reason='exclusive_owner' OR (ao.reason IN ('shared','unassigned') AND ao.account_id=cut.primary_account_id))";
type NativeTopicWrite = Omit<TrendWriteContext, "organizationId" | "workspaceId"> & {
  nativeTopicAccount: string;
};
type TopicWriteScope = TrendWriteContext | NativeTopicWrite;

async function nativeTrendTopics(db: Pick<PoolConnection, "query">) {
  const [columns] = await db.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM trend_topics WHERE Field IN ('account_id','organization_id','workspace_id')",
  );
  const shape = columns
    .map((row) => row.Field)
    .sort()
    .join(",");
  if (shape === "account_id") return true;
  if (shape === "organization_id,workspace_id") return false;
  throw new TrendServiceError("trend_topic_scope_schema_invalid", 503, "主题账号迁移尚未就绪。");
}

const nativeSignalEvidence = (alias: "s" | "s2" | "trend_signals", owner: string) =>
  `EXISTS (SELECT 1 FROM raw_evidence se WHERE se.id=${alias}.raw_evidence_id
    AND se.provider_id=${alias}.provider_id AND se.account_id=${owner}
    AND ${rehearsalOwns("raw_evidence", "se.id", "se.account_id")})`;
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
  followed: Number(row.followed) === 1,
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
    const legacy = "organizationId" in input ? input : null;
    const accountId = "accountId" in input ? input.accountId : null;
    const actorId = legacy?.actorId ?? accountId;
    if (!legacy) await requireAccountReadRehearsal(this.pool);
    const native = !legacy && (await nativeTrendTopics(this.pool));
    const source = legacy ? "trend_topics t" : accountTopicSource;
    const clauses = legacy
        ? ["t.organization_id=?", "t.workspace_id=?"]
        : ["ao.account_id=?", accountTopicReason],
      params: unknown[] = legacy ? [legacy.organizationId, legacy.workspaceId] : [accountId],
      followMatch = "FROM account_trend_topic_follows f WHERE f.topic_id=t.id AND f.account_id=?";
    if (native) clauses.push("t.account_id=ao.account_id");
    if (input.query) {
      clauses.push(
        legacy
          ? "(t.title LIKE ? OR EXISTS (SELECT 1 FROM trend_topic_keywords k WHERE k.topic_id=t.id AND k.keyword LIKE ?))"
          : "(t.title LIKE ? OR EXISTS (SELECT 1 FROM trend_topic_keywords k JOIN account_owned_records ko " +
              "ON ko.source_table='trend_topic_keywords' AND ko.source_id=k.id WHERE ko.account_id=? " +
              "AND k.topic_id=t.id AND k.keyword LIKE ?))",
      );
      const pattern = `%${input.query}%`;
      params.push(pattern, ...(legacy ? [] : [accountId]), pattern);
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
      (clauses.push(`${input.followed ? "" : "NOT "}EXISTS (SELECT 1 ${followMatch})`),
        params.push(actorId));
    const where = clauses.join(" AND "),
      offset = (input.page - 1) * input.pageSize;
    const [[count], [rows]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        `SELECT COUNT(${legacy ? "*" : "DISTINCT t.topic_key"}) total FROM ${source} WHERE ${where}`,
        params,
      ),
      this.pool.query<RowDataPacket[]>(
        legacy
          ? `SELECT t.*,EXISTS(
          SELECT 1 ${followMatch}
         ) followed
         FROM ${source} WHERE ${where}
         ORDER BY t.last_seen_at DESC,t.id ASC LIMIT ? OFFSET ?`
          : `SELECT t.topic_key FROM ${source} WHERE ${where}
             GROUP BY t.topic_key ORDER BY MAX(t.last_seen_at) DESC,t.topic_key ASC LIMIT ? OFFSET ?`,
        legacy ? [actorId, ...params, input.pageSize, offset] : [...params, input.pageSize, offset],
      ),
    ]);
    const groups = new Map<string, RowDataPacket[]>();
    let displayed = rows;
    if (!legacy && rows.length) {
      const keys = rows.map((row) => String(row.topic_key));
      for (const key of keys) groups.set(key, []);
      const [members] = await this.pool.query<RowDataPacket[]>(
        `SELECT ${accountTopicFields},EXISTS(SELECT 1 ${followMatch}) followed
         FROM ${source} WHERE ${where} AND t.topic_key IN (?)
         ORDER BY t.last_seen_at DESC,t.id ASC`,
        [actorId, ...params, keys],
      );
      for (const member of members) groups.get(String(member.topic_key))?.push(member);
      displayed = [...groups.values()].flatMap((members) => members.slice(0, 1));
    }
    const [media] = displayed.length
      ? legacy
        ? await this.pool.query<RowDataPacket[]>(
            "SELECT s.topic_id,s.canonical_url,s.publisher,JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.image_url')) image_url " +
              "FROM trend_signals s JOIN trend_topics st ON st.id=s.topic_id LEFT JOIN normalized_records n ON n.id=s.normalized_record_id AND n.raw_evidence_id=s.raw_evidence_id AND n.provider_id=s.provider_id AND n.organization_id=st.organization_id AND n.workspace_id=st.workspace_id AND n.status IN ('active','superseded') " +
              "WHERE st.organization_id=? AND st.workspace_id=? AND s.topic_id IN (?) AND s.id=(SELECT s2.id FROM trend_signals s2 WHERE s2.topic_id=s.topic_id ORDER BY s2.observed_at DESC,s2.id DESC LIMIT 1)",
            [legacy.organizationId, legacy.workspaceId, displayed.map((row) => String(row.id))],
          )
        : await this.pool.query<RowDataPacket[]>(
            `SELECT s.topic_id,s.canonical_url,s.publisher,JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.image_url')) image_url
          FROM trend_signals s
          JOIN account_owned_records so ON so.source_table='trend_signals' AND so.source_id=s.id
          JOIN account_owned_records towner ON towner.source_table='trend_topics' AND towner.source_id=s.topic_id
            AND towner.account_id=so.account_id
          LEFT JOIN account_owned_records nowner ON nowner.source_table='normalized_records' AND nowner.source_id=s.normalized_record_id AND nowner.account_id=so.account_id
          LEFT JOIN normalized_records n ON n.id=nowner.source_id AND n.raw_evidence_id=s.raw_evidence_id
            AND n.provider_id=s.provider_id AND n.status IN ('active','superseded')
            ${native ? "AND n.account_id=so.account_id" : ""}
          WHERE so.account_id=? AND s.topic_id IN (?) AND s.id=(SELECT s2.id FROM trend_signals s2
            JOIN account_owned_records so2 ON so2.source_table='trend_signals' AND so2.source_id=s2.id
            WHERE so2.account_id=so.account_id AND s2.topic_id=s.topic_id
            ${native ? "AND " + nativeSignalEvidence("s2", "so2.account_id") : ""}
            ORDER BY s2.observed_at DESC,s2.id DESC LIMIT 1)
          ${native ? "AND " + nativeSignalEvidence("s", "so.account_id") : ""}`,
            [accountId, displayed.map((row) => String(row.id))],
          )
      : [[]];
    const byTopic = new Map(media.map((row) => [String(row.topic_id), row]));
    return {
      items: displayed.map((row) => {
        const image = byTopic.get(String(row.id));
        const variants = groups.get(String(row.topic_key));
        return {
          ...topic(row),
          ...(variants && variants.length > 1
            ? {
                topic_variants: variants.map((variant) => {
                  const { id, title, status, last_seen_at } = topic(variant);
                  return { id, title, status, last_seen_at };
                }),
              }
            : {}),
          image_url: image?.image_url ?? null,
          source_url: image?.canonical_url ?? null,
          source_name: image?.publisher ?? null,
        };
      }),
      total: Number(count[0]?.total ?? 0),
    };
  }

  async get(input: Parameters<TrendRepository["get"]>[0]) {
    const legacy = "organizationId" in input ? input : null;
    const accountId = "accountId" in input ? input.accountId : null;
    if (!legacy) await requireAccountReadRehearsal(this.pool);
    const native = !legacy && (await nativeTrendTopics(this.pool));
    const [rows] = legacy
      ? await this.pool.query<RowDataPacket[]>(
          "SELECT t.*,EXISTS(SELECT 1 FROM account_trend_topic_follows f WHERE f.topic_id=t.id AND f.account_id=?) " +
            "followed FROM trend_topics t WHERE t.id=? AND t.organization_id=? AND t.workspace_id=? " +
            "LIMIT 1",
          [legacy.actorId, input.topicId, legacy.organizationId, legacy.workspaceId],
        )
      : await this.pool.query<RowDataPacket[]>(
          `SELECT ${accountTopicFields},EXISTS(SELECT 1 FROM account_trend_topic_follows f WHERE f.topic_id=t.id AND f.account_id=?) followed
       FROM ${accountTopicSource}
       WHERE t.id=? AND ao.account_id=? AND ${accountTopicReason}${native ? " AND t.account_id=ao.account_id" : ""} LIMIT 1`,
          [accountId, input.topicId, accountId],
        );
    if (!rows[0]) return null;
    const legacyRange = legacy ? " AND organization_id=? AND workspace_id=?" : "";
    const owned = (source: "trend_topic_keywords" | "trend_signals" | "trend_events") =>
      !legacy
        ? ` AND EXISTS (SELECT 1 FROM account_owned_records ao WHERE ao.source_table='${source}' AND ao.source_id=${source}.id AND ao.account_id=?)`
        : "";
    const ownedEvidence = !legacy
      ? native
        ? " AND " + nativeSignalEvidence("trend_signals", "?")
        : " AND EXISTS (SELECT 1 FROM account_owned_records eo WHERE eo.source_table='raw_evidence' AND eo.source_id=trend_signals.raw_evidence_id AND eo.account_id=?)"
      : "";
    const childParams = legacy
      ? [input.topicId, legacy.organizationId, legacy.workspaceId]
      : [input.topicId, accountId];
    const signalParams = legacy ? [input.topicId] : [...childParams, accountId];
    const signalFilter = owned("trend_signals") + ownedEvidence;
    const evidencePageSize = 100,
      evidencePage = input.evidencePage ?? 1;
    const [[keywordRows], [signalRows], [timelineRows], [timelineSourceRows], [relevanceRows]] =
      await Promise.all([
        this.pool.query<RowDataPacket[]>(
          "SELECT keyword,keyword_type,language,market FROM trend_topic_keywords WHERE topic_id=?" +
            `${owned("trend_topic_keywords")} ORDER BY FIELD(keyword_type,'primary',` +
            "'related','negative'),keyword",
          legacy ? [input.topicId] : childParams,
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT id,title,publisher,canonical_url,published_at,observed_at,provider_id," +
            `raw_evidence_id FROM trend_signals WHERE topic_id=?${signalFilter} ` +
            (legacy
              ? "ORDER BY published_at DESC LIMIT 100"
              : "ORDER BY published_at DESC,id DESC LIMIT ? OFFSET ?"),
          legacy
            ? signalParams
            : [...signalParams, evidencePageSize + 1, (evidencePage - 1) * evidencePageSize],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT DATE_FORMAT(published_at,'%Y-%m-%dT%H:00:00.000Z') at,\n                  COUNT(*) " +
            "signal_count,\n                  COUNT(DISTINCT provider_id) source_count\n           " +
            `  FROM trend_signals\n            WHERE topic_id=?${signalFilter}\n` +
            "            GROUP BY DATE_FORMAT(published_at,'%Y-%m-%dT%H:00:00.000Z')\n            " +
            "ORDER BY MIN(published_at)",
          signalParams,
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT provider_id,\n                  MAX(publisher) source_label,\n                 " +
            " DATE_FORMAT(published_at,'%Y-%m-%dT%H:00:00.000Z') at,\n                  COUNT(*) signal_count\n" +
            "             FROM trend_signals\n            WHERE topic_id=?" +
            `${signalFilter}\n            GROUP BY provider_id,\n                     DATE_FORMAT(published_at,` +
            "'%Y-%m-%dT%H:00:00.000Z')\n            ORDER BY provider_id,MIN(published_at)",
          signalParams,
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT actor_id,payload_json,occurred_at FROM " +
            (legacy ? trendTopicEventReadRelation + " trend_events" : "trend_events") +
            " WHERE resource_type='trend_topic' AND resource_id=?" +
            `${legacyRange} ` +
            `AND event_type='trend.topic.relevance_changed'${owned("trend_events")} ORDER BY occurred_at DESC,id DESC LIMIT 50`,
          childParams,
        ),
      ]);
    const summary = topic(rows[0]),
      evidence = signalRows.slice(0, evidencePageSize).map((row) => ({
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
    const evidenceCount = legacy
      ? evidence.length
      : timelineRows.reduce((total, row) => total + Number(row.signal_count), 0);
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
      ...(legacy
        ? {}
        : {
            evidence_pagination: {
              page: evidencePage,
              has_more: signalRows.length > evidencePageSize,
            },
          }),
      data_quality: {
        coverage_status: evidenceCount > 0 ? ("covered" as const) : ("insufficient_data" as const),
        evidence_count: evidenceCount,
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
    if ("accountId" in input) return this.listAccountRules(input.accountId);
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
         JOIN collection_tasks t ON t.id=s.task_id
         WHERE t.organization_id=? AND t.workspace_id=? AND s.task_id IN (${placeholders})
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

  private async listAccountRules(accountId: string) {
    await requireAccountReadRehearsal(this.pool);
    const nativeOwner = await this.hasNativeRuleOwner(this.pool);
    const ownerMatch = nativeOwner ? " AND r.account_id=ro.account_id" : "";
    // A stored task ID is not access. Require the owned task and its original scheduling receipt.
    // Apply the same proof again to the child read; a rule or a task can change between the queries.
    const originalTask = `EXISTS (SELECT 1 FROM collection_tasks t
      JOIN collection_task_events e ON e.task_id=t.id
        AND e.event_type='trend.rule.collection.scheduled'
        AND BINARY e.request_id=BINARY t.request_id AND BINARY e.trace_id=BINARY t.trace_id
      WHERE t.id=r.last_collection_task_id
        AND BINARY JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.monitoring_rule_id'))=BINARY r.id
        AND BINARY JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.task_id'))=BINARY t.id
        AND ${rehearsalOwns("collection_tasks", "t.id", "ro.account_id")}
        AND ${rehearsalOwns("collection_task_events", "e.id", "ro.account_id")})`;
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT r.id,r.name,r.include_keywords_json,r.negative_keywords_json,r.market,r.language,r.category,
       r.collection_interval_minutes,r.recommendation_min_source_count,r.status,r.last_evaluated_at,
       r.last_collection_at,r.next_collection_at,r.last_collection_task_id,r.version,r.created_at,r.updated_at,
       ${originalTask} AS owned_last_task FROM trend_monitoring_rules r
       JOIN account_owned_records ro ON ro.source_table='trend_monitoring_rules' AND ro.source_id=r.id
       WHERE ro.account_id=?${ownerMatch} ORDER BY r.updated_at DESC,r.id`,
      [accountId],
    );
    const items = rows.map((row) =>
      rule(
        Number(row.owned_last_task) === 1
          ? row
          : ({ ...row, last_collection_task_id: null } as RowDataPacket),
      ),
    );
    const withTask = items.filter((item) => item.last_collection_task_id !== null);
    if (!withTask.length) return items;
    const [failureRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT r.id rule_id,s.task_id,p.name FROM trend_monitoring_rules r
       JOIN account_owned_records ro ON ro.source_table='trend_monitoring_rules' AND ro.source_id=r.id
       JOIN collection_subqueries s ON s.task_id=r.last_collection_task_id
        AND BINARY JSON_UNQUOTE(JSON_EXTRACT(s.target_json,'$.monitoring_rule_id'))=BINARY r.id
       JOIN providers p ON p.id=s.provider_id
       WHERE ro.account_id=?${ownerMatch} AND r.id IN (?) AND s.status IN ('failed','blocked')
        AND ${originalTask} AND ${rehearsalOwns("collection_subqueries", "s.id", "ro.account_id")}
       ORDER BY r.id,s.ordinal`,
      [accountId, withTask.map((item) => item.id)],
    );
    const failures = new Map<string, string[]>();
    const tasks = new Map(withTask.map((item) => [item.id, item.last_collection_task_id]));
    for (const row of failureRows) {
      const id = String(row.rule_id);
      if (tasks.get(id) !== String(row.task_id)) continue;
      const names = failures.get(id) ?? [];
      names.push(String(row.name));
      failures.set(id, names);
    }
    return items.map((item) => ({ ...item, last_failed_sources: failures.get(item.id) ?? [] }));
  }

  private async hasNativeRuleOwner(connection: Pick<Pool, "query">) {
    const [fields] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM trend_monitoring_rules WHERE Field='account_id'",
    );
    return fields.length !== 0;
  }

  async listChangeRequests(input: Parameters<TrendRepository["listChangeRequests"]>[0]) {
    const params: unknown[] = [input.organizationId, input.workspaceId],
      status = input.status ? " AND c.status=?" : "";
    if (input.status) params.push(input.status);
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT c.*,t.title target_title,t.market target_market,t.language target_language," +
        "t.version target_version FROM trend_topic_change_requests c JOIN trend_topics t ON " +
        `t.id=c.target_topic_id WHERE t.organization_id=? AND t.workspace_id=?${status} ` +
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
          `SELECT s.id FROM trend_signals s JOIN trend_topics st ON st.id=s.topic_id WHERE st.organization_id=? AND st.workspace_id=? AND s.topic_id=? ` +
            `AND s.id IN (${input.signalIds.map(() => "?").join(",")}) FOR UPDATE`,
          [input.organizationId, input.workspaceId, input.targetTopicId, ...input.signalIds],
        );
        const [counts] = await c.query<RowDataPacket[]>(
          "SELECT COUNT(*) total FROM trend_signals s JOIN trend_topics st ON st.id=s.topic_id WHERE st.organization_id=? AND st.workspace_id=? AND s.topic_id=?",
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
      const [scope] = await c.query<RowDataPacket[]>(
        "SHOW COLUMNS FROM trend_topic_change_requests WHERE Field IN ('organization_id','workspace_id')",
      );
      if (scope.length === 1)
        throw new Error("partial_inherited_scope_schema:trend_topic_change_requests");
      const legacy = scope.length === 2;
      await c.query(
        `INSERT INTO trend_topic_change_requests (id,${legacy ? "organization_id,workspace_id," : ""}operation,` +
          "target_topic_id,source_topic_ids_json,signal_ids_json,new_title,new_category," +
          "expected_versions_json,reason,status,result_topic_id,proposed_by,decided_by," +
          "decision_reason,decided_at,request_id,trace_id,version,created_at,updated_at) VALUES " +
          `(?,${legacy ? "?,?," : ""}?,?,?,?,?,?,?,?,'pending',NULL,?,NULL,NULL,NULL,?,?,1,?,?)`,
        [
          input.requestIdValue,
          ...(legacy ? [input.organizationId, input.workspaceId] : []),
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
            "t.id=c.target_topic_id WHERE c.id=? AND t.organization_id=? AND t.workspace_id=? FOR UPDATE",
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
    return this.writeTopic(input, async (c, scope, ownershipReason) => {
      if (input.followed) {
        const [[existing]] = await c.query<RowDataPacket[]>(
          "SELECT id FROM account_trend_topic_follows WHERE topic_id=? AND account_id=? FOR UPDATE",
          [input.topicId, input.actorId],
        );
        if (!existing)
          await c.query(
            "INSERT INTO account_trend_topic_follows (id,account_id,topic_id,created_at) VALUES (?,?,?,?)",
            [randomUUID(), input.actorId, input.topicId, this.now()],
          );
      } else
        await c.query("DELETE FROM account_trend_topic_follows WHERE topic_id=? AND account_id=?", [
          input.topicId,
          input.actorId,
        ]);
      const result = { topic_id: input.topicId, followed: input.followed };
      const eventId = await this.event(
        c,
        scope,
        input.followed ? "trend.topic.followed" : "trend.topic.unfollowed",
        "trend_topic",
        input.topicId,
        result,
        "user",
      );
      await this.mapTopicEvent(c, eventId, input.actorId, ownershipReason);
      return result;
    });
  }

  async setRelevance(input: Parameters<TrendRepository["setRelevance"]>[0]) {
    return this.writeTopic(input, async (c, scope, ownershipReason) => {
      const native = "nativeTopicAccount" in scope;
      const [update] = await c.query<ResultSetHeader>(
        "UPDATE trend_topics SET status=?,version=version+1,updated_at=? WHERE id=? AND " +
          (native ? "account_id=?" : "organization_id=? AND workspace_id=?") +
          " AND version=?",
        [
          input.status,
          this.now(),
          input.topicId,
          ...(native ? [scope.nativeTopicAccount] : [scope.organizationId, scope.workspaceId]),
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
      const eventId = await this.event(
        c,
        scope,
        "trend.topic.relevance_changed",
        "trend_topic",
        input.topicId,
        { ...result, reason: input.reason },
        "user",
      );
      await this.mapTopicEvent(c, eventId, input.actorId, ownershipReason);
      return result;
    });
  }

  async createRule(input: Parameters<TrendRepository["createRule"]>[0]) {
    return this.write(input, input.ruleId, async (c) => {
      const now = this.now(),
        value = input.rule;
      const nativeOwner = await this.hasNativeRuleOwner(c);
      let owner: RowDataPacket | undefined;
      if (nativeOwner) {
        await requireAccountReadRehearsal(c, { lockForTransaction: true });
        [[owner]] = await c.query<RowDataPacket[]>(
          "SELECT s.account_id,s.reason FROM account_ownership_cutover cut " +
            "JOIN account_retirement_scopes s ON s.run_id=cut.source_run_id " +
            "WHERE cut.slot='current' AND cut.contract_version=25 AND s.legacy_org_id=? AND s.legacy_workspace_id=? " +
            "AND (s.reason='exclusive_owner' OR s.account_id=cut.primary_account_id) LIMIT 1 LOCK IN SHARE MODE",
          [input.organizationId, input.workspaceId],
        );
        if (!owner)
          throw new TrendServiceError(
            "account_ownership_not_ready",
            503,
            "先在隔离副本完成账号归属回填。",
          );
      }
      try {
        await c.query(
          `INSERT INTO trend_monitoring_rules (id,${owner ? "account_id," : ""}organization_id,workspace_id,name,` +
            "include_keywords_json,negative_keywords_json,market,language,category,notification_channel," +
            "collection_interval_minutes,recommendation_min_source_count,status,last_evaluated_at,next_collection_at," +
            `version,created_by,updated_by,created_at,updated_at) VALUES (?,${owner ? "?," : ""}?,?,?,?,?,` +
            "?,?,?,'in_app',?,?,'enabled',NULL,?,1,?,?,?,?)",
          [
            input.ruleId,
            ...(owner ? [owner.account_id] : []),
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
      const eventId = await this.event(
        c,
        input,
        "trend.monitoring_rule.created",
        "trend_monitoring_rule",
        input.ruleId,
        { status: result.status, version: result.version },
        "user",
      );
      if (owner) {
        await c.query(
          "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES ('trend_monitoring_rules',?,?,?)",
          [input.ruleId, owner.account_id, owner.reason],
        );
        await this.mapTopicEvent(c, eventId, String(owner.account_id), String(owner.reason));
      }
      return result;
    });
  }

  async updateRule(request: Parameters<TrendRepository["updateRule"]>[0]) {
    const account = "accountOwnedRule" in request;
    const lock = !account
      ? undefined
      : async (c: PoolConnection) => {
          await requireAccountReadRehearsal(c, { lockForTransaction: true });
          const source = await trendRuleScopeRelation(c);
          if (source === "trend_monitoring_rules")
            throw new TrendServiceError("trend_rule_scope_not_ready", 503, "先应用隔离规则迁移。");
          const [rows] = await c.query<RowDataPacket[]>(
            "SELECT o.reason FROM trend_monitoring_rules r " +
              "JOIN account_owned_records o ON o.source_table='trend_monitoring_rules' AND o.source_id=r.id " +
              "AND o.account_id=r.account_id JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
              "WHERE r.id=? AND r.account_id=? AND (o.reason='exclusive_owner' OR o.account_id=cut.primary_account_id) FOR UPDATE",
            [request.ruleId, request.actorId],
          );
          if (!rows[0])
            throw new TrendServiceError("trend_rule_not_found", 404, "刷新监控规则列表。");
          return rows[0];
        };
    return this.write(
      { ...request, route: request.route + (account ? "#account-v1" : "") },
      request.ruleId,
      async (c, owned) => {
        const legacy = request as typeof request & TrendWriteContext;
        const input = {
          ...request,
          organizationId: legacy.organizationId,
          workspaceId: legacy.workspaceId,
        };
        const scope = account ? "account_id=?" : "organization_id=? AND workspace_id=?";
        const args = account ? [input.actorId] : [input.organizationId, input.workspaceId];

        const [update] = await c.query<ResultSetHeader>(
          "UPDATE trend_monitoring_rules SET status=?," +
            (account
              ? "collection_interval_minutes=COALESCE(?,collection_interval_minutes)," +
                "recommendation_min_source_count=COALESCE(?,recommendation_min_source_count),"
              : "collection_interval_minutes=?,recommendation_min_source_count=?,") +
            "next_collection_at=IF(?='enabled',?,NULL),updated_by=?,version=version+1," +
            `updated_at=? WHERE id=? AND ${scope} AND version=?`,
          [
            input.status,
            input.collectionIntervalMinutes ?? (account ? null : 60),
            input.recommendationMinSourceCount ?? (account ? null : 1),
            input.status,
            this.now(),
            input.actorId,
            this.now(),
            input.ruleId,
            ...args,
            input.expectedVersion,
          ],
        );
        if (update.affectedRows !== 1)
          throw new TrendServiceError(
            "trend_rule_version_conflict",
            409,
            "刷新监控规则后重新提交。",
          );
        const [affectedOpportunities] = await c.query<RowDataPacket[]>(
          "SELECT o.id,o.recommendation_status,o.source_count," +
            "(SELECT MIN(" +
            "r.recommendation_min_source_count) FROM opportunity_rule_matches m JOIN " +
            "trend_monitoring_rules r ON r.id=m.monitoring_rule_id AND " +
            "r.status='enabled' WHERE m.opportunity_id=o.id AND " +
            (account
              ? "r.account_id=? AND " +
                rehearsalOwns("trend_monitoring_rules", "r.id", "r.account_id") +
                " AND " +
                rehearsalOwns("opportunity_rule_matches", "m.id", "r.account_id") +
                " AND "
              : "r.organization_id=o.organization_id AND r.workspace_id=o.workspace_id AND ") +
            "o.source_count>=r.recommendation_min_source_count) matched_threshold FROM " +
            "opportunities o JOIN opportunity_rule_matches affected ON " +
            "affected.opportunity_id=o.id WHERE " +
            (account ? "" : "o.organization_id=? AND o.workspace_id=? AND ") +
            "affected.monitoring_rule_id=? AND " +
            (account
              ? rehearsalOwns("opportunities", "o.id", "?") +
                " AND " +
                rehearsalOwns("opportunity_rule_matches", "affected.id", "?") +
                " AND "
              : "") +
            "o.decision_status='pending' AND o.score_rule_version IS NULL FOR UPDATE",
          [
            ...(account ? [input.actorId] : [input.organizationId, input.workspaceId]),
            input.ruleId,
            ...(account ? [input.actorId, input.actorId] : []),
          ],
        );
        let recommendationUpdates = 0;
        for (const opportunity of affectedOpportunities) {
          const recommendationStatus = "insufficient_data";
          if (String(opportunity.recommendation_status) === recommendationStatus) continue;
          const now = this.now();
          await c.query(
            "UPDATE opportunities SET recommendation_status=?,version=version+1,updated_at=? " +
              "WHERE id=?" +
              (account ? "" : " AND organization_id=? AND workspace_id=?"),
            [
              recommendationStatus,
              now,
              opportunity.id,
              ...(account ? [] : [input.organizationId, input.workspaceId]),
            ],
          );
          const recommendationEvent = await this.opportunityRecommendationEvent(
            c,
            input,
            opportunity,
            recommendationStatus,
            now,
            account,
          );
          if (account)
            await c.query(
              "INSERT INTO account_owned_records(source_table,source_id,account_id,reason) " +
                "SELECT 'opportunity_events',?,account_id,reason FROM account_owned_records WHERE source_table='opportunities' AND source_id=? AND account_id=? " +
                "UNION ALL SELECT 'opportunity_outbox',?,account_id,reason FROM account_owned_records WHERE source_table='opportunities' AND source_id=? AND account_id=?",
              [
                recommendationEvent,
                opportunity.id,
                input.actorId,
                recommendationEvent,
                opportunity.id,
                input.actorId,
              ],
            );
          recommendationUpdates += 1;
        }
        const [rows] = await c.query<RowDataPacket[]>(
          `SELECT * FROM trend_monitoring_rules WHERE id=? AND ${scope}`,
          [input.ruleId, ...args],
        );
        if (!rows[0])
          throw new TrendServiceError("trend_rule_not_found", 404, "刷新监控规则列表。");
        const result = rule(rows[0]);
        const rulePayload = {
          status: result.status,
          version: result.version,
          recommendation_updates: recommendationUpdates,
        };
        const eventId = account
          ? await this.accountRuleStatusEvent(c, input, rulePayload)
          : await this.event(
              c,
              input,
              "trend.monitoring_rule.status_changed",
              "trend_monitoring_rule",
              input.ruleId,
              rulePayload,
              "user",
            );
        if (account) await this.mapTopicEvent(c, eventId, input.actorId, String(owned?.reason));
        return result;
      },
      lock,
    );
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
      `UPDATE trend_signals s JOIN trend_topics t ON t.id=s.topic_id SET s.topic_id=? ` +
        `WHERE t.organization_id=? AND t.workspace_id=? AND s.topic_id IN (${sourceTopicIds.map(() => "?").join(",")})`,
      [targetTopicId, input.organizationId, input.workspaceId, ...sourceTopicIds],
    );
    await c.query(
      `INSERT IGNORE INTO trend_topic_keywords (id,topic_id,keyword,` +
        `keyword_type,language,market,created_at) SELECT UUID(),?,k.keyword,` +
        `k.keyword_type,k.language,k.market,? FROM trend_topic_keywords k JOIN trend_topics t ON t.id=k.topic_id ` +
        `WHERE t.organization_id=? AND t.workspace_id=? AND k.topic_id IN (${sourceTopicIds.map(() => "?").join(",")})`,
      [targetTopicId, now, input.organizationId, input.workspaceId, ...sourceTopicIds],
    );
    await c.query(
      `INSERT IGNORE INTO account_trend_topic_follows (id,topic_id,account_id,created_at) ` +
        `SELECT UUID(),?,f.account_id,? FROM account_trend_topic_follows f JOIN trend_topics t ON t.id=f.topic_id WHERE ` +
        `t.organization_id=? AND t.workspace_id=? AND f.topic_id IN ` +
        `(${sourceTopicIds.map(() => "?").join(",")})`,
      [targetTopicId, now, input.organizationId, input.workspaceId, ...sourceTopicIds],
    );
    await c.query(
      `DELETE k FROM trend_topic_keywords k JOIN trend_topics t ON t.id=k.topic_id WHERE t.organization_id=? AND t.workspace_id=? AND k.topic_id IN ` +
        `(${sourceTopicIds.map(() => "?").join(",")})`,
      [input.organizationId, input.workspaceId, ...sourceTopicIds],
    );
    await c.query(
      `DELETE f FROM account_trend_topic_follows f JOIN trend_topics t ON t.id=f.topic_id WHERE t.organization_id=? AND t.workspace_id=? AND f.topic_id IN ` +
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
        `SELECT s.* FROM trend_signals s JOIN trend_topics st ON st.id=s.topic_id WHERE st.organization_id=? AND st.workspace_id=? AND s.topic_id=? AND s.id IN ` +
          `(${signalIds.map(() => "?").join(",")}) ORDER BY s.id FOR UPDATE`,
        [input.organizationId, input.workspaceId, sourceTopicId, ...signalIds],
      ),
      [counts] = await c.query<RowDataPacket[]>(
        "SELECT COUNT(*) total FROM trend_signals s JOIN trend_topics st ON st.id=s.topic_id WHERE st.organization_id=? AND st.workspace_id=? AND s.topic_id=?",
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
      "INSERT INTO trend_topic_keywords (id,topic_id,keyword," +
        "keyword_type,language,market,created_at) VALUES (?,?,?,'primary',?,?,?)",
      [
        randomUUID(),
        resultTopicId,
        normalizedTitle,
        request.target_language,
        request.target_market,
        now,
      ],
    );
    await c.query(
      `UPDATE trend_signals s JOIN trend_topics t ON t.id=s.topic_id SET s.topic_id=? ` +
        `WHERE t.organization_id=? AND t.workspace_id=? AND s.topic_id=? AND s.id IN (${signalIds.map(() => "?").join(",")})`,
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

  private writeTopic<T>(
    input: TrendTopicWriteContext & { topicId: string; route: string },
    action: (c: PoolConnection, scope: TopicWriteScope, ownershipReason?: string) => Promise<T>,
  ) {
    if ("organizationId" in input) {
      return this.write(input, input.topicId, async (c) => {
        await this.requireTopic(c, input.topicId, input.organizationId, input.workspaceId);
        return action(c, input);
      });
    }
    return this.write(
      input,
      input.topicId,
      async (c, owned) => {
        if (!owned) throw new Error("account_topic_lock_missing");
        return action(
          c,
          owned.account_id != null
            ? { ...input, nativeTopicAccount: String(owned.account_id) }
            : {
                ...input,
                organizationId: String(owned.organization_id),
                workspaceId: String(owned.workspace_id),
              },
          String(owned.ownership_reason),
        );
      },
      async (c) => {
        await requireAccountReadRehearsal(c, { lockForTransaction: true });
        const native = await nativeTrendTopics(c);
        const [[owned]] = await c.query<RowDataPacket[]>(
          "SELECT " +
            (native ? "t.account_id" : "t.organization_id,t.workspace_id") +
            ",o.reason ownership_reason " +
            "FROM trend_topics t JOIN account_owned_records o ON o.source_table='trend_topics' " +
            "AND o.source_id=t.id " +
            (native ? "AND t.account_id=o.account_id " : "") +
            "WHERE t.id=? AND o.account_id=? FOR UPDATE",
          [input.topicId, input.actorId],
        );
        if (!owned) throw new TrendServiceError("trend_topic_not_found", 404, "刷新趋势列表。");
        return owned;
      },
    );
  }

  private async mapTopicEvent(
    c: PoolConnection,
    eventId: string,
    actorId: string,
    reason?: string,
  ) {
    if (!reason) return;
    await c.query(
      "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) " +
        "VALUES ('trend_events',?,?,?),('trend_outbox',?,?,?)",
      [eventId, actorId, reason, eventId, actorId, reason],
    );
  }

  private async write<T>(
    input: { actorId: string; route: string; idempotencyKey: string },
    resourceId: string,
    action: (connection: PoolConnection, owned?: RowDataPacket) => Promise<T>,
    lockOwnedTopic?: (connection: PoolConnection) => Promise<RowDataPacket>,
  ) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const owned = await lockOwnedTopic?.(c);
      const [replayed] = await c.query<RowDataPacket[]>(
        "SELECT result_json FROM trend_operations WHERE actor_id=? AND route=? AND idempotency_key=? LIMIT 1" +
          (lockOwnedTopic ? " FOR UPDATE" : ""),
        [input.actorId, input.route, input.idempotencyKey],
      );
      if (replayed[0]) {
        await c.commit();
        return json<T>(replayed[0].result_json);
      }
      const result = await action(c, owned);
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
    input:
      | NativeTopicWrite
      | {
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
    if ("nativeTopicAccount" in input) {
      if (resourceType !== "trend_topic" || input.nativeTopicAccount !== input.actorId)
        throw new Error("native_trend_event_scope_invalid");
      const body = JSON.stringify(payload);
      await c.query(
        "INSERT INTO trend_events (id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) " +
          "VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
          eventId,
          eventType,
          resourceType,
          resourceId,
          actorType,
          input.actorId,
          input.requestId,
          input.traceId,
          body,
          now,
        ],
      );
      await c.query(
        "INSERT INTO trend_outbox (id,event_type,resource_type,resource_id,payload_json,status,attempt_count," +
          "available_at,request_id,trace_id,created_at,updated_at) VALUES (?,?,?,?,?,'queued',0,?,?,?,?,?)",
        [
          eventId,
          eventType,
          resourceType,
          resourceId,
          body,
          now,
          input.requestId,
          input.traceId,
          now,
          now,
        ],
      );
      return eventId;
    }
    await appendTrendEvent(c, {
      id: eventId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      eventType,
      resourceType,
      resourceId,
      actorType,
      actorId: input.actorId,
      requestId: input.requestId,
      traceId: input.traceId,
      payloadJson: JSON.stringify(payload),
      occurredAt: now,
    });
    await appendTrendOutbox(c, {
      id: eventId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      eventType,
      resourceType,
      resourceId,
      payloadJson: JSON.stringify(payload),
      requestId: input.requestId,
      traceId: input.traceId,
      createdAt: now,
    });
    return eventId;
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
    recommendationStatus: "insufficient_data",
    now: Date,
    account = false,
  ) {
    const eventId = randomUUID();
    const payload = JSON.stringify({
      previous_status: String(opportunity.recommendation_status),
      recommendation_status: recommendationStatus,
      source_count: Number(opportunity.source_count),
      minimum_source_count:
        opportunity.matched_threshold == null ? null : Number(opportunity.matched_threshold),
      basis: "monitoring_rule_candidate_threshold",
    });
    if (account) {
      await appendAccountOpportunityRecommendationEvent(c, {
        id: eventId,
        opportunityId: String(opportunity.id),
        actorType: "user",
        actorId: input.actorId,
        requestId: input.requestId,
        traceId: input.traceId,
        payloadJson: payload,
        now,
      });
      return eventId;
    }
    await appendOpportunityEvent(c, {
      id: eventId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      eventType: "opportunity.rule_recommendation.changed",
      resourceType: "opportunity",
      resourceId: opportunity.id,
      actorType: "user",
      actorId: input.actorId,
      requestId: input.requestId,
      traceId: input.traceId,
      payloadJson: payload,
      occurredAt: now,
    });
    await appendOpportunityOutbox(c, {
      id: eventId,
      eventId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      eventType: "opportunity.rule_recommendation.changed",
      resourceType: "opportunity",
      resourceId: opportunity.id,
      payloadJson: payload,
      createdAt: now,
      requestId: input.requestId,
      traceId: input.traceId,
    });
    return eventId;
  }

  private async accountRuleStatusEvent(
    c: PoolConnection,
    input: { actorId: string; ruleId: string; requestId: string; traceId: string },
    value: unknown,
  ) {
    const id = randomUUID(),
      now = this.now(),
      payload = JSON.stringify(value);
    const event = "trend.monitoring_rule.status_changed";
    await c.query(
      "INSERT INTO trend_events (id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) " +
        "VALUES (?,?,'trend_monitoring_rule',?,'user',?,?,?,?,?)",
      [id, event, input.ruleId, input.actorId, input.requestId, input.traceId, payload, now],
    );
    await c.query(
      "INSERT INTO trend_outbox (id,event_type,resource_type,resource_id,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) " +
        "VALUES (?,?,'trend_monitoring_rule',?,?,'queued',0,?,?,?,?,?)",
      [id, event, input.ruleId, payload, now, input.requestId, input.traceId, now, now],
    );
    return id;
  }
}
