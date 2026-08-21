import { randomUUID } from "node:crypto";
export type FeeType = "platform_fee" | "payment_fee" | "tax" | "fulfillment";
export type FeeMode = "percentage_of_sale" | "fixed_amount";
export type CostRuleStatus =
  "draft" | "pending_approval" | "approved" | "active" | "retired" | "rejected" | "rolled_back";
export type CostRuleAction = "submit" | "approve" | "reject" | "publish" | "rollback";
export type ApprovalRole = "selection_manager" | "organization_admin";
export type CostInputType = "sale_price" | "purchase_price" | "logistics";
export interface FeeLine {
  type: FeeType;
  mode: FeeMode;
  value: number;
  currency: string | null;
}
export interface CostRule {
  id: string;
  market: string;
  platform: string;
  version_code: string;
  name: string;
  status: CostRuleStatus;
  fee_lines: FeeLine[];
  effective_from: string;
  revision: number;
  approvals: ApprovalRole[];
  published_at: string | null;
  updated_at: string;
}
export interface ProfitAnalysis {
  latest_run: null | {
    id: string;
    status: "calculated" | "insufficient_data";
    rule_version_code: string;
    platform: string;
    market: string;
    currency: string | null;
    sale_price: number | null;
    total_cost: number | null;
    net_profit: number | null;
    net_margin_percent: number | null;
    missing_fields: string[];
    calculated_at: string;
    components: Array<{
      component_type: string;
      source_amount: number | null;
      source_currency: string | null;
      converted_amount: number | null;
      target_currency: string | null;
      source_ref_id: string | null;
      evidence_id: string | null;
      exchange_quote_id: string | null;
      missing_reason: string | null;
    }>;
  };
  current_inputs: Array<{
    input_type: CostInputType;
    amount_value: number;
    currency: string;
    source_type: string;
    source_ref_id: string;
    evidence_id: string;
    observed_at: string;
    input_version: number;
    platform: string;
  }>;
}
export interface ProfitWriteContext {
  organizationId: string;
  workspaceId: string;
  actorId: string;
  roleCodes: string[];
  requestId: string;
  traceId: string;
  idempotencyKey: string;
}
export class ProfitServiceError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
    message = code,
  ) {
    super(message);
    this.name = "ProfitServiceError";
  }
}
const bounded = (value: unknown, field: string, max: number, pattern?: RegExp) => {
    if (typeof value !== "string")
      throw new ProfitServiceError("profit_input_invalid", 400, `修正 ${field} 后重试。`);
    const result = value.trim();
    if (!result || result.length > max || (pattern && !pattern.test(result)))
      throw new ProfitServiceError("profit_input_invalid", 400, `修正 ${field} 后重试。`);
    return result;
  },
  uuid = (value: unknown, field: string) =>
    bounded(
      value,
      field,
      36,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    ),
  currency = (value: unknown) => bounded(value, "currency", 3, /^[A-Za-z]{3}$/).toUpperCase(),
  amount = (value: unknown, field: string, allowZero = true) => {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      (!allowZero && value === 0) ||
      value > 999999999999
    )
      throw new ProfitServiceError("profit_amount_invalid", 400, `${field} 必须为有效非负金额。`);
    return Math.round(value * 1e6) / 1e6;
  },
  dateOnly = (value: unknown, field: string) => {
    const text = bounded(value, field, 10, /^\d{4}-\d{2}-\d{2}$/),
      date = new Date(`${text}T00:00:00.000Z`);
    if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== text)
      throw new ProfitServiceError("profit_date_invalid", 400, `修正 ${field}。`);
    return text;
  };
