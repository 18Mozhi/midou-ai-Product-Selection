import { ApiError } from "./api-foundation.js";

export interface PersonalCenterRepository {
  profile(input: { userId: string }): Promise<unknown>;
  updateProfile(input: {
    userId: string;
    organizationId: string;
    workspaceId: string;
    displayName: string;
    avatarUrl: string | null;
    phone: string | null;
    locale: string;
    timezone: string;
    expectedVersion: number;
    reason: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<unknown>;
  assets(input: { userId: string; organizationId: string; workspaceId: string }): Promise<unknown>;
}

export class PersonalCenterError extends ApiError {
  constructor(code: string, statusCode: number, actionHint: string) {
    super(statusCode, code, code, actionHint);
    this.name = "PersonalCenterError";
  }
}

const text = (value: unknown, field: string, max: number) => {
  const result = String(value ?? "").trim();
  if (!result || result.length > max)
    throw new PersonalCenterError(`${field}_invalid`, 400, `填写 1–${max} 个字符。`);
  return result;
};

export class PersonalCenterService {
  constructor(
    private readonly repository: PersonalCenterRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  profile(userId: string) {
    return this.repository.profile({ userId });
  }

  assets(userId: string, organizationId: string, workspaceId: string) {
    return this.repository.assets({ userId, organizationId, workspaceId });
  }

  update(
    value: any,
    context: {
      userId: string;
      organizationId: string;
      workspaceId: string;
      idempotencyKey: string;
      requestId: string;
      traceId: string;
    },
  ) {
    const avatarUrl = String(value?.avatar_url ?? "").trim();
    if (avatarUrl && !/^https:\/\//i.test(avatarUrl))
      throw new PersonalCenterError("avatar_url_invalid", 400, "头像地址必须使用 HTTPS。 ");
    const phone = String(value?.phone ?? "").trim();
    if (phone && !/^\+?[0-9 -]{6,30}$/.test(phone))
      throw new PersonalCenterError(
        "phone_invalid",
        400,
        "手机号只允许国际区号、数字、空格和连字符。 ",
      );
    const expectedVersion = Number(value?.expected_version);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0)
      throw new PersonalCenterError("profile_version_invalid", 400, "刷新个人资料后重试。 ");
    const reason = text(value?.reason, "reason", 300);
    return this.repository.updateProfile({
      ...context,
      displayName: text(value?.display_name, "display_name", 120),
      avatarUrl: avatarUrl || null,
      phone: phone || null,
      locale: text(value?.locale, "locale", 20),
      timezone: text(value?.timezone, "timezone", 64),
      expectedVersion,
      reason,
      now: this.now(),
    });
  }
}
