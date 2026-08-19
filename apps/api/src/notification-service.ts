export class NotificationServiceError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
    message = code,
  ) {
    super(message);
    this.name = "NotificationServiceError";
  }
}
const version = (v: unknown) => {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 1)
    throw new NotificationServiceError(
      "notification_version_invalid",
      400,
      "刷新后提交当前版本。",
    );
  return n;
};
export function validateNotificationAction(v: any) {
  if (!["read", "unread", "start", "close", "reopen"].includes(v?.action))
    throw new NotificationServiceError(
      "notification_action_invalid",
      400,
      "选择已读、未读、开始处理、关闭或重新打开。",
    );
  return { action: v.action, expected_version: version(v?.expected_version) };
}
export function validatePreferences(v: any) {
  const keys = [
      "in_app_enabled",
      "email_enabled",
      "task_enabled",
      "approval_enabled",
      "competitor_enabled",
    ] as const,
    result: any = { expected_version: version(v?.expected_version) };
  for (const key of keys) {
    if (typeof v?.[key] !== "boolean")
      throw new NotificationServiceError(
        "notification_preference_invalid",
        400,
        `修正 ${key}。`,
      );
    result[key] = v[key];
  }
  return result;
}
export interface NotificationRepository {
  list(i: any): Promise<any>;
  summary(i: any): Promise<any>;
  detail(i: any): Promise<any>;
  action(i: any): Promise<any>;
  markAll(i: any): Promise<any>;
  preferences(i: any): Promise<any>;
  updatePreferences(i: any): Promise<any>;
}
export class NotificationService {
  constructor(private readonly repo: NotificationRepository) {}
  list(i: any) {
    const page = Math.max(1, Number(i.page) || 1),
      pageSize = Math.min(200, Math.max(1, Number(i.pageSize) || 50));
    return this.repo.list({
      ...i,
      page,
      pageSize,
      unread: i.unread === "true",
      category: ["task", "approval", "competitor", "system"].includes(
        i.category,
      )
        ? i.category
        : null,
    });
  }
  summary(i: any) {
    return this.repo.summary(i);
  }
  detail(i: any) {
    return this.repo.detail(i);
  }
  action(i: any) {
    return this.repo.action({
      ...i,
      value: validateNotificationAction(i.value),
    });
  }
  markAll(i: any) {
    return this.repo.markAll(i);
  }
  preferences(i: any) {
    return this.repo.preferences(i);
  }
  updatePreferences(i: any) {
    return this.repo.updatePreferences({
      ...i,
      value: validatePreferences(i.value),
    });
  }
}
