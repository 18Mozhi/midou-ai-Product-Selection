import { createHash } from "node:crypto";
import mysql, { type Pool, type PoolConnection } from "mysql2/promise";
import type { RuntimeConfig } from "@scoutops/config";

export type MySqlResilienceState = "ready" | "warning" | "blocked";
export type MySqlRecoveryStatus = "verified" | "stale" | "blocked" | "empty";
export interface MySqlResilienceSnapshot {
  available: boolean;
  version: string;
  readOnly: boolean;
  logBinEnabled: boolean;
  binlogFormat: "ROW" | "MIXED" | "STATEMENT" | "unknown";
  productDatabaseBinlogExcluded: boolean;
  innodbFlushLogAtTrxCommit: number;
  syncBinlog: number;
  masterStatusAvailable: boolean;
  replicaConfigured: boolean;
  bufferPoolBytes: number;
  bufferPoolDataBytes: number;
  bufferPoolHitRateBasisPoints: number;
  maxConnections: number;
  threadsConnected: number;
  threadsRunning: number;
  slowQueriesPerMinute: number;
  slowQueriesTotal?: number;
  longQueryTimeSeconds: number;
  dataFilesystemTotalBytes: number;
  dataFilesystemAvailableBytes: number;
  innodbLogWaits: number;
  innodbRowLockWaits: number;
  uptimeSeconds: number;
  backupStatus: MySqlRecoveryStatus;
  actualRpoMinutes: number | null;
  actualRtoMinutes: number | null;
  recoveryDrillAgeDays: number | null;
}
export interface MySqlResiliencePolicy {
  connectionWarningBasisPoints: number;
  connectionStopBasisPoints: number;
  dataWarningBasisPoints: number;
  dataStopBasisPoints: number;
  slowQueryWarningPerMinute: number;
  slowQueryStopPerMinute: number;
  bufferPoolHitWarningBasisPoints: number;
  maximumRecoveryDrillAgeDays: number;
  maximumRpoMinutes: number;
  maximumRtoMinutes: number;
}
export interface MySqlResilienceFinding {
  code: string;
  severity: "warning" | "blocked";
  actionHint: string;
}
export interface MySqlResilienceEvaluation {
  state: MySqlResilienceState;
  connectionUsageBasisPoints: number;
  dataUsageBasisPoints: number;
  findings: MySqlResilienceFinding[];
  singlePrimary: true;
  replicaEnabled: false;
  backupServerUsed: false;
  capacityClaim: "unverified";
}

const mysqlRatioBasisPoints = (used: number, maximum: number) =>
  maximum > 0 ? Math.min(10000, Math.max(0, Math.round((used / maximum) * 10000))) : 10000;

