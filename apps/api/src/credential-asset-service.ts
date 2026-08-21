import { randomUUID } from "node:crypto";
import { sealCredential, type CredentialCipherRecord } from "@scoutops/credentials";
import type {
  CrawlerProfileInput,
  CrawlerProfileSummary,
  CredentialAssetCreateInput,
  CredentialAssetSummary,
  CredentialSecretInput,
} from "@scoutops/contracts";
export class CredentialAssetError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
  ) {
    super(code);
    this.name = "CredentialAssetError";
  }
}
interface Context {
  actorId: string;
  idempotencyKey: string;
  requestId: string;
  traceId: string;
}
interface Sealed {
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
  fingerprint: string;
}
export interface CredentialAssetRepository {
  listAssets(): Promise<CredentialAssetSummary[]>;
  listProviderOptions(): Promise<
    {
      id: string;
      code: string;
      name: string;
      target_url: string;
      access_mode: string;
    }[]
  >;
  getCipherRecord(
    id: string,
  ): Promise<CredentialCipherRecord & { summary: CredentialAssetSummary }>;
  createAsset(input: {
    id: string;
    value: Omit<CredentialAssetCreateInput, "secret_payload">;
    sealed: Sealed;
    keyVersion: string;
    actorId: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<CredentialAssetSummary>;
  rotateAsset(input: {
    id: string;
    expectedVersion: number;
    sealed: Sealed;
    keyVersion: string;
    expiresAt: string | null;
    actorId: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<CredentialAssetSummary>;
  revokeAsset(input: {
    id: string;
    expectedVersion: number;
    reason: string;
    actorId: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<CredentialAssetSummary>;
  listProfiles(): Promise<CrawlerProfileSummary[]>;
  createProfile(input: {
    id: string;
    value: CrawlerProfileInput;
    actorId: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<CrawlerProfileSummary>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  kinds = ["api_key", "account_secret", "cookie_bundle", "private_key", "browser_profile"];
type CookieSameSite = "Strict" | "Lax" | "None";
interface NormalizedCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: CookieSameSite;
}
const cookieText = (value: unknown, field: string, maximum: number) => {
  if (typeof value !== "string" || !value.trim() || value.length > maximum)
    throw new CredentialAssetError("credential_cookie_invalid", 400, `Cookie ${field} 格式无效。`);
  return value.trim();
};
const normalizeSameSite = (value: unknown): CookieSameSite | undefined => {
  if (value == null || value === "") return undefined;
  const normalized = String(value).toLowerCase();
  if (normalized === "strict") return "Strict";
  if (normalized === "lax") return "Lax";
  if (["none", "no_restriction"].includes(normalized)) return "None";
  if (normalized === "unspecified") return undefined;
  throw new CredentialAssetError(
    "credential_cookie_invalid",
    400,
    "Cookie sameSite 只支持 Strict、Lax 或 None。",
  );
};
const normalizeCookie = (input: Record<string, unknown>): NormalizedCookie => {
  const domain = cookieText(input.domain, "domain", 255).toLowerCase();
  if (!/^\.?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(domain) || domain.includes(".."))
    throw new CredentialAssetError("credential_cookie_invalid", 400, "Cookie domain 格式无效。");
  const rawExpires = input.expires ?? input.expirationDate;
  const expires = rawExpires == null ? undefined : Number(rawExpires);
  if (expires !== undefined && (!Number.isFinite(expires) || (expires < 0 && expires !== -1)))
    throw new CredentialAssetError("credential_cookie_invalid", 400, "Cookie expires 格式无效。");
  const sameSite = normalizeSameSite(input.sameSite);
  return {
    name: cookieText(input.name, "name", 256),
    value: typeof input.value === "string" ? input.value : "",
    domain,
    path:
      typeof input.path === "string" && input.path.startsWith("/")
        ? input.path.slice(0, 1024)
        : "/",
    ...(expires !== undefined && expires > 0 ? { expires } : {}),
    ...(input.httpOnly != null ? { httpOnly: Boolean(input.httpOnly) } : {}),
    ...(input.secure != null ? { secure: Boolean(input.secure) } : {}),
    ...(sameSite ? { sameSite } : {}),
  };
};
const parseNetscapeCookies = (raw: string) => {
  const cookies: NormalizedCookie[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || (trimmed.startsWith("#") && !trimmed.startsWith("#HttpOnly_"))) continue;
    const values = trimmed.split("\t");
    if (values.length !== 7)
      throw new CredentialAssetError(
        "credential_cookie_invalid",
        400,
        "Netscape cookies.txt 每行必须包含 7 列。",
      );
    const httpOnly = values[0]!.startsWith("#HttpOnly_");
    const domain = httpOnly ? values[0]!.slice(10) : values[0]!;
    cookies.push(
      normalizeCookie({
        domain,
        path: values[2],
        secure: values[3]?.toUpperCase() === "TRUE",
        expires: Number(values[4] || 0),
        name: values[5],
        value: values[6] ?? "",
        httpOnly,
      }),
    );
  }
  return cookies;
};
export function normalizeCookieBundle(raw: string): CredentialSecretInput {
  if (typeof raw !== "string" || !raw.trim() || raw.length > 2_000_000)
    throw new CredentialAssetError(
      "credential_cookie_invalid",
      400,
      "Cookie 文件不能为空且不能超过 2 兆字符。",
    );
  let cookies: NormalizedCookie[];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | Array<Record<string, unknown>>;
    const values = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.cookies)
        ? (parsed.cookies as Array<Record<string, unknown>>)
        : [];
    cookies = values.map(normalizeCookie);
  } catch (error) {
    if (error instanceof CredentialAssetError) throw error;
    cookies = parseNetscapeCookies(raw);
  }
  if (!cookies.length || cookies.length > 500)
    throw new CredentialAssetError(
      "credential_cookie_invalid",
      400,
      "Cookie 文件需包含 1–500 条有效记录。",
    );
  const identities = new Set<string>();
  const unique = cookies.filter((cookie) => {
    const key = `${cookie.domain}\0${cookie.path}\0${cookie.name}`;
    if (identities.has(key)) return false;
    identities.add(key);
    return true;
  });
  return {
    encoding: "utf8",
    value: JSON.stringify({ format: "scoutops-cookie-bundle-v1", cookies: unique }),
  };
}
function secret(value: CredentialSecretInput, kind?: string) {
  if (
    !value ||
    !["utf8", "base64"].includes(value.encoding) ||
    typeof value.value !== "string" ||
    value.value.length < 1 ||
    value.value.length > 8_000_000
  )
    throw new CredentialAssetError(
      "credential_payload_invalid",
      400,
      "凭证内容不能为空；网页登录档案压缩后不超过 6 兆字节。",
    );
  if (value.encoding === "base64" && !/^[A-Za-z0-9+/]*={0,2}$/.test(value.value))
    throw new CredentialAssetError("credential_payload_invalid", 400, "base64 载荷格式无效。");
  if (kind === "cookie_bundle") {
    if (value.encoding !== "utf8")
      throw new CredentialAssetError(
        "credential_cookie_invalid",
        400,
        "Cookie 档案请使用 JSON、Playwright storageState 或 Netscape cookies.txt。",
      );
    return normalizeCookieBundle(value.value);
  }
  return value;
}
function createInput(value: CredentialAssetCreateInput, now: Date) {
  if (!value || !uuid.test(value.provider_id))
    throw new CredentialAssetError(
      "credential_provider_invalid",
      400,
      "provider_id 必须是已登记来源 UUID。",
    );
  if (typeof value.name !== "string" || value.name.trim().length < 2 || value.name.length > 160)
    throw new CredentialAssetError("credential_name_invalid", 400, "名称需要 2–160 字符。");
  if (!kinds.includes(value.kind))
    throw new CredentialAssetError("credential_kind_invalid", 400, "凭证类型无效。");
  let expires_at: string | null = null;
  if (value.expires_at !== null) {
    const date = new Date(value.expires_at);
    if (!Number.isFinite(date.getTime()) || date <= now)
      throw new CredentialAssetError(
        "credential_expiry_invalid",
        400,
        "到期时间必须晚于当前时间。",
      );
    expires_at = date.toISOString();
  }
  return {
    provider_id: value.provider_id,
    name: value.name.trim(),
    kind: value.kind,
    expires_at,
    secret_payload: secret(value.secret_payload, value.kind),
  };
}
function expiry(value: unknown, now: Date) {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime()) || date <= now)
    throw new CredentialAssetError("credential_expiry_invalid", 400, "到期时间必须晚于当前时间。");
  return date.toISOString();
}
function cookieDomains(payload: CredentialSecretInput) {
  if (payload.encoding !== "utf8") return [];
  const parsed = JSON.parse(payload.value) as {
    cookies?: Array<{ domain?: unknown }>;
  };
  return (parsed.cookies ?? []).map((cookie) => String(cookie.domain ?? ""));
}
async function validateProviderDomains(
  repository: CredentialAssetRepository,
  providerId: string,
  payload: CredentialSecretInput,
) {
  const provider = (await repository.listProviderOptions()).find((item) => item.id === providerId);
  if (!provider)
    throw new CredentialAssetError(
      "credential_provider_invalid",
      400,
      "选择已登记且可配置凭证的来源。",
    );
  let hostname: string;
  try {
    hostname = new URL(provider.target_url).hostname.toLowerCase();
  } catch {
    throw new CredentialAssetError(
      "credential_provider_target_invalid",
      409,
      "先修复来源定义中的目标网址，再绑定 Cookie。",
    );
  }
  const invalid = cookieDomains(payload).find((value) => {
    const domain = value.replace(/^\./, "").toLowerCase();
    return hostname !== domain && !hostname.endsWith(`.${domain}`);
  });
  if (invalid)
    throw new CredentialAssetError(
      "credential_cookie_domain_mismatch",
      400,
      `Cookie 域名 ${invalid} 与来源站点 ${hostname} 不匹配。`,
    );
}
function expected(value: number) {
  if (!Number.isInteger(value) || value < 1)
    throw new CredentialAssetError(
      "credential_version_invalid",
      400,
      "expected_version 必须为正整数。",
    );
  return value;
}
function profile(value: CrawlerProfileInput) {
  if (!value || !uuid.test(value.provider_id) || !uuid.test(value.credential_asset_id))
    throw new CredentialAssetError(
      "crawler_profile_reference_invalid",
      400,
      "来源与凭证引用必须是 UUID。",
    );
  if (!/^[a-z0-9_]{2,80}$/.test(value.code))
    throw new CredentialAssetError(
      "crawler_profile_code_invalid",
      400,
      "code 仅允许小写字母、数字和下划线。",
    );
  if (
    typeof value.name !== "string" ||
    value.name.trim().length < 2 ||
    value.name.length > 160 ||
    value.browser_family !== "chromium" ||
    !["active", "disabled"].includes(value.status)
  )
    throw new CredentialAssetError("crawler_profile_input_invalid", 400, "浏览器档案字段无效。");
  if (
    !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(value.locale) ||
    typeof value.timezone !== "string" ||
    value.timezone.length < 1 ||
    value.timezone.length > 80
  )
    throw new CredentialAssetError(
      "crawler_profile_locale_invalid",
      400,
      "locale 或 timezone 无效。",
    );
  return { ...value, name: value.name.trim() };
}
export class CredentialAssetService {
  constructor(
    private readonly repository: CredentialAssetRepository,
    private readonly masterKey: string,
    private readonly keyVersion: string,
    private readonly now: () => Date = () => new Date(),
  ) {}
  listAssets() {
    return this.repository.listAssets();
  }
  listProviderOptions() {
    return this.repository.listProviderOptions();
  }
  listProfiles() {
    return this.repository.listProfiles();
  }
  async createAsset(value: CredentialAssetCreateInput, context: Context) {
    if (this.masterKey.length < 32)
      throw new CredentialAssetError(
        "credential_master_key_unavailable",
        503,
        "在宝塔受限环境配置 CREDENTIALS_MASTER_KEY 后重启 Node API。",
      );
    const now = this.now(),
      clean = createInput(value, now),
      id = randomUUID(),
      sealed = sealCredential(clean.secret_payload, this.masterKey, {
        assetId: id,
        assetVersion: 1,
        kind: clean.kind,
        keyVersion: this.keyVersion,
      }),
      { secret_payload, ...metadata } = clean;
    if (clean.kind === "cookie_bundle")
      await validateProviderDomains(this.repository, clean.provider_id, clean.secret_payload);
    return this.repository.createAsset({
      id,
      value: metadata,
      sealed,
      keyVersion: this.keyVersion,
      ...context,
      now,
    });
  }
  async rotateAsset(
    id: string,
    value: {
      secret_payload: CredentialSecretInput;
      expected_version: number;
      expires_at?: string | null;
    },
    context: Context,
  ) {
    if (!uuid.test(id))
      throw new CredentialAssetError("credential_id_invalid", 400, "凭证 ID 无效。");
    if (this.masterKey.length < 32)
      throw new CredentialAssetError(
        "credential_master_key_unavailable",
        503,
        "在宝塔受限环境配置 CREDENTIALS_MASTER_KEY 后重启 Node API。",
      );
    const record = await this.repository.getCipherRecord(id);
    if (record.summary.status === "revoked")
      throw new CredentialAssetError("credential_revoked", 409, "已撤销凭证不能轮换。");
    const now = this.now(),
      normalizedSecret = secret(value.secret_payload, record.summary.kind),
      expiresAt = expiry(value.expires_at ?? record.summary.expires_at, now);
    if (record.summary.kind === "cookie_bundle")
      await validateProviderDomains(this.repository, record.summary.provider_id, normalizedSecret);
    const next = expected(value.expected_version) + 1,
      sealed = sealCredential(normalizedSecret, this.masterKey, {
        assetId: id,
        assetVersion: next,
        kind: record.summary.kind,
        keyVersion: this.keyVersion,
      });
    return this.repository.rotateAsset({
      id,
      expectedVersion: value.expected_version,
      sealed,
      keyVersion: this.keyVersion,
      expiresAt,
      ...context,
      now,
    });
  }
  revokeAsset(id: string, value: { expected_version: number; reason: string }, context: Context) {
    if (!uuid.test(id))
      throw new CredentialAssetError("credential_id_invalid", 400, "凭证 ID 无效。");
    expected(value.expected_version);
    if (
      typeof value.reason !== "string" ||
      value.reason.trim().length < 2 ||
      value.reason.length > 500
    )
      throw new CredentialAssetError(
        "credential_revocation_reason_invalid",
        400,
        "撤销原因需要 2–500 字符。",
      );
    return this.repository.revokeAsset({
      id,
      expectedVersion: value.expected_version,
      reason: value.reason.trim(),
      ...context,
      now: this.now(),
    });
  }
  createProfile(value: CrawlerProfileInput, context: Context) {
    return this.repository.createProfile({
      id: randomUUID(),
      value: profile(value),
      ...context,
      now: this.now(),
    });
  }
}
