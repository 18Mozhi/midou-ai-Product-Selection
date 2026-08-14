import type { RedisResilienceDto } from "@scoutops/contracts";
import { evaluateRedisResilience, type RedisResiliencePolicy, type RedisResilienceSnapshot } from "@scoutops/redis";

export interface RedisResilienceProbe { snapshot(): Promise<RedisResilienceSnapshot> }
export interface RedisResilienceRepository {
  record(input: {actorId: string; requestId: string; traceId: string; observedAt: Date; snapshot: RedisResilienceSnapshot; evaluation: ReturnType<typeof evaluateRedisResilience>}): Promise<void>;
}

export class RedisResilienceService {
  constructor(private readonly probe: RedisResilienceProbe, private readonly repository: RedisResilienceRepository, private readonly policy: RedisResiliencePolicy, private readonly now = () => new Date()) {}

  async read(input: {actorId: string; requestId: string; traceId: string}): Promise<RedisResilienceDto> {
    const observedAt = this.now();
    const snapshot = await this.probe.snapshot();
    const evaluation = evaluateRedisResilience(snapshot, this.policy);
    await this.repository.record({...input, observedAt, snapshot, evaluation});
    return {
      state: evaluation.state,
      mode: "single_instance",
      persistence: {aof_enabled:snapshot.appendOnlyEnabled,rdb_enabled:snapshot.rdbEnabled,aof_last_write_status:snapshot.aofLastWriteStatus,rdb_last_save_status:snapshot.rdbLastSaveStatus},
      memory: {used_bytes:snapshot.usedMemoryBytes,max_bytes:snapshot.maxMemoryBytes,usage_basis_points:evaluation.memoryUsageBasisPoints},
      connections: {connected:snapshot.connectedClients,maximum:snapshot.maxClients,usage_basis_points:evaluation.connectionUsageBasisPoints,rejected:snapshot.rejectedConnections},
      evicted_keys: snapshot.evictedKeys,
      findings: evaluation.findings.map((item) => ({code:item.code,severity:item.severity,action_hint:item.actionHint})),
      single_instance: true,
      sentinel_enabled: false,
      cluster_enabled: false,
      capacity_claim: "unverified",
      observed_at: observedAt.toISOString(),
    };
  }
}
