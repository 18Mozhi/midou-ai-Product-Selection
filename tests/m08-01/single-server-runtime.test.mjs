import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const requiredFiles = [
  "database/migrations/0030_load_balancing_m08_01.up.sql",
  "database/migrations/0030_load_balancing_m08_01.down.sql",
  "database/migrations/0062_runtime_process_restart_observations.up.sql",
  "database/migrations/0062_runtime_process_restart_observations.down.sql",
  "database/migrations/0063_runtime_health_endpoint_probes.up.sql",
  "database/migrations/0063_runtime_health_endpoint_probes.down.sql",
  "packages/runtime-topology/src/index.ts",
  "apps/api/src/runtime-health-probe.ts",
  "apps/api/src/mysql-runtime-health-probe-repository.ts",
  "apps/api/src/mysql-runtime-topology-repository.ts",
  "apps/api/src/runtime-topology-routes.ts",
  "apps/web/src/components/RuntimeTopologyCenter.vue",
  "apps/web/src/runtime-topology.css",
  "infra/baota/single-server-manifest.json",
  "verification/single-server-production-evidence.schema.json",
  "scripts/verify-single-server-production.mjs",
  "scripts/single-server-evidence.mjs",
  "scripts/verify-runtime-topology-live.mjs",
  "docs/architecture/m08-01-single-server.md",
  "docs/runbooks/m08-01-single-server.md",
  "tests/e2e/m08-01-single-server.spec.ts",
];

test("M08-01.A01-A17 deliver a Baota-only single-server runtime boundary", async () => {
  const values = await Promise.all(requiredFiles.map((path) => readFile(path, "utf8")));
  const all = values.join("\n");
  for (const token of [
    "M08-01",
    "platform:operate",
    "/api/v1/platform/operations/topology",
    "/api/v1/health/nodes",
    "RUNTIME_NODE_ID",
    "single_host",
    "baota",
    "rollback",
    "backupServerUsed",
    "loadBalancingEnabled",
    "restart_trend",
  ])
    assert.match(all, new RegExp(token, "i"));
  assert.doesNotMatch(
    all,
    /systemctl\s|docker(?:-|\s)compose\s+up|pm2\s+start|10000 users supported/i,
  );
});

test("M08-01 queue monitoring exposes scheduler aging policy and factual delay", async () => {
  const [scheduler, service, web, openapi, architecture, runbook, feature] = await Promise.all(
    [
      "apps/worker/src/queue-scheduler.ts",
      "apps/api/src/runtime-topology-service.ts",
      "apps/web/src/components/RuntimeTopologyCenter.vue",
      "docs/openapi.yaml",
      "docs/architecture/m08-01-single-server.md",
      "docs/runbooks/m08-01-single-server.md",
      "docs/feature-map.json",
    ].map((path) => readFile(path, "utf8")),
  );
  for (const field of ["aging_interval_ms", "maximum_aging_boost"])
    for (const contract of [scheduler, service, openapi]) assert.match(contract, new RegExp(field));
  for (const copy of ["队列老化与实际调度延迟", "已老化队列", "饥饿风险", "实际调度延迟"])
    assert.match(web, new RegExp(copy));
  assert.match(architecture, /最大老化增益/);
  assert.match(runbook, /饥饿风险/);
  assert.match(JSON.parse(feature).implementation.runtimeTopology.truthBoundary, /starvation risk/);
});

