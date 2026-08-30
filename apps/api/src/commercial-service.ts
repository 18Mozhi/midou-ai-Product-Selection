import { randomUUID } from "node:crypto";

export class CommercialError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
    message = code,
  ) {
    super(message);
    this.name = "CommercialError";
  }
}

const uuid = (value: unknown, label: string) => {
  const normalized = String(value ?? "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
  )
    throw new CommercialError(`${label}_invalid`, 400, "提交有效资源标识。");
  return normalized;
};

const text = (value: unknown, label: string, max: number) => {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > max)
    throw new CommercialError(`${label}_invalid`, 400, `填写 1–${max} 个字符。`);
  return normalized;
};

const reason = (value: unknown) => text(value, "reason", 500);
const quotaKeys = new Set(["collection_tasks", "open_api_requests", "report_exports"]);

const quotas = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CommercialError("quotas_invalid", 400, "填写已支持计量项的整数配额。");
  const entries = Object.entries(value);
  if (
    !entries.length ||
    entries.some(
      ([key, amount]) =>
        !quotaKeys.has(key) ||
        !Number.isSafeInteger(Number(amount)) ||
        Number(amount) < 0 ||
        Number(amount) > 1_000_000_000,
    )
  )
    throw new CommercialError(
      "quotas_invalid",
      400,
      "配额仅支持 collection_tasks、open_api_requests、report_exports，值为 0–1000000000。",
    );
  return Object.fromEntries(entries.map(([key, amount]) => [key, Number(amount)]));
};

const date = (value: unknown, label: string) => {
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime()))
    throw new CommercialError(`${label}_invalid`, 400, "填写有效日期时间。");
  return parsed;
};

const version = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new CommercialError("expected_version_invalid", 400, "填写大于等于 1 的整数版本号。");
  return parsed;
};
const pageNumber = (value: unknown, label: string, fallback: number, maximum: number) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum)
    throw new CommercialError(`${label}_invalid`, 400, `填写 1–${maximum} 的整数。`);
  return parsed;
};
const optionalQuery = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  if (normalized.length > 120)
    throw new CommercialError("query_invalid", 400, "搜索内容不能超过 120 个字符。");
  return normalized;
};
const databaseFailureCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "PROTOCOL_CONNECTION_LOST",
  "POOL_CLOSED",
  "ER_CON_COUNT_ERROR",
  "ER_LOCK_DEADLOCK",
  "ER_LOCK_WAIT_TIMEOUT",
  "ER_QUERY_TIMEOUT",
]);
export const rethrowCommercialDependency = (error: unknown): never => {
  if (databaseFailureCodes.has(String((error as { code?: unknown })?.code ?? "")))
    throw new CommercialError(
      "commercial_dependency_unavailable",
      503,
      "配额数据库暂不可用，当前变更未确认写入，请稍后使用原幂等键重试。",
    );
  throw error;
};
const repositoryCall = async <T>(operation: Promise<T>) => {
  try {
    return await operation;
  } catch (error) {
    if (error instanceof CommercialError) throw error;
    rethrowCommercialDependency(error);
  }
};

export interface CommercialRepository {
  read(input: any): Promise<any>;
  createPlan(input: any): Promise<any>;
  updatePlan(input: any): Promise<any>;
  assign(input: any): Promise<any>;
  assignmentAction(input: any): Promise<any>;
  adjust(input: any): Promise<any>;
  revokeAdjustment(input: any): Promise<any>;
}

export class CommercialService {
  constructor(
    private readonly repository: CommercialRepository,
    private readonly limit = 100,
  ) {}

  read(input: any) {
    const status = String(input.status ?? "");
    if (status && !["draft", "active", "retired"].includes(status))
      throw new CommercialError("plan_status_invalid", 400, "选择草稿、启用或退役状态。");
    const defaultPageSize = Math.min(20, this.limit),
      pageSize = pageNumber(input.pageSize, "page_size", defaultPageSize, this.limit),
      adjustmentPageSize = pageNumber(
        input.adjustmentPageSize,
        "adjustment_page_size",
        Math.min(10, this.limit),
        this.limit,
      );
    return repositoryCall(
      this.repository.read({
        ...input,
        organizationId: input.organizationId ? uuid(input.organizationId, "organization_id") : null,
        query: optionalQuery(input.query),
        status: status || null,
        page: pageNumber(input.page, "page", 1, 1_000_000),
        pageSize,
        adjustmentPage: pageNumber(input.adjustmentPage, "adjustment_page", 1, 1_000_000),
        adjustmentPageSize,
      }),
    );
  }

