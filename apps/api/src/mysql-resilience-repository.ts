import { randomUUID } from "node:crypto";
import type { Pool } from "mysql2/promise";
import type { MySqlResilienceRepository as MySqlResilienceRepositoryContract } from "./mysql-resilience-service.js";

export class MySqlResilienceRepository implements MySqlResilienceRepositoryContract {
  constructor(private readonly pool: Pick<Pool, "getConnection">) {}
  async record(input: Parameters<MySqlResilienceRepositoryContract["record"]>[0]) {
    input.signal?.throwIfAborted();
    const connection = await this.pool.getConnection();
    const observationId = randomUUID();
    try {
      await connection.beginTransaction();
      input.signal?.throwIfAborted();
      await connection.query(
        "INSERT INTO mysql_resilience_observations(id,organization_id,workspace_id," +
          "manager,mode,state,mysql_version,read_only_enabled,log_bin_enabled,binlog_format," +
          "product_database_binlog_excluded,innodb_flush_log_at_trx_commit,sync_binlog," +
          "master_status_available,replica_configured,buffer_pool_bytes,buffer_pool_data_bytes," +
          "buffer_pool_hit_rate_basis_points,threads_connected,threads_running,max_connections," +
          "connection_usage_basis_points,slow_queries_total,slow_queries_per_minute," +
          "long_query_time_seconds,data_filesystem_total_bytes,data_filesystem_available_bytes," +
          "data_usage_basis_points,innodb_log_waits,innodb_row_lock_waits,backup_status," +
          "actual_rpo_minutes,actual_rto_minutes,recovery_drill_age_days,finding_codes_json," +
          "request_id,trace_id,observed_at) VALUES(?,NULL,NULL,'baota','single_primary'," +
          "?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          observationId,
          input.evaluation.state,
          input.snapshot.version,
          input.snapshot.readOnly,
          input.snapshot.logBinEnabled,
          input.snapshot.binlogFormat,
          input.snapshot.productDatabaseBinlogExcluded,
          input.snapshot.innodbFlushLogAtTrxCommit,
          input.snapshot.syncBinlog,
          input.snapshot.masterStatusAvailable,
          input.snapshot.replicaConfigured,
          input.snapshot.bufferPoolBytes,
          input.snapshot.bufferPoolDataBytes,
          input.snapshot.bufferPoolHitRateBasisPoints,
          input.snapshot.threadsConnected,
          input.snapshot.threadsRunning,
          input.snapshot.maxConnections,
          input.evaluation.connectionUsageBasisPoints,
          input.snapshot.slowQueriesTotal ?? 0,
          input.snapshot.slowQueriesPerMinute,
          input.snapshot.longQueryTimeSeconds,
          input.snapshot.dataFilesystemTotalBytes,
          input.snapshot.dataFilesystemAvailableBytes,
          input.evaluation.dataUsageBasisPoints,
          input.snapshot.innodbLogWaits,
          input.snapshot.innodbRowLockWaits,
          input.snapshot.backupStatus,
          input.snapshot.actualRpoMinutes,
          input.snapshot.actualRtoMinutes,
          input.snapshot.recoveryDrillAgeDays,
          JSON.stringify(input.evaluation.findings.map((item) => item.code)),
          input.requestId,
          input.traceId,
          input.observedAt,
        ],
      );
      input.signal?.throwIfAborted();
      await connection.query(
        "INSERT INTO mysql_resilience_views(id,actor_id,observation_id,request_id,trace_id,observed_at) VALUES(?,?,?,?,?,?)",
        [
          randomUUID(),
          input.actorId,
          observationId,
          input.requestId,
          input.traceId,
          input.observedAt,
        ],
      );
      input.signal?.throwIfAborted();
      await connection.query(
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id," +
          "action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at," +
          "schema_version) VALUES(?,NULL,NULL,?,'platform.mysql_resilience.read','mysql_single_primary'," +
          "?,'succeeded',?,?,?,?,1)",
        [
          randomUUID(),
          input.actorId,
          observationId,
          input.requestId,
          input.traceId,
          JSON.stringify({
            state: input.evaluation.state,
            connection_usage_basis_points: input.evaluation.connectionUsageBasisPoints,
            data_usage_basis_points: input.evaluation.dataUsageBasisPoints,
            finding_codes: input.evaluation.findings.map((item) => item.code),
            mode: "single_primary",
            replica_enabled: false,
            backup_server_used: false,
          }),
          input.observedAt,
        ],
      );
      input.signal?.throwIfAborted();
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
