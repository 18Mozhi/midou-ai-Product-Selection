import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const requiredFiles = [
  "database/migrations/0031_redis_resilience_m08_02.up.sql",
  "database/migrations/0031_redis_resilience_m08_02.down.sql",
  "apps/api/src/redis-resilience-service.ts",
  "apps/api/src/mysql-redis-resilience-repository.ts",
  "apps/api/src/redis-resilience-routes.ts",
  "apps/web/src/components/RedisResilienceCenter.vue",
  "apps/web/src/redis-resilience.css",
  "infra/baota/redis-single-instance-manifest.json",
  "verification/redis-resilience-production-evidence.schema.json",
  "scripts/verify-redis-resilience-production.mjs",
  "docs/architecture/m08-02-redis-resilience.md",
  "docs/runbooks/m08-02-redis-resilience.md",
  "tests/e2e/m08-02-redis-resilience.spec.ts",
  "verification/modules/M08-02.json",
];

test("M08-02.A01-A17 deliver a BaoTa-only Redis single-instance resilience boundary", async () => {
  const all = (await Promise.all(requiredFiles.map((path) => readFile(path, "utf8")))).join("\n");
  for (const token of [
    "M08-02",
    "single_instance",
    "appendonly",
    "maxmemory",
    "maxclients",
    "platform:operate",
    "request_id",
    "trace_id",
    "rollback",
    "baota",
  ]) {
    assert.match(all, new RegExp(token, "i"));
  }
  assert.doesNotMatch(
    all,
    /sentinel\s+(?:monitor|on)|cluster-enabled\s+yes|replicaof\s+\S+|systemctl\s|pm2\s+start|docker(?:-|\s)compose\s+up/i,
  );
});

test("M08-02.A02/A04/A12 evaluates persistence memory and connection limits without capacity claims", async () => {
  const { evaluateRedisResilience } = await import("../../packages/redis/dist/index.js");
  const policy = {
    memoryWarningBasisPoints: 7500,
    memoryStopBasisPoints: 9000,
    connectionWarningBasisPoints: 7500,
    connectionStopBasisPoints: 9000,
  };
  const base = {
    available: true,
    loading: false,
    appendOnlyEnabled: true,
    rdbEnabled: true,
    aofLastWriteStatus: "ok",
    rdbLastSaveStatus: "ok",
    usedMemoryBytes: 256,
    maxMemoryBytes: 1024,
    maxMemoryPolicy: "noeviction",
    connectedClients: 10,
    maxClients: 512,
    rejectedConnections: 0,
    evictedKeys: 0,
    uptimeSeconds: 120,
  };
  const ready = evaluateRedisResilience(base, policy);
  assert.equal(ready.state, "ready");
  assert.equal(ready.memoryUsageBasisPoints, 2500);
  assert.equal(ready.connectionUsageBasisPoints, 195);
  assert.equal(ready.capacityClaim, "unverified");
  assert.equal(ready.singleInstance, true);

  const warning = evaluateRedisResilience({ ...base, usedMemoryBytes: 800 }, policy);
  assert.equal(warning.state, "warning");
  assert.ok(warning.findings.some((item) => item.code === "redis_memory_warning"));

  const blocked = evaluateRedisResilience(
    { ...base, appendOnlyEnabled: false, maxMemoryBytes: 0 },
    policy,
  );
  assert.equal(blocked.state, "blocked");
  assert.ok(blocked.findings.some((item) => item.code === "redis_aof_disabled"));
  assert.ok(blocked.findings.some((item) => item.code === "redis_memory_unbounded"));
});