test("M08-01 continuously probes only fixed health endpoints and records bounded outcomes", async () => {
  const { RuntimeHealthProbeMonitor, RUNTIME_HEALTH_ENDPOINTS } =
    await import("../../apps/api/dist/runtime-health-probe.js");
  const writes = [];
  const repository = {
    record: async (input) => writes.push(input),
    summarize: async () => [],
  };
  const monitor = new RuntimeHealthProbeMonitor(
    repository,
    { intervalMs: 30_000, timeoutMs: 5, windowMinutes: 60, retentionHours: 72 },
    async ({ path, signal }) => {
      if (path.endsWith("/live")) return { statusCode: 200 };
      if (path.endsWith("/ready")) return { statusCode: 503 };
      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    },
  );
  assert.deepEqual(
    RUNTIME_HEALTH_ENDPOINTS.map((item) => item.endpoint),
    ["live", "ready", "available"],
  );
  assert.equal(await monitor.runCycle(), true);
  assert.deepEqual(
    writes[0].samples.map((item) => [item.endpoint, item.outcome, item.statusCode]),
    [
      ["live", "succeeded", 200],
      ["ready", "http_error", 503],
      ["available", "timeout", null],
    ],
  );
  assert.equal(writes[0].retentionHours, 72);
  assert.ok(writes[0].samples.every((item) => !("body" in item)));
});

test("M08-01 health probe repository calculates endpoint P50 P95 P99 and timeout counts", async () => {
  const { MySqlRuntimeHealthProbeRepository } =
    await import("../../apps/api/dist/mysql-runtime-health-probe-repository.js");
  const observedAt = new Date("2026-08-22T10:00:00.000Z");
  const rows = [10, 20, 30, 40, 50].map((latency, index) => ({
    endpoint: "live",
    outcome: index === 4 ? "timeout" : "succeeded",
    status_code: index === 4 ? null : 200,
    latency_ms: latency,
    observed_at: new Date(observedAt.getTime() - (5 - index) * 1000),
  }));
  const repository = new MySqlRuntimeHealthProbeRepository({
    query: async () => [rows],
  });
  const summaries = await repository.summarize({ observedAt, windowMinutes: 60 });
  const live = summaries.find((item) => item.endpoint === "live");
  assert.deepEqual(
    {
      sample_count: live.sample_count,
      timeout_count: live.timeout_count,
      availability_basis_points: live.availability_basis_points,
      latency_p50_ms: live.latency_p50_ms,
      latency_p95_ms: live.latency_p95_ms,
      latency_p99_ms: live.latency_p99_ms,
    },
    {
      sample_count: 5,
      timeout_count: 1,
      availability_basis_points: 8000,
      latency_p50_ms: 30,
      latency_p95_ms: 50,
      latency_p99_ms: 50,
    },
  );
});

