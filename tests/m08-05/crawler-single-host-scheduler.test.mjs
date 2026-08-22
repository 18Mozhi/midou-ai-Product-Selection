import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const required = [
  "database/migrations/0034_crawler_scheduler_m08_05.up.sql",
  "database/migrations/0034_crawler_scheduler_m08_05.down.sql",
  "database/migrations/0061_crawler_completion_spool_status.up.sql",
  "database/migrations/0061_crawler_completion_spool_status.down.sql",
  "apps/api/src/crawler-scheduler-service.ts",
  "apps/api/src/crawler-scheduler-repository.ts",
  "apps/api/src/crawler-scheduler-routes.ts",
  "apps/worker/src/single-host-resource-probe.ts",
  "apps/web/src/components/CrawlerSchedulerCenter.vue",
  "apps/web/src/crawler-scheduler.css",
  "infra/baota/crawler-single-host-scheduler-manifest.json",
  "verification/crawler-scheduler-production-evidence.schema.json",
  "scripts/verify-crawler-scheduler-production.mjs",
  "scripts/verify-crawler-scheduler-live.mjs",
  "docs/architecture/m08-05-crawler-single-host-scheduler.md",
  "docs/runbooks/m08-05-crawler-single-host-scheduler.md",
  "tests/e2e/m08-05-crawler-scheduler.spec.ts",
  "verification/modules/M08-05.json",
];

test("M08-05.A01-A17 deliver a BaoTa-only single-host Crawler scheduler", async () => {
  const all = (await Promise.all(required.map((path) => readFile(path, "utf8")))).join("\n");
  for (const token of [
    "M08-05",
    "single_host",
    "worker",
    "crawler",
    "provider",
    "profile",
    "lease",
    "queued_tasks",
    "longest_queue_wait_seconds",
    "resource",
    "platform:operate",
    "request_id",
    "trace_id",
    "rollback",
    "baota",
  ])
    assert.match(all, new RegExp(token, "i"));
  assert.doesNotMatch(
    all,
    /systemctl\s|pm2\s+start|docker(?:-|\s)compose\s+up|load balancing enabled|backup server enabled|10000 users capability/i,
  );
});