test("Redis keyspace sampling is bounded, memory-based and never returns scoped key identities", async () => {
  const { inspectRedisKeyspaceHotspots, REDIS_KEYSPACE_SAMPLE_LIMIT } =
    await import("../../packages/redis/dist/index.js");
  const organizationId = "00000000-0000-4000-8000-000000000891",
    workspaceId = "00000000-0000-4000-8000-000000000892",
    keys = [
      `scoutops:v1:queue:org:${organizationId}:ws:${workspaceId}:collection-task:task-a`,
      `scoutops:v1:queue:org:${organizationId}:ws:${workspaceId}:collection-ready:task-b`,
      `scoutops:v1:rate:org:${organizationId}:ws:${workspaceId}:login:user-a`,
      "scoutops:v1:queue:malformed",
    ],
    sizes = new Map([
      [keys[0], 900],
      [keys[1], 75],
      [keys[2], 25],
    ]),
    calls = [];
  const sample = await inspectRedisKeyspaceHotspots({
    ping: async () => "PONG",
    info: async () => "",
    configGet: async () => ({}),
    scan: async (cursor, options) => {
      calls.push([cursor, options]);
      return { cursor: "0", keys };
    },
    memoryUsage: async (key) => sizes.get(key) ?? null,
  });
  assert.equal(sample.status, "sampled");
  assert.equal(sample.sample_limit, REDIS_KEYSPACE_SAMPLE_LIMIT);
  assert.equal(sample.scanned_keys, 4);
  assert.equal(sample.measured_keys, 3);
  assert.equal(sample.ignored_keys, 1);
  assert.equal(sample.total_sampled_bytes, 1000);
  assert.deepEqual(calls, [["0", { MATCH: "scoutops:v1:*", COUNT: 32 }]]);
  assert.deepEqual(sample.hotspots, [
    {
      purpose: "queue",
      resource: "collection_task",
      sampled_keys: 1,
      sampled_bytes: 900,
      sampled_share_basis_points: 9000,
    },
    {
      purpose: "queue",
      resource: "collection_ready",
      sampled_keys: 1,
      sampled_bytes: 75,
      sampled_share_basis_points: 750,
    },
    {
      purpose: "rate",
      resource: "other",
      sampled_keys: 1,
      sampled_bytes: 25,
      sampled_share_basis_points: 250,
    },
  ]);
  assert.equal(sample.access_frequency_available, false);
  assert.doesNotMatch(
    JSON.stringify(sample),
    new RegExp(`${organizationId}|${workspaceId}|task-a|user-a`),
  );
});

test("Redis keyspace sampling stops at the fixed sample limit", async () => {
  const { inspectRedisKeyspaceHotspots, REDIS_KEYSPACE_SAMPLE_LIMIT } =
    await import("../../packages/redis/dist/index.js");
  let scanCalls = 0,
    memoryCalls = 0;
  const sample = await inspectRedisKeyspaceHotspots({
    ping: async () => "PONG",
    info: async () => "",
    configGet: async () => ({}),
    scan: async () => {
      scanCalls += 1;
      return {
        cursor: "9",
        keys: Array.from(
          { length: 200 },
          (_, index) =>
            `scoutops:v1:queue:org:org-${index}:ws:ws-${index}:collection-task:item-${index}`,
        ),
      };
    },
    memoryUsage: async () => (memoryCalls += 1),
  });
  assert.equal(scanCalls, 1);
  assert.equal(sample.scanned_keys, REDIS_KEYSPACE_SAMPLE_LIMIT);
  assert.equal(memoryCalls, REDIS_KEYSPACE_SAMPLE_LIMIT);
  assert.equal(sample.truncated, true);
});

test("keyspace sampling failure does not erase independent Redis resilience facts", async () => {
  const { inspectRedisResilience } = await import("../../packages/redis/dist/index.js");
  const snapshot = await inspectRedisResilience({
    ping: async () => "PONG",
    info: async (section) =>
      ({
        server: "uptime_in_seconds:600",
        persistence:
          "loading:0\naof_last_write_status:ok\nrdb_last_bgsave_status:ok\naof_last_bgrewrite_status:ok",
        memory: "used_memory:1024\nmaxmemory:4096\nmaxmemory_policy:noeviction",
        clients: "connected_clients:2\nmaxclients:512",
        stats: "rejected_connections:0\nevicted_keys:0",
      })[section] ?? "",
    configGet: async (parameter) =>
      ({
        appendonly: { appendonly: "yes" },
        save: { save: "3600 1" },
        maxmemory: { maxmemory: "4096" },
        "maxmemory-policy": { "maxmemory-policy": "noeviction" },
        maxclients: { maxclients: "512" },
      })[parameter] ?? {},
    scan: async () => {
      throw new Error("ACL denied");
    },
    memoryUsage: async () => 0,
  });
  assert.equal(snapshot.available, true);
  assert.equal(snapshot.usedMemoryBytes, 1024);
  assert.equal(snapshot.maxMemoryPolicy, "noeviction");
  assert.equal(snapshot.keyspaceSample.status, "unavailable");
  assert.equal(snapshot.keyspaceSample.unavailable_reason, "scan_failed");
});

