import { randomUUID } from "node:crypto";
import type { ProviderDefinition, ProviderDefinitionInput } from "@scoutops/contracts";
export class ProviderRegistryError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
  ) {
    super(code);
    this.name = "ProviderRegistryError";
  }
}
export interface ProviderRegistryRepository {
  list(): Promise<ProviderDefinition[]>;
  create(input: {
    value: ProviderDefinitionInput & { terms_reviewed_at: string | null };
    actorId: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    id: string;
    now: Date;
  }): Promise<ProviderDefinition>;
  update(input: {
    id: string;
    value: ProviderDefinitionInput & { terms_reviewed_at: string | null };
    expectedVersion: number;
    actorId: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<ProviderDefinition>;
}
const modes = ["public_page", "public_rss", "authenticated_browser", "import", "manual"],
  statuses = ["draft", "disabled", "enabled"];
const termsReviewStatuses = ["pending", "approved", "rejected"];
function cleanList(value: string[], name: string) {
  if (!Array.isArray(value))
    throw new ProviderRegistryError(`${name}_invalid`, 400, `${name} 需要 1–100 项。`);
  const list = [
    ...new Set(value.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean)),
  ];
  if (!list.length || list.length > 100)
    throw new ProviderRegistryError(`${name}_invalid`, 400, `${name} 需要 1–100 项。`);
  return list;
}
function optionalHttpUrl(value: string | null) {
  if (value === null || value === "") return null;
  if (typeof value !== "string")
    throw new ProviderRegistryError(
      "healthcheck_url_invalid",
      400,
      "健康检查 URL 必须为 HTTP(S)。",
    );
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw 0;
    return value;
  } catch {
    throw new ProviderRegistryError(
      "healthcheck_url_invalid",
      400,
      "健康检查 URL 必须为 HTTP(S)。",
    );
  }
}
function optionalHttpsUrl(value: string | null) {
  if (value === null || value === "") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) throw 0;
    return url.toString();
  } catch {
    throw new ProviderRegistryError(
      "terms_reference_url_invalid",
      400,
      "平台条款参考地址必须为不含账号信息的 HTTPS URL。",
    );
  }
}
function validate(value: ProviderDefinitionInput, now: Date): ProviderDefinitionInput {
  if (!value || typeof value !== "object")
    throw new ProviderRegistryError("provider_input_invalid", 400, "来源技术合同不能为空。");
  if (typeof value.code !== "string" || !/^[a-z0-9_]{2,80}$/.test(value.code))
    throw new ProviderRegistryError(
      "provider_code_invalid",
      400,
      "code 仅允许小写字母、数字和下划线。",
    );
  if (typeof value.name !== "string" || value.name.trim().length < 2 || value.name.length > 160)
    throw new ProviderRegistryError("provider_name_invalid", 400, "名称需要 2–160 字符。");
  if (
    typeof value.access_mode !== "string" ||
    typeof value.status !== "string" ||
    !modes.includes(value.access_mode) ||
    !statuses.includes(value.status)
  )
    throw new ProviderRegistryError("provider_enum_invalid", 400, "接入模式或状态无效。");
  if (!termsReviewStatuses.includes(value.terms_review_status))
    throw new ProviderRegistryError("terms_review_status_invalid", 400, "平台条款复核状态无效。");
  if (
    typeof value.target_url !== "string" ||
    value.target_url.length < 1 ||
    value.target_url.length > 1000
  )
    throw new ProviderRegistryError("provider_url_invalid", 400, "目标 URL 需要 1–1000 字符。");
  if (!["import", "manual"].includes(value.access_mode)) {
    try {
      const url = new URL(value.target_url.replace(/\{[^}]+\}/g, "value"));
      if (!["http:", "https:"].includes(url.protocol)) throw 0;
    } catch {
      throw new ProviderRegistryError(
        "provider_url_invalid",
        400,
        "目标 URL 必须为 HTTP(S) 技术合同。",
      );
    }
  }
  for (const [k, v, min, max] of [
    ["schedule_minutes", value.schedule_minutes, 1, 10080],
    ["concurrency_limit", value.concurrency_limit, 1, 20],
    ["timeout_ms", value.timeout_ms, 1000, 120000],
    ["retry_limit", value.retry_limit, 0, 10],
    ["circuit_failure_threshold", value.circuit_failure_threshold, 1, 20],
    ["retention_days", value.retention_days, 1, 3650],
  ] as const)
    if (!Number.isInteger(v) || v < min || v > max)
      throw new ProviderRegistryError(`provider_${k}_invalid`, 400, `${k} 超出允许范围。`);
  if (
    typeof value.dedupe_key !== "string" ||
    value.dedupe_key.trim().length < 1 ||
    value.dedupe_key.length > 255
  )
    throw new ProviderRegistryError("dedupe_key_invalid", 400, "去重键需要 1–255 字符。");
  if (
    typeof value.parser_version !== "string" ||
    !/^[A-Za-z0-9._-]{1,80}$/.test(value.parser_version)
  )
    throw new ProviderRegistryError("parser_version_invalid", 400, "Parser 版本格式无效。");
  if (
    typeof value.owner_label !== "string" ||
    value.owner_label.trim().length < 2 ||
    value.owner_label.length > 120
  )
    throw new ProviderRegistryError("owner_label_invalid", 400, "负责人需要 2–120 字符。");
  const termsReferenceUrl = optionalHttpsUrl(value.terms_reference_url),
    termsVersion = value.terms_version == null ? null : String(value.terms_version).trim(),
    termsExpiry = value.terms_expires_at == null ? null : new Date(value.terms_expires_at);
  if (termsVersion !== null && !/^[A-Za-z0-9._:-]{1,80}$/.test(termsVersion))
    throw new ProviderRegistryError(
      "terms_version_invalid",
      400,
      "条款版本仅允许 1–80 位字母、数字、点、下划线、冒号或短横线。",
    );
  if (termsExpiry !== null && !Number.isFinite(termsExpiry.getTime()))
    throw new ProviderRegistryError("terms_expiry_invalid", 400, "填写有效的条款到期时间。");
  if (
    ["public_page", "public_rss"].includes(value.access_mode) &&
    value.status === "enabled" &&
    (value.terms_review_status !== "approved" ||
      !termsReferenceUrl ||
      !termsVersion ||
      !termsExpiry ||
      termsExpiry <= now)
  )
    throw new ProviderRegistryError(
      "public_source_compliance_required",
      409,
      "公开来源启用前必须批准平台条款，并登记 HTTPS 参考地址、版本和未来到期时间。",
    );
  return {
    ...value,
    name: value.name.trim(),
    markets: cleanList(value.markets, "markets"),
    languages: cleanList(value.languages, "languages"),
    fields: cleanList(value.fields, "fields"),
    failure_rules: cleanList(value.failure_rules, "failure_rules"),
    dedupe_key: value.dedupe_key.trim(),
    healthcheck_url: optionalHttpUrl(value.healthcheck_url),
    owner_label: value.owner_label.trim(),
    terms_reference_url: termsReferenceUrl,
    terms_version: termsVersion,
    terms_expires_at: termsExpiry?.toISOString() ?? null,
  };
}
export class ProviderRegistryService {
  constructor(
    private readonly repository: ProviderRegistryRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}
  list() {
    return this.repository.list();
  }
  create(
    value: ProviderDefinitionInput,
    context: {
      actorId: string;
      idempotencyKey: string;
      requestId: string;
      traceId: string;
    },
  ) {
    const now = this.now(),
      validated = validate(value, now);
    return this.repository.create({
      ...context,
      value: {
        ...validated,
        terms_reviewed_at: validated.terms_review_status === "pending" ? null : now.toISOString(),
      },
      id: randomUUID(),
      now,
    });
  }
  update(
    id: string,
    value: ProviderDefinitionInput,
    expectedVersion: number,
    context: {
      actorId: string;
      idempotencyKey: string;
      requestId: string;
      traceId: string;
    },
  ) {
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1)
      throw new ProviderRegistryError(
        "provider_version_invalid",
        400,
        "expected_version 必须为正整数。",
      );
    const now = this.now(),
      validated = validate(value, now);
    return this.repository.update({
      id,
      value: {
        ...validated,
        terms_reviewed_at: validated.terms_review_status === "pending" ? null : now.toISOString(),
      },
      expectedVersion,
      ...context,
      now,
    });
  }
}
