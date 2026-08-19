export type ProviderAccessMode =
  "public_page" | "public_rss" | "authenticated_browser" | "import" | "manual";
export type AdapterHealthStatus = "ready" | "degraded" | "blocked";
export type JsonScalar = string | number | boolean | null;

export interface ProviderRuntimeDefinition {
  id: string;
  code: string;
  accessMode: ProviderAccessMode;
  targetUrl: string;
  parserVersion: string;
  timeoutMs: number;
  fields: string[];
}

export interface AdapterInvocationContext {
  requestId: string;
  traceId: string;
  organizationId: string;
  workspaceId: string;
  provider: ProviderRuntimeDefinition;
}

export interface AdapterHealthContext {
  requestId: string;
  traceId: string;
  provider: ProviderRuntimeDefinition;
}

export interface ProviderCollectRequest extends AdapterInvocationContext {
  cursor?: string;
  limit: number;
  target?: Record<string, unknown>;
}

export interface ProviderRawRecord {
  externalId: string;
  observedAt: string;
  evidenceRef: string;
  payload: unknown;
}

export interface ProviderCollectBatch {
  records: ProviderRawRecord[];
  nextCursor: string | null;
}

export interface ProviderNormalizedRecord {
  external_id: string;
  observed_at: string;
  canonical_url: string | null;
  fields: Record<string, JsonScalar>;
  evidence_ref: string;
  provenance: {
    provider_id: string;
    adapter_key: string;
    adapter_version: string;
    parser_version: string;
  };
}

export interface AdapterHealthSignal {
  status: AdapterHealthStatus;
  latencyMs: number;
  errorCode: string | null;
  message: string;
}

export interface ProviderAdapter {
  readonly key: string;
  readonly accessMode: ProviderAccessMode;
  readonly version: string;
  collect(
    request: ProviderCollectRequest,
    signal: AbortSignal,
  ): Promise<ProviderCollectBatch>;
  normalize(
    record: ProviderRawRecord,
    context: AdapterInvocationContext,
  ): ProviderNormalizedRecord;
  healthCheck(
    context: AdapterHealthContext,
    signal: AbortSignal,
  ): Promise<AdapterHealthSignal>;
}

export interface ProviderAdapterLimits {
  maxItemsPerBatch: number;
  maxResponseBytes: number;
  healthTimeoutMs: number;
}

export class ProviderAdapterFailure extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message = code,
  ) {
    super(message);
    this.name = "ProviderAdapterFailure";
  }
}

export interface ClassifiedAdapterFailure {
  code: string;
  retryable: boolean;
  status: AdapterHealthStatus;
}

const accessModes: ProviderAccessMode[] = [
  "public_page",
  "public_rss",
  "authenticated_browser",
  "import",
  "manual",
];
const iso = (value: string) => Number.isFinite(Date.parse(value));
const identifier = (value: string) => /^[A-Za-z0-9._:-]{1,255}$/.test(value);
const uuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

export function classifyProviderAdapterFailure(
  error: unknown,
): ClassifiedAdapterFailure {
  const structured =
    error instanceof ProviderAdapterFailure
      ? error
      : error instanceof Error &&
          error.name === "ProviderAdapterFailure" &&
          typeof (error as Error & { code?: unknown }).code === "string" &&
          typeof (error as Error & { retryable?: unknown }).retryable === "boolean"
        ? (error as Error & { code: string; retryable: boolean })
        : null;
  if (structured) {
    const blocked = [
      "adapter_not_registered",
      "adapter_mode_mismatch",
      "login_expired",
      "invalid_payload",
      "response_too_large",
    ].includes(structured.code);
    return {
      code: structured.code,
      retryable: structured.retryable,
      status: blocked ? "blocked" : "degraded",
    };
  }
  if (error instanceof Error && error.name === "AbortError")
    return { code: "timeout", retryable: true, status: "degraded" };
  return {
    code: "dependency_unavailable",
    retryable: true,
    status: "degraded",
  };
}