test("M08-05.A02/A04/A12 fails closed on process counts leases provider quotas and resources", async () => {
  const { evaluateCrawlerScheduler } =
    await import("../../apps/api/dist/crawler-scheduler-service.js");
  const policy = {
    maximumWorkers: 1,
    maximumCrawlers: 1,
    maximumProviderConcurrency: 1,
    maximumLoadBasisPoints: 8500,
    minimumAvailableMemoryMb: 1024,
    minimumFreeDiskMb: 4096,
    staleAfterSeconds: 90,
  };
  const provider = {
    id: "provider",
    code: "source",
    configured_concurrency: 3,
    effective_concurrency: 1,
    active_leases: 0,
    queued_tasks: 0,
    longest_queue_wait_seconds: 0,
  };
  const base = {
    worker_instances: 1,
    crawler_instances: 1,
    active_worker_leases: 0,
    active_crawler_leases: 0,
    duplicate_lease_count: 0,
    expired_leases: {
      total: 0,
      task_count: 0,
      worker: 0,
      crawler: 0,
      provider: 0,
      oldest_expired_at: null,
    },
    active_leases: [],
    providers: [provider],
    profiles: [{ id: "profile", active_leases: 0 }],
    resource: {
      load_basis_points: 3000,
      available_memory_mb: 4096,
      free_disk_mb: 8192,
      observed_at: "2026-08-15T08:00:00.000Z",
    },
    receipt_spool: {
      pending_count: 0,
      pending_bytes: 0,
      quarantined_count: 0,
      quarantined_bytes: 0,
      oldest_pending_at: null,
      retention_days: 30,
      max_bytes: 536870912,
      minimum_free_disk_mb: 4096,
      free_disk_mb: 8192,
      observed_at: "2026-08-15T08:00:00.000Z",
    },
  };
  assert.equal(
    evaluateCrawlerScheduler(base, policy, new Date("2026-08-15T08:00:30.000Z")).state,
    "ready",
  );
  const warning = evaluateCrawlerScheduler(
    { ...base, resource: { ...base.resource, load_basis_points: 8000 } },
    policy,
    new Date("2026-08-15T08:00:30.000Z"),
  );
  assert.equal(warning.state, "warning");
  assert.ok(warning.findings.some((item) => item.code === "crawler_resource_warning"));
  const blocked = evaluateCrawlerScheduler(
    {
      ...base,
      worker_instances: 2,
      duplicate_lease_count: 1,
      providers: [{ ...provider, active_leases: 2 }],
    },
    policy,
    new Date("2026-08-15T08:00:30.000Z"),
  );
  assert.equal(blocked.state, "blocked");
  for (const code of [
    "crawler_worker_count_exceeded",
    "crawler_lease_duplicate",
    "crawler_provider_quota_exceeded",
  ])
    assert.ok(blocked.findings.some((item) => item.code === code));
  assert.equal(
    evaluateCrawlerScheduler(
      { ...base, resource: { ...base.resource, observed_at: "2026-08-15T07:58:00.000Z" } },
      policy,
      new Date("2026-08-15T08:00:30.000Z"),
    ).state,
    "blocked",
  );
  const receiptWarning = evaluateCrawlerScheduler(
    {
      ...base,
      receipt_spool: {
        ...base.receipt_spool,
        pending_bytes: 450_000_000,
        quarantined_count: 2,
        oldest_pending_at: "2026-07-15T08:00:00.000Z",
      },
    },
    policy,
    new Date("2026-08-15T08:00:30.000Z"),
  );
  assert.equal(receiptWarning.state, "warning");
  for (const code of [
    "crawler_completion_spool_capacity_warning",
    "crawler_completion_spool_retention_warning",
    "crawler_completion_spool_quarantine_pending",
  ])
    assert.ok(receiptWarning.findings.some((item) => item.code === code));
  const receiptBlocked = evaluateCrawlerScheduler(
    {
      ...base,
      receipt_spool: { ...base.receipt_spool, free_disk_mb: 2048 },
    },
    policy,
    new Date("2026-08-15T08:00:30.000Z"),
  );
  assert.equal(receiptBlocked.state, "blocked");
  assert.ok(
    receiptBlocked.findings.some((item) => item.code === "crawler_completion_spool_disk_stop"),
  );
});

