import type { MySqlResilienceDto } from "@scoutops/contracts";
import {
  evaluateMySqlResilience,
  type MySqlResiliencePolicy,
  type MySqlResilienceSnapshot,
} from "@scoutops/database";

export interface MySqlResilienceProbe {
  snapshot(): Promise<MySqlResilienceSnapshot>;
}
export interface MySqlResilienceRepository {
  record(input: {
    actorId: string;
    requestId: string;
    traceId: string;
    observedAt: Date;
    snapshot: MySqlResilienceSnapshot;
    evaluation: ReturnType<typeof evaluateMySqlResilience>;
  }): Promise<void>;
}

export class MySqlResilienceService {
  constructor(
    private readonly probe: MySqlResilienceProbe,
    private readonly repository: MySqlResilienceRepository,
    private readonly policy: MySqlResiliencePolicy,
    private readonly now = () => new Date(),
  ) {}
  async read(input: {
    actorId: string;
    requestId: string;
    traceId: string;
  }): Promise<MySqlResilienceDto> {
    const observedAt = this.now();
    const snapshot = await this.probe.snapshot();
    const evaluation = evaluateMySqlResilience(snapshot, this.policy);
    await this.repository.record({ ...input, observedAt, snapshot, evaluation });
    const usedBytes = Math.max(
      0,
      snapshot.dataFilesystemTotalBytes - snapshot.dataFilesystemAvailableBytes,
    );
    return {
      state: evaluation.state,
      mode: "single_primary",
      durability: {
        log_bin_enabled: snapshot.logBinEnabled,
        binlog_format: snapshot.binlogFormat,
        innodb_flush_log_at_trx_commit: snapshot.innodbFlushLogAtTrxCommit,
        sync_binlog: snapshot.syncBinlog,
      },
      connections: {
        connected: snapshot.threadsConnected,
        running: snapshot.threadsRunning,
        maximum: snapshot.maxConnections,
        usage_basis_points: evaluation.connectionUsageBasisPoints,
      },
      storage: {
        used_bytes: usedBytes,
        total_bytes: snapshot.dataFilesystemTotalBytes,
        usage_basis_points: evaluation.dataUsageBasisPoints,
      },
      io: {
        buffer_pool_bytes: snapshot.bufferPoolBytes,
        buffer_pool_data_bytes: snapshot.bufferPoolDataBytes,
        buffer_pool_hit_rate_basis_points: snapshot.bufferPoolHitRateBasisPoints,
        innodb_log_waits: snapshot.innodbLogWaits,
        innodb_row_lock_waits: snapshot.innodbRowLockWaits,
      },
      slow_queries: {
        per_minute: snapshot.slowQueriesPerMinute,
        long_query_time_seconds: snapshot.longQueryTimeSeconds,
      },
      recovery: {
        status: snapshot.backupStatus,
        actual_rpo_minutes: snapshot.actualRpoMinutes,
        actual_rto_minutes: snapshot.actualRtoMinutes,
        drill_age_days: snapshot.recoveryDrillAgeDays,
      },
      findings: evaluation.findings.map((item) => ({
        code: item.code,
        severity: item.severity,
        action_hint: item.actionHint,
      })),
      single_primary: true,
      replica_enabled: false,
      backup_server_used: false,
      capacity_claim: "unverified",
      observed_at: observedAt.toISOString(),
    };
  }
}
