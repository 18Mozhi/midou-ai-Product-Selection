import { randomUUID } from "node:crypto";

export type RuntimeHealthEndpoint = "live" | "ready" | "available";
export type RuntimeHealthProbeOutcome = "succeeded" | "http_error" | "timeout" | "network_error";

export interface RuntimeHealthProbeSample {
  endpoint: RuntimeHealthEndpoint;
  outcome: RuntimeHealthProbeOutcome;
  statusCode: number | null;
  latencyMs: number;
  requestId: string;
  traceId: string;
  observedAt: Date;
}

export interface RuntimeHealthEndpointSummary {
  endpoint: RuntimeHealthEndpoint;
  sample_count: number;
  success_count: number;
  http_error_count: number;
  timeout_count: number;
  network_error_count: number;
  availability_basis_points: number;
  latency_p50_ms: number | null;
  latency_p95_ms: number | null;
  latency_p99_ms: number | null;
  latency_max_ms: number | null;
  last_status_code: number | null;
  last_outcome: RuntimeHealthProbeOutcome | null;
  last_observed_at: string | null;
}

export interface RuntimeHealthProbeRepository {
  record(input: { samples: RuntimeHealthProbeSample[]; retentionHours: number }): Promise<void>;
  summarize(input: {
    observedAt: Date;
    windowMinutes: number;
  }): Promise<RuntimeHealthEndpointSummary[]>;
}

export interface RuntimeHealthProbePolicy {
  intervalMs: number;
  timeoutMs: number;
  windowMinutes: number;
  retentionHours: number;
}

export type RuntimeHealthProbeRequest = (input: {
  path: string;
  signal: AbortSignal;
  requestId: string;
  traceId: string;
}) => Promise<{ statusCode: number }>;

export const RUNTIME_HEALTH_ENDPOINTS = [
  { endpoint: "live" as const, path: "/api/v1/health/live" },
  { endpoint: "ready" as const, path: "/api/v1/health/ready" },
  { endpoint: "available" as const, path: "/api/v1/health/available" },
];

export class RuntimeHealthProbeMonitor {
  private activeCycle: Promise<boolean> | null = null;
  private stopping = false;

  constructor(
    private readonly repository: RuntimeHealthProbeRepository,
    private readonly policy: RuntimeHealthProbePolicy,
    private readonly request: RuntimeHealthProbeRequest,
    private readonly now = () => new Date(),
  ) {}

  private async probe(
    endpoint: RuntimeHealthEndpoint,
    path: string,
  ): Promise<RuntimeHealthProbeSample> {
    const startedAt = this.now();
    const requestId = `health-probe-${randomUUID()}`;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.policy.timeoutMs);
    try {
      const response = await this.request({
        path,
        signal: controller.signal,
        requestId,
        traceId: requestId,
      });
      return {
        endpoint,
        outcome:
          response.statusCode >= 200 && response.statusCode < 400 ? "succeeded" : "http_error",
        statusCode: response.statusCode,
        latencyMs: Math.max(0, this.now().getTime() - startedAt.getTime()),
        requestId,
        traceId: requestId,
        observedAt: this.now(),
      };
    } catch {
      return {
        endpoint,
        outcome: timedOut ? "timeout" : "network_error",
        statusCode: null,
        latencyMs: Math.max(0, this.now().getTime() - startedAt.getTime()),
        requestId,
        traceId: requestId,
        observedAt: this.now(),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  runCycle(): Promise<boolean> {
    if (this.activeCycle || this.stopping) return Promise.resolve(false);
    const cycle = (async () => {
      const samples = await Promise.all(
        RUNTIME_HEALTH_ENDPOINTS.map(({ endpoint, path }) => this.probe(endpoint, path)),
      );
      await this.repository.record({ samples, retentionHours: this.policy.retentionHours });
      return true;
    })().finally(() => {
      if (this.activeCycle === cycle) this.activeCycle = null;
    });
    this.activeCycle = cycle;
    return cycle;
  }

  async stop() {
    this.stopping = true;
    await this.activeCycle?.catch(() => false);
  }

  async snapshot() {
    const observedAt = this.now();
    const endpoints = await this.repository.summarize({
      observedAt,
      windowMinutes: this.policy.windowMinutes,
    });
    return {
      status: endpoints.some((item) => item.sample_count > 0)
        ? ("ready" as const)
        : ("empty" as const),
      interval_ms: this.policy.intervalMs,
      timeout_ms: this.policy.timeoutMs,
      window_minutes: this.policy.windowMinutes,
      retention_hours: this.policy.retentionHours,
      endpoints,
      observed_at: observedAt.toISOString(),
    };
  }
}