test("M08-01 runtime alerts correlate exact queues and allowlisted business objects", async () => {
  const [scheduler, pollers, service, web, openapi, architecture, runbook, feature] =
    await Promise.all(
      [
        "apps/worker/src/queue-scheduler.ts",
        "apps/worker/src/worker-pollers.ts",
        "apps/api/src/runtime-topology-service.ts",
        "apps/web/src/components/RuntimeTopologyCenter.vue",
        "docs/openapi.yaml",
        "docs/architecture/m08-01-single-server.md",
        "docs/runbooks/m08-01-single-server.md",
        "docs/feature-map.json",
      ].map((path) => readFile(path, "utf8")),
    );
  for (const field of [
    "last_result_error_code",
    "last_business_objects",
    "root_cause_code",
    "business_objects",
  ])
    assert.match(`${scheduler}\n${service}\n${openapi}`, new RegExp(field));
  assert.match(pollers, /normalizeQueueRunObservation/);
  assert.match(pollers, /\/platform-admin\/collection\?task=/);
  assert.match(pollers, /\/opportunities\//);
  assert.match(web, /关联队列/);
  assert.match(web, /关联业务对象/);
  assert.match(architecture, /不按队列类型猜测具体对象/);
  assert.match(runbook, /不得出现原始 payload/);
  assert.match(
    JSON.parse(feature).implementation.runtimeTopology.truthBoundary,
    /allowlisted exact object identifier/,
  );
});

test("M08-01.A02/A04/A12 requires exactly the configured single-host API heartbeat", async () => {
  const topology = await import("../../packages/runtime-topology/dist/index.js");
  const now = new Date("2026-08-14T00:00:00.000Z");
  const ready = topology.evaluateRuntimeTopology({
    now,
    staleAfterMs: 90_000,
    expectedNodeId: "api-primary",
    expectedHostId: "huizhou-single-host",
    nodes: [
      {
        nodeId: "api-primary",
        hostId: "huizhou-single-host",
        role: "api",
        status: "ready",
        lastHeartbeatAt: new Date(now.getTime() - 5_000),
      },
    ],
  });
  assert.equal(ready.state, "ready");
  assert.equal(ready.activeApiInstances, 1);
  assert.equal(ready.singleHost, true);

  const wrongHost = topology.evaluateRuntimeTopology({
    now,
    staleAfterMs: 90_000,
    expectedNodeId: "api-primary",
    expectedHostId: "huizhou-single-host",
    nodes: [
      {
        nodeId: "api-primary",
        hostId: "unexpected-host",
        role: "api",
        status: "ready",
        lastHeartbeatAt: now,
      },
    ],
  });
  assert.equal(wrongHost.state, "blocked");
  assert.ok(wrongHost.blockers.some((item) => item.code === "api_host_identity_mismatch"));

  const stale = topology.evaluateRuntimeTopology({
    now,
    staleAfterMs: 90_000,
    expectedNodeId: "api-primary",
    expectedHostId: "huizhou-single-host",
    nodes: [
      {
        nodeId: "api-primary",
        hostId: "huizhou-single-host",
        role: "api",
        status: "ready",
        lastHeartbeatAt: new Date(now.getTime() - 90_001),
      },
    ],
  });
  assert.equal(stale.state, "stale");
  assert.deepEqual(stale.staleNodeIds, ["api-primary"]);
});

test("M08-01.A06/A09/A11/A13 public health is sanitized and operations read is authorized and audited", async () => {
  const [{ buildApp }, { RuntimeTopologyService }] = await Promise.all([
    import("../../apps/api/dist/app.js"),
    import("../../apps/api/dist/runtime-topology-service.js"),
  ]);
  const calls = [];
  const now = new Date("2026-08-14T02:00:00.000Z");
  const repository = {
    snapshot: async () => ({
      nodes: [
        {
          nodeId: "api-primary",
          hostId: "huizhou-single-host",
          role: "api",
          status: "ready",
          region: "惠州",
          zone: "primary",
          buildSha: "a".repeat(40),
          version: "0.1.0",
          lastHeartbeatAt: now,
        },
      ],
    }),
    recordView: async (input) => calls.push(["audit", input]),
    heartbeat: async () => {},
  };
  const service = new RuntimeTopologyService(
    repository,
    { expectedNodeId: "api-primary", expectedHostId: "huizhou-single-host", staleAfterMs: 90_000 },
    () => now,
  );
  const authorization = { authorize: async (input) => calls.push(["authorize", input]) };
  const auth = {
    authenticate: async () => ({
      user: { id: "00000000-0000-4000-8000-000000000801" },
      session: { id: "session" },
    }),
  };
  const app = buildApp({ runtimeTopology: { service, authorization, auth, secureCookie: false } });

  const health = await app.inject({
    method: "GET",
    url: "/api/v1/health/nodes",
    headers: { "x-request-id": "health-request", "x-trace-id": "health-trace" },
  });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(Object.keys(health.json().data).sort(), [
    "active_api_instances",
    "mode",
    "observed_at",
    "single_host",
    "stale_node_count",
    "state",
  ]);
  assert.doesNotMatch(health.body, /node_id|host_id|build_sha|evidence_sha256/i);

  const operations = await app.inject({
    method: "GET",
    url: "/api/v1/platform/operations/topology",
    headers: {
      cookie: "scoutops_session=test",
      "x-request-id": "topology-request",
      "x-trace-id": "topology-trace",
    },
  });
  assert.equal(operations.statusCode, 200);
  assert.equal(operations.headers["cache-control"], "private, no-store");
  assert.deepEqual(calls[0][1], {
    actorId: "00000000-0000-4000-8000-000000000801",
    capability: "platform:operate",
    surface: "api",
    requestId: "topology-request",
    traceId: "topology-trace",
  });
  assert.equal(calls[1][0], "audit");
  assert.equal(operations.json().data.mode, "single_host");
  assert.equal(operations.json().data.load_balancing_enabled, false);
  assert.equal(operations.json().data.multi_node_claim, false);
  assert.equal(operations.json().data.capacity_claim, "unverified");
  assert.equal(operations.json().data.backup_server_used, false);
  await app.close();
});

test("M08-01 topology classifies a database outage as a recoverable 503", async () => {
  const { buildApp } = await import("../../apps/api/dist/app.js");
  const app = buildApp({
    runtimeTopology: {
      service: {
        read: async () => {
          throw Object.assign(new Error("database unavailable"), { code: "ECONNREFUSED" });
        },
      },
      authorization: { authorize: async () => ({ reason: "allowed_platform" }) },
      auth: {
        authenticate: async () => ({
          user: { id: "00000000-0000-4000-8000-000000000801" },
          session: { id: "session" },
        }),
      },
      secureCookie: false,
    },
  });
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/platform/operations/topology",
    headers: {
      cookie: "scoutops_session=test",
      "x-request-id": "topology-database-down",
      "x-trace-id": "topology-database-down",
    },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "runtime_topology_dependency_unavailable");
  assert.equal(response.json().request_id, "topology-database-down");
  assert.doesNotMatch(response.body, /database unavailable|ECONNREFUSED/i);
  await app.close();
});

