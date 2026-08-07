import { performance } from 'node:perf_hooks';
import { createClient, type RedisClientType } from 'redis';
import type { RuntimeConfig } from '@scoutops/config';
import { assertOrganizationScope, type OrganizationScope } from '@scoutops/contracts';

export type RedisPurpose = 'cache' | 'queue' | 'rate' | 'sse';

export const REDIS_TTL_POLICY = {
  cache: { defaultSeconds: 300, maximumSeconds: 3600 },
  queue: { defaultSeconds: 86400, maximumSeconds: 604800 },
  rate: { defaultSeconds: 60, maximumSeconds: 3600 },
  sse: { defaultSeconds: 86400, maximumSeconds: 86400 },
} as const satisfies Record<RedisPurpose, { defaultSeconds: number; maximumSeconds: number }>;

export class RedisBoundaryError extends Error {
  constructor(readonly code: 'invalid_scope' | 'invalid_key_segment' | 'invalid_ttl' | 'redis_unavailable', message: string) {
    super(message);
    this.name = 'RedisBoundaryError';
  }
}

function segment(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 160 || /[\u0000-\u001f]/.test(normalized)) {
    throw new RedisBoundaryError('invalid_key_segment', `${field} must be a non-empty safe key segment`);
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
    throw new RedisBoundaryError('invalid_scope', 'organization_id is required for organization Redis data');
  }
  const workspace = input.workspace_id ? segment(input.workspace_id, 'workspace_id') : '_organization';
  const identifiers = input.identifiers?.map((value, index) => segment(value, `identifiers[${index}]`)) ?? [];
  return [
    'scoutops', 'v1', input.purpose,
    'org', segment(input.organization_id, 'organization_id'),
    'ws', workspace,
    segment(input.resource, 'resource'),
    ...identifiers,
  ].join(':');
}

export function resolveRedisTtl(purpose: RedisPurpose, requestedSeconds?: number): number {
  const policy = REDIS_TTL_POLICY[purpose];
  const ttl = requestedSeconds ?? policy.defaultSeconds;
  if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > policy.maximumSeconds) {
    throw new RedisBoundaryError('invalid_ttl', `${purpose} TTL must be between 1 and ${policy.maximumSeconds} seconds`);
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

export function createRedisConnection(config: RuntimeConfig): RedisClientType {
  return createClient({
    socket: { host: config.redis.host, port: config.redis.port, connectTimeout: config.redis.connectTimeoutMs },
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
    try { await this.client.quit(); } catch { this.client.destroy(); }
  }

  async writeJson<T>(input: ScopedRedisKeyInput, value: T, ttlSeconds?: number): Promise<string> {
    const key = buildScopedRedisKey(input);
    await this.client.set(key, JSON.stringify(value), { EX: resolveRedisTtl(input.purpose, ttlSeconds) });
    return key;
  }

  async readJson<T>(input: ScopedRedisKeyInput): Promise<T | null> {
    const raw = await this.client.get(buildScopedRedisKey(input));
    return raw === null ? null : JSON.parse(raw) as T;
  }

  async delete(input: ScopedRedisKeyInput): Promise<number> {
    return this.client.del(buildScopedRedisKey(input));
  }

  async incrementRate(input: Omit<ScopedRedisKeyInput, 'purpose'>, ttlSeconds?: number): Promise<{ count: number; ttl_seconds: number }> {
    const scoped = { ...input, purpose: 'rate' as const };
    const key = buildScopedRedisKey(scoped);
    const ttl = resolveRedisTtl('rate', ttlSeconds);
    const result = await this.client.eval(
      "local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return {count,redis.call('TTL',KEYS[1])}",
      { keys: [key], arguments: [String(ttl)] },
    );
    if (!Array.isArray(result) || result.length !== 2) throw new RedisBoundaryError('redis_unavailable', 'unexpected rate counter response');
    return { count: Number(result[0]), ttl_seconds: Number(result[1]) };
  }

  async acquireLease(input: Omit<ScopedRedisKeyInput, 'purpose'>, token: string, ttlSeconds?: number): Promise<boolean> {
    const key = buildScopedRedisKey({ ...input, purpose: 'queue' });
    const result = await this.client.set(key, segment(token, 'lease_token'), { EX: resolveRedisTtl('queue', ttlSeconds), NX: true });
    return result === 'OK';
  }

  async releaseLease(input: Omit<ScopedRedisKeyInput, 'purpose'>, token: string): Promise<boolean> {
    const key = buildScopedRedisKey({ ...input, purpose: 'queue' });
    const result = await this.client.eval(
      "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",
      { keys: [key], arguments: [segment(token, 'lease_token')] },
    );
    return Number(result) === 1;
  }

  async health(requestId: string, traceId: string): Promise<{
    status: 'available' | 'unavailable'; latency_ms: number; checked_at: string; request_id: string; trace_id: string;
  }> {
    const started = performance.now();
    try {
      const result = await this.client.ping();
      if (result !== 'PONG') throw new Error('unexpected Redis ping response');
      return { status: 'available', latency_ms: Math.round(performance.now() - started), checked_at: new Date().toISOString(), request_id: requestId, trace_id: traceId };
    } catch {
      return { status: 'unavailable', latency_ms: Math.round(performance.now() - started), checked_at: new Date().toISOString(), request_id: requestId, trace_id: traceId };
    }
  }
}
