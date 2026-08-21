import { performance } from "node:perf_hooks";
import { createClient, type RedisClientType } from "redis";
import type { RuntimeConfig } from "@scoutops/config";
import { assertOrganizationScope, type OrganizationScope } from "@scoutops/contracts";

export type RedisPurpose = "cache" | "queue" | "rate" | "sse";

export const REDIS_TTL_POLICY = {
  cache: { defaultSeconds: 300, maximumSeconds: 3600 },
  queue: { defaultSeconds: 86400, maximumSeconds: 604800 },
  rate: { defaultSeconds: 60, maximumSeconds: 3600 },
  sse: { defaultSeconds: 86400, maximumSeconds: 86400 },
} as const satisfies Record<RedisPurpose, { defaultSeconds: number; maximumSeconds: number }>;

export class RedisBoundaryError extends Error {
  constructor(
    readonly code: "invalid_scope" | "invalid_key_segment" | "invalid_ttl" | "redis_unavailable",
    message: string,
  ) {
    super(message);
    this.name = "RedisBoundaryError";
  }
}

function segment(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 160 || /[\u0000-\u001f]/.test(normalized)) {
    throw new RedisBoundaryError(
      "invalid_key_segment",
      `${field} must be a non-empty safe key segment`,
    );
  }
  return encodeURIComponent(normalized);
}

export interface ScopedRedisKeyInput extends OrganizationScope {
  purpose: RedisPurpose;
  resource: string;
  identifiers?: readonly string[];
}

export function buildScopedRedisKey(input: ScopedRedisKeyInput): string {
  try {
    assertOrganizationScope(input);
  } catch {
    throw new RedisBoundaryError(
      "invalid_scope",
      "organization_id is required for organization Redis data",
    );
  }
  const workspace = input.workspace_id
    ? segment(input.workspace_id, "workspace_id")
    : "_organization";
  const identifiers =
    input.identifiers?.map((value, index) => segment(value, `identifiers[${index}]`)) ?? [];
  return [
    "scoutops",
    "v1",
    input.purpose,
    "org",
    segment(input.organization_id, "organization_id"),
    "ws",
    workspace,
    segment(input.resource, "resource"),
    ...identifiers,
  ].join(":");
}

export function resolveRedisTtl(purpose: RedisPurpose, requestedSeconds?: number): number {
  const policy = REDIS_TTL_POLICY[purpose];
  const ttl = requestedSeconds ?? policy.defaultSeconds;
  if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > policy.maximumSeconds) {
    throw new RedisBoundaryError(
      "invalid_ttl",
      `${purpose} TTL must be between 1 and ${policy.maximumSeconds} seconds`,
    );
  }
  return ttl;
}

export interface RedisConnection {
  readonly isOpen: boolean;
  connect(): Promise<unknown>;
  quit(): Promise<unknown>;
  destroy(): void;
  ping(): Promise<string>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number; NX?: true }): Promise<unknown>;
  del(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
}

export type RedisResilienceState = "ready" | "warning" | "blocked";
export interface RedisResilienceSnapshot {
  available: boolean;
  loading: boolean;
  appendOnlyEnabled: boolean;
  rdbEnabled: boolean;
  aofLastWriteStatus: "ok" | "err" | "unknown";
  rdbLastSaveStatus: "ok" | "err" | "unknown";
  usedMemoryBytes: number;
  maxMemoryBytes: number;
  maxMemoryPolicy: string;
  connectedClients: number;
  maxClients: number;
  rejectedConnections: number;
  evictedKeys: number;
  uptimeSeconds: number;
}
export interface RedisResiliencePolicy {
  memoryWarningBasisPoints: number;
  memoryStopBasisPoints: number;
  connectionWarningBasisPoints: number;
  connectionStopBasisPoints: number;
}
export interface RedisResilienceFinding {
  code: string;
  severity: "warning" | "blocked";
  actionHint: string;
}
export interface RedisResilienceEvaluation {
  state: RedisResilienceState;
  memoryUsageBasisPoints: number;
  connectionUsageBasisPoints: number;
  findings: RedisResilienceFinding[];
  singleInstance: true;
  sentinelEnabled: false;
  clusterEnabled: false;
  capacityClaim: "unverified";
}

const ratioBasisPoints = (used: number, maximum: number) =>
  maximum > 0 ? Math.min(10000, Math.round((used / maximum) * 10000)) : 10000;

