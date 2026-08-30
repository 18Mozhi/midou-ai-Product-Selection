export class SecurityOperationsError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
    message = code,
  ) {
    super(message);
    this.name = "SecurityOperationsError";
  }
}

export interface SecurityOperationsRepository {
  read(input: any): Promise<any>;
}

const windows: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720 };
const views = new Set(["events", "sessions", "credentials", "audit"]);
const statuses: Record<string, Set<string>> = {
  events: new Set(["succeeded", "failed", "blocked"]),
  sessions: new Set(["active", "revoked", "expired"]),
  credentials: new Set(["active", "revoked", "expired"]),
  audit: new Set(["succeeded", "failed", "blocked"]),
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

const pageNumber = (value: unknown, label: string, fallback: number, maximum: number) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum)
    throw new SecurityOperationsError(
      `security_operations_${label}_invalid`,
      400,
      `填写 1–${maximum} 的整数。`,
    );
  return parsed;
};

const optionalQuery = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  if (normalized.length > 120)
    throw new SecurityOperationsError(
      "security_operations_query_invalid",
      400,
      "搜索内容不能超过 120 个字符。",
    );
  return normalized;
};

export const rethrowSecurityOperationsDependency = (error: unknown): never => {
  if (databaseFailureCodes.has(String((error as { code?: unknown })?.code ?? "")))
    throw new SecurityOperationsError(
      "security_operations_dependency_unavailable",
      503,
      "安全运营数据库暂不可用，请稍后重试；页面会保留上次成功数据。",
    );
  throw error;
};

export class SecurityOperationsService {
  constructor(
    private readonly repo: SecurityOperationsRepository,
    private readonly defaultWindow = "24h",
    private readonly limit = 50,
  ) {}

  async read(input: any) {
    const window = String(input.window ?? this.defaultWindow);
    if (!windows[window])
      throw new SecurityOperationsError(
        "security_operations_window_invalid",
        400,
        "选择 24h、7d 或 30d。",
      );
    const view = String(input.view ?? "events");
    if (!views.has(view))
      throw new SecurityOperationsError(
        "security_operations_view_invalid",
        400,
        "选择事件、会话、访问与凭证或平台审计。",
      );
    const status = String(input.status ?? "");
    if (status && !statuses[view]?.has(status))
      throw new SecurityOperationsError(
        "security_operations_status_invalid",
        400,
        "选择当前视图支持的状态。",
      );
    const defaultPageSize = Math.min(20, this.limit),
      pageSize = pageNumber(input.pageSize, "page_size", defaultPageSize, this.limit),
      tokenPageSize = pageNumber(
        input.tokenPageSize,
        "token_page_size",
        defaultPageSize,
        this.limit,
      );
    try {
      return await this.repo.read({
        ...input,
        window,
        windowHours: windows[window],
        view,
        query: optionalQuery(input.query),
        status: status || null,
        page: pageNumber(input.page, "page", 1, 1_000_000),
        pageSize,
        tokenPage: pageNumber(input.tokenPage, "token_page", 1, 1_000_000),
        tokenPageSize,
      });
    } catch (error) {
      if (error instanceof SecurityOperationsError) throw error;
      rethrowSecurityOperationsDependency(error);
    }
  }
}