export class ProviderAdapterRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();

  constructor(readonly limits: ProviderAdapterLimits) {
    if (
      !Number.isSafeInteger(limits.maxItemsPerBatch) ||
      limits.maxItemsPerBatch < 1 ||
      limits.maxItemsPerBatch > 5000
    )
      throw new ProviderAdapterFailure("adapter_limit_invalid", false);
    if (
      !Number.isSafeInteger(limits.maxResponseBytes) ||
      limits.maxResponseBytes < 1024 ||
      limits.maxResponseBytes > 100_000_000
    )
      throw new ProviderAdapterFailure("adapter_limit_invalid", false);
    if (
      !Number.isSafeInteger(limits.healthTimeoutMs) ||
      limits.healthTimeoutMs < 100 ||
      limits.healthTimeoutMs > 120_000
    )
      throw new ProviderAdapterFailure("adapter_limit_invalid", false);
  }

  register(adapter: ProviderAdapter): this {
    if (
      !identifier(adapter.key) ||
      !identifier(adapter.version) ||
      !accessModes.includes(adapter.accessMode)
    )
      throw new ProviderAdapterFailure("adapter_contract_invalid", false);
    if (this.adapters.has(adapter.key))
      throw new ProviderAdapterFailure("adapter_duplicate", false);
    this.adapters.set(adapter.key, adapter);
    return this;
  }

  has(key: string, accessMode?: ProviderAccessMode): boolean {
    const adapter = this.adapters.get(key);
    return Boolean(
      adapter && (!accessMode || adapter.accessMode === accessMode),
    );
  }

  describe(): Array<{
    key: string;
    access_mode: ProviderAccessMode;
    version: string;
  }> {
    return [...this.adapters.values()]
      .map((adapter) => ({
        key: adapter.key,
        access_mode: adapter.accessMode,
        version: adapter.version,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  private resolve(provider: ProviderRuntimeDefinition): ProviderAdapter {
    const adapter = this.adapters.get(provider.code);
    if (!adapter)
      throw new ProviderAdapterFailure("adapter_not_registered", false);
    if (adapter.accessMode !== provider.accessMode)
      throw new ProviderAdapterFailure("adapter_mode_mismatch", false);
    return adapter;
  }

  async collect(
    request: ProviderCollectRequest,
  ): Promise<ProviderCollectBatch> {
    if (
      !uuid(request.organizationId) ||
      !uuid(request.workspaceId) ||
      !Number.isSafeInteger(request.limit) ||
      request.limit < 1 ||
      request.limit > this.limits.maxItemsPerBatch
    )
      throw new ProviderAdapterFailure("collect_scope_or_limit_invalid", false);
    const adapter = this.resolve(request.provider);
    const batch = await this.withTimeout(request.provider.timeoutMs, (signal) =>
      adapter.collect(request, signal),
    );
    if (
      !batch ||
      !Array.isArray(batch.records) ||
      batch.records.length > request.limit ||
      batch.records.length > this.limits.maxItemsPerBatch
    )
      throw new ProviderAdapterFailure("invalid_payload", false);
    let serialized: string;
    try {
      serialized = JSON.stringify(batch);
    } catch {
      throw new ProviderAdapterFailure("invalid_payload", false);
    }
    const size = Buffer.byteLength(serialized);
    if (size > this.limits.maxResponseBytes)
      throw new ProviderAdapterFailure("response_too_large", false);
    for (const record of batch.records) this.validateRaw(record);
    return batch;
  }

  normalize(
    providerCode: string,
    record: ProviderRawRecord,
    context: AdapterInvocationContext,
  ): ProviderNormalizedRecord {
    this.validateRaw(record);
    const adapter = this.resolve(context.provider);
    if (adapter.key !== providerCode)
      throw new ProviderAdapterFailure("adapter_context_mismatch", false);
    const normalized = adapter.normalize(record, context);
    if (
      !normalized ||
      normalized.external_id !== record.externalId ||
      !iso(normalized.observed_at) ||
      normalized.evidence_ref !== record.evidenceRef ||
      normalized.provenance.provider_id !== context.provider.id ||
      normalized.provenance.adapter_key !== adapter.key ||
      normalized.provenance.adapter_version !== adapter.version ||
      normalized.provenance.parser_version !== context.provider.parserVersion ||
      !normalized.fields ||
      typeof normalized.fields !== "object" ||
      Object.values(normalized.fields).some(
        (value) =>
          value !== null &&
          !["string", "number", "boolean"].includes(typeof value),
      )
    )
      throw new ProviderAdapterFailure("normalized_record_invalid", false);
    if (normalized.canonical_url !== null) {
      try {
        const url = new URL(normalized.canonical_url);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        throw new ProviderAdapterFailure("normalized_record_invalid", false);
      }
    }
    return normalized;
  }

  healthCheck(context: AdapterHealthContext): Promise<AdapterHealthSignal> {
    const adapter = this.resolve(context.provider);
    return this.withTimeout(
      Math.min(context.provider.timeoutMs, this.limits.healthTimeoutMs),
      async (signal) => {
        const result = await adapter.healthCheck(context, signal);
        if (
          !result ||
          !["ready", "degraded", "blocked"].includes(result.status) ||
          !Number.isSafeInteger(result.latencyMs) ||
          result.latencyMs < 0 ||
          result.latencyMs > 120_000 ||
          (result.errorCode !== null && !identifier(result.errorCode)) ||
          (result.status === "ready" && result.errorCode !== null) ||
          (result.status !== "ready" && result.errorCode === null) ||
          typeof result.message !== "string" ||
          result.message.length > 500
        )
          throw new ProviderAdapterFailure("invalid_health_payload", false);
        return result;
      },
    );
  }

  private validateRaw(record: ProviderRawRecord): void {
    if (
      !record ||
      !identifier(record.externalId) ||
      !iso(record.observedAt) ||
      typeof record.evidenceRef !== "string" ||
      record.evidenceRef.length < 1 ||
      record.evidenceRef.length > 1000 ||
      record.payload === undefined
    )
      throw new ProviderAdapterFailure("invalid_payload", false);
  }

  private async withTimeout<T>(
    timeoutMs: number,
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await Promise.race([
        operation(controller.signal),
        new Promise<T>((_, reject) =>
          controller.signal.addEventListener(
            "abort",
            () =>
              reject(
                new DOMException("Adapter invocation timed out", "AbortError"),
              ),
            { once: true },
          ),
        ),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}