test("M08-01 topology Web read is single-flight, bounded and does not call idle queues waiting", async () => {
  const web = await readFile("apps/web/src/components/RuntimeTopologyCenter.vue", "utf8");
  for (const token of [
    "if (controller) return",
    "15_000",
    "已停止本次请求并保留上次成功的运行事实",
    "queue.due",
    "当前没有等待、运行或异常队列",
    "查看全部 ${queueRows.length} 个队列策略",
    "未进入等待队列",
  ])
    assert.match(web, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(web, /queue\.queue_delay_ms > 0\s*\? "等待中"/);
});

test("M08-01.A04/A16 fails closed for missing stale stopped or mismatched API", async () => {
  const { RuntimeTopologyService } =
    await import("../../apps/api/dist/runtime-topology-service.js");
  const now = new Date("2026-08-14T02:00:00.000Z");
  const policy = {
    expectedNodeId: "api-primary",
    expectedHostId: "huizhou-single-host",
    staleAfterMs: 90_000,
  };
  for (const [nodes, expected] of [
    [[], "empty"],
    [
      [
        {
          nodeId: "api-primary",
          hostId: "huizhou-single-host",
          role: "api",
          status: "stopped",
          lastHeartbeatAt: now,
        },
      ],
      "blocked",
    ],
    [
      [
        {
          nodeId: "api-primary",
          hostId: "huizhou-single-host",
          role: "api",
          status: "ready",
          lastHeartbeatAt: new Date(now.getTime() - 90_001),
        },
      ],
      "stale",
    ],
  ]) {
    const service = new RuntimeTopologyService(
      { snapshot: async () => ({ nodes }), recordView: async () => {}, heartbeat: async () => {} },
      policy,
      () => now,
    );
    assert.equal((await service.publicHealth()).state, expected);
  }
});

test("M08-01.A03/A10/A14 validates single-host config and transactional repository writes", async () => {
  const [{ loadRuntimeConfig }, { MySqlRuntimeTopologyRepository }] = await Promise.all([
    import("../../packages/config/dist/index.js"),
    import("../../apps/api/dist/mysql-runtime-topology-repository.js"),
  ]);
  const runtime = loadRuntimeConfig({}, "api");
  assert.equal(runtime.runtimeTopology.mode, "single_host");
  assert.deepEqual(
    {
      interval: runtime.runtimeTopology.healthProbeIntervalMs,
      timeout: runtime.runtimeTopology.healthProbeTimeoutMs,
      window: runtime.runtimeTopology.healthProbeWindowMinutes,
      retention: runtime.runtimeTopology.healthProbeRetentionHours,
    },
    { interval: 30_000, timeout: 5_000, window: 60, retention: 72 },
  );
  assert.equal(
    runtime.runtimeTopology.productionEvidenceFile.endsWith(
      "m08-01-single-server-production-evidence.json",
    ),
    true,
  );
  assert.throws(
    () => loadRuntimeConfig({ RUNTIME_TOPOLOGY_MODE: "multi_host" }, "api"),
    /RUNTIME_TOPOLOGY_MODE/,
  );
  assert.throws(() => loadRuntimeConfig({ RUNTIME_HOST_ID: "bad host" }, "api"), /RUNTIME_HOST_ID/);
  assert.throws(
    () =>
      loadRuntimeConfig(
        { RUNTIME_HEALTH_PROBE_WINDOW_MINUTES: "120", RUNTIME_HEALTH_PROBE_RETENTION_HOURS: "1" },
        "api",
      ),
    /RUNTIME_HEALTH_PROBE_WINDOW_MINUTES/,
  );

  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push("begin"),
    commit: async () => calls.push("commit"),
    rollback: async () => calls.push("rollback"),
    release: () => calls.push("release"),
    query: async (sql, values = []) => {
      assert.equal(values.length, (sql.match(/\?/g) ?? []).length, `placeholder mismatch: ${sql}`);
      calls.push(sql);
      if (sql.startsWith("SELECT id FROM runtime_nodes"))
        return [[{ id: "00000000-0000-4000-8000-000000000899" }]];
      return [[], []];
    },
  };
  const repository = new MySqlRuntimeTopologyRepository({ getConnection: async () => connection });
  const observedAt = new Date("2026-08-14T02:00:00.000Z");
  await repository.heartbeat({
    nodeId: "api-primary",
    hostId: "huizhou-single-host",
    region: "惠州",
    zone: "primary",
    buildSha: "a".repeat(40),
    version: "0.1.0",
    status: "ready",
    requestId: "request",
    traceId: "trace",
    observedAt,
  });
  await repository.recordView({
    actorId: "00000000-0000-4000-8000-000000000801",
    requestId: "request",
    traceId: "trace",
    observedAt,
    state: "ready",
    activeApiInstances: 1,
    processes: [
      { name: "api", status: "running", restartCount: 2 },
      { name: "worker", status: "running", restartCount: 1 },
    ],
  });
  assert.equal(calls.filter((item) => item === "begin").length, 2);
  assert.equal(calls.filter((item) => item === "commit").length, 2);
  assert.equal(calls.filter((item) => item === "release").length, 2);
  assert.equal(calls.filter((item) => item === "rollback").length, 0);
  assert.ok(
    calls.every((item) => typeof item !== "string" || !item.includes("load_balancer_observations")),
  );
  assert.equal(
    calls.filter(
      (item) => typeof item === "string" && item.startsWith("INSERT INTO runtime_process_restart"),
    ).length,
    2,
  );
});

