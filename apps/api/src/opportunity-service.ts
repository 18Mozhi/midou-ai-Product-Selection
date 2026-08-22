import { randomUUID } from "node:crypto";

export type OpportunityDecision = "pending" | "adopted" | "observing" | "rejected";
export type OpportunityCoverageStatus = "insufficient" | "partial" | "complete";
export type OpportunityBlockingReason = "evidence_insufficient" | "recommendation_insufficient";
export type OpportunityLifecycle =
  "candidate" | "validating" | "ready" | "adopted" | "observing" | "rejected" | "archived";
export type OpportunityBatchAction = "assign" | "archive" | "review";
export type DecisionAction = "adopt" | "observe" | "reject";
export interface OpportunityScope {
  organizationId: string;
  workspaceId: string;
  actorId: string;
}
export interface OpportunityWriteContext extends OpportunityScope {
  requestId: string;
  traceId: string;
  idempotencyKey: string;
}
export interface OpportunityCreateInput {
  name: string;
  market: string;
  category?: string | null;
  source_topic_id?: string | null;
}
export interface OpportunitySummary {
  id: string;
  name: string;
  image_url: string | null;
  market: string;
  category: string | null;
  source_type: "manual" | "trend_topic";
  source_ref_id: string | null;
  owner_id: string | null;
  lifecycle_status: string;
  lifecycle_entered_at: string;
  lifecycle_dwell_seconds: number;
  recommendation_status: "insufficient_data" | "recommend" | "observe" | "not_recommend";
  overall_score: number | null;
  trend_score: number | null;
  competition_score: number | null;
  profit_status: "insufficient_data" | "calculated";
  risk_level: "unknown" | "low" | "medium" | "high";
  confidence: { status: "insufficient_data" | "measured"; score: number | null };
  evidence_count: number;
  source_count: number;
  competitor_count: number;
  supplier_candidate_count: number;
  coverage_status: OpportunityCoverageStatus;
  blocking_reasons: OpportunityBlockingReason[];
  decision_status: OpportunityDecision;
  version: number;
  updated_at: string;
}
export interface OpportunityDetail extends OpportunitySummary {
  adoption_blockers: Array<{
    code: OpportunityBlockingReason;
    status: "blocked" | "in_progress" | "cleared";
    progress_percent: number | null;
    next_action: string;
    task_id: string | null;
    task_status: string | null;
    score_job_status: string | null;
  }>;
  redecision_ready: boolean;
  score_rule_version: string | null;
  scored_at: string | null;
  latest_score_run: null | {
    id: string;
    status: "calculated" | "insufficient_data";
    coverage_percent: number;
    confidence_score: number | null;
    recommendation_status: string;
    missing_fields: string[];
    scored_at: string;
  };
  score_components: Array<{
    dimension_code: string;
    weight_percent: number;
    input_score: number | null;
    weighted_score: number | null;
    evidence_ids: string[];
    missing_fields: string[];
  }>;
  evidence: Array<{
    id: string;
    title: string;
    publisher: string;
    canonical_url: string;
    provider_id: string;
    raw_evidence_id: string;
    observed_at: string;
  }>;
  decisions: Array<{
    id: string;
    action: DecisionAction;
    reason: string;
    actor_id: string;
    created_at: string;
    opportunity_version: number;
  }>;
  section_status: {
    market: "covered" | "insufficient_data";
    competition: "covered" | "insufficient_data";
    profit: "insufficient_data" | "calculated";
    risk: "covered" | "insufficient_data";
    execution: "not_available";
  };
}