test("M08-05 scheduler evaluates resource freshness after the host probe completes", async () => {
  const { CrawlerSchedulerService } =
    await import("../../apps/api/dist/crawler-scheduler-service.js");
  let clock = new Date("2026-08-15T08:00:00.000Z"),
    recorded = null;
  const repository = {
    snapshot: async () => ({
      active_worker_leases: 0,
      active_crawler_leases: 0,
      duplicate_lease_count: 0,
      expired_leases: {
        total: 0,
        task_count: 0,
        worker: 0,
        crawler: 0,
        provider: 0,
        oldest_expired_at: null,
      },
      active_leases: [],
      providers: [],
      profiles: [],
      trend: [],
      receipt_spool: {
        pending_count: 0,
        pending_bytes: 0,
        quarantined_count: 0,
        quarantined_bytes: 0,
        oldest_pending_at: null,
        retention_days: 30,
        max_bytes: 536870912,
        minimum_free_disk_mb: 4096,
        free_disk_mb: 8192,
        observed_at: clock.toISOString(),
      },
    }),
    record: async (input) => {
      recorded = input;
    },
    recoverExpired: async () => ({ recovered: 0 }),
  };
  const hostProbe = {
    snapshot: async () => {
      clock = new Date("2026-08-15T08:00:00.020Z");
      return {
        worker_instances: 1,
        crawler_instances: 1,
        resource: {
          load_basis_points: 1000,
          available_memory_mb: 4096,
          free_disk_mb: 8192,
          observed_at: clock.toISOString(),
        },
      };
    },
  };
  const service = new CrawlerSchedulerService(
    repository,
    hostProbe,
    {
      maximumWorkers: 1,
      maximumCrawlers: 1,
      maximumProviderConcurrency: 1,
      maximumLoadBasisPoints: 8500,
      minimumAvailableMemoryMb: 1024,
      minimumFreeDiskMb: 4096,
      staleAfterSeconds: 90,
    },
    () => clock,
  );
  const result = await service.read({ actorId: "actor", requestId: "request", traceId: "trace" });
  assert.equal(result.state, "ready");
  assert.equal(recorded.observedAt.toISOString(), clock.toISOString());
});
test("M08-05 classifies real BaoTa Node Worker and Python Crawler commands independently", async () => {
  const { classifyCrawlerSchedulerCommand } =
    await import("../../apps/api/dist/crawler-scheduler-probe.js");
  assert.deepEqual(classifyCrawlerSchedulerCommand("node apps/worker/dist/index.js"), {
    worker: true,
    crawler: false,
  });
  assert.deepEqual(
    classifyCrawlerSchedulerCommand(
      "/www/server/panel/pyenv/bin/python -m scoutops_crawler --env-file=/www/wwwroot/ai选品/config/product_scout.env",
    ),
    { worker: false, crawler: true },
  );
  assert.deepEqual(classifyCrawlerSchedulerCommand("node apps/backend/dist/server.js"), {
    worker: false,
    crawler: false,
  });
  assert.deepEqual(classifyCrawlerSchedulerCommand("python -m unrelated_module"), {
    worker: false,
    crawler: false,
  });
});
test("M08-05 independently observes the Node Worker and BaoTa Python Crawler", async () => {
  const [probe, ui, topology, manifest] = await Promise.all(
    [
      "apps/api/src/crawler-scheduler-probe.ts",
      "apps/web/src/components/CrawlerSchedulerCenter.vue",
      "apps/web/src/components/RuntimeTopologyCenter.vue",
      "infra/baota/service-manifest.json",
    ].map((path) => readFile(path, "utf8")),
  );
  assert.ok(probe.includes("python(?:3"));
  assert.ok(probe.includes("\\s+scoutops_crawler"));
  assert.match(probe, /crawler_instances:\s*crawler/);
  assert.doesNotMatch(probe, /crawler_instances:\s*worker/);
  assert.match(ui, /Python 采集运行时/);
  assert.match(ui, /Node Worker 与 Python Crawler/);
  assert.match(topology, /Node 后端负责 API 与 Worker，Python 项目负责采集桥接/);
  const pythonProjects = JSON.parse(manifest).objects.filter(
    (item) => item.kind === "baota-python-project",
  );
  assert.equal(pythonProjects.length, 1);
  assert.equal(pythonProjects[0].workingDirectory, "/www/wwwroot/ai选品/python");
  assert.match(pythonProjects[0].pythonVersion, /^3\.12\./);
  assert.match(pythonProjects[0].startCommand, /python -m scoutops_crawler/);
});