test("M08-01 keeps a truthful 24-hour process restart trend and marks counter resets", async () => {
  const { RuntimeTopologyService } =
    await import("../../apps/api/dist/runtime-topology-service.js");
  const now = new Date("2026-08-14T02:10:00.000Z"),
    views = [];
  const service = new RuntimeTopologyService(
    {
      snapshot: async () => ({
        nodes: [
          {
            nodeId: "api-primary",
            hostId: "huizhou-single-host",
            role: "api",
            status: "ready",
            region: "惠州",
            zone: "primary",
            buildSha: "a".repeat(40),
            version: "0.1.0",
            lastHeartbeatAt: now,
          },
        ],
        processHistory: [
          {
            process_name: "api",
            status: "running",
            restart_count: 2,
            observed_at: "2026-08-14T02:00:00.000Z",
          },
          {
            process_name: "worker",
            status: "running",
            restart_count: 5,
            observed_at: "2026-08-14T02:00:00.000Z",
          },
          {
            process_name: "api",
            status: "running",
            restart_count: 4,
            observed_at: "2026-08-14T02:05:00.000Z",
          },
          {
            process_name: "worker",
            status: "running",
            restart_count: 1,
            observed_at: "2026-08-14T02:05:00.000Z",
          },
        ],
      }),
      recordView: async (input) => views.push(input),
      heartbeat: async () => {},
    },
    {
      expectedNodeId: "api-primary",
      expectedHostId: "huizhou-single-host",
      staleAfterMs: 90_000,
      restartAlertThreshold: 20,
      supervisorSnapshot: async () => ({
        supervisor_pid: 1200,
        status: "ready",
        processes: {
          api: {
            status: "running",
            pid: 1201,
            restart_count: 5,
            ready_at: now.toISOString(),
            circuit_open_until: null,
          },
          worker: {
            status: "running",
            pid: 1202,
            restart_count: 2,
            ready_at: now.toISOString(),
            circuit_open_until: null,
          },
        },
        observed_at: now.toISOString(),
      }),
    },
    () => now,
  );
  const result = await service.read({ actorId: "actor", requestId: "request", traceId: "trace" });
  assert.deepEqual(
    result.restart_trend
      .filter((sample) => sample.process_name === "api")
      .map((sample) => sample.restart_delta),
    [0, 2, 1],
  );
  assert.deepEqual(
    result.restart_trend
      .filter((sample) => sample.process_name === "worker")
      .map((sample) => [sample.restart_delta, sample.counter_reset]),
    [
      [0, false],
      [0, true],
      [1, false],
    ],
  );
  assert.deepEqual(views[0].processes, [
    { name: "api", status: "running", restartCount: 5 },
    { name: "worker", status: "running", restartCount: 2 },
  ]);
});

