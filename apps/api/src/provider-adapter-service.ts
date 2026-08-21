import type { ProviderAdapterSummary } from "@scoutops/contracts";
import {
  classifyProviderAdapterFailure,
  type AdapterHealthSignal,
  type ProviderAccessMode,
  type ProviderAdapterRegistry,
  type ProviderRuntimeDefinition,
} from "@scoutops/provider-adapters";

export class ProviderAdapterServiceError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
  ) {
    super(code);
    this.name = "ProviderAdapterServiceError";
  }
}

export interface AdapterProviderRecord extends ProviderRuntimeDefinition {
  name: string;
  status: "draft" | "disabled" | "enabled";
}

export interface StoredAdapterHealth {
  providerId: string;
  adapterVersion: string | null;
  healthStatus: "unknown" | "ready" | "degraded" | "blocked";
  lastCheckedAt: string | null;
  lastLatencyMs: number | null;
  lastErrorCode: string | null;
  consecutiveFailures: number;
  version: number;
  updatedAt: string;
}

export interface AdapterRuntimeHealthWindow {
  latestCategory: "unknown" | "healthy" | "network" | "parser" | "login" | "empty" | "other";
  sampleCount: number;
  successRateBasisPoints: number | null;
  durationP95Ms: number | null;
  networkFailureCount: number;
  parserFailureCount: number;
  loginFailureCount: number;
  emptySuccessCount: number;
}

const emptyRuntimeWindow = (): AdapterRuntimeHealthWindow => ({
  latestCategory: "unknown",
  sampleCount: 0,
  successRateBasisPoints: null,
  durationP95Ms: null,
  networkFailureCount: 0,
  parserFailureCount: 0,
  loginFailureCount: 0,
  emptySuccessCount: 0,
});

export interface ProviderAdapterRepository {
  list(): Promise<
    Array<{
      provider: AdapterProviderRecord;
      health: StoredAdapterHealth;
      runtime?: AdapterRuntimeHealthWindow;
    }>
  >;
  runtimeWindow?(providerId: string): Promise<AdapterRuntimeHealthWindow>;
  getProvider(id: string): Promise<AdapterProviderRecord | null>;
  findReplay(input: {
    providerId: string;
    actorId: string;
    route: string;
    idempotencyKey: string;
  }): Promise<StoredAdapterHealth | null>;
  recordHealth(input: {
    provider: AdapterProviderRecord;
    signal: AdapterHealthSignal;
    adapterVersion: string | null;
    actorId: string;
    route: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<StoredAdapterHealth>;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ProviderAdapterService {
  constructor(
    private readonly repository: ProviderAdapterRepository,
    private readonly registry: ProviderAdapterRegistry,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(): Promise<ProviderAdapterSummary[]> {
    const rows = await this.repository.list();
    return rows.map(({ provider, health, runtime }) => this.summary(provider, health, runtime));
  }

  async probe(
    providerId: string,
    context: { actorId: string; idempotencyKey: string; requestId: string; traceId: string },
  ): Promise<ProviderAdapterSummary> {
    if (!uuid.test(providerId))
      throw new ProviderAdapterServiceError("provider_id_invalid", 400, "刷新来源列表后重试。");
    const provider = await this.repository.getProvider(providerId);
    if (!provider)
      throw new ProviderAdapterServiceError("provider_not_found", 404, "刷新来源列表。");
    const route = `/platform/provider-adapters/${providerId}/health-check`;
    const replay = await this.repository.findReplay({
      providerId,
      actorId: context.actorId,
      route,
      idempotencyKey: context.idempotencyKey,
    });
    if (replay) return this.summary(provider, replay, await this.runtimeWindow(providerId));

    const registered = this.registry.has(provider.code, provider.accessMode);
    let signal: AdapterHealthSignal;
    let adapterVersion: string | null = null;
    if (!registered) {
      signal = {
        status: "blocked",
        latencyMs: 0,
        errorCode: "adapter_not_registered",
        message: "该来源尚未注册真实适配器实现。",
      };
    } else {
      adapterVersion =
        this.registry.describe().find((item) => item.key === provider.code)?.version ?? null;
      const started = Date.now();
      try {
        signal = await this.registry.healthCheck({
          provider,
          requestId: context.requestId,
          traceId: context.traceId,
        });
      } catch (error) {
        const failure = classifyProviderAdapterFailure(error);
        signal = {
          status: failure.status,
          latencyMs: Math.max(0, Date.now() - started),
          errorCode: failure.code,
          message: failure.retryable
            ? "适配器依赖暂不可用，可按退避策略重试。"
            : "适配器合同受阻，需要修复配置或实现。",
        };
      }
    }
    const stored = await this.repository.recordHealth({
      provider,
      signal,
      adapterVersion,
      route,
      ...context,
      now: this.now(),
    });
    return this.summary(provider, stored, await this.runtimeWindow(providerId));
  }

  private async runtimeWindow(providerId: string): Promise<AdapterRuntimeHealthWindow> {
    return this.repository.runtimeWindow?.(providerId) ?? emptyRuntimeWindow();
  }

  private summary(
    provider: AdapterProviderRecord,
    health: StoredAdapterHealth,
    runtime = emptyRuntimeWindow(),
  ): ProviderAdapterSummary {
    return {
      id: provider.id,
      code: provider.code,
      name: provider.name,
      access_mode: provider.accessMode,
      provider_status: provider.status,
      adapter_registered: this.registry.has(provider.code, provider.accessMode),
      adapter_version: health.adapterVersion,
      health_status: health.healthStatus,
      last_checked_at: health.lastCheckedAt,
      last_latency_ms: health.lastLatencyMs,
      last_error_code: health.lastErrorCode,
      consecutive_failures: health.consecutiveFailures,
      latest_runtime_category: runtime.latestCategory,
      runtime_sample_count_24h: runtime.sampleCount,
      runtime_success_rate_basis_points_24h: runtime.successRateBasisPoints,
      runtime_duration_p95_ms_24h: runtime.durationP95Ms,
      runtime_network_failure_count_24h: runtime.networkFailureCount,
      runtime_parser_failure_count_24h: runtime.parserFailureCount,
      runtime_login_failure_count_24h: runtime.loginFailureCount,
      runtime_empty_success_count_24h: runtime.emptySuccessCount,
      version: health.version,
      updated_at: health.updatedAt,
    };
  }
}

export function toRuntimeProvider(row: Record<string, unknown>): AdapterProviderRecord {
  const parse = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.map(String)
      : typeof value === "string"
        ? (JSON.parse(value) as string[])
        : [];
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    accessMode: row.access_mode as ProviderAccessMode,
    targetUrl: String(row.target_url),
    parserVersion: String(row.parser_version),
    timeoutMs: Number(row.timeout_ms),
    fields: parse(row.fields_json),
    status: row.status as AdapterProviderRecord["status"],
  };
}
