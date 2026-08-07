import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export type RuntimeTarget = 'api' | 'worker';
export class ConfigError extends Error {
  readonly code = 'invalid_runtime_config';
  constructor(readonly key: string, message: string) { super(`${key}: ${message}`); this.name = 'ConfigError'; }
}
export interface RuntimeConfig {
  target: RuntimeTarget;
  nodeEnv: 'development' | 'test' | 'production';
  app: { host: string; port: number; version: string; buildSha: string; webOrigin: string };
  database: { host: string; port: number; name: string; user: string; password: string; writeHost?: string; readHost?: string };
  redis: { host: string; port: number; password: string; connectTimeoutMs: number };
  ai: { baseUrl: string; model: string; apiKey: string; timeoutMs: number };
  storage: { evidenceRoot: string; exportRoot: string };
  security: { sessionSecret: string; credentialsMasterKey: string };
  auth: { argon2MemoryKib: number; argon2TimeCost: number; argon2Parallelism: number; passwordMinLength: number; passwordMaxLength: number; sessionTtlMinutes: number; actionTokenTtlMinutes: number; maxFailedAttempts: number; lockMinutes: number; outboxPollMs: number };
  mfa: { issuer: string; totpPeriodSeconds: number; totpDigits: number; totpWindow: number; challengeTtlMinutes: number; maxAttempts: number; recoveryCodeCount: number };
  identity: { workerId: string; crawlerId: string };
  runtime: { workerHeartbeatMs: number; crawlerHeartbeatSeconds: number };
  configFingerprint: string;
}
const text = (env: NodeJS.ProcessEnv, key: string, fallback = '') => env[key]?.trim() || fallback;
function integer(env: NodeJS.ProcessEnv, key: string, fallback: number, min: number, max: number) {
  const value = Number(text(env, key, String(fallback)));
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new ConfigError(key, `must be an integer from ${min} to ${max}`);
  return value;
}
function httpUrl(env: NodeJS.ProcessEnv, key: string, fallback: string) {
  try { const value = new URL(text(env, key, fallback)); if (!['http:', 'https:'].includes(value.protocol)) throw new Error(); return value.toString().replace(/\/$/, ''); }
  catch { throw new ConfigError(key, 'must be an absolute http(s) URL'); }
}
function secret(env: NodeJS.ProcessEnv, key: string, production: boolean, minimum: number) {
  const value = text(env, key); if (production && value.length < minimum) throw new ConfigError(key, `must contain at least ${minimum} characters in production`); return value;
}
export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env, target: RuntimeTarget = 'api', cwd = process.cwd()): RuntimeConfig {
  const rawNodeEnv = text(env, 'NODE_ENV', 'development');
  if (!['development', 'test', 'production'].includes(rawNodeEnv)) throw new ConfigError('NODE_ENV', 'must be development, test or production');
  const nodeEnv = rawNodeEnv as RuntimeConfig['nodeEnv'];
  const production = nodeEnv === 'production';
  const evidenceRoot = resolve(cwd, text(env, 'EVIDENCE_ROOT', './runtime/evidence'));
  const exportRoot = resolve(cwd, text(env, 'EXPORT_ROOT', './runtime/exports'));
  if (evidenceRoot === exportRoot) throw new ConfigError('EXPORT_ROOT', 'must not equal EVIDENCE_ROOT');
  const base = {
    target, nodeEnv,
    app: { host: text(env, 'APP_HOST', '127.0.0.1'), port: integer(env, 'APP_PORT', 4101, 1, 65535), version: text(env, 'APP_VERSION', '0.1.0'), buildSha: text(env, 'BUILD_SHA', 'development'), webOrigin: httpUrl(env, 'WEB_ORIGIN', 'http://127.0.0.1:5173') },
    database: { host: text(env, 'DB_HOST', '127.0.0.1'), port: integer(env, 'DB_PORT', 3306, 1, 65535), name: text(env, 'DB_NAME', 'product_scout'), user: text(env, 'DB_USER', 'product_scout'), password: secret(env, 'DB_PASSWORD', production, 12), ...(text(env, 'DB_WRITE_HOST') ? { writeHost: text(env, 'DB_WRITE_HOST') } : {}), ...(text(env, 'DB_READ_HOST') ? { readHost: text(env, 'DB_READ_HOST') } : {}) },
    redis: { host: text(env, 'REDIS_HOST', '127.0.0.1'), port: integer(env, 'REDIS_PORT', 6379, 1, 65535), password: text(env, 'REDIS_PASSWORD'), connectTimeoutMs: integer(env, 'REDIS_CONNECT_TIMEOUT_MS', 3000, 100, 30000) },
    ai: { baseUrl: httpUrl(env, 'AI_BASE_URL', 'http://192.168.1.203:8588/v1'), model: text(env, 'AI_MODEL', 'Qwen3.5-9B-AWQ-4bit'), apiKey: text(env, 'AI_API_KEY'), timeoutMs: integer(env, 'AI_TIMEOUT_MS', 30000, 1000, 300000) },
    storage: { evidenceRoot, exportRoot },
    security: { sessionSecret: secret(env, 'SESSION_SECRET', production, 32), credentialsMasterKey: secret(env, 'CREDENTIALS_MASTER_KEY', production, 32) },
    auth: { argon2MemoryKib: integer(env, 'AUTH_ARGON2_MEMORY_KIB', 19456, 19456, 1048576), argon2TimeCost: integer(env, 'AUTH_ARGON2_TIME_COST', 2, 2, 20), argon2Parallelism: integer(env, 'AUTH_ARGON2_PARALLELISM', 1, 1, 16), passwordMinLength: integer(env, 'AUTH_PASSWORD_MIN_LENGTH', 12, 8, 128), passwordMaxLength: integer(env, 'AUTH_PASSWORD_MAX_LENGTH', 128, 12, 1024), sessionTtlMinutes: integer(env, 'AUTH_SESSION_TTL_MINUTES', 720, 5, 43200), actionTokenTtlMinutes: integer(env, 'AUTH_ACTION_TOKEN_TTL_MINUTES', 15, 5, 1440), maxFailedAttempts: integer(env, 'AUTH_MAX_FAILED_ATTEMPTS', 5, 2, 20), lockMinutes: integer(env, 'AUTH_LOCK_MINUTES', 15, 1, 1440), outboxPollMs: integer(env, 'AUTH_OUTBOX_POLL_MS', 5000, 1000, 60000) },
    mfa: { issuer: text(env,'MFA_ISSUER','ScoutOps'), totpPeriodSeconds: integer(env,'MFA_TOTP_PERIOD_SECONDS',30,15,120), totpDigits: integer(env,'MFA_TOTP_DIGITS',6,6,8), totpWindow: integer(env,'MFA_TOTP_WINDOW',1,0,2), challengeTtlMinutes: integer(env,'MFA_CHALLENGE_TTL_MINUTES',5,1,10), maxAttempts: integer(env,'MFA_MAX_ATTEMPTS',5,2,10), recoveryCodeCount: integer(env,'MFA_RECOVERY_CODE_COUNT',8,4,20) },
    identity: { workerId: text(env, 'WORKER_ID', 'worker-local'), crawlerId: text(env, 'CRAWLER_ID', 'crawler-local') },
    runtime: { workerHeartbeatMs: integer(env, 'WORKER_HEARTBEAT_MS', 30000, 5000, 60000), crawlerHeartbeatSeconds: integer(env, 'CRAWLER_HEARTBEAT_SECONDS', 30, 5, 60) },
  };
  if (base.auth.passwordMaxLength < base.auth.passwordMinLength) throw new ConfigError('AUTH_PASSWORD_MAX_LENGTH', 'must be greater than or equal to AUTH_PASSWORD_MIN_LENGTH');
  const safe = { ...base, database: { ...base.database, password: Boolean(base.database.password) }, redis: { ...base.redis, password: Boolean(base.redis.password) }, ai: { ...base.ai, apiKey: Boolean(base.ai.apiKey) }, security: { sessionSecret: Boolean(base.security.sessionSecret), credentialsMasterKey: Boolean(base.security.credentialsMasterKey) } };
  return { ...base, configFingerprint: createHash('sha256').update(JSON.stringify(safe)).digest('hex') };
}
