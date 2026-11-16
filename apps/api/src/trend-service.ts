import { randomUUID } from "node:crypto";

export type TrendStatus = "active" | "irrelevant" | "stale" | "archived";
export type MonitoringRuleStatus = "enabled" | "paused";
export type TrendTopicChangeOperation = "merge" | "split";
export type TrendTopicChangeStatus = "pending" | "confirmed" | "rejected";

export interface TrendTopicSummary {
  image_url?: string | null;
  source_url?: string | null;
  source_name?: string | null;
  topic_variants?: Array<Pick<TrendTopicSummary, "id" | "title" | "status" | "last_seen_at">>;
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
  timeline_sources: Array<{
    source_id: string;
    source_label: string;
    points: Array<{ at: string; signal_count: number }>;
  }>;
  evidence: TrendSignal[];
  evidence_pagination?: { page: number; has_more: boolean };
  data_quality: {
    coverage_status: "covered" | "insufficient_data";
    evidence_count: number;
    source_count: number;
    stale: boolean;
  };
  relevance_history: Array<{
    status: "active" | "irrelevant";
    reason: string;
    actor_id: string;
    version: number;
    occurred_at: string;
  }>;
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
  recommendation_min_source_count: number;
  status: MonitoringRuleStatus;
  last_evaluated_at: string | null;
  last_collection_at: string | null;
  next_collection_at: string | null;
  last_collection_task_id: string | null;
  last_failed_sources: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TrendTopicChangeRequest {
  id: string;
  operation: TrendTopicChangeOperation;
  target_topic: Pick<TrendTopicSummary, "id" | "title" | "market" | "language" | "version">;
  source_topics: Array<Pick<TrendTopicSummary, "id" | "title" | "market" | "language" | "version">>;
  signal_ids: string[];
  new_title: string | null;
  new_category: string | null;
  reason: string;
  status: TrendTopicChangeStatus;
  result_topic_id: string | null;
  proposed_by: string;
  decided_by: string | null;
  decision_reason: string | null;
  decided_at: string | null;
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
export type TrendTopicWriteContext =
  | TrendWriteContext
  | (Omit<TrendWriteContext, "organizationId" | "workspaceId"> & { accountOwnedTopic: true });
export type TrendRuleUpdateContext =
  | TrendWriteContext
  | (Omit<TrendWriteContext, "organizationId" | "workspaceId"> & { accountOwnedRule: true });
export interface MonitoringRuleInput {
  name: string;
  include_keywords: string[];
  negative_keywords?: string[];
  market: string;
  language: string;
  category?: string | null;
  notification_channel: "in_app";
  collection_interval_minutes: number;
  recommendation_min_source_count: number;
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

const boundedText = (value: unknown, field: string, maximum: number, pattern?: RegExp) => {
  if (typeof value !== "string")
    throw new TrendServiceError("trend_input_invalid", 400, `修正 ${field} 后重试。`);
  const result = value.trim();
  if (!result || result.length > maximum || (pattern && !pattern.test(result)))
    throw new TrendServiceError("trend_input_invalid", 400, `修正 ${field} 后重试。`);
  return result;
};

export function normalizeTrendTitle(value: string) {
  return boundedText(value, "title", 500)
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ");
}

const keywords = (value: unknown, field: string, allowEmpty: boolean) => {
  if (!Array.isArray(value) || value.length > 20 || (!allowEmpty && value.length === 0))
    throw new TrendServiceError("trend_rule_keywords_invalid", 400, `修正 ${field} 后重试。`);
  const normalized = value.map((item) =>
    boundedText(item, field, 100).normalize("NFKC").toLocaleLowerCase("en-US").replace(/\s+/g, " "),
  );
  if (new Set(normalized).size !== normalized.length)
    throw new TrendServiceError(
      "trend_rule_keywords_duplicate",
      400,
      `${field} 不能包含重复关键词。`,
    );
  return normalized;
};

export function validateMonitoringRuleInput(value: MonitoringRuleInput): MonitoringRuleInput {
  if (!value || typeof value !== "object")
    throw new TrendServiceError("trend_rule_input_invalid", 400, "按 OpenAPI 提交监控规则。");
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
  const recommendationMinSourceCount = Number(value.recommendation_min_source_count ?? 1);
  if (
    !Number.isSafeInteger(recommendationMinSourceCount) ||
    recommendationMinSourceCount < 1 ||
    recommendationMinSourceCount > 10
  )
    throw new TrendServiceError(
      "trend_rule_source_threshold_invalid",
      400,
      "自动推荐所需独立来源数必须为 1–10。",
    );
  return {
    name: boundedText(value.name, "name", 120),
    include_keywords: keywords(value.include_keywords, "include_keywords", false),
    negative_keywords: keywords(value.negative_keywords ?? [], "negative_keywords", true),
    market: boundedText(value.market, "market", 40, /^[A-Za-z0-9._-]+$/).toUpperCase(),
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
    recommendation_min_source_count: recommendationMinSourceCount,
  };
}

export type TrendListScope = TrendScope | { accountId: string };

export interface TrendRepository {
  list(
    input: TrendListScope & {
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
    input: TrendListScope & { topicId: string; evidencePage?: number },
  ): Promise<TrendTopicDetail | null>;
  listRules(input: TrendListScope): Promise<TrendMonitoringRule[]>;
  listChangeRequests(
    input: TrendScope & { status?: TrendTopicChangeStatus },
  ): Promise<TrendTopicChangeRequest[]>;
  proposeTopicChange(
    input: TrendWriteContext & {
      requestIdValue: string;
      operation: TrendTopicChangeOperation;
      targetTopicId: string;
      sourceTopicIds: string[];
      signalIds: string[];
      newTitle: string | null;
      newCategory: string | null;
      expectedVersions: Record<string, number>;
      reason: string;
      route: string;
    },
  ): Promise<TrendTopicChangeRequest>;
  decideTopicChange(
    input: TrendWriteContext & {
      changeRequestId: string;
      decision: "confirm" | "reject";
      reason: string;
      expectedVersion: number;
      splitTopicId: string;
      route: string;
    },
  ): Promise<TrendTopicChangeRequest>;
  setFollow(
    input: TrendTopicWriteContext & {
      topicId: string;
      followed: boolean;
      route: string;
    },
  ): Promise<{ topic_id: string; followed: boolean }>;
  setRelevance(
    input: TrendTopicWriteContext & {
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
    input: TrendRuleUpdateContext & {
      ruleId: string;
      status: MonitoringRuleStatus;
      collectionIntervalMinutes?: number;
      recommendationMinSourceCount?: number;
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

const uuidList = (value: unknown, field: string, minimum: number, maximum: number) => {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum)
    throw new TrendServiceError("trend_change_input_invalid", 400, `修正 ${field} 后重试。`);
  const result = value.map((item) => uuid(String(item), field));
  if (new Set(result).size !== result.length)
    throw new TrendServiceError("trend_change_input_invalid", 400, `${field} 不能包含重复项。`);
  return result;
};

export class TrendService {
  constructor(private readonly repository: TrendRepository) {}

  list(
    input: TrendListScope & {
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

  async get(input: TrendListScope & { topicId: string; evidencePage?: unknown }) {
    const { evidencePage, ...scope } = input;
    const page =
      typeof evidencePage === "string" && /^\d{1,6}$/.test(evidencePage)
        ? Number(evidencePage)
        : evidencePage;
    if (
      "accountId" in scope &&
      page !== undefined &&
      (typeof page !== "number" || !Number.isInteger(page) || page < 1 || page > 100000)
    )
      throw new TrendServiceError("trend_evidence_page_invalid", 400, "选择有效的来源证据页码。");
    const result = await this.repository.get({
      ...scope,
      topicId: uuid(input.topicId, "topic_id"),
      ...("accountId" in scope && typeof page === "number" ? { evidencePage: page } : {}),
    });
    if (!result)
      throw new TrendServiceError(
        "trend_topic_not_found",
        404,
        "accountId" in input
          ? "刷新情报列表；该主题可能不属于当前账号。"
          : "刷新趋势列表；该主题可能不在当前工作区。",
      );
    return result;
  }

  listRules(input: TrendListScope) {
    return this.repository.listRules(input);
  }
  listChangeRequests(input: TrendScope & { status?: TrendTopicChangeStatus }) {
    if (input.status && !["pending", "confirmed", "rejected"].includes(input.status))
      throw new TrendServiceError(
        "trend_change_status_invalid",
        400,
        "使用 pending、confirmed 或 rejected 筛选确认队列。",
      );
    return this.repository.listChangeRequests(input);
  }

  proposeTopicChange(
    input: TrendWriteContext & {
      value: {
        operation: TrendTopicChangeOperation;
        target_topic_id: string;
        source_topic_ids?: unknown;
        signal_ids?: unknown;
        new_title?: unknown;
        new_category?: unknown;
        expected_versions: unknown;
        reason: unknown;
      };
    },
  ) {
    const operation = input.value?.operation,
      targetTopicId = uuid(String(input.value?.target_topic_id ?? ""), "target_topic_id"),
      sourceTopicIds = uuidList(
        input.value?.source_topic_ids ?? [],
        "source_topic_ids",
        operation === "merge" ? 1 : 0,
        operation === "merge" ? 10 : 0,
      ),
      signalIds = uuidList(
        input.value?.signal_ids ?? [],
        "signal_ids",
        operation === "split" ? 1 : 0,
        operation === "split" ? 100 : 0,
      );
    if (!["merge", "split"].includes(operation))
      throw new TrendServiceError("trend_change_input_invalid", 400, "选择合并或拆分。 ");
    if (sourceTopicIds.includes(targetTopicId))
      throw new TrendServiceError("trend_change_input_invalid", 400, "合并来源不能包含目标主题。");
    const expected = input.value?.expected_versions;
    if (!expected || typeof expected !== "object" || Array.isArray(expected))
      throw new TrendServiceError("trend_change_version_invalid", 400, "提交涉及主题的当前版本。");
    const expectedVersions: Record<string, number> = {};
    for (const topicId of [targetTopicId, ...sourceTopicIds]) {
      const version = Number((expected as Record<string, unknown>)[topicId]);
      if (!Number.isSafeInteger(version) || version < 1)
        throw new TrendServiceError(
          "trend_change_version_invalid",
          400,
          "提交涉及主题的当前版本。",
        );
      expectedVersions[topicId] = version;
    }
    const newTitle =
        operation === "split" ? boundedText(input.value.new_title, "new_title", 500) : null,
      newCategory =
        operation === "split" && input.value.new_category != null && input.value.new_category !== ""
          ? boundedText(input.value.new_category, "new_category", 80)
          : null,
      reason = boundedText(input.value.reason, "reason", 1000);
    if (reason.length < 2)
      throw new TrendServiceError("trend_change_reason_invalid", 400, "原因至少填写 2 个字符。");
    return this.repository.proposeTopicChange({
      ...input,
      requestIdValue: randomUUID(),
      operation,
      targetTopicId,
      sourceTopicIds,
      signalIds,
      newTitle,
      newCategory,
      expectedVersions,
      reason,
      route: "POST:/api/v1/trends/change-requests",
    });
  }

  decideTopicChange(
    input: TrendWriteContext & {
      changeRequestId: string;
      value: { decision: "confirm" | "reject"; reason: unknown; expected_version: unknown };
    },
  ) {
    const changeRequestId = uuid(input.changeRequestId, "change_request_id"),
      decision = input.value?.decision,
      expectedVersion = Number(input.value?.expected_version),
      reason = boundedText(input.value?.reason, "reason", 1000);
    if (
      !["confirm", "reject"].includes(decision) ||
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 1
    )
      throw new TrendServiceError(
        "trend_change_decision_invalid",
        400,
        "提交确认或驳回动作和当前版本。",
      );
    if (reason.length < 2)
      throw new TrendServiceError("trend_change_reason_invalid", 400, "原因至少填写 2 个字符。");
    return this.repository.decideTopicChange({
      ...input,
      changeRequestId,
      decision,
      reason,
      expectedVersion,
      splitTopicId: randomUUID(),
      route: `POST:/api/v1/trends/change-requests/${changeRequestId}/decisions`,
    });
  }
  follow(input: TrendTopicWriteContext & { topicId: string; followed: boolean }) {
    const parsedId = uuid(input.topicId, "topic_id");
    const account = "accountOwnedTopic" in input;
    const topicId = account ? parsedId.toLowerCase() : parsedId;
    return this.repository.setFollow({
      ...input,
      topicId,
      route: `${input.followed ? "PUT" : "DELETE"}:/api/v1/trends/${topicId}/follow${account ? ":account" : ""}`,
    });
  }

  relevance(
    input: TrendTopicWriteContext & {
      topicId: string;
      status: "active" | "irrelevant";
      reason: string;
      expectedVersion: number;
    },
  ) {
    const parsedId = uuid(input.topicId, "topic_id");
    const account = "accountOwnedTopic" in input;
    const topicId = account ? parsedId.toLowerCase() : parsedId;
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
      route: `POST:/api/v1/trends/${topicId}/relevance${account ? ":account" : ""}`,
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
    input: TrendRuleUpdateContext & {
      ruleId: string;
      status: MonitoringRuleStatus;
      collectionIntervalMinutes?: number;
      recommendationMinSourceCount?: number;
      expectedVersion: number;
    },
  ) {
    const account = "accountOwnedRule" in input;
    const ruleId = uuid(input.ruleId, "rule_id"),
      collectionIntervalMinutes =
        account && input.collectionIntervalMinutes === undefined
          ? undefined
          : Number(input.collectionIntervalMinutes ?? (account ? 0 : 60)),
      recommendationMinSourceCount =
        account && input.recommendationMinSourceCount === undefined
          ? undefined
          : Number(input.recommendationMinSourceCount ?? (account ? 0 : 1));
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
      recommendationMinSourceCount !== undefined &&
      (!Number.isSafeInteger(recommendationMinSourceCount) ||
        recommendationMinSourceCount < 1 ||
        recommendationMinSourceCount > 10)
    )
      throw new TrendServiceError(
        "trend_rule_source_threshold_invalid",
        400,
        "自动推荐所需独立来源数必须为 1–10。",
      );
    if (
      collectionIntervalMinutes !== undefined &&
      (!Number.isSafeInteger(collectionIntervalMinutes) ||
        collectionIntervalMinutes < 15 ||
        collectionIntervalMinutes > 10080)
    )
      throw new TrendServiceError(
        "trend_rule_interval_invalid",
        400,
        "采集周期必须为 15–10080 分钟。",
      );
    return this.repository.updateRule({
      ...input,
      ruleId,
      ...(collectionIntervalMinutes !== undefined ? { collectionIntervalMinutes } : {}),
      ...(recommendationMinSourceCount !== undefined ? { recommendationMinSourceCount } : {}),
      route: `PATCH:/api/v1/trends/monitoring-rules/${ruleId}`,
    });
  }
}
