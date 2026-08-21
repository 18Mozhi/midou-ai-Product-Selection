import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const requiredFiles = [
  "database/migrations/0030_load_balancing_m08_01.up.sql",
  "database/migrations/0030_load_balancing_m08_01.down.sql",
  "packages/runtime-topology/src/index.ts",
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
  ])
    assert.match(all, new RegExp(token, "i"));
  assert.doesNotMatch(
    all,
    /systemctl\s|docker(?:-|\s)compose\s+up|pm2\s+start|10000 users supported/i,
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
  });
  assert.equal(calls.filter((item) => item === "begin").length, 2);
  assert.equal(calls.filter((item) => item === "commit").length, 2);
  assert.equal(calls.filter((item) => item === "release").length, 2);
  assert.equal(calls.filter((item) => item === "rollback").length, 0);
  assert.ok(
    calls.every((item) => typeof item !== "string" || !item.includes("load_balancer_observations")),
  );
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
