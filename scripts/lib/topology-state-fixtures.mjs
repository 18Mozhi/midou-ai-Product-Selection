import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { topologyReviewFixtures } from "./topology-review-fixtures.mjs";

export const topologyStateSources = [
  "packages/runtime-topology/src/index.ts",
  "apps/api/src/runtime-topology-service.ts",
  "scripts/lib/topology-state-fixtures.mjs",
];

// Execute current producers with inert snapshots and a captured recordView call, never SQL/probes.
export async function topologyStateFixtures(additionalSpecs = null) {
  const domain = {},
    serviceModule = {};
  for (const [file, exports] of [
    [topologyStateSources[0], domain],
    [topologyStateSources[1], serviceModule],
  ]) {
    const code = ts.transpileModule(await readFile(file, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext(
      code,
      {
        exports,
        require: (id) => {
          assert.equal(id, "@scoutops/runtime-topology");
          return domain;
        },
      },
      { timeout: 1000 },
    );
  }
  const { fixture, nav } = await topologyReviewFixtures();
  const clock = fixture.observed_at,
    now = new Date(clock);
  const at = (ms) => new Date(now.getTime() + ms).toISOString();
  const first = fixture.nodes[0];
  const baseline = () => ({
    nodes: [
      {
        nodeId: first.node_id,
        hostId: first.host_id,
        role: first.role,
        status: first.status,
        region: first.region,
        zone: first.zone,
        buildSha: first.build_sha,
        version: first.version,
        lastHeartbeatAt: new Date(first.last_heartbeat_at),
      },
    ],
    processHistory: [],
    supervisor: {
      supervisor_pid: fixture.supervisor_pid,
      status: "ready",
      observed_at: clock,
      processes: Object.fromEntries(fixture.processes.map(({ name, ...row }) => [name, row])),
    },
    worker: {
      ...structuredClone(fixture.worker_scheduler),
      observed_at: clock,
      status: "running",
      queues: [],
      active_runs: 0,
      due_queue_count: 0,
      backpressure: false,
      max_queue_delay_ms: 0,
      suspected_stuck_runs: 0,
      failed_last_minute: 0,
      failure_rate_percent: 0,
      snapshot_publish_failed_total: 0,
      last_snapshot_error: null,
    },
    health: structuredClone(fixture.health_probes),
  });
  const specs = [
    ["node-ready", "节点门就绪", () => {}, "ready", []],
    [
      "no-api",
      "尚无API节点",
      (x) => {
        x.nodes = [];
      },
      "empty",
      ["runtime_nodes_empty"],
    ],
    [
      "expected-node-missing",
      "预期节点缺失",
      (x) => {
        x.nodes[0].nodeId = "api-other-local";
      },
      "blocked",
      ["api_node_missing"],
    ],
    [
      "wrong-host",
      "主机身份不一致",
      (x) => {
        x.nodes[0].hostId = "other-local-host";
      },
      "blocked",
      ["api_host_identity_mismatch"],
    ],
    [
      "old-api-heartbeat",
      "API心跳过期",
      (x) => {
        x.nodes[0].lastHeartbeatAt = new Date(at(-90001));
      },
      "stale",
      ["api_heartbeat_stale"],
    ],
    ...["starting", "degraded", "draining", "stopped"].map((status) => [
      "api-" + status,
      "API状态" + status,
      (x) => {
        x.nodes[0].status = status;
      },
      "blocked",
      ["api_unavailable"],
    ]),
    [
      "combined-node-blockers",
      "节点三项阻断",
      (x) => {
        x.nodes[0].hostId = "other-local-host";
        x.nodes[0].status = "stopped";
        x.nodes[0].lastHeartbeatAt = new Date(at(-90001));
      },
      "stale",
      ["api_host_identity_mismatch", "api_heartbeat_stale", "api_unavailable"],
    ],
    [
      "supervisor-degraded",
      "节点就绪但监督器异常",
      (x) => {
        x.supervisor.status = "degraded";
      },
      "ready",
      ["backend_supervisor_degraded"],
    ],
    [
      "worker-missing",
      "Worker观测缺失",
      (x) => {
        x.worker = null;
      },
      "stale",
      [],
    ],
    [
      "worker-stopped",
      "Worker已停止",
      (x) => {
        x.worker.status = "stopped";
      },
      "stale",
      [],
    ],
    [
      "worker-old",
      "Worker观测过期",
      (x) => {
        x.worker.observed_at = at(-90001);
      },
      "stale",
      [],
    ],
    [
      "worker-future",
      "Worker未来时间观测",
      (x) => {
        x.worker.observed_at = at(1000);
      },
      "stale",
      [],
    ],
    [
      "node-future",
      "节点未来时间的现有判定",
      (x) => {
        x.nodes[0].lastHeartbeatAt = new Date(at(1000));
      },
      "ready",
      [],
    ],
    [
      "health-unavailable",
      "探测摘要不可用",
      (x) => {
        x.health = null;
      },
      "ready",
      [],
    ],
    [
      "restart-counter-reset",
      "重启累计计数重置",
      (x) => {
        x.processHistory = [
          { process_name: "worker", status: "running", restart_count: 4, observed_at: at(-60000) },
        ];
        x.supervisor.processes.worker.restart_count = 0;
      },
      "ready",
      [],
    ],
  ];
  const cases = [];
  for (const [id, title, mutate, expectedState, expectedBlockers] of additionalSpecs ?? specs) {
    const input = baseline();
    mutate(input);
    const views = [];
    const service = new serviceModule.RuntimeTopologyService(
      {
        snapshot: async () => ({ nodes: input.nodes, processHistory: input.processHistory }),
        recordView: async (row) => views.push(row),
        heartbeat: async () => {
          throw new Error("heartbeat forbidden in review");
        },
      },
      {
        expectedNodeId: first.node_id,
        expectedHostId: first.host_id,
        staleAfterMs: 90000,
        workerSchedulerStaleAfterMs: 90000,
        supervisorSnapshot: async () => input.supervisor,
        workerSchedulerSnapshot: async () => input.worker,
        healthProbePolicy: {
          intervalMs: fixture.health_probes.interval_ms,
          timeoutMs: fixture.health_probes.timeout_ms,
          windowMinutes: fixture.health_probes.window_minutes,
          retentionHours: fixture.health_probes.retention_hours,
        },
        healthProbeSnapshot: async () => {
          if (!input.health) throw new Error("local missing probe summary");
          return input.health;
        },
      },
      () => new Date(clock),
    );
    const data = JSON.parse(
      JSON.stringify(await service.read({ actorId: "local-review", requestId: id, traceId: id })),
    );
    assert.equal(data.state, expectedState, id);
    assert.deepEqual(
      data.blockers.map((row) => row.code),
      expectedBlockers,
      id,
    );
    assert.equal(views.length, 1, "one in-memory view record per read");
    assert.equal(views[0].state, data.state);
    cases.push({ id, title, data, recordedView: JSON.parse(JSON.stringify(views[0])) });
  }
  return { cases, nav, clock };
}