export class OpportunityServiceError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
    message = code,
  ) {
    super(message);
    this.name = "OpportunityServiceError";
  }
}
const bounded = (value: unknown, field: string, max: number, pattern?: RegExp) => {
  if (typeof value !== "string")
    throw new OpportunityServiceError("opportunity_input_invalid", 400, `修正 ${field} 后重试。`);
  const result = value.trim();
  if (!result || result.length > max || (pattern && !pattern.test(result)))
    throw new OpportunityServiceError("opportunity_input_invalid", 400, `修正 ${field} 后重试。`);
  return result;
};
const uuid = (value: unknown, field: string) =>
  bounded(
    value,
    field,
    36,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
export function validateOpportunityInput(value: OpportunityCreateInput): OpportunityCreateInput {
  if (!value || typeof value !== "object")
    throw new OpportunityServiceError(
      "opportunity_input_invalid",
      400,
      "按 OpenAPI 提交机会候选。",
    );
  return {
    name: bounded(value.name, "name", 200),
    market: bounded(value.market, "market", 40, /^[A-Za-z0-9._-]+$/).toUpperCase(),
    category:
      value.category == null || value.category === ""
        ? null
        : bounded(value.category, "category", 80),
    source_topic_id:
      value.source_topic_id == null || value.source_topic_id === ""
        ? null
        : uuid(value.source_topic_id, "source_topic_id"),
  };
}
export function validateDecisionInput(value: {
  action: DecisionAction;
  reason: string;
  expected_version: number;
}) {
  if (
    !value ||
    !["adopt", "observe", "reject"].includes(value.action) ||
    !Number.isSafeInteger(value.expected_version) ||
    value.expected_version < 1
  )
    throw new OpportunityServiceError(
      "opportunity_decision_invalid",
      400,
      "提交动作、原因和当前 version。",
    );
  return {
    action: value.action,
    reason: bounded(value.reason, "reason", 1000),
    expected_version: value.expected_version,
  };
}
export interface OpportunityRepository {
  list(
    input: OpportunityScope & {
      page: number;
      pageSize: number;
      query?: string;
      market?: string;
      decisionStatus?: OpportunityDecision;
      coverageStatus?: OpportunityCoverageStatus;
      blockingReason?: OpportunityBlockingReason;
      lifecycleStatus?: OpportunityLifecycle;
      ownerId?: string;
      scope?: "product" | "all";
    },
  ): Promise<{ items: OpportunitySummary[]; total: number }>;
  get(input: OpportunityScope & { opportunityId: string }): Promise<OpportunityDetail | null>;
  memberOptions(input: OpportunityScope): Promise<Array<{ id: string; label: string }>>;
  create(
    input: OpportunityWriteContext & {
      opportunityId: string;
      value: OpportunityCreateInput;
      route: string;
    },
  ): Promise<OpportunitySummary>;
  decide(
    input: OpportunityWriteContext & {
      opportunityId: string;
      action: DecisionAction;
      reason: string;
      expectedVersion: number;
      route: string;
    },
  ): Promise<{
    opportunity_id: string;
    decision_status: OpportunityDecision;
    version: number;
    decision_id: string;
  }>;
  batch(input: OpportunityWriteContext & { value: any; route: string }): Promise<any>;
  createEvidenceTask(
    input: OpportunityWriteContext & {
      opportunityId: string;
      expectedVersion: number;
      route: string;
    },
  ): Promise<any>;
}
export class OpportunityService {
  constructor(private readonly repository: OpportunityRepository) {}
  list(
    input: OpportunityScope & {
      page?: number;
      pageSize?: number;
      query?: string;
      market?: string;
      decisionStatus?: OpportunityDecision;
      coverageStatus?: OpportunityCoverageStatus;
      blockingReason?: OpportunityBlockingReason;
      lifecycleStatus?: OpportunityLifecycle;
      ownerId?: string;
      scope?: "product" | "all";
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
      throw new OpportunityServiceError(
        "opportunity_pagination_invalid",
        400,
        "page 从 1 开始，page_size 为 1–100。",
      );
    if (
      input.decisionStatus &&
      !["pending", "adopted", "observing", "rejected"].includes(input.decisionStatus)
    )
      throw new OpportunityServiceError(
        "opportunity_filter_invalid",
        400,
        "修正 decision_status 后重试。",
      );
    if (
      input.coverageStatus &&
      !["insufficient", "partial", "complete"].includes(input.coverageStatus)
    )
      throw new OpportunityServiceError(
        "opportunity_filter_invalid",
        400,
        "修正 coverage_status 后重试。",
      );
    if (
      input.blockingReason &&
      !["evidence_insufficient", "recommendation_insufficient"].includes(input.blockingReason)
    )
      throw new OpportunityServiceError(
        "opportunity_filter_invalid",
        400,
        "修正 blocking_reason 后重试。",
      );
    if (
      input.lifecycleStatus &&
      ![
        "candidate",
        "validating",
        "ready",
        "adopted",
        "observing",
        "rejected",
        "archived",
      ].includes(input.lifecycleStatus)
    )
      throw new OpportunityServiceError(
        "opportunity_filter_invalid",
        400,
        "修正 lifecycle_status 后重试。",
      );
    return this.repository.list({
      ...input,
      page,
      pageSize,
      ...(input.query ? { query: bounded(input.query, "query", 200) } : {}),
      ...(input.market
        ? { market: bounded(input.market, "market", 40, /^[A-Za-z0-9._-]+$/).toUpperCase() }
        : {}),
      ...(input.ownerId ? { ownerId: uuid(input.ownerId, "owner_id") } : {}),
    });
  }
  memberOptions(input: OpportunityScope) {
    return this.repository.memberOptions(input);
  }
  async get(input: OpportunityScope & { opportunityId: string }) {
    const result = await this.repository.get({
      ...input,
      opportunityId: uuid(input.opportunityId, "opportunity_id"),
    });
    if (!result)
      throw new OpportunityServiceError(
        "opportunity_not_found",
        404,
        "刷新机会列表；该机会可能不在当前工作区。",
      );
    return result;
  }
  create(input: OpportunityWriteContext & { value: OpportunityCreateInput }) {
    return this.repository.create({
      ...input,
      opportunityId: randomUUID(),
      value: validateOpportunityInput(input.value),
      route: "POST:/api/v1/opportunities",
    });
  }
  decide(
    input: OpportunityWriteContext & {
      opportunityId: string;
      value: { action: DecisionAction; reason: string; expected_version: number };
    },
  ) {
    const opportunityId = uuid(input.opportunityId, "opportunity_id"),
      value = validateDecisionInput(input.value);
    return this.repository.decide({
      ...input,
      opportunityId,
      action: value.action,
      reason: value.reason,
      expectedVersion: value.expected_version,
      route: `POST:/api/v1/opportunities/${opportunityId}/decisions`,
    });
  }
  batch(input: OpportunityWriteContext & { value: any }) {
    const action = input.value?.action as OpportunityBatchAction,
      items = Array.isArray(input.value?.items) ? input.value.items : [];
    if (!(["assign", "archive", "review"] as string[]).includes(action))
      throw new OpportunityServiceError(
        "opportunity_batch_action_invalid",
        400,
        "选择批量指派、归档或复核。",
      );
    if (items.length < 1 || items.length > 50)
      throw new OpportunityServiceError(
        "opportunity_batch_size_invalid",
        400,
        "每次选择 1–50 个机会。",
      );
    const normalized: Array<{ id: string; expected_version: number }> = items.map((item: any) => {
      const expectedVersion = Number(item?.expected_version);
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)
        throw new OpportunityServiceError(
          "opportunity_version_invalid",
          400,
          "提交每个机会的当前 version。",
        );
      return { id: uuid(item?.id, "opportunity_id"), expected_version: expectedVersion };
    });
    if (new Set(normalized.map((item) => item.id)).size !== normalized.length)
      throw new OpportunityServiceError(
        "opportunity_batch_duplicate",
        400,
        "批量机会编号不能重复。",
      );
    return this.repository.batch({
      ...input,
      value: {
        action,
        items: normalized,
        reason: bounded(input.value?.reason, "reason", 1000),
        assignee_id: action === "assign" ? uuid(input.value?.assignee_id, "assignee_id") : null,
      },
      route: "POST:/api/v1/opportunities/batch",
    });
  }
  createEvidenceTask(input: OpportunityWriteContext & { opportunityId: string; value: any }) {
    const expectedVersion = Number(input.value?.expected_version);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)
      throw new OpportunityServiceError(
        "opportunity_version_invalid",
        400,
        "提交当前机会 version。",
      );
    const opportunityId = uuid(input.opportunityId, "opportunity_id");
    return this.repository.createEvidenceTask({
      ...input,
      opportunityId,
      expectedVersion,
      route: `POST:/api/v1/opportunities/${opportunityId}/evidence-completion-tasks`,
    });
  }
}
