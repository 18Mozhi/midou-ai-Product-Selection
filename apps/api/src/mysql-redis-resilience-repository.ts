import { randomUUID } from "node:crypto";
import type { Pool } from "mysql2/promise";
import type { RedisResilienceRepository } from "./redis-resilience-service.js";

export class MySqlRedisResilienceRepository implements RedisResilienceRepository {
  constructor(private readonly pool: Pool) {}

  async record(input: Parameters<RedisResilienceRepository["record"]>[0]) {
    const connection = await this.pool.getConnection();
    const observationId = randomUUID();
    try {
      await connection.beginTransaction();
      await connection.query(
        "INSERT INTO redis_resilience_observations(id,organization_id,workspace_id," +
          "manager,mode,state,appendonly_enabled,rdb_enabled,aof_last_write_status," +
          "rdb_last_save_status,used_memory_bytes,maxmemory_bytes,memory_usage_basis_points," +
          "connected_clients,maxclients,connection_usage_basis_points,rejected_connections," +
          "evicted_keys,finding_codes_json,request_id,trace_id,observed_at) VALUES(?," +
          "NULL,NULL,'baota','single_instance',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          observationId,
          input.evaluation.state,
          input.snapshot.appendOnlyEnabled,
          input.snapshot.rdbEnabled,
          input.snapshot.aofLastWriteStatus,
          input.snapshot.rdbLastSaveStatus,
          input.snapshot.usedMemoryBytes,
          input.snapshot.maxMemoryBytes,
          input.evaluation.memoryUsageBasisPoints,
          input.snapshot.connectedClients,
          input.snapshot.maxClients,
          input.evaluation.connectionUsageBasisPoints,
          input.snapshot.rejectedConnections,
          input.snapshot.evictedKeys,
          JSON.stringify(input.evaluation.findings.map((item) => item.code)),
          input.requestId,
          input.traceId,
          input.observedAt,
        ],
      );
      await connection.query(
        "INSERT INTO redis_resilience_views(id,actor_id,observation_id,request_id,trace_id,observed_at) VALUES(?,?,?,?,?,?)",
        [
          randomUUID(),
          input.actorId,
          observationId,
          input.requestId,
          input.traceId,
          input.observedAt,
        ],
      );
      await connection.query(
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id," +
          "action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at," +
          "schema_version) VALUES(?,NULL,NULL,?,'platform.redis_resilience.read','redis_single_instance'," +
          "?,'succeeded',?,?,?,?,1)",
        [
          randomUUID(),
          input.actorId,
          observationId,
          input.requestId,
          input.traceId,
          JSON.stringify({
            state: input.evaluation.state,
            memory_usage_basis_points: input.evaluation.memoryUsageBasisPoints,
            connection_usage_basis_points: input.evaluation.connectionUsageBasisPoints,
            finding_codes: input.evaluation.findings.map((item) => item.code),
            keyspace_sample: input.snapshot.keyspaceSample
              ? {
                  status: input.snapshot.keyspaceSample.status,
                  basis: input.snapshot.keyspaceSample.basis,
                  sample_limit: input.snapshot.keyspaceSample.sample_limit,
                  scanned_keys: input.snapshot.keyspaceSample.scanned_keys,
                  measured_keys: input.snapshot.keyspaceSample.measured_keys,
                  total_sampled_bytes: input.snapshot.keyspaceSample.total_sampled_bytes,
                  truncated: input.snapshot.keyspaceSample.truncated,
                  hotspots: input.snapshot.keyspaceSample.hotspots,
                }
              : null,
            mode: "single_instance",
          }),
          input.observedAt,
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
