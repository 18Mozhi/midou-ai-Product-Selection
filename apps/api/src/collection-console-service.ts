export class CollectionConsoleError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
    message = code,
  ) {
    super(message);
    this.name = "CollectionConsoleError";
  }
}

export interface CollectionConsoleRepository {
  read(input: Record<string, unknown>): Promise<unknown>;
}

const uuid = (value: unknown, field: string) => {
  const normalized = String(value ?? "");
  if (
    normalized &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
  )
    throw new CollectionConsoleError(
      "collection_console_scope_invalid",
      400,
      `提交有效${field}标识。`,
    );
  return normalized || null;
};

const windowValue = (value: unknown) => {
  const normalized = String(value ?? "24h");
  if (!["24h", "7d", "30d", "all"].includes(normalized))
    throw new CollectionConsoleError(
      "collection_console_window_invalid",
      400,
      "选择 24 小时、7 天、30 天或全部时间。",
    );
  return normalized;
};

const errorCode = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  if (normalized && !/^[A-Za-z0-9._:-]{1,80}$/.test(normalized))
    throw new CollectionConsoleError(
      "collection_console_error_code_invalid",
      400,
      "选择控制台返回的错误根因。",
    );
  return normalized || null;
};

const pageValue = (value: unknown, field: string) => {
  const normalized = String(value ?? "1").trim();
  if (!/^\d{1,6}$/.test(normalized) || Number(normalized) < 1)
    throw new CollectionConsoleError(
      "collection_console_page_invalid",
      400,
      `提交有效${field}页码。`,
    );
  return Number(normalized);
};

export class CollectionConsoleService {
  constructor(
    private readonly repo: CollectionConsoleRepository,
    private readonly recentLimit = 50,
  ) {}

  read(input: Record<string, unknown>) {
    return this.repo.read({
      ...input,
      organizationId: uuid(input.organizationId, "组织"),
      workspaceId: uuid(input.workspaceId, "工作区"),
      providerId: uuid(input.providerId, "来源"),
      window: windowValue(input.window),
      errorCode: errorCode(input.errorCode),
      attemptPage: pageValue(input.attemptPage, "尝试记录"),
      deadLetterPage: pageValue(input.deadLetterPage, "死信记录"),
      recentLimit: this.recentLimit,
    });
  }
}