test("M08-05 Python Crawler separates main loop lease execution receipts and transport", async () => {
  const [
    entrypoint,
    mainLoop,
    leases,
    execution,
    receipts,
    transport,
    facade,
    feature,
    architecture,
  ] = await Promise.all(
    [
      "apps/crawler/scoutops_crawler/__main__.py",
      "apps/crawler/scoutops_crawler/main_loop.py",
      "apps/crawler/scoutops_crawler/lease_client.py",
      "apps/crawler/scoutops_crawler/execution_runner.py",
      "apps/crawler/scoutops_crawler/completion_receipts.py",
      "apps/crawler/scoutops_crawler/runtime_transport.py",
      "apps/crawler/scoutops_crawler/runtime_client.py",
      "docs/feature-map.json",
      "docs/architecture/m08-05-crawler-single-host-scheduler.md",
    ].map((path) => readFile(path, "utf8")),
  );
  assert.match(entrypoint, /from \.main_loop import run_loop/);
  assert.doesNotMatch(entrypoint, /PlaywrightBridge|client\.heartbeat|client\.complete/);
  assert.match(mainLoop, /def run_once[\s\S]*execute_lease[\s\S]*client\.complete/);
  assert.match(leases, /class CrawlerLeaseClient[\s\S]*def acquire[\s\S]*def heartbeat/);
  assert.match(execution, /def execute_lease[\s\S]*PlaywrightBridge/);
  assert.match(receipts, /class CompletionReceiptClient[\s\S]*created_at[\s\S]*_pending_sort_key/);
  assert.match(transport, /class CrawlerRuntimeTransport[\s\S]*max_attempts/);
  assert.match(facade, /CrawlerLeaseClient[\s\S]*CompletionReceiptClient/);
  for (const copy of [feature, architecture]) {
    assert.match(copy, /main_loop\.py|主循环/);
    assert.match(copy, /completion_receipts\.py|终态回执/);
  }
});

