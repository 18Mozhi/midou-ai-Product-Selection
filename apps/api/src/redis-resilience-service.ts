import type { RedisResilienceDto } from "@scoutops/contracts";
import {
  REDIS_KEYSPACE_SAMPLE_LIMIT,
  evaluateRedisResilience,
  type RedisResiliencePolicy,
  type RedisResilienceSnapshot,
} from "@scoutops/redis";

export interface RedisResilienceProbe {
  snapshot(): Promise<RedisResilienceSnapshot>;
}
export const unavailableRedisResilienceSnapshot = (): RedisResilienceSnapshot => ({
  available: false,
  loading: false,
  appendOnlyEnabled: false,
  rdbEnabled: false,
  aofLastWriteStatus: "unknown",
  rdbLastSaveStatus: "unknown",
  usedMemoryBytes: 0,
  maxMemoryBytes: 0,
  maxMemoryPolicy: "unknown",
  connectedClients: 0,
  maxClients: 0,
  rejectedConnections: 0,
  evictedKeys: 0,
  uptimeSeconds: 0,
  keyspaceSample: {
    status: "unavailable",
    basis: "bounded_memory_usage",
    sample_limit: REDIS_KEYSPACE_SAMPLE_LIMIT,
    scanned_keys: 0,
    measured_keys: 0,
    ignored_keys: 0,
    failed_measurements: 0,
    total_sampled_bytes: 0,
    truncated: false,
    access_frequency_available: false,
    unavailable_reason: "scan_failed",
    hotspots: [],
  },
});
export interface RedisResilienceRepository {
  record(input: {
    actorId: string;
    requestId: string;
    traceId: string;
    observedAt: Date;
    snapshot: RedisResilienceSnapshot;
    evaluation: ReturnType<typeof evaluateRedisResilience>;
  }): Promise<void>;
}

export class RedisResilienceService {
  constructor(
    private readonly probe: RedisResilienceProbe,
    private readonly repository: RedisResilienceRepository,
    private readonly policy: RedisResiliencePolicy,
    private readonly now = () => new Date(),
  ) {}

  async read(input: {
    actorId: string;
    requestId: string;
    traceId: string;
  }): Promise<RedisResilienceDto> {
    const observedAt = this.now();
    const snapshot = await this.probe.snapshot();
    const evaluation = evaluateRedisResilience(snapshot, this.policy);
    const keyspaceSample = snapshot.keyspaceSample ?? {
      status: "unavailable" as const,
      basis: "bounded_memory_usage" as const,
      sample_limit: REDIS_KEYSPACE_SAMPLE_LIMIT,
      scanned_keys: 0,
      measured_keys: 0,
      ignored_keys: 0,
      failed_measurements: 0,
      total_sampled_bytes: 0,
      truncated: false,
      access_frequency_available: false as const,
      unavailable_reason: "command_unsupported" as const,
      hotspots: [],
    };
    await this.repository.record({ ...input, observedAt, snapshot, evaluation });
    return {
      state: evaluation.state,
      mode: "single_instance",
      persistence: {
        aof_enabled: snapshot.appendOnlyEnabled,
        rdb_enabled: snapshot.rdbEnabled,
        aof_last_write_status: snapshot.aofLastWriteStatus,
        rdb_last_save_status: snapshot.rdbLastSaveStatus,
      },
      memory: {
        used_bytes: snapshot.usedMemoryBytes,
        max_bytes: snapshot.maxMemoryBytes,
        usage_basis_points: evaluation.memoryUsageBasisPoints,
      },
      connections: {
        connected: snapshot.connectedClients,
        maximum: snapshot.maxClients,
        usage_basis_points: evaluation.connectionUsageBasisPoints,
        rejected: snapshot.rejectedConnections,
      },
      evicted_keys: snapshot.evictedKeys,
      max_memory_policy: snapshot.maxMemoryPolicy,
      uptime_seconds: snapshot.uptimeSeconds,
      keyspace_sample: keyspaceSample,
      findings: evaluation.findings.map((item) => ({
        code: item.code,
        severity: item.severity,
        action_hint: item.actionHint,
      })),
      single_instance: true,
      sentinel_enabled: false,
      cluster_enabled: false,
      capacity_claim: "unverified",
      observed_at: observedAt.toISOString(),
    };
  }
}
