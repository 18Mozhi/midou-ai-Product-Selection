import { createHash, randomUUID } from "node:crypto";
import type { DecisionAction } from "./opportunity-service.js";

export type SelectionInputKind = "keyword" | "asin" | "product_url";
export type SelectionJourneyState =
  "accepted" | "running" | "result_ready" | "succeeded_empty" | "blocked" | "failed" | "decided";
export interface SelectionJourneyCandidate {
  raw_evidence_id: string;
  title: string | null;
  publisher: string | null;
  canonical_url: string;
  observed_at: string;
  topic_id: string | null;
}
export interface SelectionJourneyResult {
  id: string;
  organization_id: string;
  workspace_id: string;
  input_kind: SelectionInputKind;
  input_value: string;
  provider_code: string;
  task_id: string;
  task_status: string;
  state: SelectionJourneyState;
  coverage_status: string | null;
  available_result_count: number;
  results: SelectionJourneyCandidate[];
  first_result: SelectionJourneyCandidate | null;
  blocked_reason: string | null;
  blocked_owner: string | null;
  blocked_next_step: string | null;
  timeline: Array<{
    stage: "queued" | "collecting" | "parsing" | "decision";
    status: "waiting" | "active" | "completed" | "blocked";
    occurred_at: string | null;
  }>;
  decision: null | {
    action: DecisionAction;
    reason: string;
    selected_raw_evidence_id: string | null;
    actor_id: string;
    created_at: string;
  };
  opportunity_id: string | null;
  verification_task_id: string | null;
  accepted_at: string;
  terminal_at: string | null;
  decided_at: string | null;
  elapsed_ms: number;
  deadline_ms: 180000;
  within_deadline: boolean;
  request_id: string;
  trace_id: string;
}
export interface SelectionJourneyRepository {
  create(input: {
    journeyId: string;
    taskId: string;
    subqueryId: string;
    organizationId: string;
    workspaceId: string;
    actorId: string;
    requestId: string;
    traceId: string;
    idempotencyKey: string;
    inputKind: SelectionInputKind;
    inputValue: string;
    inputSha256: string;
    providerCode: "google_news_search";
    deadlineAt: Date;
    now: Date;
  }): Promise<SelectionJourneyResult>;
  get(input: {
    journeyId: string;
    organizationId: string;
    workspaceId: string;
    actorId: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<SelectionJourneyResult | null>;
  decide(input: {
    journeyId: string;
    organizationId: string;
    workspaceId: string;
    actorId: string;
    requestId: string;
    traceId: string;
    idempotencyKey: string;
    action: DecisionAction;
    reason: string;
    selectedRawEvidenceId: string | null;
    now: Date;
  }): Promise<SelectionJourneyResult>;
}

export class SelectionJourneyError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
  ) {
    super(code);
    this.name = "SelectionJourneyError";
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bounded = (value: unknown, maximum: number) =>
  typeof value === "string" && value.trim() && value.trim().length <= maximum ? value.trim() : null;
function input(value: { input_kind?: unknown; input_value?: unknown }) {
  if (!value || !["keyword", "asin", "product_url"].includes(String(value.input_kind)))
    throw new SelectionJourneyError(
      "selection_input_kind_invalid",
      400,
      "选择关键词、ASIN 或商品链接后重试。",
    );
  const kind = value.input_kind as SelectionInputKind,
    raw = bounded(value.input_value, 200);
  if (!raw)
    throw new SelectionJourneyError(
      "selection_input_value_invalid",
      400,
      "输入 1–200 个字符后重试。",
    );
  if (kind === "asin" && !/^[A-Z0-9]{10}$/i.test(raw))
    throw new SelectionJourneyError("selection_asin_invalid", 400, "输入 10 位 ASIN 后重试。");
  if (kind === "product_url") {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new SelectionJourneyError(
        "selection_product_url_invalid",
        400,
        "输入有效的 HTTPS 商品链接后重试。",
      );
    }
    if (url.protocol !== "https:" || url.username || url.password || url.hash)
      throw new SelectionJourneyError(
        "selection_product_url_invalid",
        400,
        "输入不含账号、密码或片段的 HTTPS 商品链接。",
      );
  }
  return { kind, inputValue: raw };
}
function journeyId(value: string) {
  if (!uuid.test(value))
    throw new SelectionJourneyError(
      "selection_journey_id_invalid",
      400,
      "刷新真实选品验收页面后重试。",
    );
  return value;
}
function decision(value: {
  action?: unknown;
  reason?: unknown;
  selected_raw_evidence_id?: unknown;
}) {
  if (!["adopt", "observe", "reject"].includes(String(value?.action)))
    throw new SelectionJourneyError(
      "selection_decision_invalid",
      400,
      "选择采纳、继续观察或驳回。",
    );
  const reason = bounded(value.reason, 1000);
  if (!reason)
    throw new SelectionJourneyError(
      "selection_decision_invalid",
      400,
      "填写 1–1000 个字符的决策原因。",
    );
  const selectedRawEvidenceId =
    value.selected_raw_evidence_id == null ? null : String(value.selected_raw_evidence_id);
  if (selectedRawEvidenceId !== null && !uuid.test(selectedRawEvidenceId))
    throw new SelectionJourneyError(
      "selection_candidate_invalid",
      400,
      "重新选择当前旅程中的候选结果。",
    );
  if (value.action === "adopt" && selectedRawEvidenceId === null)
    throw new SelectionJourneyError(
      "selection_candidate_required",
      400,
      "采纳前请选择一条候选结果。",
    );
  return {
    action: value.action as DecisionAction,
    reason,
    selectedRawEvidenceId: value.action === "adopt" ? selectedRawEvidenceId : null,
  };
}

export class SelectionJourneyService {
  constructor(
    private readonly repository: SelectionJourneyRepository,
    private readonly deadlineMs = 180000,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (deadlineMs !== 180000)
      throw new SelectionJourneyError(
        "selection_deadline_contract_invalid",
        500,
        "将 SELECTION_ACCEPTANCE_DEADLINE_MS 恢复为 180000 并通过宝塔重启 Node API。",
      );
  }
  create(context: {
    organizationId: string;
    workspaceId: string;
    actorId: string;
    requestId: string;
    traceId: string;
    idempotencyKey: string;
    value: { input_kind?: unknown; input_value?: unknown };
  }) {
    const parsed = input(context.value),
      now = this.now();
    return this.repository.create({
      ...context,
      journeyId: randomUUID(),
      taskId: randomUUID(),
      subqueryId: randomUUID(),
      inputKind: parsed.kind,
      inputValue: parsed.inputValue,
      inputSha256: createHash("sha256").update(parsed.inputValue).digest("hex"),
      providerCode: "google_news_search",
      deadlineAt: new Date(now.getTime() + this.deadlineMs),
      now,
    });
  }
  async get(context: {
    journeyId: string;
    organizationId: string;
    workspaceId: string;
    actorId: string;
    requestId: string;
    traceId: string;
  }) {
    const result = await this.repository.get({
      ...context,
      journeyId: journeyId(context.journeyId),
      now: this.now(),
    });
    if (!result)
      throw new SelectionJourneyError(
        "selection_journey_not_found",
        404,
        "返回真实选品入口重新创建任务。",
      );
    return result;
  }
  decide(context: {
    journeyId: string;
    organizationId: string;
    workspaceId: string;
    actorId: string;
    requestId: string;
    traceId: string;
    idempotencyKey: string;
    value: { action?: unknown; reason?: unknown; selected_raw_evidence_id?: unknown };
  }) {
    const parsed = decision(context.value);
    return this.repository.decide({
      ...context,
      journeyId: journeyId(context.journeyId),
      ...parsed,
      now: this.now(),
    });
  }
}