  createPlan(input: any) {
    const value = input.value ?? {};
    const code = String(value.code ?? "")
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(code))
      throw new CommercialError(
        "plan_code_invalid",
        400,
        "使用 1–80 位小写字母、数字、下划线或连字符。",
      );
    return repositoryCall(
      this.repository.createPlan({
        ...input,
        id: randomUUID(),
        route: "POST:/api/v1/platform/commercial/plans",
        value: {
          code,
          name: text(value.name, "plan_name", 120),
          description: value.description ? text(value.description, "description", 500) : null,
          quotas: quotas(value.quotas),
          reason: reason(value.reason),
        },
      }),
    );
  }

  updatePlan(input: any) {
    const value = input.value ?? {};
    const status = String(value.status ?? "");
    if (!["draft", "active", "retired"].includes(status))
      throw new CommercialError("plan_status_invalid", 400, "选择草稿、启用或退役。");
    return repositoryCall(
      this.repository.updatePlan({
        ...input,
        id: randomUUID(),
        planId: uuid(input.planId, "plan_id"),
        route: "PATCH:/api/v1/platform/commercial/plans/:id",
        value: {
          name: text(value.name, "plan_name", 120),
          description: value.description ? text(value.description, "description", 500) : null,
          quotas: quotas(value.quotas),
          status,
          expected_version: version(value.expected_version),
          reason: reason(value.reason),
        },
      }),
    );
  }

  assign(input: any) {
    const value = input.value ?? {};
    const start = date(value.period_start, "period_start");
    const end = date(value.period_end, "period_end");
    if (end <= start)
      throw new CommercialError("commercial_period_invalid", 400, "账期结束时间必须晚于开始时间。");
    return repositoryCall(
      this.repository.assign({
        ...input,
        id: randomUUID(),
        route: "POST:/api/v1/platform/commercial/assignments",
        value: {
          organization_id: uuid(value.organization_id, "organization_id"),
          plan_id: uuid(value.plan_id, "plan_id"),
          period_start: start,
          period_end: end,
          expected_version:
            value.expected_version === undefined || value.expected_version === null
              ? null
              : version(value.expected_version),
          reason: reason(value.reason),
        },
      }),
    );
  }

  assignmentAction(input: any) {
    const action = String(input.value?.action ?? "");
    if (!["suspend", "resume", "end"].includes(action))
      throw new CommercialError("assignment_action_invalid", 400, "选择暂停、恢复或结束。");
    return repositoryCall(
      this.repository.assignmentAction({
        ...input,
        id: randomUUID(),
        assignmentId: uuid(input.assignmentId, "assignment_id"),
        route: "POST:/api/v1/platform/commercial/assignments/:id/actions",
        value: {
          action,
          expected_version: version(input.value?.expected_version),
          reason: reason(input.value?.reason),
        },
      }),
    );
  }

  adjust(input: any) {
    const value = input.value ?? {};
    const quotaKey = String(value.quota_key ?? "");
    const delta = Number(value.delta_value);
    if (
      !quotaKeys.has(quotaKey) ||
      !Number.isSafeInteger(delta) ||
      delta === 0 ||
      Math.abs(delta) > 1_000_000_000
    )
      throw new CommercialError(
        "quota_adjustment_invalid",
        400,
        "选择已支持计量项，并填写非零整数调整值。",
      );
    const effectiveAt = value.effective_at ? date(value.effective_at, "effective_at") : new Date();
    const expiresAt = value.expires_at ? date(value.expires_at, "expires_at") : null;
    if (expiresAt && expiresAt <= effectiveAt)
      throw new CommercialError("adjustment_period_invalid", 400, "失效时间必须晚于生效时间。");
    return repositoryCall(
      this.repository.adjust({
        ...input,
        id: randomUUID(),
        route: "POST:/api/v1/platform/commercial/adjustments",
        value: {
          organization_id: uuid(value.organization_id, "organization_id"),
          assignment_id: uuid(value.assignment_id, "assignment_id"),
          quota_key: quotaKey,
          delta_value: delta,
          effective_at: effectiveAt,
          expires_at: expiresAt,
          reason: reason(value.reason),
        },
      }),
    );
  }

  revokeAdjustment(input: any) {
    return repositoryCall(
      this.repository.revokeAdjustment({
        ...input,
        id: randomUUID(),
        adjustmentId: uuid(input.adjustmentId, "adjustment_id"),
        route: "POST:/api/v1/platform/commercial/adjustments/:id/revoke",
        value: {
          expected_version: version(input.value?.expected_version),
          reason: reason(input.value?.reason),
        },
      }),
    );
  }
}
