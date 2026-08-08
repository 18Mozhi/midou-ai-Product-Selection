import { createHash } from "node:crypto";
import { resolve } from "node:path";

export type RuntimeTarget = "api" | "worker";
export class ConfigError extends Error {
  readonly code = "invalid_runtime_config";
  constructor(
    readonly key: string,
    message: string,
  ) {
    super(`${key}: ${message}`);
    this.name = "ConfigError";
  }
}
export interface RuntimeConfig {
  target: RuntimeTarget;
  nodeEnv: "development" | "test" | "production";
  app: {
    host: string;
    port: number;
    version: string;
    buildSha: string;
    webOrigin: string;
  };
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    writeHost?: string;
    readHost?: string;
  };
  redis: {
    host: string;
    port: number;
    password: string;
    connectTimeoutMs: number;
  };
  ai: {
    baseUrl: string;
    model: string;
    apiKey: string;
    timeoutMs: number;
    retryLimit: number;
    pollMs: number;
    leaseSeconds: number;
  };
  storage: {
    evidenceRoot: string;
    exportRoot: string;
    credentialTempRoot: string;
  };
  security: {
    sessionSecret: string;
    credentialsMasterKey: string;
    credentialsMasterKeyVersion: string;
    evidenceDownloadSigningKey: string;
  };
  providerAdapters: {
    healthTimeoutMs: number;
    maxResponseBytes: number;
    maxItemsPerBatch: number;
  };
  playwright: {
    browser: "chromium";
    headless: boolean;
    navigationTimeoutMs: number;
    actionTimeoutMs: number;
    maxPages: number;
    maxScrolls: number;
    maxDetails: number;
    maxArchiveBytes: number;
    maxExtractedBytes: number;
    maxArchiveFiles: number;
  };
  auth: {
    argon2MemoryKib: number;
    argon2TimeCost: number;
    argon2Parallelism: number;
    passwordMinLength: number;
    passwordMaxLength: number;
    sessionTtlMinutes: number;
    actionTokenTtlMinutes: number;
    maxFailedAttempts: number;
    lockMinutes: number;
    outboxPollMs: number;
  };
  mfa: {
    issuer: string;
    totpPeriodSeconds: number;
    totpDigits: number;
    totpWindow: number;
    challengeTtlMinutes: number;
    maxAttempts: number;
    recoveryCodeCount: number;
  };
  identity: { workerId: string; crawlerId: string };
  runtime: { workerHeartbeatMs: number; crawlerHeartbeatSeconds: number };
  collectionTasks: { pollMs: number; leaseSeconds: number };
  trends: { projectionPollMs: number; projectionLeaseSeconds: number };
  opportunities: { refreshPollMs: number; refreshLeaseSeconds: number };
  scoring: { pollMs: number; leaseSeconds: number };
  profit: { pollMs: number; leaseSeconds: number };
  competitorMonitor: { pollMs: number; leaseSeconds: number };
  sourcing: { pollMs: number; leaseSeconds: number };
  businessTasks: { pollMs: number; leaseSeconds: number };
  approvals: { escalationPollMs: number; escalationLeaseSeconds: number };
  notifications: {
    outboxPollMs: number;
    outboxLeaseSeconds: number;
    retryLimit: number;
    emailDeliveryMode: "placeholder";
  };
  realtime: {
    pollMs: number;
    heartbeatMs: number;
    replayLimit: number;
    maxConnectionSeconds: number;
    maxConnections: number;
  };
  automations: { pollMs: number; leaseSeconds: number; retryLimit: number; defaultRateLimit: number };
  reports: { pollMs: number; leaseSeconds: number; retryLimit: number; exportTtlHours: number; maxRows: number; exportRoot: string };
  organizationAdmin: { invitationTtlHours: number; tokenDefaultTtlDays: number; tokenMaxActive: number };
  platformDashboard: { defaultWindow: "15m"|"24h"|"7d"|"30d"; queueWarning: number; errorLimit: number };
  collectionConsole: { recentLimit: number };
  securityOperations: { defaultWindow: "24h"|"7d"|"30d"; recentLimit: number };
  evidence: { maxRawBytes: number; downloadGrantSeconds: number };
  configFingerprint: string;
}
export interface PlatformSeedConfig {
  email: string;
  password: string;
}
const text = (env: NodeJS.ProcessEnv, key: string, fallback = "") =>
  env[key]?.trim() || fallback;