export function evaluateRedisResilience(
  snapshot: RedisResilienceSnapshot,
  policy: RedisResiliencePolicy,
): RedisResilienceEvaluation {
  const findings: RedisResilienceFinding[] = [];
  const blocked = (code: string, actionHint: string) =>
    findings.push({ code, severity: "blocked", actionHint } as const);
  const warning = (code: string, actionHint: string) =>
    findings.push({ code, severity: "warning", actionHint } as const);
  if (!snapshot.available)
    blocked("redis_unavailable", "在宝塔检查并恢复当前单 Redis 服务后重新核验。");
  if (snapshot.loading) blocked("redis_loading", "等待宝塔 Redis 完成持久化数据加载后重新核验。");
  if (!snapshot.appendOnlyEnabled)
    blocked("redis_aof_disabled", "通过宝塔启用 AOF everysec 并执行受控重启。");
  if (!snapshot.rdbEnabled) blocked("redis_rdb_disabled", "通过宝塔保留受控 RDB save 规则。");
  if (snapshot.aofLastWriteStatus !== "ok")
    blocked("redis_aof_write_failed", "在宝塔检查 AOF 写入状态、磁盘空间和 Redis 日志。");
  if (snapshot.rdbLastSaveStatus !== "ok")
    blocked("redis_rdb_save_failed", "在宝塔检查 RDB 保存状态、磁盘空间和 Redis 日志。");
  if (snapshot.maxMemoryBytes <= 0)
    blocked("redis_memory_unbounded", "通过宝塔为单 Redis 设置非零 maxmemory 上限。");
  if (snapshot.maxMemoryPolicy !== "noeviction")
    blocked("redis_eviction_policy_invalid", "通过宝塔恢复 noeviction，禁止静默淘汰协调数据。");
  if (snapshot.maxClients <= 0)
    blocked("redis_connections_unbounded", "通过宝塔设置非零 maxclients 上限。");
  const memoryUsageBasisPoints = ratioBasisPoints(
    snapshot.usedMemoryBytes,
    snapshot.maxMemoryBytes,
  );
  const connectionUsageBasisPoints = ratioBasisPoints(
    snapshot.connectedClients,
    snapshot.maxClients,
  );
  if (snapshot.maxMemoryBytes > 0 && memoryUsageBasisPoints >= policy.memoryStopBasisPoints)
    blocked("redis_memory_stop", "停止新异步任务并在宝塔检查内存与积压。");
  else if (snapshot.maxMemoryBytes > 0 && memoryUsageBasisPoints >= policy.memoryWarningBasisPoints)
    warning("redis_memory_warning", "检查缓存、队列和 SSE 协调数据增长。");
  if (snapshot.maxClients > 0 && connectionUsageBasisPoints >= policy.connectionStopBasisPoints)
    blocked("redis_connections_stop", "停止新增连接并在宝塔检查连接泄漏。");
  else if (
    snapshot.maxClients > 0 &&
    connectionUsageBasisPoints >= policy.connectionWarningBasisPoints
  )
    warning("redis_connections_warning", "检查 API、Worker 与 Crawler 的 Redis 连接。");
  if (snapshot.rejectedConnections > 0)
    blocked("redis_connections_rejected", "在宝塔核对拒绝连接增量和受影响能力。");
  if (snapshot.evictedKeys > 0)
    blocked("redis_keys_evicted", "停止依赖 Redis 的新操作并核对是否存在数据淘汰。");
  return {
    state: findings.some((item) => item.severity === "blocked")
      ? "blocked"
      : findings.length
        ? "warning"
        : "ready",
    memoryUsageBasisPoints,
    connectionUsageBasisPoints,
    findings,
    singleInstance: true,
    sentinelEnabled: false,
    clusterEnabled: false,
    capacityClaim: "unverified",
  };
}

export interface RedisResilienceConnection {
  ping(): Promise<string>;
  info(section?: string): Promise<string>;
  configGet(parameter: string): Promise<Record<string, string>>;
}

