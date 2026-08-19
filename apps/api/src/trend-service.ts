import { randomUUID } from "node:crypto";

export type TrendStatus = "active" | "irrelevant" | "stale";
export type MonitoringRuleStatus = "enabled" | "paused";

export interface TrendTopicSummary {
  id: string;
  title: string;
  category: string | null;
  market: string;
  language: string;
  status: TrendStatus;
  signal_count: number;
  source_count: number;
  heat: { value: number; unit: "signals" };
  momentum_percent: number | null;
  confidence: {
    score: number | null;
    status: "measured" | "insufficient_data";
  };
  first_seen_at: string;
  last_seen_at: string;
  source_fresh_at: string;
  followed: boolean;
  version: number;
}

export interface TrendSignal {
  id: string;
  title: string;
  publisher: string;
  canonical_url: string;
  published_at: string;
  observed_at: string;
  provider_id: string;
  raw_evidence_id: string;
}

export interface TrendTopicDetail extends TrendTopicSummary {
  keywords: Array<{
    keyword: string;
    type: "primary" | "related" | "negative";
    language: string;
    market: string;
  }>;
  timeline: Array<{ at: string; signal_count: number; source_count: number }>;
  evidence: TrendSignal[];
  data_quality: {
    coverage_status: "covered" | "insufficient_data";
    evidence_count: number;
    source_count: number;
    stale: boolean;
  };
}

export interface TrendMonitoringRule {
  id: string;
  name: string;
  include_keywords: string[];
  negative_keywords: string[];
  market: string;
  language: string;
  category: string | null;
  notification_channel: "in_app";
  collection_interval_minutes: number;
  status: MonitoringRuleStatus;
  last_evaluated_at: string | null;
  last_collection_at: string | null;
  next_collection_at: string | null;
  last_collection_task_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TrendScope {
  organizationId: string;
  workspaceId: string;
  actorId: string;
}
export interface TrendWriteContext extends TrendScope {
  requestId: string;
  traceId: string;
  idempotencyKey: string;
}
export interface MonitoringRuleInput {
  name: string;
  include_keywords: string[];
  negative_keywords?: string[];
  market: string;
  language: string;
  category?: string | null;
  notification_channel: "in_app";
  collection_interval_minutes: number;
}

export class TrendServiceError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
    message = code,
  ) {
    super(message);
    this.name = "TrendServiceError";
  }
}

const boundedText = (
  value: unknown,
  field: string,
  maximum: number,
  pattern?: RegExp,
) => {
  if (typeof value !== "string")
    throw new TrendServiceError(
      "trend_input_invalid",
      400,
      `修正 ${field} 后重试。`,
    );
  const result = value.trim();
  if (!result || result.length > maximum || (pattern && !pattern.test(result)))
    throw new TrendServiceError(
      "trend_input_invalid",
      400,
      `修正 ${field} 后重试。`,
    );
  return result;
};

export function normalizeTrendTitle(value: string) {
  return boundedText(value, "title", 500)
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ");
}

const keywords = (value: unknown, field: string, allowEmpty: boolean) => {
  if (
    !Array.isArray(value) ||
    value.length > 20 ||
    (!allowEmpty && value.length === 0)
  )
    throw new TrendServiceError(
      "trend_rule_keywords_invalid",
      400,
      `修正 ${field} 后重试。`,
    );
  const normalized = value.map((item) =>
    boundedText(item, field, 100)
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .replace(/\s+/g, " "),
  );
  if (new Set(normalized).size !== normalized.length)
    throw new TrendServiceError(
      "trend_rule_keywords_duplicate",
      400,
      `${field} 不能包含重复关键词。`,
    );
  return normalized;
};

export function validateMonitoringRuleInput(
  value: MonitoringRuleInput,
): MonitoringRuleInput {
  if (!value || typeof value !== "object")
    throw new TrendServiceError(
      "trend_rule_input_invalid",
      400,
      "按 OpenAPI 提交监控规则。",
    );
  const collectionInterval = Number(value.collection_interval_minutes ?? 60);
  if (
    !Number.isSafeInteger(collectionInterval) ||
    collectionInterval < 15 ||
    collectionInterval > 10080
  )
    throw new TrendServiceError(
      "trend_rule_interval_invalid",
      400,
      "采集周期必须为 15–10080 分钟。",
    );
  return {
    name: boundedText(value.name, "name", 120),
    include_keywords: keywords(
      value.include_keywords,
      "include_keywords",
      false,
    ),
    negative_keywords: keywords(
      value.negative_keywords ?? [],
      "negative_keywords",
      true,
    ),
    market: boundedText(
      value.market,
      "market",
      40,
      /^[A-Za-z0-9._-]+$/,
    ).toUpperCase(),
    language: boundedText(value.language, "language", 40, /^[A-Za-z0-9._-]+$/),
    category:
      value.category == null || value.category === ""
        ? null
        : boundedText(value.category, "category", 80),
    notification_channel:
      value.notification_channel === "in_app"
        ? "in_app"
        : (() => {
            throw new TrendServiceError(
              "trend_rule_channel_unavailable",
              400,
              "当前仅支持站内通知；邮件 Provider 尚未确认。",
            );
          })(),
    collection_interval_minutes: collectionInterval,
  };
}