export function evaluateMySqlResilience(
  snapshot: MySqlResilienceSnapshot,
  policy: MySqlResiliencePolicy,
): MySqlResilienceEvaluation {
  const findings: MySqlResilienceFinding[] = [];
  const blocked = (code: string, actionHint: string) =>
    findings.push({ code, severity: "blocked", actionHint });
  const warning = (code: string, actionHint: string) =>
    findings.push({ code, severity: "warning", actionHint });
  if (!snapshot.available)
    blocked("mysql_unavailable", "在宝塔检查并恢复当前 MySQL 5.7 服务后重新核验。");
  if (!/^5\.7\./.test(snapshot.version))
    blocked("mysql_version_incompatible", "只允许当前宝塔 MySQL 5.7 单主合同。");
  if (snapshot.readOnly)
    blocked("mysql_primary_read_only", "在宝塔核对单主状态，禁止把只读节点冒充当前主库。");
  if (!snapshot.logBinEnabled)
    blocked("mysql_binlog_disabled", "通过宝塔恢复二进制日志并重新执行隔离恢复验证。");
  if (snapshot.binlogFormat !== "ROW")
    blocked("mysql_binlog_format_invalid", "通过宝塔将 binlog_format 恢复为 ROW。");
  if (snapshot.productDatabaseBinlogExcluded)
    blocked(
      "mysql_product_database_binlog_excluded",
      "通过宝塔移除 product_scout 的 binlog 排除规则。",
    );
  if (snapshot.innodbFlushLogAtTrxCommit !== 2)
    blocked("mysql_flush_contract_invalid", "通过宝塔恢复 innodb_flush_log_at_trx_commit=2。");
  if (snapshot.syncBinlog !== 1)
    blocked("mysql_sync_binlog_invalid", "通过宝塔恢复 sync_binlog=1。");
  if (!snapshot.masterStatusAvailable)
    blocked(
      "mysql_master_status_unavailable",
      "核对 product_scout 的 REPLICATION CLIENT 与 binlog 主状态。",
    );
  if (snapshot.replicaConfigured)
    blocked("mysql_replica_unexpected", "当前 S0 只允许一个 MySQL 主库，不启用只读副本。");
  const connectionUsageBasisPoints = mysqlRatioBasisPoints(
    snapshot.threadsConnected,
    snapshot.maxConnections,
  );
  const usedBytes = Math.max(
    0,
    snapshot.dataFilesystemTotalBytes - snapshot.dataFilesystemAvailableBytes,
  );
  const dataUsageBasisPoints = mysqlRatioBasisPoints(usedBytes, snapshot.dataFilesystemTotalBytes);
  if (snapshot.maxConnections <= 0)
    blocked("mysql_connections_unbounded", "通过宝塔恢复明确的 max_connections 上限。");
  else if (connectionUsageBasisPoints >= policy.connectionStopBasisPoints)
    blocked("mysql_connections_stop", "停止新增异步工作并检查 MySQL 连接占用。");
  else if (connectionUsageBasisPoints >= policy.connectionWarningBasisPoints)
    warning("mysql_connections_warning", "检查 API、Worker 与 Crawler 的连接使用。");
  if (snapshot.dataFilesystemTotalBytes <= 0)
    blocked("mysql_data_capacity_unknown", "在当前主机核验 MySQL 数据文件系统容量。");
  else if (dataUsageBasisPoints >= policy.dataStopBasisPoints)
    blocked("mysql_data_capacity_stop", "停止新增大任务并通过宝塔释放或扩展受控存储。");
  else if (dataUsageBasisPoints >= policy.dataWarningBasisPoints)
    warning("mysql_data_capacity_warning", "检查数据、binlog、临时表与备份增长。");
  if (snapshot.slowQueriesPerMinute >= policy.slowQueryStopPerMinute)
    blocked("mysql_slow_query_stop", "停止高成本任务并在宝塔慢查询日志定位根因。");
  else if (snapshot.slowQueriesPerMinute >= policy.slowQueryWarningPerMinute)
    warning("mysql_slow_query_warning", "检查慢查询增量、索引和执行计划。");
  if (snapshot.bufferPoolHitRateBasisPoints < policy.bufferPoolHitWarningBasisPoints)
    warning("mysql_buffer_pool_hit_warning", "检查工作集、索引和 4 GiB 缓冲池命中率。");
  if (snapshot.innodbLogWaits > 0)
    warning("mysql_innodb_log_waits", "检查 InnoDB 日志等待增量和磁盘 I/O。");
  if (snapshot.innodbRowLockWaits > 0)
    warning("mysql_row_lock_waits", "检查行锁等待增量与长事务。");
  if (snapshot.backupStatus === "empty" || snapshot.backupStatus === "blocked")
    blocked("mysql_recovery_unverified", "通过宝塔完成同机加密备份与隔离恢复核验。");
  if (
    snapshot.backupStatus === "stale" ||
    snapshot.recoveryDrillAgeDays === null ||
    snapshot.recoveryDrillAgeDays > policy.maximumRecoveryDrillAgeDays
  )
    blocked("mysql_recovery_stale", "在宝塔重新执行 90 天内的隔离恢复演练。");
  if (snapshot.actualRpoMinutes === null || snapshot.actualRpoMinutes > policy.maximumRpoMinutes)
    blocked("mysql_rpo_exceeded", "恢复演练必须证明 RPO 不超过 15 分钟。");
  if (snapshot.actualRtoMinutes === null || snapshot.actualRtoMinutes > policy.maximumRtoMinutes)
    blocked("mysql_rto_exceeded", "恢复演练必须证明 RTO 不超过 4 小时。");
  return {
    state: findings.some((item) => item.severity === "blocked")
      ? "blocked"
      : findings.length
        ? "warning"
        : "ready",
    connectionUsageBasisPoints,
    dataUsageBasisPoints,
    findings,
    singlePrimary: true,
    replicaEnabled: false,
    backupServerUsed: false,
    capacityClaim: "unverified",
  };
}

export const migrationChecksum = (sql: string) =>
  createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
export function createDatabasePool(config: RuntimeConfig): Pool {
  return mysql.createPool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    charset: "utf8mb4",
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
  });
}
export async function withTransaction<T>(
  pool: Pick<Pool, "getConnection">,
  work: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
export interface MigrationRecord {
  name: string;
  checksum: string;
}
export interface MigrationExecutor {
  execute(sql: string, values?: unknown[]): Promise<unknown>;
  queryApplied(): Promise<MigrationRecord[]>;
}
export function createMigrationExecutor(pool: Pool): MigrationExecutor {
  return {
    execute: async (sql, values = []) => pool.query(sql, values),
    queryApplied: async () => {
      const [rows] = await pool.query("SELECT name, checksum FROM schema_migrations ORDER BY name");
      return rows as MigrationRecord[];
    },
  };
}
export async function applyMigration(
  executor: MigrationExecutor,
  migration: { name: string; sql: string },
) {
  const checksum = migrationChecksum(migration.sql);
  const applied = await executor.queryApplied();
  const existing = applied.find((item) => item.name === migration.name);
  if (existing && existing.checksum !== checksum)
    throw new Error(`migration_checksum_mismatch:${migration.name}`);
  if (existing) return "already_applied";
  await executor.execute(migration.sql);
  await executor.execute(
    "INSERT INTO schema_migrations (name, checksum, applied_at) VALUES (?, ?, UTC_TIMESTAMP(3))",
    [migration.name, checksum],
  );
  return "applied";
}