export function validateCostRule(value: {
  market: string;
  platform: string;
  version_code: string;
  name: string;
  fee_lines: FeeLine[];
  effective_from: string;
}) {
  if (!value || !Array.isArray(value.fee_lines) || value.fee_lines.length !== 4)
    throw new ProfitServiceError(
      "cost_rule_fee_lines_invalid",
      400,
      "必须明确提供平台费、支付手续费、税费和履约成本四项规则。",
    );
  const expected: FeeType[] = ["platform_fee", "payment_fee", "tax", "fulfillment"],
    seen = new Set<string>(),
    fee_lines = value.fee_lines.map((line) => {
      if (
        !expected.includes(line?.type) ||
        seen.has(line.type) ||
        !["percentage_of_sale", "fixed_amount"].includes(line.mode)
      )
        throw new ProfitServiceError(
          "cost_rule_fee_lines_invalid",
          400,
          "费用类型必须完整且不重复。",
        );
      seen.add(line.type);
      const result = {
        type: line.type,
        mode: line.mode,
        value: amount(line.value, "fee.value"),
        currency: line.mode === "fixed_amount" ? currency(line.currency) : null,
      };
      if (line.mode === "percentage_of_sale" && result.value > 100)
        throw new ProfitServiceError(
          "cost_rule_percentage_invalid",
          400,
          "百分比费用不得超过 100。",
        );
      return result;
    });
  if (expected.some((type) => !seen.has(type)))
    throw new ProfitServiceError("cost_rule_fee_lines_invalid", 400, "费用类型不完整。");
  return {
    market: bounded(value.market, "market", 40, /^[A-Za-z0-9._-]+$/).toUpperCase(),
    platform: bounded(value.platform, "platform", 80, /^[A-Za-z0-9._-]+$/).toLowerCase(),
    version_code: bounded(value.version_code, "version_code", 64, /^[A-Za-z0-9._-]+$/),
    name: bounded(value.name, "name", 160),
    fee_lines,
    effective_from: dateOnly(value.effective_from, "effective_from"),
  };
}
export function validateExchangeQuote(value: {
  provider_id: string;
  base_currency: string;
  quote_currency: string;
  rate_value: number;
  quote_date: string;
  observed_at: string;
  source_ref_id: string;
  evidence_id: string;
}) {
  const base = currency(value.base_currency),
    quote = currency(value.quote_currency);
  if (base === quote)
    throw new ProfitServiceError("exchange_pair_invalid", 400, "汇率币种对必须不同。");
  const rate = amount(value.rate_value, "rate_value", false);
  const quoteDate = dateOnly(value.quote_date, "quote_date");
  if (quoteDate > new Date().toISOString().slice(0, 10))
    throw new ProfitServiceError("exchange_quote_future", 400, "不能记录未来汇率。");
  const observed = new Date(value.observed_at);
  if (Number.isNaN(observed.valueOf()) || observed.valueOf() > Date.now() + 300000)
    throw new ProfitServiceError(
      "exchange_observed_at_invalid",
      400,
      "observed_at 必须是有效历史时间。",
    );
  return {
    provider_id: uuid(value.provider_id, "provider_id"),
    base_currency: base,
    quote_currency: quote,
    rate_value: rate,
    quote_date: quoteDate,
    observed_at: observed,
    source_ref_id: bounded(value.source_ref_id, "source_ref_id", 255),
    evidence_id: uuid(value.evidence_id, "evidence_id"),
  };
}
export function validateCostInput(value: {
  platform: string;
  input_type: CostInputType;
  amount_value: number;
  currency: string;
  source_type: string;
  source_ref_id: string;
  evidence_id: string;
  observed_at: string;
  expected_version: number;
}) {
  if (
    !["sale_price", "purchase_price", "logistics"].includes(value?.input_type) ||
    !Number.isSafeInteger(value.expected_version) ||
    value.expected_version < 1
  )
    throw new ProfitServiceError(
      "cost_input_invalid",
      400,
      "提交有效成本类型和当前 opportunity version。",
    );
  const observed = new Date(value.observed_at);
  if (Number.isNaN(observed.valueOf()) || observed.valueOf() > Date.now() + 300000)
    throw new ProfitServiceError(
      "cost_input_time_invalid",
      400,
      "observed_at 必须是有效历史时间。",
    );
  return {
    platform: bounded(value.platform, "platform", 80, /^[A-Za-z0-9._-]+$/).toLowerCase(),
    input_type: value.input_type,
    amount_value: amount(value.amount_value, "amount_value", value.input_type !== "sale_price"),
    currency: currency(value.currency),
    source_type: bounded(value.source_type, "source_type", 80, /^[A-Za-z0-9._-]+$/),
    source_ref_id: bounded(value.source_ref_id, "source_ref_id", 255),
    evidence_id: uuid(value.evidence_id, "evidence_id"),
    observed_at: observed,
    expected_version: value.expected_version,
  };
}
export interface ProfitRepository {
  listRules(input: { organizationId: string; workspaceId: string }): Promise<CostRule[]>;
  getAnalysis(input: {
    organizationId: string;
    workspaceId: string;
    opportunityId: string;
  }): Promise<ProfitAnalysis>;
  createRule(
    input: ProfitWriteContext & {
      id: string;
      value: ReturnType<typeof validateCostRule>;
      route: string;
    },
  ): Promise<CostRule>;
  actRule(
    input: ProfitWriteContext & {
      ruleId: string;
      action: CostRuleAction;
      reason: string;
      expectedRevision: number;
      approvalRole?: ApprovalRole;
      targetRuleId?: string;
      route: string;
    },
  ): Promise<CostRule>;
  recordRate(
    input: ProfitWriteContext & {
      id: string;
      value: ReturnType<typeof validateExchangeQuote>;
      route: string;
    },
  ): Promise<{
    id: string;
    provider_id: string;
    pair: string;
    quote_date: string;
  }>;
  recordCost(
    input: ProfitWriteContext & {
      id: string;
      opportunityId: string;
      value: ReturnType<typeof validateCostInput>;
      route: string;
    },
  ): Promise<{
    input_id: string;
    opportunity_id: string;
    version: number;
    job_status: string;
  }>;
  queue(
    input: ProfitWriteContext & {
      opportunityId: string;
      platform: string;
      expectedVersion: number;
      route: string;
    },
  ): Promise<{ job_id: string; opportunity_id: string; version: number }>;
}
export class ProfitService {
  constructor(private readonly repository: ProfitRepository) {}
  listRules(input: { organizationId: string; workspaceId: string }) {
    return this.repository.listRules(input);
  }
  getAnalysis(input: { organizationId: string; workspaceId: string; opportunityId: string }) {
    return this.repository.getAnalysis({
      ...input,
      opportunityId: uuid(input.opportunityId, "opportunity_id"),
    });
  }
  createRule(
    input: ProfitWriteContext & {
      value: Parameters<typeof validateCostRule>[0];
    },
  ) {
    return this.repository.createRule({
      ...input,
      id: randomUUID(),
      value: validateCostRule(input.value),
      route: "POST:/api/v1/cost-rules",
    });
  }
  actRule(
    input: ProfitWriteContext & {
      ruleId: string;
      value: {
        action: CostRuleAction;
        reason: string;
        expected_revision: number;
        approval_role?: ApprovalRole;
        target_rule_id?: string;
      };
    },
  ) {
    const action = input.value?.action;
    if (
      !["submit", "approve", "reject", "publish", "rollback"].includes(action) ||
      !Number.isSafeInteger(input.value.expected_revision) ||
      input.value.expected_revision < 1
    )
      throw new ProfitServiceError(
        "cost_rule_action_invalid",
        400,
        "提交有效动作和当前 revision。",
      );
    const approvalRole = input.value.approval_role;
    if (
      (action === "approve" || action === "reject") &&
      (!approvalRole || !input.roleCodes.includes(approvalRole))
    )
      throw new ProfitServiceError(
        "cost_rule_approval_role_forbidden",
        403,
        "使用本人真实角色提交对应审批或驳回。",
      );
    const targetRuleId = input.value.target_rule_id
      ? uuid(input.value.target_rule_id, "target_rule_id")
      : undefined;
    if (action === "rollback" && !targetRuleId)
      throw new ProfitServiceError(
        "cost_rule_rollback_target_required",
        400,
        "回滚必须指定目标规则。",
      );
    const ruleId = uuid(input.ruleId, "cost_rule_id");
    return this.repository.actRule({
      ...input,
      ruleId,
      action,
      reason: bounded(input.value.reason, "reason", 1000),
      expectedRevision: input.value.expected_revision,
      ...(approvalRole ? { approvalRole } : {}),
      ...(targetRuleId ? { targetRuleId } : {}),
      route: `POST:/api/v1/cost-rules/${ruleId}/actions`,
    });
  }
  recordRate(
    input: ProfitWriteContext & {
      value: Parameters<typeof validateExchangeQuote>[0];
    },
  ) {
    return this.repository.recordRate({
      ...input,
      id: randomUUID(),
      value: validateExchangeQuote(input.value),
      route: "POST:/api/v1/exchange-rates",
    });
  }
  recordCost(
    input: ProfitWriteContext & {
      opportunityId: string;
      value: Parameters<typeof validateCostInput>[0];
    },
  ) {
    const opportunityId = uuid(input.opportunityId, "opportunity_id");
    return this.repository.recordCost({
      ...input,
      id: randomUUID(),
      opportunityId,
      value: validateCostInput(input.value),
      route: `POST:/api/v1/opportunities/${opportunityId}/cost-inputs`,
    });
  }
  queue(
    input: ProfitWriteContext & {
      opportunityId: string;
      value: { platform: string; expected_version: number };
    },
  ) {
    const opportunityId = uuid(input.opportunityId, "opportunity_id");
    if (!Number.isSafeInteger(input.value?.expected_version) || input.value.expected_version < 1)
      throw new ProfitServiceError(
        "profit_run_invalid",
        400,
        "提交平台和当前 opportunity version。",
      );
    return this.repository.queue({
      ...input,
      opportunityId,
      platform: bounded(input.value.platform, "platform", 80, /^[A-Za-z0-9._-]+$/).toLowerCase(),
      expectedVersion: input.value.expected_version,
      route: `POST:/api/v1/opportunities/${opportunityId}/profit-runs`,
    });
  }
}