function integer(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  min: number,
  max: number,
) {
  const value = Number(text(env, key, String(fallback)));
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new ConfigError(key, `must be an integer from ${min} to ${max}`);
  return value;
}
function httpUrl(env: NodeJS.ProcessEnv, key: string, fallback: string) {
  try {
    const value = new URL(text(env, key, fallback));
    if (!["http:", "https:"].includes(value.protocol)) throw new Error();
    return value.toString().replace(/\/$/, "");
  } catch {
    throw new ConfigError(key, "must be an absolute http(s) URL");
  }
}
function secret(
  env: NodeJS.ProcessEnv,
  key: string,
  production: boolean,
  minimum: number,
) {
  const value = text(env, key);
  if (production && value.length < minimum)
    throw new ConfigError(
      key,
      `must contain at least ${minimum} characters in production`,
    );
  return value;
}
export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
  target: RuntimeTarget = "api",
  cwd = process.cwd(),
): RuntimeConfig {
  const rawNodeEnv = text(env, "NODE_ENV", "development");
  if (!["development", "test", "production"].includes(rawNodeEnv))
    throw new ConfigError(
      "NODE_ENV",
      "must be development, test or production",
    );
  const nodeEnv = rawNodeEnv as RuntimeConfig["nodeEnv"];
  const production = nodeEnv === "production";
  const evidenceRoot = resolve(
    cwd,
    text(env, "EVIDENCE_ROOT", "./runtime/evidence"),
  );
  const exportRoot = resolve(
    cwd,
    text(env, "EXPORT_ROOT", "./runtime/exports"),
  );
  const credentialTempRoot = resolve(
    cwd,
    text(env, "CREDENTIAL_TEMP_ROOT", "./runtime/credential-tmp"),
  );
  if (evidenceRoot === exportRoot)
    throw new ConfigError("EXPORT_ROOT", "must not equal EVIDENCE_ROOT");
  const base = {
    target,
    nodeEnv,
    app: {
      host: text(env, "APP_HOST", "127.0.0.1"),
      port: integer(env, "APP_PORT", 4101, 1, 65535),
      version: text(env, "APP_VERSION", "0.1.0"),
      buildSha: text(env, "BUILD_SHA", "development"),
      webOrigin: httpUrl(env, "WEB_ORIGIN", "http://127.0.0.1:5173"),
    },
    database: {
      host: text(env, "DB_HOST", "127.0.0.1"),
      port: integer(env, "DB_PORT", 3306, 1, 65535),
      name: text(env, "DB_NAME", "product_scout"),
      user: text(env, "DB_USER", "product_scout"),
      password: secret(env, "DB_PASSWORD", production, 12),
      ...(text(env, "DB_WRITE_HOST")
        ? { writeHost: text(env, "DB_WRITE_HOST") }
        : {}),
      ...(text(env, "DB_READ_HOST")
        ? { readHost: text(env, "DB_READ_HOST") }
        : {}),
    },
    redis: {
      host: text(env, "REDIS_HOST", "127.0.0.1"),
      port: integer(env, "REDIS_PORT", 6379, 1, 65535),
      password: text(env, "REDIS_PASSWORD"),
      connectTimeoutMs: integer(
        env,
        "REDIS_CONNECT_TIMEOUT_MS",
        3000,
        100,
        30000,
      ),
    },
    ai: {
      baseUrl: httpUrl(env, "AI_BASE_URL", "http://192.168.1.203:8588/v1"),
      model: text(env, "AI_MODEL", "Qwen3.5-9B-AWQ-4bit"),
      apiKey: text(env, "AI_API_KEY"),
      timeoutMs: integer(env, "AI_TIMEOUT_MS", 30000, 1000, 300000),
      retryLimit: integer(env, "AI_RETRY_LIMIT", 3, 0, 10),
      pollMs: integer(env, "AI_ANALYSIS_POLL_MS", 2000, 250, 60000),
      leaseSeconds: integer(env, "AI_ANALYSIS_LEASE_SECONDS", 120, 30, 3600),
    },
    storage: { evidenceRoot, exportRoot, credentialTempRoot },
    security: {
      sessionSecret: secret(env, "SESSION_SECRET", production, 32),
      credentialsMasterKey: secret(
        env,
        "CREDENTIALS_MASTER_KEY",
        production,
        32,
      ),
      credentialsMasterKeyVersion: text(
        env,
        "CREDENTIALS_MASTER_KEY_VERSION",
        "v1",
      ),
      evidenceDownloadSigningKey: secret(
        env,
        "EVIDENCE_DOWNLOAD_SIGNING_KEY",
        production,
        32,
      ),
    },
    providerAdapters: {
      healthTimeoutMs: integer(
        env,
        "PROVIDER_ADAPTER_HEALTH_TIMEOUT_MS",
        10000,
        100,
        120000,
      ),
      maxResponseBytes: integer(
        env,
        "PROVIDER_ADAPTER_MAX_RESPONSE_BYTES",
        5242880,
        1024,
        100000000,
      ),
      maxItemsPerBatch: integer(
        env,
        "PROVIDER_ADAPTER_MAX_ITEMS_PER_BATCH",
        500,
        1,
        5000,
      ),
    },
    playwright: {
      browser: "chromium" as const,
      headless: text(env, "PLAYWRIGHT_HEADLESS", "true") === "true",
      navigationTimeoutMs: integer(
        env,
        "PLAYWRIGHT_NAVIGATION_TIMEOUT_MS",
        30000,
        1000,
        120000,
      ),
      actionTimeoutMs: integer(
        env,
        "PLAYWRIGHT_ACTION_TIMEOUT_MS",
        10000,
        500,
        60000,
      ),
      maxPages: integer(env, "PLAYWRIGHT_MAX_PAGES", 10, 1, 100),
      maxScrolls: integer(env, "PLAYWRIGHT_MAX_SCROLLS", 20, 0, 100),
      maxDetails: integer(env, "PLAYWRIGHT_MAX_DETAILS", 20, 0, 100),
      maxArchiveBytes: integer(
        env,
        "PLAYWRIGHT_PROFILE_ARCHIVE_MAX_BYTES",
        104857600,
        1024,
        1073741824,
      ),
      maxExtractedBytes: integer(
        env,
        "PLAYWRIGHT_PROFILE_EXTRACTED_MAX_BYTES",
        524288000,
        1024,
        2147483647,
      ),
      maxArchiveFiles: integer(
        env,
        "PLAYWRIGHT_PROFILE_MAX_FILES",
        5000,
        1,
        50000,
      ),
    },
    auth: {
      argon2MemoryKib: integer(
        env,
        "AUTH_ARGON2_MEMORY_KIB",
        19456,
        19456,
        1048576,
      ),
      argon2TimeCost: integer(env, "AUTH_ARGON2_TIME_COST", 2, 2, 20),
      argon2Parallelism: integer(env, "AUTH_ARGON2_PARALLELISM", 1, 1, 16),
      passwordMinLength: integer(env, "AUTH_PASSWORD_MIN_LENGTH", 12, 8, 128),
      passwordMaxLength: integer(
        env,
        "AUTH_PASSWORD_MAX_LENGTH",
        128,
        12,
        1024,
      ),
      sessionTtlMinutes: integer(
        env,
        "AUTH_SESSION_TTL_MINUTES",
        720,
        5,
        43200,
      ),
      actionTokenTtlMinutes: integer(
        env,
        "AUTH_ACTION_TOKEN_TTL_MINUTES",
        15,
        5,
        1440,
      ),
      maxFailedAttempts: integer(env, "AUTH_MAX_FAILED_ATTEMPTS", 5, 2, 20),
      lockMinutes: integer(env, "AUTH_LOCK_MINUTES", 15, 1, 1440),
      outboxPollMs: integer(env, "AUTH_OUTBOX_POLL_MS", 5000, 1000, 60000),
    },
    mfa: {
      issuer: text(env, "MFA_ISSUER", "ScoutOps"),
      totpPeriodSeconds: integer(env, "MFA_TOTP_PERIOD_SECONDS", 30, 15, 120),
      totpDigits: integer(env, "MFA_TOTP_DIGITS", 6, 6, 8),
      totpWindow: integer(env, "MFA_TOTP_WINDOW", 1, 0, 2),
      challengeTtlMinutes: integer(env, "MFA_CHALLENGE_TTL_MINUTES", 5, 1, 10),
      maxAttempts: integer(env, "MFA_MAX_ATTEMPTS", 5, 2, 10),
      recoveryCodeCount: integer(env, "MFA_RECOVERY_CODE_COUNT", 8, 4, 20),
    },
    identity: {
      workerId: text(env, "WORKER_ID", "worker-local"),
      crawlerId: text(env, "CRAWLER_ID", "crawler-local"),
    },
    runtime: {
      workerHeartbeatMs: integer(
        env,
        "WORKER_HEARTBEAT_MS",
        30000,
        5000,
        60000,
      ),
      crawlerHeartbeatSeconds: integer(
        env,
        "CRAWLER_HEARTBEAT_SECONDS",
        30,
        5,
        60,
      ),
    },
    collectionTasks: {
      pollMs: integer(env, "COLLECTION_TASK_POLL_MS", 2000, 250, 60000),
      leaseSeconds: integer(
        env,
        "COLLECTION_TASK_LEASE_SECONDS",
        120,
        30,
        3600,
      ),
    },
    trends: {
      projectionPollMs: integer(
        env,
        "TREND_PROJECTION_POLL_MS",
        2000,
        250,
        60000,
      ),
      projectionLeaseSeconds: integer(
        env,
        "TREND_PROJECTION_LEASE_SECONDS",
        120,
        30,
        3600,
      ),
    },
    opportunities: {
      refreshPollMs: integer(
        env,
        "OPPORTUNITY_REFRESH_POLL_MS",
        2000,
        250,
        60000,
      ),
      refreshLeaseSeconds: integer(
        env,
        "OPPORTUNITY_REFRESH_LEASE_SECONDS",
        120,
        30,
        3600,
      ),
    },
    scoring: {
      pollMs: integer(env, "OPPORTUNITY_SCORING_POLL_MS", 2000, 250, 60000),
      leaseSeconds: integer(
        env,
        "OPPORTUNITY_SCORING_LEASE_SECONDS",
        120,
        30,
        3600,
      ),
    },
    profit: {
      pollMs: integer(env, "PROFIT_CALCULATION_POLL_MS", 2000, 250, 60000),
      leaseSeconds: integer(
        env,
        "PROFIT_CALCULATION_LEASE_SECONDS",
        120,
        30,
        3600,
      ),
    },
    competitorMonitor: {
      pollMs: integer(env, "COMPETITOR_MONITOR_POLL_MS", 2000, 250, 60000),
      leaseSeconds: integer(
        env,
        "COMPETITOR_MONITOR_LEASE_SECONDS",
        120,
        30,
        3600,
      ),
    },
    sourcing: {
      pollMs: integer(env, "SOURCING_PROJECTION_POLL_MS", 2000, 250, 60000),
      leaseSeconds: integer(
        env,
        "SOURCING_PROJECTION_LEASE_SECONDS",
        120,
        30,
        3600,
      ),
    },
    businessTasks: {
      pollMs: integer(
        env,
        "BUSINESS_TASK_PROJECTION_POLL_MS",
        2000,
        250,
        60000,
      ),
      leaseSeconds: integer(
        env,
        "BUSINESS_TASK_PROJECTION_LEASE_SECONDS",
        120,
        30,
        3600,
      ),
    },
    approvals: {
      escalationPollMs: integer(
        env,
        "APPROVAL_ESCALATION_POLL_MS",
        2000,
        250,
        60000,
      ),
      escalationLeaseSeconds: integer(
        env,
        "APPROVAL_ESCALATION_LEASE_SECONDS",
        120,
        30,
        3600,
      ),
    },
    notifications: {
      outboxPollMs: integer(
        env,
        "NOTIFICATION_OUTBOX_POLL_MS",
        2000,
        250,
        60000,
      ),
      outboxLeaseSeconds: integer(
        env,
        "NOTIFICATION_OUTBOX_LEASE_SECONDS",
        120,
        30,
        3600,
      ),
      retryLimit: integer(env, "NOTIFICATION_OUTBOX_RETRY_LIMIT", 3, 1, 10),
      emailDeliveryMode: "placeholder" as const,
    },
    realtime: {
      pollMs: integer(env, "REALTIME_POLL_MS", 1000, 250, 10000),
      heartbeatMs: integer(env, "REALTIME_HEARTBEAT_MS", 15000, 5000, 60000),
      replayLimit: integer(env, "REALTIME_REPLAY_LIMIT", 100, 1, 1000),
      maxConnectionSeconds: integer(
        env,
        "REALTIME_MAX_CONNECTION_SECONDS",
        55,
        10,
        300,
      ),
      maxConnections: integer(env, "REALTIME_MAX_CONNECTIONS", 200, 1, 2000),
    },
    automations: {
      pollMs: integer(env, "AUTOMATION_POLL_MS", 2000, 250, 60000),
      leaseSeconds: integer(env, "AUTOMATION_LEASE_SECONDS", 120, 30, 3600),
      retryLimit: integer(env, "AUTOMATION_RETRY_LIMIT", 3, 1, 10),
      defaultRateLimit: integer(env, "AUTOMATION_DEFAULT_RATE_LIMIT", 20, 1, 1000),
    },
    reports: {
      pollMs: integer(env, "REPORT_EXPORT_POLL_MS", 2000, 250, 60000),
      leaseSeconds: integer(env, "REPORT_EXPORT_LEASE_SECONDS", 120, 30, 3600),
      retryLimit: integer(env, "REPORT_EXPORT_RETRY_LIMIT", 3, 1, 10),
      exportTtlHours: integer(env, "REPORT_EXPORT_TTL_HOURS", 24, 1, 720),
      maxRows: integer(env, "REPORT_EXPORT_MAX_ROWS", 10000, 1, 100000),
      exportRoot: resolve(process.cwd(), text(env, "REPORT_EXPORT_ROOT", "./data/report-exports")),
    },
    organizationAdmin: {
      invitationTtlHours: integer(env, "ORG_INVITATION_TTL_HOURS", 72, 1, 720),
      tokenDefaultTtlDays: integer(env, "ORG_TOKEN_DEFAULT_TTL_DAYS", 90, 1, 365),
      tokenMaxActive: integer(env, "ORG_TOKEN_MAX_ACTIVE", 20, 1, 200),
    },
    platformDashboard: {
      defaultWindow: text(env, "PLATFORM_DASHBOARD_DEFAULT_WINDOW", "24h") as "15m"|"24h"|"7d"|"30d",
      queueWarning: integer(env, "PLATFORM_DASHBOARD_QUEUE_WARNING", 1000, 1, 1000000),
      errorLimit: integer(env, "PLATFORM_DASHBOARD_ERROR_LIMIT", 20, 1, 100),
    },
    collectionConsole: { recentLimit: integer(env, "COLLECTION_CONSOLE_RECENT_LIMIT", 50, 10, 200) },
    securityOperations: { defaultWindow: text(env,"SECURITY_OPERATIONS_DEFAULT_WINDOW","24h") as "24h"|"7d"|"30d", recentLimit: integer(env,"SECURITY_OPERATIONS_RECENT_LIMIT",50,10,200) },
    evidence: {
      maxRawBytes: integer(
        env,
        "EVIDENCE_MAX_RAW_BYTES",
        10485760,
        1024,
        104857600,
      ),
      downloadGrantSeconds: integer(
        env,
        "EVIDENCE_DOWNLOAD_GRANT_SECONDS",
        120,
        1,
        300,
      ),
    },
  };
  if (base.auth.passwordMaxLength < base.auth.passwordMinLength)
    throw new ConfigError(
      "AUTH_PASSWORD_MAX_LENGTH",
      "must be greater than or equal to AUTH_PASSWORD_MIN_LENGTH",
    );
  if (!["15m","24h","7d","30d"].includes(base.platformDashboard.defaultWindow))
    throw new ConfigError("PLATFORM_DASHBOARD_DEFAULT_WINDOW", "must be 15m, 24h, 7d or 30d");
  if(!["24h","7d","30d"].includes(base.securityOperations.defaultWindow))throw new ConfigError("SECURITY_OPERATIONS_DEFAULT_WINDOW","must be 24h, 7d or 30d");
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(base.security.credentialsMasterKeyVersion))
    throw new ConfigError(
      "CREDENTIALS_MASTER_KEY_VERSION",
      "must contain only letters, numbers, dot, underscore or hyphen",
    );
  if (!["true", "false"].includes(text(env, "PLAYWRIGHT_HEADLESS", "true")))
    throw new ConfigError("PLAYWRIGHT_HEADLESS", "must be true or false");
  if (
    text(env, "NOTIFICATION_EMAIL_DELIVERY_MODE", "placeholder") !==
    "placeholder"
  )
    throw new ConfigError(
      "NOTIFICATION_EMAIL_DELIVERY_MODE",
      "must be placeholder until a real provider contract is configured",
    );
  const safe = {
    ...base,
    database: { ...base.database, password: Boolean(base.database.password) },
    redis: { ...base.redis, password: Boolean(base.redis.password) },
    ai: { ...base.ai, apiKey: Boolean(base.ai.apiKey) },
    security: {
      sessionSecret: Boolean(base.security.sessionSecret),
      credentialsMasterKey: Boolean(base.security.credentialsMasterKey),
      credentialsMasterKeyVersion: base.security.credentialsMasterKeyVersion,
      evidenceDownloadSigningKey: Boolean(
        base.security.evidenceDownloadSigningKey,
      ),
    },
  };
  return {
    ...base,
    configFingerprint: createHash("sha256")
      .update(JSON.stringify(safe))
      .digest("hex"),
  };
}

export function loadPlatformSeedConfig(
  env: NodeJS.ProcessEnv = process.env,
): PlatformSeedConfig {
  const email = text(env, "PLATFORM_ADMIN_SEED_EMAIL").toLowerCase(),
    password = env.PLATFORM_ADMIN_SEED_PASSWORD ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new ConfigError("PLATFORM_ADMIN_SEED_EMAIL", "must be a valid email");
  if (password.length < 12 || password.length > 1024)
    throw new ConfigError(
      "PLATFORM_ADMIN_SEED_PASSWORD",
      "must contain 12 to 1024 characters",
    );
  return { email, password };
}