const infoValues = (raw: string) =>
  Object.fromEntries(
    raw
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes(":"))
      .map((line) => {
        const index = line.indexOf(":");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
const safeNumber = (value: string | undefined) => {
  const parsed = Number(value ?? "0");
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
};

export async function inspectRedisResilience(
  client: RedisResilienceConnection,
): Promise<RedisResilienceSnapshot> {
  try {
    if ((await client.ping()) !== "PONG") throw new Error("unexpected ping");
    const [
      serverRaw,
      persistenceRaw,
      memoryRaw,
      clientsRaw,
      statsRaw,
      appendOnly,
      save,
      maxMemory,
      policy,
      maxClients,
    ] = await Promise.all([
      client.info("server"),
      client.info("persistence"),
      client.info("memory"),
      client.info("clients"),
      client.info("stats"),
      client.configGet("appendonly"),
      client.configGet("save"),
      client.configGet("maxmemory"),
      client.configGet("maxmemory-policy"),
      client.configGet("maxclients"),
    ]);
    const server = infoValues(serverRaw),
      persistence = infoValues(persistenceRaw),
      memory = infoValues(memoryRaw),
      clients = infoValues(clientsRaw),
      stats = infoValues(statsRaw);
    return {
      available: true,
      loading: persistence.loading === "1",
      appendOnlyEnabled: appendOnly.appendonly === "yes",
      rdbEnabled: Boolean(save.save?.trim()),
      aofLastWriteStatus:
        persistence.aof_last_write_status === "ok"
          ? "ok"
          : persistence.aof_last_write_status === "err"
            ? "err"
            : persistence.aof_last_bgrewrite_status === "ok"
              ? "ok"
              : "unknown",
      rdbLastSaveStatus:
        persistence.rdb_last_bgsave_status === "ok"
          ? "ok"
          : persistence.rdb_last_bgsave_status === "err"
            ? "err"
            : "unknown",
      usedMemoryBytes: safeNumber(memory.used_memory),
      maxMemoryBytes: safeNumber(maxMemory.maxmemory ?? memory.maxmemory),
      maxMemoryPolicy: policy["maxmemory-policy"] ?? memory.maxmemory_policy ?? "unknown",
      connectedClients: safeNumber(clients.connected_clients),
      maxClients: safeNumber(maxClients.maxclients ?? clients.maxclients),
      rejectedConnections: safeNumber(stats.rejected_connections),
      evictedKeys: safeNumber(stats.evicted_keys),
      uptimeSeconds: safeNumber(server.uptime_in_seconds),
    };
  } catch {
    return {
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
    };
  }
}

export function createRedisConnection(config: RuntimeConfig): RedisClientType {
  return createClient({
    socket: {
      host: config.redis.host,
      port: config.redis.port,
      connectTimeout: config.redis.connectTimeoutMs,
    },
    ...(config.redis.password ? { password: config.redis.password } : {}),
  });
}

export class ScopedRedisStore {
  constructor(private readonly client: RedisConnection) {}

  async connect(): Promise<void> {
    if (!this.client.isOpen) await this.client.connect();
  }

  async close(): Promise<void> {
    if (!this.client.isOpen) return;
    try {
      await this.client.quit();
    } catch {
      this.client.destroy();
    }
  }

  async writeJson<T>(input: ScopedRedisKeyInput, value: T, ttlSeconds?: number): Promise<string> {
    const key = buildScopedRedisKey(input);
    await this.client.set(key, JSON.stringify(value), {
      EX: resolveRedisTtl(input.purpose, ttlSeconds),
    });
    return key;
  }

  async readJson<T>(input: ScopedRedisKeyInput): Promise<T | null> {
    const raw = await this.client.get(buildScopedRedisKey(input));
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async delete(input: ScopedRedisKeyInput): Promise<number> {
    return this.client.del(buildScopedRedisKey(input));
  }

  async incrementRate(
    input: Omit<ScopedRedisKeyInput, "purpose">,
    ttlSeconds?: number,
  ): Promise<{ count: number; ttl_seconds: number }> {
    const scoped = { ...input, purpose: "rate" as const };
    const key = buildScopedRedisKey(scoped);
    const ttl = resolveRedisTtl("rate", ttlSeconds);
    const result = await this.client.eval(
      "local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return {count,redis.call('TTL',KEYS[1])}",
      { keys: [key], arguments: [String(ttl)] },
    );
    if (!Array.isArray(result) || result.length !== 2)
      throw new RedisBoundaryError("redis_unavailable", "unexpected rate counter response");
    return { count: Number(result[0]), ttl_seconds: Number(result[1]) };
  }

  async acquireLease(
    input: Omit<ScopedRedisKeyInput, "purpose">,
    token: string,
    ttlSeconds?: number,
  ): Promise<boolean> {
    const key = buildScopedRedisKey({ ...input, purpose: "queue" });
    const result = await this.client.set(key, segment(token, "lease_token"), {
      EX: resolveRedisTtl("queue", ttlSeconds),
      NX: true,
    });
    return result === "OK";
  }

  async releaseLease(input: Omit<ScopedRedisKeyInput, "purpose">, token: string): Promise<boolean> {
    const key = buildScopedRedisKey({ ...input, purpose: "queue" });
    const result = await this.client.eval(
      "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",
      { keys: [key], arguments: [segment(token, "lease_token")] },
    );
    return Number(result) === 1;
  }

  async health(
    requestId: string,
    traceId: string,
  ): Promise<{
    status: "available" | "unavailable";
    latency_ms: number;
    checked_at: string;
    request_id: string;
    trace_id: string;
  }> {
    const started = performance.now();
    try {
      const result = await this.client.ping();
      if (result !== "PONG") throw new Error("unexpected Redis ping response");
      return {
        status: "available",
        latency_ms: Math.round(performance.now() - started),
        checked_at: new Date().toISOString(),
        request_id: requestId,
        trace_id: traceId,
      };
    } catch {
      return {
        status: "unavailable",
        latency_ms: Math.round(performance.now() - started),
        checked_at: new Date().toISOString(),
        request_id: requestId,
        trace_id: traceId,
      };
    }
  }
}