export interface TrendRepository {
  list(
    input: TrendScope & {
      page: number;
      pageSize: number;
      query?: string;
      market?: string;
      category?: string;
      status?: TrendStatus;
      followed?: boolean;
    },
  ): Promise<{ items: TrendTopicSummary[]; total: number }>;
  get(
    input: TrendScope & { topicId: string },
  ): Promise<TrendTopicDetail | null>;
  listRules(input: TrendScope): Promise<TrendMonitoringRule[]>;
  setFollow(
    input: TrendWriteContext & {
      topicId: string;
      followed: boolean;
      route: string;
    },
  ): Promise<{ topic_id: string; followed: boolean }>;
  setRelevance(
    input: TrendWriteContext & {
      topicId: string;
      status: "active" | "irrelevant";
      reason: string;
      expectedVersion: number;
      route: string;
    },
  ): Promise<{
    topic_id: string;
    status: "active" | "irrelevant";
    version: number;
  }>;
  createRule(
    input: TrendWriteContext & {
      ruleId: string;
      rule: MonitoringRuleInput;
      route: string;
    },
  ): Promise<TrendMonitoringRule>;
  updateRule(
    input: TrendWriteContext & {
      ruleId: string;
      status: MonitoringRuleStatus;
      collectionIntervalMinutes: number;
      expectedVersion: number;
      route: string;
    },
  ): Promise<TrendMonitoringRule>;
}

const uuid = (value: string, field: string) =>
  boundedText(
    value,
    field,
    36,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );

export class TrendService {
  constructor(private readonly repository: TrendRepository) {}

  list(
    input: TrendScope & {
      page?: number;
      pageSize?: number;
      query?: string;
      market?: string;
      category?: string;
      status?: TrendStatus;
      followed?: boolean;
    },
  ) {
    const page = input.page ?? 1,
      pageSize = input.pageSize ?? 20;
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    )
      throw new TrendServiceError(
        "trend_pagination_invalid",
        400,
        "page 从 1 开始，page_size 为 1–100。",
      );
    return this.repository.list({
      ...input,
      page,
      pageSize,
      ...(input.query ? { query: boundedText(input.query, "query", 200) } : {}),
    });
  }

  async get(input: TrendScope & { topicId: string }) {
    const result = await this.repository.get({
      ...input,
      topicId: uuid(input.topicId, "topic_id"),
    });
    if (!result)
      throw new TrendServiceError(
        "trend_topic_not_found",
        404,
        "刷新趋势列表；该主题可能不在当前工作区。",
      );
    return result;
  }

  listRules(input: TrendScope) {
    return this.repository.listRules(input);
  }
  follow(input: TrendWriteContext & { topicId: string; followed: boolean }) {
    const topicId = uuid(input.topicId, "topic_id");
    return this.repository.setFollow({
      ...input,
      topicId,
      route: `${input.followed ? "PUT" : "DELETE"}:/api/v1/trends/${topicId}/follow`,
    });
  }

  relevance(
    input: TrendWriteContext & {
      topicId: string;
      status: "active" | "irrelevant";
      reason: string;
      expectedVersion: number;
    },
  ) {
    const topicId = uuid(input.topicId, "topic_id");
    if (
      !["active", "irrelevant"].includes(input.status) ||
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 1
    )
      throw new TrendServiceError(
        "trend_relevance_input_invalid",
        400,
        "提交 active/irrelevant 和当前 version。",
      );
    return this.repository.setRelevance({
      ...input,
      topicId,
      reason: boundedText(input.reason, "reason", 500),
      route: `POST:/api/v1/trends/${topicId}/relevance`,
    });
  }

  createRule(input: TrendWriteContext & { rule: MonitoringRuleInput }) {
    return this.repository.createRule({
      ...input,
      ruleId: randomUUID(),
      rule: validateMonitoringRuleInput(input.rule),
      route: "POST:/api/v1/trends/monitoring-rules",
    });
  }

  updateRule(
    input: TrendWriteContext & {
      ruleId: string;
      status: MonitoringRuleStatus;
      collectionIntervalMinutes?: number;
      expectedVersion: number;
    },
  ) {
    const ruleId = uuid(input.ruleId, "rule_id"),
      collectionIntervalMinutes = Number(
        input.collectionIntervalMinutes ?? 60,
      );
    if (
      !["enabled", "paused"].includes(input.status) ||
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 1
    )
      throw new TrendServiceError(
        "trend_rule_status_invalid",
        400,
        "提交 enabled/paused 和当前 version。",
      );
    if (
      !Number.isSafeInteger(collectionIntervalMinutes) ||
      collectionIntervalMinutes < 15 ||
      collectionIntervalMinutes > 10080
    )
      throw new TrendServiceError(
        "trend_rule_interval_invalid",
        400,
        "采集周期必须为 15–10080 分钟。",
      );
    return this.repository.updateRule({
      ...input,
      ruleId,
      collectionIntervalMinutes,
      route: `PATCH:/api/v1/trends/monitoring-rules/${ruleId}`,
    });
  }
}