test("Redis disconnect snapshot stays bounded and evaluates to a truthful blocked state", async () => {
  const { RedisResilienceService, unavailableRedisResilienceSnapshot } =
    await import("../../apps/api/dist/redis-resilience-service.js");
  const records = [];
  const service = new RedisResilienceService(
    { snapshot: async () => unavailableRedisResilienceSnapshot() },
    { record: async (input) => records.push(input) },
    {
      memoryWarningBasisPoints: 7500,
      memoryStopBasisPoints: 9000,
      connectionWarningBasisPoints: 7500,
      connectionStopBasisPoints: 9000,
    },
    () => new Date("2026-08-31T06:30:00.000Z"),
  );
  const result = await service.read({ actorId: "actor", requestId: "request", traceId: "trace" });
  assert.equal(result.state, "blocked");
  assert.ok(result.findings.some((item) => item.code === "redis_unavailable"));
  assert.equal(result.keyspace_sample.status, "unavailable");
  assert.equal(result.keyspace_sample.sample_limit, 128);
  assert.equal(records.length, 1);
});

test("M08-02.A06/A09/A11/A13 operations route is authorized audited and sanitized", async () => {
  const { buildApp } = await import("../../apps/api/dist/app.js");
  const calls = [];
  const service = {
    read: async (input) => {
      calls.push(["read", input]);
      return {
        state: "ready",
        mode: "single_instance",
        persistence: { aof_enabled: true, rdb_enabled: true },
        memory: { used_bytes: 1, max_bytes: 536870912, usage_basis_points: 0 },
        connections: { connected: 1, maximum: 512, usage_basis_points: 20 },
        keyspace_sample: {
          status: "sampled",
          basis: "bounded_memory_usage",
          sample_limit: 128,
          scanned_keys: 2,
          measured_keys: 2,
          ignored_keys: 0,
          failed_measurements: 0,
          total_sampled_bytes: 1024,
          truncated: false,
          access_frequency_available: false,
          unavailable_reason: null,
          hotspots: [
            {
              purpose: "queue",
              resource: "collection_task",
              sampled_keys: 2,
              sampled_bytes: 1024,
              sampled_share_basis_points: 10000,
            },
          ],
        },
        findings: [],
        single_instance: true,
        sentinel_enabled: false,
        cluster_enabled: false,
        capacity_claim: "unverified",
        observed_at: "2026-08-14T10:00:00.000Z",
      };
    },
  };
  const authorization = { authorize: async (input) => calls.push(["authorize", input]) };
  const auth = {
    authenticate: async () => ({
      user: { id: "00000000-0000-4000-8000-000000000802" },
      session: { id: "session" },
    }),
  };
  const app = buildApp({ redisResilience: { service, authorization, auth, secureCookie: false } });
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/platform/operations/redis",
    headers: {
      cookie: "scoutops_session=test",
      "x-request-id": "redis-request",
      "x-trace-id": "redis-trace",
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.equal(calls[0][1].capability, "platform:operate");
  assert.equal(calls[1][1].requestId, "redis-request");
  assert.doesNotMatch(response.body, /REDIS_PASSWORD|redis:\/\/|127\.0\.0\.1|6379/i);
  await app.close();
});

test("Redis operations route maps dependency failures to a correlated sanitized 503", async () => {
  const { buildApp } = await import("../../apps/api/dist/app.js");
  const failure = Object.assign(new Error("private database detail"), {
    code: "ER_LOCK_WAIT_TIMEOUT",
  });
  const app = buildApp({
    redisResilience: {
      service: { read: async () => Promise.reject(failure) },
      authorization: { authorize: async () => undefined },
      auth: {
        authenticate: async () => ({ user: { id: "actor" }, session: { id: "session" } }),
      },
      secureCookie: false,
    },
  });
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/platform/operations/redis",
    headers: {
      cookie: "scoutops_session=test",
      "x-request-id": "redis-failure-request",
      "x-trace-id": "redis-failure-trace",
    },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "redis_resilience_dependency_unavailable");
  assert.equal(response.json().request_id, "redis-failure-request");
  assert.doesNotMatch(response.body, /private database detail|ER_LOCK_WAIT_TIMEOUT|127\.0\.0\.1/);
  await app.close();
});

