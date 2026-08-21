import { createHash, randomBytes, randomUUID } from "node:crypto";
import { sealCredential } from "@scoutops/credentials";

export class OpenPlatformError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
    message = code,
  ) {
    super(message);
    this.name = "OpenPlatformError";
  }
}
const uuid = (v: unknown, label: string) => {
  const x = String(v ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x))
    throw new OpenPlatformError(`${label}_invalid`, 400, "提交有效资源标识。");
  return x;
};
const text = (v: unknown, label: string, max: number) => {
  const x = String(v ?? "").trim();
  if (!x || x.length > max)
    throw new OpenPlatformError(`${label}_invalid`, 400, `填写 1–${max} 个字符。`);
  return x;
};
const reason = (v: unknown) => text(v, "reason", 500);
const allowedScopes = new Set(["status:read"]),
  allowedEvents = new Set([
    "scoutops.test",
    "task.updated",
    "approval.updated",
    "competitor.changed",
  ]);
const target = (v: unknown) => {
  let u: URL;
  try {
    u = new URL(String(v ?? ""));
  } catch {
    throw new OpenPlatformError("webhook_url_invalid", 400, "填写有效 HTTPS 地址。");
  }
  if (u.protocol !== "https:" || u.username || u.password || u.hash || (u.port && u.port !== "443"))
    throw new OpenPlatformError(
      "webhook_url_invalid",
      400,
      "Webhook 仅允许无凭证、无片段的 HTTPS 443 地址。",
    );
  return u.toString();
};
const list = (v: unknown, allowed: Set<string>, code: string) => {
  const a = Array.isArray(v) ? [...new Set(v.map(String))] : [];
  if (!a.length || a.some((x) => !allowed.has(x)))
    throw new OpenPlatformError(code, 400, "选择已开放的最小权限范围。");
  return a;
};
export interface OpenPlatformRepository {
  overview(i: any): Promise<any>;
  createClient(i: any): Promise<any>;
  clientAction(i: any): Promise<any>;
  createWebhook(i: any): Promise<any>;
  updateWebhook(i: any): Promise<any>;
  rotateWebhook(i: any): Promise<any>;
  enqueue(i: any): Promise<any>;
  replay(i: any): Promise<any>;
  authenticate(i: any): Promise<any>;
  recordRejectedAuth(i: any): Promise<boolean>;
  recordUsage(i: any): Promise<void>;
}
export class OpenPlatformService {
  constructor(
    private readonly repo: OpenPlatformRepository,
    private readonly masterKey: string,
    private readonly keyVersion: string,
    private readonly p: {
      clientTtlDays: number;
      defaultQuota: number;
      maxQuota: number;
      timestampToleranceSeconds: number;
      nonceTtlSeconds: number;
    },
    private readonly now = () => new Date(),
  ) {}
  overview(i: any) {
    return this.repo.overview(i);
  }
  createClient(i: any) {
    const v = i.value ?? {},
      quota = Number(v.quota_per_minute ?? this.p.defaultQuota);
    if (!Number.isInteger(quota) || quota < 1 || quota > this.p.maxQuota)
      throw new OpenPlatformError(
        "client_quota_invalid",
        400,
        `每分钟配额必须为 1–${this.p.maxQuota}。`,
      );
    const secret = `sco_open_${randomBytes(32).toString("base64url")}`;
    return this.repo.createClient({
      ...i,
      id: randomUUID(),
      route: "POST:/api/v1/platform/open/clients",
      value: {
        organization_id: uuid(v.organization_id, "organization_id"),
        name: text(v.name, "client_name", 120),
        scopes: list(v.scopes, allowedScopes, "client_scope_invalid"),
        quota_per_minute: quota,
        client_prefix: secret.slice(0, 20),
        secret_hash: createHash("sha256").update(secret).digest("hex"),
        secret,
        expires_at: new Date(this.now().getTime() + this.p.clientTtlDays * 86400000),
        reason: reason(v.reason),
      },
    });
  }
  clientAction(i: any) {
    const action = String(i.value?.action ?? "");
    if (!["rotate", "revoke"].includes(action))
      throw new OpenPlatformError("client_action_invalid", 400, "选择轮换或撤销。");
    const secret = action === "rotate" ? `sco_open_${randomBytes(32).toString("base64url")}` : null;
    return this.repo.clientAction({
      ...i,
      id: randomUUID(),
      clientId: uuid(i.clientId, "client_id"),
      route: "POST:/api/v1/platform/open/clients/:id/actions",
      value: {
        action,
        expected_version: Number(i.value?.expected_version),
        reason: reason(i.value?.reason),
        secret,
        client_prefix: secret?.slice(0, 20),
        secret_hash: secret ? createHash("sha256").update(secret).digest("hex") : null,
        expires_at: new Date(this.now().getTime() + this.p.clientTtlDays * 86400000),
      },
    });
  }
  createWebhook(i: any) {
    const v = i.value ?? {},
      id = randomUUID(),
      secret = `whsec_${randomBytes(32).toString("base64url")}`,
      sealed = sealCredential({ encoding: "utf8", value: secret }, this.masterKey, {
        assetId: id,
        assetVersion: 1,
        kind: "webhook_signing",
        keyVersion: this.keyVersion,
      });
    return this.repo.createWebhook({
      ...i,
      id,
      route: "POST:/api/v1/platform/open/webhooks",
      value: {
        organization_id: uuid(v.organization_id, "organization_id"),
        name: text(v.name, "webhook_name", 120),
        target_url: target(v.target_url),
        events: list(v.events, allowedEvents, "webhook_events_invalid"),
        secret,
        key_version: this.keyVersion,
        ...sealed,
        reason: reason(v.reason),
      },
    });
  }
  updateWebhook(i: any) {
    const v = i.value ?? {};
    return this.repo.updateWebhook({
      ...i,
      id: randomUUID(),
      endpointId: uuid(i.endpointId, "endpoint_id"),
      route: "PATCH:/api/v1/platform/open/webhooks/:id",
      value: {
        name: text(v.name, "webhook_name", 120),
        target_url: target(v.target_url),
        events: list(v.events, allowedEvents, "webhook_events_invalid"),
        status: ["active", "disabled"].includes(String(v.status))
          ? String(v.status)
          : (() => {
              throw new OpenPlatformError("webhook_status_invalid", 400, "选择启用或停用。");
            })(),
        expected_version: Number(v.expected_version),
        reason: reason(v.reason),
      },
    });
  }
  rotateWebhook(i: any) {
    const endpointId = uuid(i.endpointId, "endpoint_id"),
      version = Number(i.value?.expected_version) + 1,
      secret = `whsec_${randomBytes(32).toString("base64url")}`,
      sealed = sealCredential({ encoding: "utf8", value: secret }, this.masterKey, {
        assetId: endpointId,
        assetVersion: version,
        kind: "webhook_signing",
        keyVersion: this.keyVersion,
      });
    return this.repo.rotateWebhook({
      ...i,
      id: randomUUID(),
      endpointId,
      route: "POST:/api/v1/platform/open/webhooks/:id/rotate",
      value: {
        expected_version: Number(i.value?.expected_version),
        reason: reason(i.value?.reason),
        secret,
        key_version: this.keyVersion,
        ...sealed,
      },
    });
  }
  enqueue(i: any) {
    return this.repo.enqueue({
      ...i,
      id: randomUUID(),
      eventId: randomUUID(),
      endpointId: uuid(i.endpointId, "endpoint_id"),
      route: "POST:/api/v1/platform/open/webhooks/:id/test",
      value: { reason: reason(i.value?.reason) },
    });
  }
  replay(i: any) {
    return this.repo.replay({
      ...i,
      id: randomUUID(),
      deliveryId: uuid(i.deliveryId, "delivery_id"),
      route: "POST:/api/v1/platform/open/deliveries/:id/replay",
      value: { reason: reason(i.value?.reason) },
    });
  }
  async authenticate(i: any) {
    const token = String(i.authorization ?? "").replace(/^Bearer\s+/i, "");
    if (!token.startsWith("sco_open_") || token.length > 128)
      throw new OpenPlatformError("open_api_unauthorized", 401, "检查 API Client 密钥。");
    const secretHash = createHash("sha256").update(token).digest("hex"),
      ts = Number(i.timestamp),
      nonce = String(i.nonce ?? ""),
      rejected = async (error: OpenPlatformError) => {
        const limited = await this.repo.recordRejectedAuth({
          ...i,
          secretHash,
          statusCode: error.statusCode,
          now: this.now(),
        });
        if (limited)
          throw new OpenPlatformError("open_api_quota_exceeded", 429, "等待配额窗口恢复后重试。");
        throw error;
      };
    if (
      !Number.isInteger(ts) ||
      Math.abs(Math.floor(this.now().getTime() / 1000) - ts) > this.p.timestampToleranceSeconds
    )
      return rejected(
        new OpenPlatformError("open_api_timestamp_invalid", 401, "同步系统时间后重试。"),
      );
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce))
      return rejected(
        new OpenPlatformError(
          "open_api_nonce_invalid",
          401,
          "为每次请求生成 16–128 位唯一 nonce。",
        ),
      );
    return this.repo.authenticate({
      ...i,
      secretHash,
      timestamp: new Date(ts * 1000),
      nonce,
      nonceExpiresAt: new Date(this.now().getTime() + this.p.nonceTtlSeconds * 1000),
      now: this.now(),
    });
  }
  usage(i: any) {
    return this.repo.recordUsage({ ...i, id: randomUUID(), occurredAt: this.now() });
  }
}
