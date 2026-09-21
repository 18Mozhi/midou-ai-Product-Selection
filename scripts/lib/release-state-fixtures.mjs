import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

export const releaseStateServiceFile = "apps/api/src/release-rollout-service.ts";
export const releaseStateClock = "2026-09-15T08:00:00.000Z";

// Execute the current read service with inert repository rows; no SQL, signatures or probes.
export async function releaseStateFixtures() {
  const source = await readFile(releaseStateServiceFile, "utf8");
  const ast = ts.createSourceFile("service.ts", source, ts.ScriptTarget.Latest, true);
  const node = ast.statements.find(
    (n) => ts.isClassDeclaration(n) && n.name?.text === "ReleaseRolloutService",
  );
  assert.ok(node, "current read service class exists");
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(node.getText(ast), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports },
    { timeout: 1000 },
  );
  const now = new Date(releaseStateClock);
  const ago = (minutes) => new Date(now.getTime() - minutes * 60000).toISOString();
  const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const a = "a".repeat(40),
    b = "b".repeat(40);
  const policy = {
    percentages: [5, 25, 100],
    minimumObservationSeconds: 1800,
    maximumEvidenceAgeMinutes: 30,
    currentBuildSha: a,
    currentAppVersion: "0.1.0",
    currentConfigFingerprint: "f".repeat(64),
    sourceLocalSha: a,
    sourceRemoteSha: a,
    sourceRemoteBranch: "main",
    sourceRepository: "local/release-state-review",
    sourceMigrationVersion: "0026_release_rollout_m07_05.up.sql",
  };
  const release = {
    id: uuid(1),
    stage: "S0",
    app_version: policy.currentAppVersion,
    build_sha: a,
    config_fingerprint: policy.currentConfigFingerprint,
    migration_version: policy.sourceMigrationVersion,
    status: "healthy",
    approved_by: uuid(2),
    request_id: uuid(3),
    trace_id: uuid(3),
    started_at: ago(100),
    finished_at: ago(5),
    created_at: ago(100),
    updated_at: ago(5),
  };
  const gates = [5, 25, 100].map((percent, i) => ({
    id: uuid(10 + i),
    release_id: release.id,
    gate_kind: `canary_${percent}`,
    status: "passed",
    traffic_percent: percent,
    observe_seconds: 1800,
    sample_count: 20 + i * 15,
    error_rate_percent: 0,
    read_p95_ms: 100,
    write_p95_ms: 200,
    async_lag_seconds: 2,
    failure_code: null,
    started_at: ago(95 - i * 30),
    finished_at: ago(65 - i * 30),
    request_id: uuid(20 + i),
    trace_id: uuid(20 + i),
    metadata: { local_test_only: true },
    created_at: ago(95 - i * 30),
  }));
  const action = (kind, status, n) => ({
    ...gates[0],
    id: uuid(n),
    gate_kind: kind,
    status,
    traffic_percent: 0,
    observe_seconds: 0,
    sample_count: 0,
    error_rate_percent: null,
    read_p95_ms: null,
    write_p95_ms: null,
    async_lag_seconds: null,
    started_at: ago(4),
    finished_at: new Date(Date.parse(ago(4)) + 1250).toISOString(),
    metadata: { timing_schema: 2, local_test_only: true },
  });
  gates.push(action("migration", "passed", 30));
  const scenarios = [
    { id: "verified" },
    {
      id: "empty",
      mutate: (r) => {
        r.releases = [];
        r.gates = [];
      },
    },
    {
      id: "current-missing",
      policy: { currentBuildSha: b, sourceLocalSha: b, sourceRemoteSha: b },
    },
    {
      id: "newest-other",
      mutate: (r) =>
        r.releases.unshift({ ...release, id: uuid(4), build_sha: b, finished_at: ago(1) }),
    },
    { id: "identity-app", policy: { currentAppVersion: "0.2.0" } },
    { id: "identity-config", policy: { currentConfigFingerprint: "e".repeat(64) } },
    { id: "identity-migration", policy: { sourceMigrationVersion: "local_next_migration.up.sql" } },
    { id: "source-mismatch", policy: { sourceRemoteSha: b } },
    {
      id: "source-fallback",
      policy: {
        sourceLocalSha: undefined,
        sourceRemoteSha: undefined,
        sourceRepository: undefined,
        sourceRemoteBranch: undefined,
      },
    },
    {
      id: "missing-gate",
      mutate: (r) => {
        r.gates = r.gates.filter((g) => g.gate_kind !== "canary_25");
      },
    },
    {
      id: "no-gates",
      mutate: (r) => {
        r.gates = [];
      },
    },
    {
      id: "gate-pending",
      mutate: (r) => {
        r.gates[1].status = "pending";
      },
    },
    {
      id: "status-stopped",
      mutate: (r) => {
        r.releases[0].status = "failed";
      },
    },
    { id: "stopped", mutate: (r) => r.gates.push(action("automatic_stop", "stopped", 31)) },
    {
      id: "status-rollback",
      mutate: (r) => {
        r.releases[0].status = "rolled_back";
      },
    },
    { id: "rolled-back", mutate: (r) => r.gates.push(action("rollback", "rolled_back", 32)) },
    {
      id: "identity-before-rollback",
      policy: { currentAppVersion: "0.2.0" },
      mutate: (r) => r.gates.push(action("rollback", "rolled_back", 32)),
    },
    {
      id: "rollback-before-stop",
      mutate: (r) =>
        r.gates.push(
          action("rollback", "rolled_back", 32),
          action("automatic_stop", "stopped", 31),
        ),
    },
    {
      id: "error-equal",
      mutate: (r) => {
        r.gates[0].error_rate_percent = 1;
      },
    },
    {
      id: "read-equal",
      mutate: (r) => {
        r.gates[0].read_p95_ms = 300;
      },
    },
    {
      id: "read-over",
      mutate: (r) => {
        r.gates[0].read_p95_ms = 301;
      },
    },
    {
      id: "missing-metric",
      mutate: (r) => {
        r.gates[0].read_p95_ms = null;
      },
    },
    {
      id: "zero-metrics",
      mutate: (r) =>
        r.gates.slice(0, 3).forEach((g) => {
          g.error_rate_percent = 0;
          g.read_p95_ms = 0;
          g.write_p95_ms = 0;
          g.async_lag_seconds = 0;
        }),
    },
    {
      id: "age-exact",
      mutate: (r) =>
        r.gates.slice(0, 3).forEach((g) => {
          g.finished_at = ago(30);
        }),
    },
    {
      id: "stale",
      mutate: (r) =>
        r.gates.slice(0, 3).forEach((g, i) => {
          g.finished_at = ago(91 - i * 30);
        }),
    },
  ];
  const cases = [];
  for (const scenario of scenarios) {
    const repositoryData = structuredClone({ releases: [release], gates });
    scenario.mutate?.(repositoryData);
    let reads = 0;
    const service = new exports.ReleaseRolloutService(
      {
        read: async () => {
          reads++;
          return structuredClone(repositoryData);
        },
      },
      { ...policy, ...scenario.policy },
      () => now,
    );
    const data = await service.read({ actorId: uuid(2), requestId: uuid(3), traceId: uuid(3) });
    cases.push({ id: scenario.id, data: JSON.parse(JSON.stringify(data)), repositoryReads: reads });
  }
  return cases;
}
