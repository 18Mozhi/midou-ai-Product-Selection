import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const required = [
  "database/migrations/0035_capacity_boundary_m08_06.up.sql",
  "database/migrations/0035_capacity_boundary_m08_06.down.sql",
  "apps/api/src/capacity-boundary-service.ts",
  "apps/api/src/capacity-boundary-repository.ts",
  "apps/api/src/capacity-boundary-routes.ts",
  "apps/web/src/components/CapacityBoundaryCenter.vue",
  "apps/web/src/capacity-boundary.css",
  "infra/baota/capacity-boundary-manifest.json",
  "verification/capacity-boundary-production-evidence.schema.json",
  "scripts/verify-capacity-boundary-production.mjs",
  "scripts/verify-capacity-boundary-live.mjs",
  "docs/architecture/m08-06-capacity-boundary.md",
  "docs/runbooks/m08-06-capacity-boundary.md",
  "tests/e2e/m08-06-capacity-boundary.spec.ts",
  "verification/modules/M08-06.json",
];

test("M08-06.A01-A17 deliver a measured BaoTa-only single-host capacity boundary", async () => {
  const all = (await Promise.all(required.map((path) => readFile(path, "utf8")))).join("\n");
  for (const token of [
    "M08-06",
    "single_host",
    "measured",
    "degradation",
    "archive",
    "recovery",
    "platform:operate",
    "request_id",
    "trace_id",
    "rollback",
    "baota",
  ])
    assert.match(all, new RegExp(token, "i"));
  assert.doesNotMatch(
    all,
    /systemctl\s|pm2\s+start|docker(?:-|\s)compose\s+up|multi-node verified|10000 users supported|load balancing enabled|backup server enabled/i,
  );
});

test("M08-06.A02/A04/A12 evaluates measured latency error queue resource recovery and last-passing-stage gates", async () => {
  const { evaluateCapacityBoundary } =
    await import("../../apps/api/dist/capacity-boundary-service.js");
  const policy = {
    readP95StopMs: 300,
    writeP95StopMs: 600,
    errorRateStopBasisPoints: 100,
    asyncLagStopSeconds: 60,
    maximumLoadBasisPoints: 8500,
    minimumAvailableMemoryMb: 1024,
    minimumFreeDiskMb: 4096,
    maximumEvidenceAgeMinutes: 60,
  };
  const ceiling = {
    measured_concurrency: 20,
    read_p95_ms: 120,
    write_p95_ms: 260,
    error_rate_basis_points: 0,
    async_lag_seconds: 2,
    load_basis_points: 3000,
    available_memory_mb: 4096,
    free_disk_mb: 8192,
    archive_verified: true,
    recovery_verified: true,
    boundary_stop_reason: "planning_ceiling_reached",
    failed_next_concurrency: null,
    failed_next_code: null,
    observed_at: "2026-08-15T08:00:00.000Z",
  };
  assert.equal(
    evaluateCapacityBoundary(ceiling, policy, new Date("2026-08-15T08:20:00.000Z")).state,
    "ready",
  );
  const limited = {
    ...ceiling,
    measured_concurrency: 5,
    boundary_stop_reason: "next_stage_gate_failed",
    failed_next_concurrency: 10,
    failed_next_code: "capacity_write_latency_exceeded",
  };
  const limitedEvaluation = evaluateCapacityBoundary(
    limited,
    policy,
    new Date("2026-08-15T08:20:00.000Z"),
  );
  assert.equal(limitedEvaluation.state, "warning");
  assert.ok(
    limitedEvaluation.findings.some((item) => item.code === "capacity_next_stage_gate_failed"),
  );
  const warning = evaluateCapacityBoundary(
    { ...ceiling, read_p95_ms: 270 },
    policy,
    new Date("2026-08-15T08:20:00.000Z"),
  );
  assert.equal(warning.state, "warning");
  assert.ok(warning.findings.some((item) => item.code === "capacity_read_latency_warning"));
  const blocked = evaluateCapacityBoundary(
    { ...ceiling, write_p95_ms: 601, recovery_verified: false },
    policy,
    new Date("2026-08-15T08:20:00.000Z"),
  );
  assert.equal(blocked.state, "blocked");
  for (const code of ["capacity_write_latency_exceeded", "capacity_recovery_unverified"])
    assert.ok(blocked.findings.some((item) => item.code === code));
  for (const finding of blocked.findings) {
    assert.equal(finding.owner_role_code, "platform_operations_admin");
    assert.equal(finding.owner_label, "平台运维管理员");
    assert.ok(finding.reason.length > 0);
  }
  assert.equal(
    evaluateCapacityBoundary(
      { ...limited, failed_next_concurrency: 20 },
      policy,
      new Date("2026-08-15T08:20:00.000Z"),
    ).state,
    "blocked",
  );
  assert.equal(
    evaluateCapacityBoundary(
      { ...ceiling, observed_at: "2026-08-15T06:00:00.000Z" },
      policy,
      new Date("2026-08-15T08:20:00.000Z"),
    ).state,
    "blocked",
  );
});