test("M08-05.A04/A06/A09 operations route is platform-only and never returns lease tokens", async () => {
  const { buildApp } = await import("../../apps/api/dist/app.js");
  const calls = [],
    dto = {
      state: "ready",
      topology: {
        mode: "single_host",
        worker_instances: 1,
        crawler_instances: 1,
        maximum_workers: 1,
        maximum_crawlers: 1,
      },
      leases: { active_worker: 0, active_crawler: 0, duplicate_count: 0 },
      expired_leases: {
        total: 0,
        task_count: 0,
        worker: 0,
        crawler: 0,
        provider: 0,
        oldest_expired_at: null,
      },
      active_leases: [],
      providers: [],
      profiles: [],
      resource: {
        load_basis_points: 1,
        available_memory_mb: 1,
        free_disk_mb: 1,
        observed_at: "2026-08-15T08:00:00.000Z",
      },
      findings: [],
      observed_at: "2026-08-15T08:00:00.000Z",
      capacity_claim: "unverified",
    };
  const service = {
    read: async (input) => (calls.push(["read", input]), dto),
    recoverExpired: async (input) => (
      calls.push(["recover", input]),
      { recovered: 0, observed_at: dto.observed_at }
    ),
    recoverProvider: async (input) => (
      calls.push(["recover-provider", input]),
      { provider_id: input.providerId, recovered: true }
    ),
  };
  const authorization = { authorize: async (input) => calls.push(["authorize", input]) },
    auth = { authenticate: async () => ({ user: { id: "00000000-0000-4000-8000-000000000805" } }) };
  const app = buildApp({
    crawlerScheduler: {
      service,
      authorization,
      auth,
      secureCookie: false,
      webOrigin: "http://127.0.0.1:5173",
    },
  });
  let response = await app.inject({
    method: "GET",
    url: "/api/v1/platform/operations/crawler-scheduler",
    headers: { cookie: "scoutops_session=test", "x-request-id": "request", "x-trace-id": "trace" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(calls[0][1].capability, "platform:operate");
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.doesNotMatch(response.body, /lease_token|token_hash|credential|cookie/i);
  response = await app.inject({
    method: "POST",
    url: "/api/v1/platform/operations/crawler-scheduler/recover-expired",
    headers: {
      cookie: "scoutops_session=test",
      origin: "http://127.0.0.1:5173",
      "idempotency-key": "recover-1",
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(calls.at(-1)[1].idempotencyKey, "recover-1");
  response = await app.inject({
    method: "POST",
    url: "/api/v1/platform/operations/crawler-scheduler/providers/00000000-0000-4000-8000-000000000855/recover",
    headers: {
      cookie: "scoutops_session=test",
      origin: "http://127.0.0.1:5173",
      "idempotency-key": "recover-provider-1",
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(calls.at(-1)[0], "recover-provider");
  assert.equal(calls.at(-1)[1].providerId, "00000000-0000-4000-8000-000000000855");
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/platform/operations/crawler-scheduler/recover-expired",
        headers: {
          cookie: "scoutops_session=test",
          origin: "https://evil.test",
          "idempotency-key": "recover-2",
        },
      })
    ).statusCode,
    403,
  );
  await app.close();
});

test("M08-05.A03/A05/A10/A13 migration config and runtime enforce one Worker and one Crawler", async () => {
  const [
    { loadRuntimeConfig },
    up,
    down,
    worker,
    workerStateMachine,
    crawler,
    openapi,
    featureMap,
    schema,
    env,
    manifest,
    evidenceSchema,
  ] = await Promise.all([
    import("../../packages/config/dist/index.js"),
    ...[
      "database/migrations/0034_crawler_scheduler_m08_05.up.sql",
      "database/migrations/0034_crawler_scheduler_m08_05.down.sql",
      "apps/worker/src/collection-task-worker.ts",
      "apps/worker/src/collection-task-state-machine.ts",
      "apps/api/src/mysql-crawler-runtime-repository.ts",
      "docs/openapi.yaml",
      "docs/feature-map.json",
      "config/schema.json",
      "config/env.example",
      "infra/baota/crawler-single-host-scheduler-manifest.json",
      "verification/crawler-scheduler-production-evidence.schema.json",
    ].map((path) => readFile(path, "utf8")),
  ]);
  for (const table of [
    "crawler_scheduler_leases",
    "crawler_scheduler_observations",
    "crawler_scheduler_operations",
  ])
    assert.ok(up.includes(`CREATE TABLE \`${table}\``));
  assert.match(up, /utf8mb4/);
  assert.doesNotMatch(up, /CHECK\s*\(|utf8mb4_0900|INVISIBLE\s+INDEX/i);
  assert.match(down, /DROP TABLE IF EXISTS `crawler_scheduler_leases`/);
  assert.match(worker, /MySqlCollectionTaskWorkerRepository/);
  assert.match(workerStateMachine, /crawler_scheduler_leases/);
  assert.match(crawler, /crawler_scheduler_leases/);
  const config = loadRuntimeConfig(
    {
      NODE_ENV: "test",
      CRAWLER_SCHEDULER_MAX_LOAD_PERCENT: "80",
      CRAWLER_SCHEDULER_MIN_AVAILABLE_MEMORY_MB: "2048",
      CRAWLER_SCHEDULER_MIN_FREE_DISK_MB: "8192",
      CRAWLER_SCHEDULER_STALE_AFTER_SECONDS: "60",
    },
    "api",
  );
  assert.equal(config.crawlerScheduler.maximumWorkers, 1);
  assert.equal(config.crawlerScheduler.maximumCrawlers, 1);
  assert.equal(config.crawlerScheduler.maximumProviderConcurrency, 1);
  assert.equal(config.crawlerScheduler.maximumLoadBasisPoints, 8000);
  assert.equal(config.crawlerScheduler.minimumAvailableMemoryMb, 2048);
  assert.equal(config.crawlerScheduler.minimumFreeDiskMb, 8192);
  assert.equal(config.crawlerScheduler.staleAfterSeconds, 60);
  for (const key of [
    "CRAWLER_SCHEDULER_MAX_LOAD_PERCENT",
    "CRAWLER_SCHEDULER_MIN_AVAILABLE_MEMORY_MB",
    "CRAWLER_SCHEDULER_MIN_FREE_DISK_MB",
    "CRAWLER_SCHEDULER_STALE_AFTER_SECONDS",
    "CRAWLER_SCHEDULER_PRODUCTION_EVIDENCE_FILE",
  ]) {
    assert.match(schema, new RegExp(key));
    assert.match(env, new RegExp(key));
  }
  for (const source of [openapi, featureMap, manifest, evidenceSchema])
    assert.match(source, /M08-05|crawler scheduler|Crawler 单机调度/i);
});

test("M08-05 scheduler observation write has a complete transaction and matching placeholders", async () => {
  const { CrawlerSchedulerRepository } =
    await import("../../apps/api/dist/crawler-scheduler-repository.js");
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push(["begin"]),
    query: async (sql, values) => {
      calls.push([sql, values]);
      return [{}];
    },
    commit: async () => calls.push(["commit"]),
    rollback: async () => calls.push(["rollback"]),
    release: () => calls.push(["release"]),
  };
  const repository = new CrawlerSchedulerRepository({ getConnection: async () => connection });
  await repository.record({
    actorId: "actor",
    requestId: "request",
    traceId: "trace",
    observedAt: new Date("2026-08-15T08:00:00.000Z"),
    snapshot: {
      worker_instances: 1,
      crawler_instances: 1,
      active_worker_leases: 0,
      active_crawler_leases: 0,
      duplicate_lease_count: 0,
      expired_leases: {
        total: 0,
        task_count: 0,
        worker: 0,
        crawler: 0,
        provider: 0,
        oldest_expired_at: null,
      },
      active_leases: [],
      providers: [],
      profiles: [],
      resource: {
        load_basis_points: 1000,
        available_memory_mb: 4096,
        free_disk_mb: 8192,
        observed_at: "2026-08-15T08:00:00.000Z",
      },
    },
    evaluation: { state: "ready", findings: [] },
  });
  const writes = calls.filter(
    (item) => typeof item[0] === "string" && item[0].startsWith("INSERT"),
  );
  assert.equal(writes.length, 2);
  for (const [sql, values] of writes) assert.equal((sql.match(/\?/g) ?? []).length, values.length);
  assert.deepEqual(
    calls.map((item) => item[0]),
    ["begin", writes[0][0], writes[1][0], "commit", "release"],
  );
});

test("M08-05 Worker resource gate fails closed before queue or lease access", async () => {
  const { processCollectionTaskOnce } =
    await import("../../apps/worker/dist/collection-task-worker.js");
  let repositoryTouched = false;
  const repository = new Proxy(
    {},
    {
      get() {
        repositoryTouched = true;
        return async () => null;
      },
    },
  );
  const result = await processCollectionTaskOnce({
    repository,
    coordinator: {},
    executor: {},
    workerId: "worker-1",
    leaseSeconds: 30,
    resourceProbe: {
      inspect: async () => ({
        allowed: false,
        snapshot: {
          loadBasisPoints: 9000,
          availableMemoryMb: 512,
          freeDiskMb: 2048,
          observedAt: new Date("2026-08-15T08:00:00.000Z"),
        },
      }),
    },
  });
  assert.equal(result.status, "resource_blocked");
  assert.equal(repositoryTouched, false);
});

test("M08-05.A07/A08/A15/A16 UI and rollback cover the full image-grounded state contract", async () => {
  const [ui, e2e, architecture, runbook, verifier] = await Promise.all(
    [
      "apps/web/src/components/CrawlerSchedulerCenter.vue",
      "tests/e2e/m08-05-crawler-scheduler.spec.ts",
      "docs/architecture/m08-05-crawler-single-host-scheduler.md",
      "docs/runbooks/m08-05-crawler-single-host-scheduler.md",
      "scripts/verify-crawler-scheduler-production.mjs",
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
    "unavailable",
    "recovering",
  ])
    assert.match(ui, new RegExp(state));
  assert.match(e2e, /390/);
  assert.match(ui, /queueSummary[\s\S]*采集排队摘要/);
  assert.match(ui, /queueRiskText[\s\S]*高于近 24 小时 P95[\s\S]*饥饿风险/);
  for (const image of [
    "61_平台运营-概览.jpg",
    "62_采集来源管理.jpg",
    "63_采集任务监控.jpg",
    "64_系统监控.jpg",
    "69_异常告警.jpg",
    "10_霓虹科技平台驾驶舱_dashboard.png",
  ])
    assert.match(architecture, new RegExp(image.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(runbook, /## 回滚/);
  assert.match(verifier, /maximumWorkers===1/);
  assert.doesNotMatch(
    `${ui}\n${e2e}\n${runbook}`,
    /多节点已验证|10000 用户|负载均衡已启用|备用服务器已启用/i,
  );
});

test("M08-05 links leases and due provider queues without returning secrets", async () => {
  const { CrawlerSchedulerRepository } =
      await import("../../apps/api/dist/crawler-scheduler-repository.js"),
    now = new Date("2026-08-15T08:00:00.000Z");
  let providerQuery = "",
    providerValues = [];
  const pool = {
      query: async (sql, values) => {
        if (sql.startsWith("SELECT slot_type,COUNT")) return [[{ slot_type: "worker", total: 1 }]];
        if (sql.startsWith("SELECT p.id,p.code")) {
          providerQuery = sql;
          providerValues = values;
          return [
            [
              {
                id: "provider",
                code: "source",
                configured_concurrency: 2,
                effective_concurrency: 1,
                active_leases: 1,
                queued_tasks: 4,
                longest_queue_wait_seconds: 125,
                circuit_failure_threshold: 3,
                consecutive_failures: 3,
                last_error_code: "timeout",
                runtime_circuit_state: "open",
              },
            ],
          ];
        }
        if (sql.startsWith("SELECT p.id,COUNT")) return [[]];
        if (sql.startsWith("SELECT COUNT(*) total,COUNT"))
          return [
            [
              {
                total: 3,
                task_count: 1,
                worker: 1,
                crawler: 1,
                provider: 1,
                oldest_expired_at: new Date("2026-08-15T07:55:00.000Z"),
              },
            ],
          ];
        if (sql.includes("SELECT COUNT(*) total")) return [[{ total: 0 }]];
        if (sql.startsWith("SELECT l.slot_type"))
          return [
            [
              {
                slot_type: "provider",
                task_id: "00000000-0000-4000-8000-000000000861",
                run_id: null,
                lease_owner: "worker-main",
                heartbeat_at: now,
                expires_at: new Date("2026-08-15T08:01:00.000Z"),
                task_status: "running",
                provider_name: "Google 新闻检索",
              },
            ],
          ];
        if (sql.startsWith("SELECT q.provider_id,q.status"))
          return [
            [
              {
                provider_id: "provider",
                status: "succeeded",
                duration_ms: 800,
                queue_wait_seconds: 15,
              },
              {
                provider_id: "provider",
                status: "failed",
                duration_ms: 1200,
                queue_wait_seconds: 45,
              },
            ],
          ];
        if (sql.startsWith("SELECT FROM_UNIXTIME"))
          return [[{ bucket_at: now, total: 2, succeeded: 1, failed: 1 }]];
        if (sql.startsWith("SELECT pending_count"))
          return [
            [
              {
                pending_count: 1,
                pending_bytes: 1024,
                quarantined_count: 0,
                quarantined_bytes: 0,
                oldest_pending_at: new Date("2026-08-15T07:59:00.000Z"),
                retention_days: 30,
                max_bytes: 536870912,
                minimum_free_disk_mb: 4096,
                free_disk_mb: 8192,
                observed_at: now,
              },
            ],
          ];
        throw new Error(`unexpected query ${sql}`);
      },
    },
    result = await new CrawlerSchedulerRepository(pool).snapshot(now);
  assert.match(providerQuery, /COUNT\(DISTINCT t\.id\) queued_tasks/);
  assert.match(providerQuery, /TIMESTAMPDIFF\(SECOND,t\.available_at,\?\)/);
  assert.match(providerQuery, /t\.available_at<=\?/);
  assert.deepEqual(providerValues, [now, now, now]);
  assert.deepEqual(result.providers[0], {
    id: "provider",
    code: "source",
    configured_concurrency: 2,
    effective_concurrency: 1,
    active_leases: 1,
    queued_tasks: 4,
    longest_queue_wait_seconds: 125,
    queue_wait_p50_seconds: 15,
    queue_wait_p95_seconds: 45,
    sample_count_24h: 2,
    success_rate_basis_points_24h: 5000,
    duration_p95_ms_24h: 1200,
    circuit_state: "open",
    circuit_failure_threshold: 3,
    consecutive_failures: 3,
    last_error_code: "timeout",
  });
  assert.deepEqual(result.trend, [
    {
      bucket_at: "2026-08-15T08:00:00.000Z",
      total: 2,
      succeeded: 1,
      failed: 1,
      failure_rate_basis_points: 5000,
    },
  ]);
  assert.deepEqual(result.active_leases, [
    {
      slot_type: "provider",
      provider_name: "Google 新闻检索",
      task_id: "00000000-0000-4000-8000-000000000861",
      task_status: "running",
      run_id: null,
      process_role: "node_worker",
      process_ref: "worker-main",
      heartbeat_at: "2026-08-15T08:00:00.000Z",
      expires_at: "2026-08-15T08:01:00.000Z",
    },
  ]);
  assert.deepEqual(result.expired_leases, {
    total: 3,
    task_count: 1,
    worker: 1,
    crawler: 1,
    provider: 1,
    oldest_expired_at: "2026-08-15T07:55:00.000Z",
  });
  assert.deepEqual(result.receipt_spool, {
    pending_count: 1,
    pending_bytes: 1024,
    quarantined_count: 0,
    quarantined_bytes: 0,
    oldest_pending_at: "2026-08-15T07:59:00.000Z",
    retention_days: 30,
    max_bytes: 536870912,
    minimum_free_disk_mb: 4096,
    free_disk_mb: 8192,
    observed_at: "2026-08-15T08:00:00.000Z",
  });
  assert.doesNotMatch(JSON.stringify(result), /lease_token|token_hash|credential|cookie/i);
});

test("M08-05 recovers only one provider after a newer ready health check", async () => {
  const { CrawlerSchedulerRepository } =
      await import("../../apps/api/dist/crawler-scheduler-repository.js"),
    now = new Date("2026-08-15T08:00:00.000Z"),
    calls = [];
  const connection = {
    beginTransaction: async () => calls.push("begin"),
    commit: async () => calls.push("commit"),
    rollback: async () => calls.push("rollback"),
    release: () => calls.push("release"),
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.startsWith("SELECT result_json")) return [[]];
      if (sql.startsWith("SELECT id,status FROM providers"))
        return [[{ id: "00000000-0000-4000-8000-000000000855", status: "enabled" }]];
      if (sql.startsWith("SELECT state,opened_at"))
        return [[{ state: "open", opened_at: new Date("2026-08-15T07:00:00.000Z") }]];
      if (sql.startsWith("SELECT health_status"))
        return [
          [{ health_status: "ready", last_checked_at: new Date("2026-08-15T07:30:00.000Z") }],
        ];
      return [{ affectedRows: 1 }];
    },
  };
  const repository = new CrawlerSchedulerRepository({ getConnection: async () => connection }),
    result = await repository.recoverProvider({
      actorId: "00000000-0000-4000-8000-000000000805",
      providerId: "00000000-0000-4000-8000-000000000855",
      requestId: "request-recover-provider",
      traceId: "trace-recover-provider",
      idempotencyKey: "recover-provider-once",
      now,
    });
  assert.deepEqual(result, {
    provider_id: "00000000-0000-4000-8000-000000000855",
    recovered: true,
  });
  const update = calls.find(
    (item) => typeof item === "object" && item.sql.startsWith("UPDATE provider_runtime_circuits"),
  );
  assert.ok(update);
  assert.deepEqual(update.values, [now, now, "00000000-0000-4000-8000-000000000855"]);
  assert.equal(calls.filter((item) => item === "commit").length, 1);
});
