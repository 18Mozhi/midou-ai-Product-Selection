export type PlatformDashboardWindow = "15m" | "24h" | "7d" | "30d";
export type PlatformManagementDomain =
  "content" | "notifications" | "email" | "status" | "data" | "governance";
export type PlatformDataEntity =
  "trends" | "opportunities" | "competitors" | "suppliers";
export interface PlatformDashboardRepository {
  read(input: {
    actorId: string;
    window: PlatformDashboardWindow;
    windowMinutes: number;
    requestId: string;
    traceId: string;
  }): Promise<unknown>;
  readManagement(input: {
    actorId: string;
    domain: PlatformManagementDomain;
    entity: PlatformDataEntity;
    query: string;
    status: string;
    requestId: string;
    traceId: string;
  }): Promise<unknown>;
  exportData(input: {
    actorId: string;
    entity: PlatformDataEntity;
    query: string;
    status: string;
    reason: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<unknown>;
  moderateTrend(input: {
    actorId: string;
    topicId: string;
    status: "active" | "irrelevant" | "stale";
    expectedVersion: number;
    reason: string;
    route: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<unknown>;
  manageEmailDelivery(input: {
    actorId: string;
    source: "account" | "notification";
    deliveryId: string;
    action: "retry" | "suppress";
    reason: string;
    route: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<unknown>;
}
export class PlatformDashboardError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
    message = code,
  ) {
    super(message);
    this.name = "PlatformDashboardError";
  }
}
const windows: Record<PlatformDashboardWindow, number> = {
  "15m": 15,
  "24h": 1440,
  "7d": 10080,
  "30d": 43200,
};
export class PlatformDashboardService {
  constructor(
    private readonly repository: PlatformDashboardRepository,
    private readonly defaultWindow: PlatformDashboardWindow = "24h",
    private readonly now: () => Date = () => new Date(),
  ) {}
  read(input: {
    actorId: string;
    window?: unknown;
    requestId: string;
    traceId: string;
  }) {
    const window = String(
      input.window ?? this.defaultWindow,
    ) as PlatformDashboardWindow;
    if (!(window in windows))
      throw new PlatformDashboardError(
        "platform_dashboard_window_invalid",
        400,
        "选择 15m、24h、7d 或 30d。",
      );
    return this.repository.read({
      ...input,
      window,
      windowMinutes: windows[window],
    });
  }
  management(input: {
    actorId: string;
    domain?: unknown;
    entity?: unknown;
    query?: unknown;
    status?: unknown;
    requestId: string;
    traceId: string;
  }) {
    const domain = String(input.domain ?? "status") as PlatformManagementDomain;
    if (
      ![
        "content",
        "notifications",
        "email",
        "status",
        "data",
        "governance",
      ].includes(domain)
    )
      throw new PlatformDashboardError(
        "platform_management_domain_invalid",
        400,
        "选择有效的管理页面。",
      );
    const entity = String(input.entity ?? "trends") as PlatformDataEntity,
      query = String(input.query ?? "").trim(),
      status = String(input.status ?? "").trim();
    if (
      domain === "data" &&
      !["trends", "opportunities", "competitors", "suppliers"].includes(entity)
    )
      throw new PlatformDashboardError(
        "platform_data_entity_invalid",
        400,
        "选择热点、机会、竞品或供应商数据。",
      );
    if (query.length > 120 || status.length > 40)
      throw new PlatformDashboardError(
        "platform_management_filter_invalid",
        400,
        "缩短筛选条件后重试。",
      );
    return this.repository.readManagement({
      ...input,
      domain,
      entity,
      query,
      status,
    });
  }
  exportData(
    value: any,
    context: { actorId: string; requestId: string; traceId: string },
  ) {
    const entity = String(value?.entity ?? "") as PlatformDataEntity,
      query = String(value?.query ?? "").trim(),
      status = String(value?.status ?? "").trim(),
      reason = String(value?.reason ?? "").trim();
    if (
      !["trends", "opportunities", "competitors", "suppliers"].includes(entity)
    )
      throw new PlatformDashboardError(
        "platform_data_entity_invalid",
        400,
        "选择热点、机会、竞品或供应商数据。",
      );
    if (query.length > 120 || status.length > 40)
      throw new PlatformDashboardError(
        "platform_management_filter_invalid",
        400,
        "缩短筛选条件后重试。",
      );
    if (reason.length < 2 || reason.length > 300)
      throw new PlatformDashboardError(
        "reason_invalid",
        400,
        "填写 2–300 字的导出原因。",
      );
    return this.repository.exportData({
      ...context,
      entity,
      query,
      status,
      reason,
      now: this.now(),
    });
  }
  moderateTrend(
    topicId: string,
    value: any,
    context: {
      actorId: string;
      idempotencyKey: string;
      requestId: string;
      traceId: string;
    },
  ) {
    if (!/^[0-9a-f-]{36}$/i.test(topicId))
      throw new PlatformDashboardError(
        "trend_topic_id_invalid",
        400,
        "刷新内容列表后重试。",
      );
    const status = String(value?.status ?? "") as
        "active" | "irrelevant" | "stale",
      expectedVersion = Number(value?.expected_version),
      reason = String(value?.reason ?? "").trim();
    if (!["active", "irrelevant", "stale"].includes(status))
      throw new PlatformDashboardError(
        "trend_topic_status_invalid",
        400,
        "选择展示、无关或过期。",
      );
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1)
      throw new PlatformDashboardError(
        "trend_topic_version_invalid",
        400,
        "刷新内容版本后重试。",
      );
    if (reason.length < 2 || reason.length > 300)
      throw new PlatformDashboardError(
        "reason_invalid",
        400,
        "填写 2–300 字的审核原因。",
      );
    return this.repository.moderateTrend({
      topicId,
      status,
      expectedVersion,
      reason,
      route: `/platform/management/content/${topicId}`,
      ...context,
      now: this.now(),
    });
  }
  manageEmailDelivery(
    sourceValue: unknown,
    deliveryId: string,
    value: any,
    context: {
      actorId: string;
      idempotencyKey: string;
      requestId: string;
      traceId: string;
    },
  ) {
    const source = String(sourceValue) as "account" | "notification";
    if (!["account", "notification"].includes(source))
      throw new PlatformDashboardError(
        "email_delivery_source_invalid",
        400,
        "刷新邮件列表后重试。",
      );
    if (!/^[0-9a-f-]{36}$/i.test(deliveryId))
      throw new PlatformDashboardError(
        "email_delivery_id_invalid",
        400,
        "刷新邮件列表后重试。",
      );
    const action = String(value?.action ?? "") as "retry" | "suppress";
    const reason = String(value?.reason ?? "").trim();
    if (!["retry", "suppress"].includes(action))
      throw new PlatformDashboardError(
        "email_delivery_action_invalid",
        400,
        "选择重新投递或抑制后重试。",
      );
    if (source === "account" && action === "suppress")
      throw new PlatformDashboardError(
        "account_email_suppress_forbidden",
        400,
        "账号验证和密码找回邮件不可抑制，可在故障恢复后重新投递。",
      );
    if (reason.length < 2 || reason.length > 300)
      throw new PlatformDashboardError(
        "reason_invalid",
        400,
        "填写 2–300 字的操作原因。",
      );
    return this.repository.manageEmailDelivery({
      source,
      deliveryId,
      action,
      reason,
      route: `/platform/management/email/${source}/${deliveryId}/actions`,
      ...context,
      now: this.now(),
    });
  }
}