test("M08-06.A04/A06/A09 operations routes are platform-only and fail closed", async () => {
  const { buildApp } = await import("../../apps/api/dist/app.js");
  const calls = [],
    dto = {
      state: "warning",
      boundary: {
        measured_concurrency: 5,
        planning_users: 100,
        planning_concurrency_min: 5,
        planning_concurrency_max: 20,
        capacity_claim: "measured_single_host_limited",
        stop_reason: "next_stage_gate_failed",
        failed_next_concurrency: 10,
        failed_next_code: "capacity_write_latency_exceeded",
      },
      performance: {
        read_p95_ms: 120,
        write_p95_ms: 260,
        error_rate_basis_points: 0,
        async_lag_seconds: 2,
      },
      resource: { load_basis_points: 3000, available_memory_mb: 4096, free_disk_mb: 8192 },
      resilience: { archive_verified: true, recovery_verified: true },
      degradation: { mode: "shed_background", actions: ["不得扩大到并发 10。"] },
      findings: [
        {
          code: "capacity_next_stage_gate_failed",
          severity: "warning",
          action_hint: "不得扩大到并发 10。",
        },
      ],
      single_host: true,
      load_balancing_enabled: false,
      backup_server_used: false,
      multi_node_claim: false,
      observed_at: "2026-08-15T08:00:00.000Z",
    };
  const service = {
    read: async (input) => (calls.push(["read", input]), dto),
    attestDrill: async (input) => (
      calls.push(["drill", input]),
      { status: "verified", observed_at: dto.observed_at }
    ),
  };
  const authorization = { authorize: async (input) => calls.push(["authorize", input]) },
    auth = { authenticate: async () => ({ user: { id: "00000000-0000-4000-8000-000000000806" } }) };
  const app = buildApp({
    capacityBoundary: {
      service,
      authorization,
      auth,
      secureCookie: false,
      webOrigin: "http://127.0.0.1:5173",
    },
  });
  let response = await app.inject({
    method: "GET",
    url: "/api/v1/platform/operations/capacity",
    headers: { cookie: "scoutops_session=test" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(calls[0][1].capability, "platform:operate");
  assert.equal(response.json().data.boundary.failed_next_concurrency, 10);
  assert.doesNotMatch(response.body, /password|credential|cookie|host_path|sql_text/i);
  response = await app.inject({
    method: "POST",
    url: "/api/v1/platform/operations/capacity/drills",
    headers: {
      cookie: "scoutops_session=test",
      origin: "http://127.0.0.1:5173",
      "idempotency-key": "drill-1",
    },
    payload: { kind: "archive_recovery", reason: "季度单机收尾演练" },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(calls.at(-1)[1].idempotencyKey, "drill-1");
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/platform/operations/capacity/drills",
        headers: {
          cookie: "scoutops_session=test",
          origin: "https://evil.test",
          "idempotency-key": "drill-2",
        },
        payload: { kind: "archive_recovery", reason: "季度单机收尾演练" },
      })
    ).statusCode,
    403,
  );
  await app.close();
});

test("M08-06 capacity read has a cancellable timeout and sanitized dependency failures", async () => {
  const { buildApp } = await import("../../apps/api/dist/app.js");
  const authorization = { authorize: async () => undefined },
    auth = { authenticate: async () => ({ user: { id: "00000000-0000-4000-8000-000000000806" } }) };
  let aborted = false;
  let app = buildApp({
    capacityBoundary: {
      service: {
        read: ({ signal }) =>
          new Promise((_resolve, reject) =>
            signal.addEventListener(
              "abort",
              () => {
                aborted = true;
                reject(signal.reason);
              },
              { once: true },
            ),
          ),
        attestDrill: async () => ({ status: "verified", observed_at: new Date().toISOString() }),
      },
      authorization,
      auth,
      secureCookie: false,
      webOrigin: "http://127.0.0.1:5173",
      readTimeoutMs: 5,
    },
  });
  let response = await app.inject({
    method: "GET",
    url: "/api/v1/platform/operations/capacity",
    headers: { cookie: "scoutops_session=test" },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "capacity_boundary_read_timeout");
  assert.equal(aborted, true);
  await app.close();

  app = buildApp({
    capacityBoundary: {
      service: {
        read: async () => {
          throw Object.assign(new Error("connect ECONNREFUSED database:3306"), {
            code: "ECONNREFUSED",
          });
        },
        attestDrill: async () => ({ status: "verified", observed_at: new Date().toISOString() }),
      },
      authorization,
      auth,
      secureCookie: false,
      webOrigin: "http://127.0.0.1:5173",
    },
  });
  response = await app.inject({
    method: "GET",
    url: "/api/v1/platform/operations/capacity",
    headers: { cookie: "scoutops_session=test" },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "capacity_boundary_dependency_unavailable");
  assert.doesNotMatch(
    response.body,
    /database:3306|ECONNREFUSED|SELECT\s|INSERT\s|UPDATE\s|DELETE\s|password|cookie/i,
  );
  await app.close();
});

test("M08-06.A03/A10/A13 migration configuration and contracts stay MySQL57 and single-host", async () => {
  const [up, down, openapi, featureMap, schema, env, manifest, evidenceSchema] = await Promise.all(
    [
      "database/migrations/0035_capacity_boundary_m08_06.up.sql",
      "database/migrations/0035_capacity_boundary_m08_06.down.sql",
      "docs/openapi.yaml",
      "docs/feature-map.json",
      "config/schema.json",
      "config/env.example",
      "infra/baota/capacity-boundary-manifest.json",
      "verification/capacity-boundary-production-evidence.schema.json",
    ].map((path) => readFile(path, "utf8")),
  );
  for (const table of [
    "capacity_boundary_observations",
    "capacity_boundary_drills",
    "capacity_boundary_operations",
  ])
    assert.ok(up.includes(`CREATE TABLE \`${table}\``));
  assert.match(up, /utf8mb4/);
  assert.doesNotMatch(up, /CHECK\s*\(|utf8mb4_0900|INVISIBLE\s+INDEX/i);
  assert.match(down, /DROP TABLE IF EXISTS `capacity_boundary_observations`/);
  for (const key of [
    "CAPACITY_BOUNDARY_READ_P95_MS",
    "CAPACITY_BOUNDARY_WRITE_P95_MS",
    "CAPACITY_BOUNDARY_ERROR_RATE_PERCENT",
    "CAPACITY_BOUNDARY_ASYNC_LAG_SECONDS",
    "CAPACITY_BOUNDARY_PRODUCTION_EVIDENCE_FILE",
  ]) {
    assert.match(schema, new RegExp(key));
    assert.match(env, new RegExp(key));
  }
  for (const source of [openapi, featureMap, manifest, evidenceSchema])
    assert.match(source, /M08-06|capacity boundary|容量边界/i);
  assert.doesNotMatch(
    `${openapi}\n${featureMap}\n${manifest}`,
    /multi-node verified|10000 users supported|load balancing enabled/i,
  );
});

test("M08-06 capacity observation and drill writes are transactional", async () => {
  const { CapacityBoundaryRepository } =
    await import("../../apps/api/dist/capacity-boundary-repository.js");
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
  const repository = new CapacityBoundaryRepository({ getConnection: async () => connection });
  await repository.recordView({
    actorId: "actor",
    requestId: "request",
    traceId: "trace",
    observedAt: new Date("2026-08-15T08:00:00.000Z"),
    snapshot: {
      measured_concurrency: 5,
      read_p95_ms: 120,
      write_p95_ms: 260,
      error_rate_basis_points: 0,
      async_lag_seconds: 2,
      load_basis_points: 3000,
      available_memory_mb: 4096,
      free_disk_mb: 8192,
      archive_verified: true,
      recovery_verified: true,
      boundary_stop_reason: "next_stage_gate_failed",
      failed_next_concurrency: 10,
      failed_next_code: "capacity_write_latency_exceeded",
      observed_at: "2026-08-15T08:00:00.000Z",
    },
    evaluation: {
      state: "warning",
      findings: [
        {
          code: "capacity_next_stage_gate_failed",
          severity: "warning",
          action_hint: "不得扩大到并发 10。",
        },
      ],
    },
  });
  const writes = calls.filter(
    (item) => typeof item[0] === "string" && item[0].startsWith("INSERT"),
  );
  assert.equal(writes.length, 2);
  for (const [sql, values] of writes) assert.equal((sql.match(/\?/g) ?? []).length, values.length);
  assert.match(String(writes[1][1][5]), /failed_next_concurrency/);
  assert.deepEqual(
    calls.map((item) => item[0]),
    ["begin", writes[0][0], writes[1][0], "commit", "release"],
  );
});

test("M08-06 repository restores the signed boundary stop from MySQL JSON", async () => {
  const { CapacityBoundaryRepository } =
    await import("../../apps/api/dist/capacity-boundary-repository.js");
  const row = {
      measured_concurrency: 5,
      read_p95_ms: 10,
      write_p95_ms: 40,
      error_rate_basis_points: 0,
      async_lag_seconds: 0,
      load_basis_points: 100,
      available_memory_mb: 2048,
      free_disk_mb: 8192,
      archive_verified: 1,
      recovery_verified: 1,
      finding_codes_json: JSON.stringify([
        "capacity_boundary_stop:next_stage_gate_failed:10:capacity_write_latency_exceeded",
      ]),
      observed_at_utc: "2026-08-16T00:00:00.000Z",
    },
    repository = new CapacityBoundaryRepository({ query: async () => [[row]] });
  const snapshot = await repository.snapshot(new Date());
  assert.equal(snapshot.boundary_stop_reason, "next_stage_gate_failed");
  assert.equal(snapshot.failed_next_concurrency, 10);
  assert.equal(snapshot.failed_next_code, "capacity_write_latency_exceeded");
});

test("M08-06 repository treats signed DATETIME observations as UTC independently of the MySQL system timezone", async () => {
  const { CapacityBoundaryRepository } =
    await import("../../apps/api/dist/capacity-boundary-repository.js");
  let sql = "";
  const row = {
      measured_concurrency: 10,
      read_p95_ms: 10,
      write_p95_ms: 40,
      error_rate_basis_points: 0,
      async_lag_seconds: 0,
      load_basis_points: 100,
      available_memory_mb: 2048,
      free_disk_mb: 8192,
      archive_verified: 1,
      recovery_verified: 1,
      finding_codes_json: JSON.stringify([
        "capacity_boundary_stop:next_stage_gate_failed:20:capacity_write_latency_exceeded",
      ]),
      observed_at: new Date("2026-08-16T20:49:24.731Z"),
      observed_at_utc: "2026-08-16T16:49:24.731Z",
    },
    repository = new CapacityBoundaryRepository({
      query: async (query) => ((sql = query), [[row]]),
    });
  const snapshot = await repository.snapshot(new Date("2026-08-16T17:03:02.000Z"));
  assert.match(sql, /observed_at_utc/);
  assert.equal(snapshot.observed_at, "2026-08-16T16:49:24.731Z");
});

test("M08-06 archive recovery drill transaction has exact MySQL placeholders", async () => {
  const { CapacityBoundaryRepository } =
    await import("../../apps/api/dist/capacity-boundary-repository.js");
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push(["begin"]),
    query: async (sql, values) => {
      calls.push([sql, values]);
      if (sql.startsWith("SELECT result_json")) return [[]];
      if (sql.startsWith("SELECT id FROM capacity_boundary_observations"))
        return [[{ id: "observation" }]];
      return [{}];
    },
    commit: async () => calls.push(["commit"]),
    rollback: async () => calls.push(["rollback"]),
    release: () => calls.push(["release"]),
  };
  const repository = new CapacityBoundaryRepository({ getConnection: async () => connection });
  await repository.attestDrill({
    actorId: "actor",
    requestId: "request",
    traceId: "trace",
    idempotencyKey: "drill-key",
    kind: "archive_recovery",
    reason: "季度演练",
    now: new Date("2026-08-15T08:00:00.000Z"),
  });
  const writes = calls.filter(
    (item) => typeof item[0] === "string" && item[0].startsWith("INSERT"),
  );
  assert.equal(writes.length, 3);
  for (const [sql, values] of writes) assert.equal((sql.match(/\?/g) ?? []).length, values.length);
  assert.equal(calls.at(-2)[0], "commit");
  assert.equal(calls.at(-1)[0], "release");
});

test("M08-06.A07/A08/A15/A16 UI and rollback cover the complete image-grounded state contract", async () => {
  const [ui, e2e, architecture, runbook, verifier] = await Promise.all(
    [
      "apps/web/src/components/CapacityBoundaryCenter.vue",
      "tests/e2e/m08-06-capacity-boundary.spec.ts",
      "docs/architecture/m08-06-capacity-boundary.md",
      "docs/runbooks/m08-06-capacity-boundary.md",
      "scripts/verify-capacity-boundary-production.mjs",
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
    "verifying",
  ])
    assert.match(ui, new RegExp(state));
  for (const token of [
    "AbortController",
    "15_000",
    "refreshing",
    "refreshFailure",
    "drillIdempotencyKey",
    "preserveOperationMessage",
  ])
    assert.match(ui, new RegExp(token));
  assert.match(e2e, /390/);
  for (const image of [
    "61_平台运营-概览.jpg",
    "63_采集任务监控.jpg",
    "64_系统监控.jpg",
    "65_日志中心.jpg",
    "66_安全审计.jpg",
    "69_异常告警.jpg",
    "10_霓虹科技平台驾驶舱_dashboard.png",
  ])
    assert.match(architecture, new RegExp(image.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(runbook, /## 回滚/);
  assert.match(verifier, /measuredConcurrentUsers|measuredConcurrency/);
  assert.doesNotMatch(
    `${ui}\n${e2e}\n${runbook}`,
    /多节点已验证|10000 用户已支持|负载均衡已启用|备用服务器已启用/i,
  );
});

test("M08-06 BaoTa capacity capture verifies runtime identity without requiring git metadata", async () => {
  const source = await readFile("scripts/capture-capacity-boundary-production.mjs", "utf8");
  assert.doesNotMatch(source, /git[\s\S]{0,80}rev-parse|execFileSync/);
  assert.match(source, /BUILD_SHA/);
  assert.match(source, /health\/version/);
  assert.match(source, /status='healthy'/);
});

test("M08-06 failed capacity capture preserves schema v1 stage and threshold evidence", async () => {
  const [source, schema, runbook, featureMap] = await Promise.all(
    [
      "scripts/capture-capacity-boundary-production.mjs",
      "verification/capacity-boundary-production-evidence.schema.json",
      "docs/runbooks/m08-06-capacity-boundary.md",
      "docs/feature-map.json",
    ].map((path) => readFile(path, "utf8")),
  );
  for (const token of ["writeBlockedEvidence", "failedStage", "completedStages", "thresholds"])
    assert.match(source, new RegExp(token));
  assert.match(schema, /\"status\"\s*:\s*\{[^}]*\"blocked\"/);
  assert.match(schema, /\"failure\"/);
  assert.match(runbook, /失败证据.*已完成档位.*阈值.*失败码/);
  assert.match(featureMap, /failedStage|completedStages/);
});

test("M08-06 signs only the last passing stage and preserves the failed next-stage stop", async () => {
  const [source, verifier, runbook, featureMap] = await Promise.all(
    [
      "scripts/capture-capacity-boundary-production.mjs",
      "scripts/verify-capacity-boundary-production.mjs",
      "docs/runbooks/m08-06-capacity-boundary.md",
      "docs/feature-map.json",
    ].map((path) => readFile(path, "utf8")),
  );
  for (const token of ["boundaryStop", "lastPassingStage", "next_stage_gate_failed"])
    assert.match(source, new RegExp(token));
  assert.match(verifier, /measuredConcurrentUsers===evidence\.stages\.at/);
  assert.match(verifier, /boundaryStopValid/);
  assert.match(runbook, /最后通过档位/);
  assert.match(featureMap, /failedNextStage|last passing stage/i);
});

test("M08-06 schema v1 accepts ceiling, limited-boundary and blocked evidence only", async () => {
  const [{ default: Ajv2020 }, { default: addFormats }, source] = await Promise.all([
      import("ajv/dist/2020.js"),
      import("ajv-formats"),
      readFile("verification/capacity-boundary-production-evidence.schema.json", "utf8"),
    ]),
    ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  const validate = ajv.compile(JSON.parse(source)),
    stage = (concurrentUsers, writeP95Ms, resourceStopGatePassed = true) => ({
      concurrentUsers,
      durationSeconds: 60,
      readP95Ms: 10,
      writeP95Ms,
      errorRateBasisPoints: 0,
      asyncLagSeconds: 0,
      loadBasisPoints: 100,
      availableMemoryMb: 2048,
      freeDiskMb: 8192,
      resourceStopGatePassed,
    }),
    common = {
      schemaVersion: 1,
      module: "M08-06",
      buildSha: "a".repeat(40),
      manager: "baota",
      mode: "single_host_measured_boundary",
      region: "惠州",
      singleHost: true,
      loadBalancingEnabled: false,
      backupServerUsed: false,
      multiNode: false,
      capturedAt: "2026-08-16T00:00:00.000Z",
    },
    result = {
      planning: { users: 100, concurrentMinimum: 5, concurrentMaximum: 20, promise: false },
      performance: {
        readP95Ms: 10,
        writeP95Ms: 40,
        errorRateBasisPoints: 0,
        asyncLagSeconds: 0,
        samples: 1200,
      },
      resource: {
        loadBasisPoints: 100,
        availableMemoryMb: 2048,
        freeDiskMb: 8192,
        stopGatePassed: true,
      },
      resilience: {
        archiveVerified: true,
        recoveryVerified: true,
        auditVerified: true,
        probeRowsCleaned: true,
      },
    },
    ceiling = {
      ...common,
      ...result,
      status: "ready",
      capacityClaim: "measured_single_host_limited",
      measuredConcurrentUsers: 20,
      stages: [stage(5, 20), stage(10, 30), stage(20, 40)],
      boundaryStop: { reason: "planning_ceiling_reached", failureCode: null, failedStage: null },
    },
    limited = {
      ...common,
      ...result,
      status: "ready",
      capacityClaim: "measured_single_host_limited",
      measuredConcurrentUsers: 5,
      stages: [stage(5, 40)],
      boundaryStop: {
        reason: "next_stage_gate_failed",
        failureCode: "capacity_write_latency_exceeded",
        failedStage: stage(10, 945),
      },
    },
    blocked = {
      ...common,
      status: "blocked",
      capacityClaim: "unverified",
      failure: {
        code: "capacity_write_latency_exceeded",
        message: "capacity stage 5 failed closed",
        failedStage: 5,
      },
      completedStages: [stage(5, 1667)],
      thresholds: {
        readP95Ms: 300,
        writeP95Ms: 600,
        errorRateBasisPoints: 100,
        asyncLagSeconds: 60,
      },
    };
  assert.equal(validate(ceiling), true, JSON.stringify(validate.errors));
  assert.equal(validate(limited), true, JSON.stringify(validate.errors));
  assert.equal(validate(blocked), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...limited, measuredConcurrentUsers: 10 }), false);
  assert.equal(
    validate({
      ...limited,
      boundaryStop: { ...limited.boundaryStop, failedStage: stage(20, 945) },
    }),
    false,
  );
  assert.equal(
    validate({ ...ceiling, stages: [stage(5, 20), stage(10, 601), stage(20, 40)] }),
    false,
  );
  assert.equal(validate({ ...blocked, failure: undefined }), false);
});

test("M08-06 production benchmark transaction has exact MySQL placeholders", async () => {
  const source = await readFile("scripts/capture-capacity-boundary-production.mjs", "utf8"),
    match = source.match(
      /connection\.query\("(INSERT INTO capacity_boundary_observations[^\"]+)"\s*,\s*\[([^\]]+)\]\)/,
    );
  assert.ok(match);
  assert.equal((match[1].match(/\?/g) ?? []).length, match[2].split(",").length);
});