test("M08-02.A03/A10/A14 migration and configuration remain MySQL57 and backend-only", async () => {
  const [{ loadRuntimeConfig }, up, down, schema, env] = await Promise.all([
    import("../../packages/config/dist/index.js"),
    readFile("database/migrations/0031_redis_resilience_m08_02.up.sql", "utf8"),
    readFile("database/migrations/0031_redis_resilience_m08_02.down.sql", "utf8"),
    readFile("config/schema.json", "utf8"),
    readFile("config/env.example", "utf8"),
  ]);
  assert.match(up, /utf8mb4/);
  assert.doesNotMatch(up, /CHECK\s*\(|utf8mb4_0900/i);
  assert.match(down, /DROP TABLE/);
  const config = loadRuntimeConfig(
    {
      NODE_ENV: "test",
      REDIS_MEMORY_WARNING_PERCENT: "70",
      REDIS_MEMORY_STOP_PERCENT: "85",
      REDIS_CONNECTION_WARNING_PERCENT: "60",
      REDIS_CONNECTION_STOP_PERCENT: "90",
    },
    "api",
  );
  assert.deepEqual(config.redisResilience, {
    memoryWarningBasisPoints: 7000,
    memoryStopBasisPoints: 8500,
    connectionWarningBasisPoints: 6000,
    connectionStopBasisPoints: 9000,
    productionEvidenceFile: config.redisResilience.productionEvidenceFile,
    maximumEvidenceAgeMinutes: 60,
  });
  assert.throws(
    () =>
      loadRuntimeConfig(
        { REDIS_MEMORY_WARNING_PERCENT: "90", REDIS_MEMORY_STOP_PERCENT: "80" },
        "api",
      ),
    /REDIS_MEMORY/,
  );
  for (const key of [
    "REDIS_MEMORY_WARNING_PERCENT",
    "REDIS_MEMORY_STOP_PERCENT",
    "REDIS_CONNECTION_WARNING_PERCENT",
    "REDIS_CONNECTION_STOP_PERCENT",
    "REDIS_RESILIENCE_PRODUCTION_EVIDENCE_FILE",
    "REDIS_RESILIENCE_EVIDENCE_MAX_AGE_MINUTES",
  ]) {
    assert.match(schema, new RegExp(key));
    assert.match(env, new RegExp(key));
  }
});

test("M08-02.A04/A09/A14 persists observation view and audit in one transaction", async () => {
  const { MySqlRedisResilienceRepository } =
    await import("../../apps/api/dist/mysql-redis-resilience-repository.js");
  const calls = [],
    valueSets = [];
  const connection = {
    beginTransaction: async () => calls.push("begin"),
    commit: async () => calls.push("commit"),
    rollback: async () => calls.push("rollback"),
    release: () => calls.push("release"),
    query: async (sql, values = []) => {
      assert.equal(values.length, (sql.match(/\?/g) ?? []).length, `placeholder mismatch: ${sql}`);
      calls.push(sql);
      valueSets.push(values);
      return [[], []];
    },
  };
  const repository = new MySqlRedisResilienceRepository({ getConnection: async () => connection });
  await repository.record({
    actorId: "00000000-0000-4000-8000-000000000802",
    requestId: "request",
    traceId: "trace",
    observedAt: new Date("2026-08-14T10:00:00.000Z"),
    snapshot: {
      available: true,
      loading: false,
      appendOnlyEnabled: true,
      rdbEnabled: true,
      aofLastWriteStatus: "ok",
      rdbLastSaveStatus: "ok",
      usedMemoryBytes: 1,
      maxMemoryBytes: 536870912,
      maxMemoryPolicy: "noeviction",
      connectedClients: 1,
      maxClients: 512,
      rejectedConnections: 0,
      evictedKeys: 0,
      uptimeSeconds: 10,
      keyspaceSample: {
        status: "sampled",
        basis: "bounded_memory_usage",
        sample_limit: 128,
        scanned_keys: 1,
        measured_keys: 1,
        ignored_keys: 0,
        failed_measurements: 0,
        total_sampled_bytes: 64,
        truncated: false,
        access_frequency_available: false,
        unavailable_reason: null,
        hotspots: [
          {
            purpose: "queue",
            resource: "collection_task",
            sampled_keys: 1,
            sampled_bytes: 64,
            sampled_share_basis_points: 10000,
          },
        ],
      },
    },
    evaluation: {
      state: "ready",
      memoryUsageBasisPoints: 0,
      connectionUsageBasisPoints: 20,
      findings: [],
      singleInstance: true,
      sentinelEnabled: false,
      clusterEnabled: false,
      capacityClaim: "unverified",
    },
  });
  assert.deepEqual(
    calls.filter((item) => ["begin", "commit", "rollback", "release"].includes(item)),
    ["begin", "commit", "release"],
  );
  assert.equal(
    calls.filter((item) => typeof item === "string" && item.startsWith("INSERT INTO")).length,
    3,
  );
  const auditMetadata = valueSets
    .flat()
    .find((value) => typeof value === "string" && value.includes('"keyspace_sample"'));
  assert.match(auditMetadata, /bounded_memory_usage[\s\S]*collection_task/);
  assert.doesNotMatch(auditMetadata, /scoutops:v1:|organization_id|workspace_id|payload/);
});

test("M08-02.A07/A08/A15/A16 UI and production evidence cover full states and single-instance recovery", async () => {
  const [ui, e2e, manifest, architecture, runbook] = await Promise.all(
    [
      "apps/web/src/components/RedisResilienceCenter.vue",
      "tests/e2e/m08-02-redis-resilience.spec.ts",
      "infra/baota/redis-single-instance-manifest.json",
      "docs/architecture/m08-02-redis-resilience.md",
      "docs/runbooks/m08-02-redis-resilience.md",
    ].map((path) => readFile(path, "utf8")),
  );
  for (const state of [
    "loading",
    "ready",
    "warning",
    "blocked",
    "empty",
    "forbidden",
    "expired",
    "rate_limited",
    "timeout",
    "unavailable",
    "recovering",
  ])
    assert.match(ui, new RegExp(state));
  assert.match(
    ui,
    /键淘汰风险[\s\S]*max_memory_policy[\s\S]*键空间占用热点[\s\S]*不把内存占比冒充访问频率/,
  );
  assert.match(
    `${ui}\n${e2e}`,
    /bounded_memory_usage[\s\S]*sample_limit[\s\S]*access_frequency_available/,
  );
  assert.match(e2e, /390/);
  for (const token of ["AbortController", "15_000", "refreshing", "refreshFailure"])
    assert.match(ui, new RegExp(token));
  assert.match(manifest, /appendonly/);
  assert.match(manifest, /noeviction/);
  assert.match(architecture, /61_平台运营-概览\.jpg/);
  assert.match(architecture, /64_系统监控\.jpg/);
  assert.match(architecture, /69_异常告警\.jpg/);
  assert.match(architecture, /10_霓虹科技平台驾驶舱_dashboard\.png/);
  assert.match(runbook, /宝塔/);
  assert.match(runbook, /## 回滚/);
  assert.doesNotMatch(
    `${ui}\n${e2e}\n${manifest}\n${runbook}`,
    /sentinel_enabled\s*[:=]\s*true|cluster_enabled\s*[:=]\s*true|备用服务器已启用/i,
  );
});