test("M08-01.A13/A16 production evidence proves one BaoTa host without load-balancing claims", async () => {
  const { validateSingleServerEvidence } = await import("../../scripts/single-server-evidence.mjs");
  const now = Date.parse("2026-08-14T04:00:00.000Z"),
    head = "a".repeat(40);
  const manifest = {
    topology: "single_host",
    loadBalancingEnabled: false,
    expectedHostCount: 1,
    productionRegion: "惠州",
  };
  const evidence = {
    schemaVersion: 1,
    module: "M08-01",
    status: "ready",
    buildSha: head,
    manager: "baota",
    topology: "single_host",
    region: "惠州",
    host: {
      hostId: "huizhou-single-host",
      manager: "baota",
      region: "惠州",
      roles: ["site", "api"],
      privateServices: true,
    },
    api: {
      nodeId: "api-primary",
      hostId: "huizhou-single-host",
      status: "ready",
      ready: true,
      buildSha: head,
      loopbackHost: "127.0.0.1",
      publicPortExposed: false,
      lastHeartbeatAt: "2026-08-14T03:59:50.000Z",
    },
    nginx: {
      managedBy: "baota_site",
      mode: "single_upstream_reverse_proxy",
      tlsProbeReady: true,
      sseBufferingOff: true,
    },
    loadBalancingEnabled: false,
    backupServerUsed: false,
    multiNodeClaim: false,
    capacityClaim: "unverified",
    capturedAt: "2026-08-14T03:59:55.000Z",
  };
  assert.deepEqual(
    validateSingleServerEvidence({ evidence, manifest, head, now, maxAgeMs: 300_000 }),
    { hostId: "huizhou-single-host", activeApiInstances: 1 },
  );
  assert.throws(
    () =>
      validateSingleServerEvidence({
        evidence: { ...evidence, loadBalancingEnabled: true },
        manifest,
        head,
        now,
        maxAgeMs: 300_000,
      }),
    /claim_invalid/,
  );
  assert.throws(
    () =>
      validateSingleServerEvidence({
        evidence: { ...evidence, api: { ...evidence.api, hostId: "other-host" } },
        manifest,
        head,
        now,
        maxAgeMs: 300_000,
      }),
    /host_identity_invalid/,
  );
  assert.throws(
    () =>
      validateSingleServerEvidence({
        evidence: { ...evidence, capturedAt: "2026-08-14T03:00:00.000Z" },
        manifest,
        head,
        now,
        maxAgeMs: 300_000,
      }),
    /evidence_stale/,
  );
});
