import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { randomUUID } from "node:crypto";

// Executes existing source with synthetic rows and inert dependencies, never production.
export async function buildTopologyDesignData(repo) {
  const sourcePaths = [
    "apps/web/src/components/RuntimeTopologyCenter.vue",
    "apps/web/src/components/TechnicalDetails.vue",
    "apps/api/src/runtime-topology-service.ts",
    "apps/api/src/mysql-runtime-topology-repository.ts",
    "apps/api/src/runtime-topology-routes.ts",
    "apps/api/src/mysql-runtime-health-probe-repository.ts",
    "packages/runtime-topology/src/index.ts",
    "apps/worker/src/worker-queue-registry.ts",
    "tests/e2e/m08-01-single-server.spec.ts",
    "apps/api/src/runtime-health-probe.ts",
    "infra/baota/single-server-manifest.json",
    "apps/web/src/runtime-topology.css",
  ];
  const read = (f) => readFile(path.join(repo, f), "utf8"),
    plain = (v) => JSON.parse(JSON.stringify(v)),
    ast = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true),
    strip = (s) =>
      ast(s)
        .statements.filter((n) => !ts.isImportDeclaration(n))
        .map((n) => n.getFullText())
        .join("\n")
        .replaceAll("export ", ""),
    compile = (s) =>
      ts.transpileModule(s, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
      }).outputText;
  const box = { Date, Number, Error, randomUUID };
  vm.createContext(box);
  for (const [file, expose] of [
    [sourcePaths[6], "evaluateRuntimeTopology"],
    [sourcePaths[2], "RuntimeTopologyService"],
    [sourcePaths[7], "WORKER_QUEUE_POLICIES"],
  ])
    vm.runInContext(compile(strip(await read(file))) + `\nglobalThis.${expose}=${expose};`, box);
  const now = new Date("2026-09-09T04:00:00.000Z"),
    ago = (seconds) => new Date(now.getTime() - seconds * 1000).toISOString(),
    node = {
      nodeId: "synthetic-api-primary",
      hostId: "synthetic-huizhou-host",
      role: "api",
      status: "ready",
      region: "惠州",
      zone: "primary",
      buildSha: "a".repeat(40),
      version: "0.1.0",
      lastHeartbeatAt: now,
    },
    policy = {
      expectedNodeId: node.nodeId,
      expectedHostId: node.hostId,
      staleAfterMs: 90000,
      healthProbePolicy: {
        intervalMs: 30000,
        timeoutMs: 5000,
        windowMinutes: 60,
        retentionHours: 72,
      },
    },
    queues = Object.entries(box.WORKER_QUEUE_POLICIES).map(([name, p]) => ({
      name,
      priority: p.priority,
      effective_priority: p.priority,
      aging_interval_ms: p.agingIntervalMs,
      maximum_aging_boost: p.maximumAgingBoost,
      max_concurrency: p.maxConcurrency,
      timeout_ms: p.timeoutMs,
      max_retries: p.maxRetries,
      active_runs: 0,
      running: false,
      due: false,
      queue_delay_ms: 0,
      longest_running_ms: 0,
      suspected_stuck: false,
      circuit_state: "closed",
      circuit_open_until: null,
      consecutive_failures: 0,
      failed_total: 0,
      timed_out_total: 0,
      retry_total: 0,
      deferred_total: 0,
      last_failed_at: null,
      last_result_at: null,
      last_result_status: null,
      last_result_error_code: null,
      last_business_objects: [],
    })),
    worker = {
      status: "running",
      max_concurrency: 4,
      active_runs: 0,
      due_queue_count: 0,
      backpressure: false,
      max_queue_delay_ms: 0,
      suspected_stuck_runs: 0,
      snapshot_publish_failed_total: 0,
      last_snapshot_error: null,
      completed_last_minute: 0,
      failed_last_minute: 0,
      failure_rate_percent: 0,
      observed_at: ago(3),
      queues,
    },
    process = {
      status: "running",
      pid: 1201,
      restart_count: 0,
      ready_at: ago(300),
      circuit_open_until: null,
      last_failure: null,
    },
    supervisor = {
      supervisor_pid: 1200,
      status: "ready",
      observed_at: ago(5),
      processes: { api: process, worker: { ...process, pid: 1202 } },
    };
  assert.equal(queues.length, 19);
  const hb = {
    Date,
    Number,
    randomUUID,
    RUNTIME_HEALTH_ENDPOINTS: ["live", "ready", "available"].map((endpoint) => ({ endpoint })),
  };
  vm.createContext(hb);
  vm.runInContext(
    compile(strip(await read(sourcePaths[5]))) +
      "\nglobalThis.Repo=MySqlRuntimeHealthProbeRepository;",
    hb,
  );
  async function summarize(rows) {
    return plain(
      await new hb.Repo({ query: async () => [rows] }).summarize({
        observedAt: now,
        windowMinutes: 60,
      }),
    );
  }
  const emptyEndpoints = await summarize([]),
    endpoints = await summarize(
      ["live", "ready", "available"].flatMap((endpoint) =>
        [0, 1, 2, 3].map((i) => ({
          endpoint,
          outcome: "succeeded",
          status_code: 200,
          latency_ms: [0, 12, 25, 40][i],
          observed_at: ago(90 - i * 30),
        })),
      ),
    ),
    mixedEndpoints = await summarize(
      ["succeeded", "http_error", "network_error", "timeout"].map((outcome, i) => ({
        endpoint: "available",
        outcome,
        status_code: i < 2 ? [200, 503][i] : null,
        latency_ms: [0, 30, 80, 5000][i],
        observed_at: ago(90 - i * 30),
      })),
    ),
    health = {
      status: "ready",
      interval_ms: 30000,
      timeout_ms: 5000,
      window_minutes: 60,
      retention_hours: 72,
      endpoints,
      observed_at: now.toISOString(),
    };
  assert.equal(emptyEndpoints[0].availability_basis_points, 0);
  assert.equal(emptyEndpoints[0].latency_p95_ms, null);
  const zeroEndpoint = await summarize([
    { endpoint: "live", outcome: "succeeded", status_code: 200, latency_ms: 0, observed_at: now },
  ]);
  assert.equal(zeroEndpoint[0].latency_p95_ms, 0);
  assert.equal(mixedEndpoints[2].latency_p95_ms, 5000);
  assert.equal(mixedEndpoints[2].availability_basis_points, 2500);
  const datasets = {},
    labels = {},
    comparisons = {};
  async function add(key, label, mutate = () => {}, patch = {}) {
    const input = {
      nodes: [{ ...node }],
      processHistory: [],
      worker: plain(worker),
      supervisor: plain(supervisor),
      health: plain(health),
    };
    mutate(input);
    const records = [],
      service = new box.RuntimeTopologyService(
        { snapshot: async () => input, recordView: async (v) => records.push(v) },
        {
          ...policy,
          workerSchedulerSnapshot: async () => input.worker,
          supervisorSnapshot: async () => input.supervisor,
          healthProbeSnapshot: async () => input.health,
          ...patch,
        },
        () => now,
      );
    datasets[key] = plain(
      await service.read({
        actorId: "synthetic-operator",
        requestId: "synthetic-read",
        traceId: "synthetic-read",
      }),
    );
    comparisons[key] = plain({
      public: await service.publicHealth(),
      business: await service.businessHealth(),
    });
    assert.equal(records.length, 1);
    labels[key] = label;
  }
  await add("ready", "完整单机证据 · 队列空闲");
  await add("empty", "没有API节点", (x) => (x.nodes = []));
  await add("missing", "存在其他API但预期节点缺失", (x) => (x.nodes[0].nodeId = "synthetic-other"));
  await add("host", "预期节点主机不匹配", (x) => (x.nodes[0].hostId = "synthetic-other-host"));
  await add(
    "node-stale",
    "API心跳超过窗口",
    (x) => (x.nodes[0].lastHeartbeatAt = new Date(ago(91))),
  );
  await add(
    "node-boundary",
    "API心跳恰好90秒",
    (x) => (x.nodes[0].lastHeartbeatAt = new Date(ago(90))),
  );
  await add(
    "node-future",
    "API未来时间仍通过源判门",
    (x) => (x.nodes[0].lastHeartbeatAt = new Date(ago(-10))),
  );
  await add("stopped", "API状态停止", (x) => (x.nodes[0].status = "stopped"));
  await add("extra-node", "额外API不变成多节点能力", (x) =>
    x.nodes.push({ ...node, nodeId: "synthetic-extra" }),
  );
  await add("worker-missing", "Worker快照缺失", (x) => (x.worker = null));
  await add("worker-stale", "Worker心跳过期 · API仍ready", (x) => (x.worker.observed_at = ago(91)));
  await add("worker-boundary", "Worker恰好90秒", (x) => (x.worker.observed_at = ago(90)));
  await add("worker-future", "Worker未来时间判为stale", (x) => (x.worker.observed_at = ago(-1)));
  await add("worker-stopped", "Worker已停止", (x) => (x.worker.status = "stopped"));
  await add("supervisor-missing", "没有监督器快照", (x) => (x.supervisor = null));
  await add(
    "supervisor-blocked",
    "ready与监督器blocker并存",
    (x) => (x.supervisor.status = "degraded"),
  );
  await add("restart-loop", "ready与严重重启告警并存", (x) => {
    x.supervisor.processes.worker.restart_count = 5;
    x.supervisor.processes.worker.last_failure = "synthetic exit:1";
  });
  await add("restart-reset", "不规则采样与计数重置", (x) => {
    x.processHistory = [600, 10].map((t, i) => ({
      process_name: "worker",
      status: "running",
      restart_count: 3 + i * 2,
      observed_at: ago(t),
    }));
    x.supervisor.processes.worker.restart_count = 1;
  });
  await add(
    "health-empty",
    "三端点零样本",
    (x) => (x.health = { ...health, status: "empty", endpoints: emptyEndpoints }),
  );
  await add("health-unavailable", "健康摘要读取失败", (x) => (x.health = null));
  await add("health-disabled", "未配置健康摘要", () => {}, { healthProbePolicy: undefined });
  await add("health-mixed", "失败超时也参与分位数", (x) => (x.health.endpoints = mixedEndpoints));
  await add("running", "运行但非due不是空闲", (x) => {
    Object.assign(x.worker.queues[0], { running: true, active_runs: 1, longest_running_ms: 12000 });
    x.worker.active_runs = 1;
  });
  await add("backpressure", "背压与老化到顶", (x) => {
    x.worker.queues.slice(0, 4).forEach((q) => Object.assign(q, { running: true, active_runs: 1 }));
    Object.assign(x.worker.queues[4], {
      due: true,
      queue_delay_ms: 3000000,
      effective_priority: 180,
    });
    Object.assign(x.worker, {
      backpressure: true,
      active_runs: 4,
      due_queue_count: 1,
      max_queue_delay_ms: 3000000,
    });
  });
  await add("stuck", "疑似卡死", (x) => {
    Object.assign(x.worker.queues[0], {
      running: true,
      active_runs: 1,
      suspected_stuck: true,
      longest_running_ms: 610000,
    });
    x.worker.suspected_stuck_runs = 1;
    x.worker.active_runs = 1;
  });
  await add("circuit", "队列熔断", (x) =>
    Object.assign(x.worker.queues[18], {
      circuit_state: "open",
      circuit_open_until: ago(-60),
      consecutive_failures: 4,
      failed_total: 4,
    }),
  );
  await add("publish-failed", "观测发布失败不等于业务失败", (x) =>
    Object.assign(x.worker, {
      snapshot_publish_failed_total: 2,
      last_snapshot_error: "synthetic EACCES: snapshot write",
    }),
  );
  await add("recent-failed", "一分钟失败与队列时间", (x) => {
    x.worker.failed_last_minute = 1;
    x.worker.failure_rate_percent = 100;
    Object.assign(x.worker.queues[0], {
      consecutive_failures: 1,
      failed_total: 1,
      last_failed_at: ago(60),
    });
  });
  const business = (x) =>
    Object.assign(x.worker.queues[0], {
      last_result_at: ago(60),
      last_result_status: "failed_terminal",
      last_result_error_code: "source_changed",
      last_business_objects: [
        {
          type: "collection_task",
          id: "synthetic-task-66",
          label: "采集任务",
          href: "/platform-admin/collection?task=synthetic-task-66",
        },
      ],
    });
  await add("business", "精确业务关联 · 一分钟边界", business);
  await add("business-old", "超过一分钟不追加业务告警", (x) => {
    business(x);
    x.worker.queues[0].last_result_at = ago(61);
  });
  for (const status of ["waiting_evidence", "waiting_profit"])
    await add(status, "等待状态不算失败 · " + status, (x) => {
      business(x);
      x.worker.queues[0].last_result_status = status;
    });
  await add("association-invalid", "关联白名单与前四项限制", (x) => {
    business(x);
    x.worker.queues[0].last_business_objects = [
      null,
      { type: "unknown", id: "1", label: "x" },
      { type: "collection_task", id: "2", label: "x", href: "//example.invalid" },
      { type: "collection_task", id: "3", label: "无可导航地址", href: 5 },
      { type: "collection_task", id: "5", label: "第五项不回填", href: "/ignored" },
    ];
  });
  await add("long", "长标识与错误文本", (x) => {
    x.nodes[0].nodeId = node.nodeId;
    x.nodes[0].buildSha = "synthetic-long-sha-".repeat(15);
    x.supervisor.processes.worker.last_failure = "synthetic-error-".repeat(25);
  });
  const originalCode = ast(await read(sourcePaths[8])).statements;
  datasets.original = plain(
    vm.runInNewContext(
      compile(
        originalCode
          .slice(
            0,
            originalCode.findIndex((n) => ts.isFunctionDeclaration(n)),
          )
          .filter((n) => !ts.isImportDeclaration(n))
          .map((n) => n.getFullText())
          .join("\n"),
      ) + "\nbase;",
    ),
  );
  labels.original = "原始E2E夹具 · 非实时且未重算";
  for (const k of [
    "ready",
    "node-boundary",
    "node-future",
    "worker-boundary",
    "supervisor-blocked",
    "restart-loop",
  ])
    assert.equal(datasets[k].state, "ready", k);
  for (const k of [
    "node-stale",
    "worker-missing",
    "worker-stale",
    "worker-future",
    "worker-stopped",
  ])
    assert.equal(datasets[k].state, "stale", k);
  assert.equal(datasets.empty.state, "empty");
  for (const k of ["missing", "host", "stopped"]) assert.equal(datasets[k].state, "blocked", k);
  assert.equal(comparisons["restart-loop"].business.status, "unavailable");
  assert.equal(comparisons["worker-stale"].public.state, "ready");
  assert.deepEqual(
    datasets["restart-reset"].restart_trend
      .filter((r) => r.process_name === "worker")
      .map((r) => [r.restart_delta, r.counter_reset]),
    [
      [0, false],
      [2, false],
      [0, true],
    ],
  );
  assert.equal(datasets["association-invalid"].alerts[0].business_objects.length, 1);
  assert.equal(datasets["association-invalid"].alerts[0].business_objects[0].href, null);
  for (const k of ["business-old", "waiting_evidence", "waiting_profit"])
    assert.equal(datasets[k].alerts.length, 0);
  for (const [key, code] of [
    ["worker-stale", "worker_scheduler_heartbeat_stale"],
    ["backpressure", "worker_scheduler_backpressure"],
    ["recent-failed", "worker_scheduler_recent_failures"],
    ["stuck", "worker_scheduler_suspected_stuck"],
    ["circuit", "worker_scheduler_queue_circuit_open"],
    ["publish-failed", "worker_scheduler_snapshot_publish_failed"],
    ["business", "worker_business_result_failed"],
    ["restart-loop", "backend_restart_loop"],
  ])
    assert.ok(
      datasets[key].alerts.some((a) => a.code === code),
      key,
    );
  const sourceChecks = [
    "Actual topology evaluator/service: node and worker time boundaries, future-time asymmetry, expected node scope, supervisor blocker versus ready, all eight alert codes, restart reset/irregular rows, business minute boundary/waiting exclusions and first-four sanitization. Separate public/business health outputs verified, not requested by prototype. Inert recordView runs once per read.",
    "Actual health repository summarize with inert rows: all outcomes included, nearest-rank percentiles, zero-latency versus no samples/null, 2500 basis points for 1/4 successes. No HTTP probe or database executed.",
  ];
  const uiSource = await read(sourcePaths[0]),
    script = uiSource.split(/<script setup[^>]*>/)[1].split("</script>")[0];
  const ref = (value) => ({ value }),
    computed = (fn) => ({
      get value() {
        return fn();
      },
    });
  const declarations = ast(script)
    .statements.filter(
      (n) =>
        ts.isVariableStatement(n) &&
        [
          "queueRows",
          "exceptionalQueues",
          "queueLabels",
          "alertLabels",
          "healthEndpointLabels",
          "healthOutcomeLabels",
        ].includes(n.declarationList.declarations[0].name.getText()),
    )
    .map((n) => n.getFullText())
    .join("\n");
  const logic = compile(
    `window.TOPOLOGY_LOGIC=function(value){const data={value};const computed=fn=>({get value(){return fn()}});${declarations}\nreturn {queues:queueRows.value,exceptional:exceptionalQueues.value,queueLabels,alertLabels,healthEndpointLabels,healthOutcomeLabels};};`,
  );
  const lb = { window: {}, Number };
  vm.createContext(lb);
  vm.runInContext(logic, lb);
  assert.equal(lb.window.TOPOLOGY_LOGIC(datasets.circuit).exceptional.length, 1);
  assert.equal(lb.window.TOPOLOGY_LOGIC(datasets.backpressure).queues[4].starvation_risk, true);
  class Failure extends Error {
    constructor(kind) {
      super(kind);
      this.kind = kind;
      this.requestId = "synthetic-failure-id";
      this.actionHint = "隔离读取失败";
    }
  }
  function mount() {
    const calls = [],
      timers = [],
      hooks = {},
      context = {
        Date,
        Number,
        DOMException,
        Error,
        AbortController,
        crypto: { randomUUID },
        ref,
        computed,
        defineProps: () => ({ apiBaseUrl: "/inert" }),
        ApiClientError: Failure,
        onMounted: (f) => (hooks.mount = f),
        onBeforeUnmount: (f) => (hooks.unmount = f),
        window: {
          setTimeout: (f, ms) => {
            timers.push({ f, ms });
            return timers.length;
          },
          clearTimeout: () => {},
        },
        createApiClient: () => (url, options) =>
          new Promise((resolve, reject) => {
            calls.push({ url, options, resolve, reject });
            options.signal.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      };
    vm.createContext(context);
    vm.runInContext(
      compile(strip(script)) + "\nglobalThis.ui={load,data,state,requestId,refreshFailure};",
      context,
    );
    return { ...context.ui, calls, timers, hooks };
  }
  for (const kind of ["expired", "forbidden", "rate_limited", "unavailable", "timeout", "generic"])
    for (const retained of [false, true]) {
      const m = mount();
      if (retained) {
        const p = m.load();
        m.calls[0].resolve({ data: datasets.ready, request_id: "synthetic-old-id" });
        await p;
      }
      const p = m.load();
      await m.load();
      assert.equal(m.calls.length, retained ? 2 : 1);
      assert.equal(m.calls.at(-1).url, "/platform/operations/topology");
      assert.equal(m.calls.at(-1).options.requestId, m.calls.at(-1).options.traceId);
      if (kind === "timeout") {
        assert.equal(m.timers.at(-1).ms, 15000);
        m.timers.at(-1).f();
      } else m.calls.at(-1).reject(kind === "generic" ? new Error("synthetic") : new Failure(kind));
      await p;
      const keep = retained && !["expired", "forbidden"].includes(kind);
      assert.equal(Boolean(m.data.value), keep);
      assert.equal(
        keep ? m.refreshFailure.value : m.state.value,
        kind === "generic" ? "unavailable" : kind,
      );
      if (retained && kind === "generic") assert.equal(m.requestId.value, "synthetic-old-id");
    }
  const m = mount(),
    p = m.load();
  m.hooks.unmount();
  await p;
  assert.equal(m.data.value, null);
  sourceChecks.push(
    "Actual Vue script: extracted 19-queue visibility/aging and label logic; single-flight exact GET/IDs, 15s browser abort, retained versus first failures, 401/403 clearing and unmount abort. Generic exception retains old request ID: proposal labels its simulated failure ID separately. Not mounted Vue or preserve lifecycle verification.",
  );
  const repository = await read(sourcePaths[3]),
    route = await read(sourcePaths[4]);
  assert.match(repository, /LIMIT 600/);
  assert.match(repository, /300_000/);
  assert.match(repository, /ON DUPLICATE KEY UPDATE/);
  assert.match(repository, /platform\.runtime_topology\.read/);
  assert.match(route, /platform:operate/);
  assert.match(route, /private, no-store/);
  assert.ok(!route.includes("AbortController"));
  const failing = new box.RuntimeTopologyService(
    {
      snapshot: async () => ({ nodes: [node] }),
      recordView: async () => {
        throw new Error("synthetic audit failure");
      },
    },
    policy,
    () => now,
  );
  await assert.rejects(
    failing.read({ actorId: "x", requestId: "x", traceId: "x" }),
    /synthetic audit failure/,
  );
  const manifest = JSON.parse(await read(sourcePaths[10]));
  assert.equal(manifest.loadBalancingEnabled, false);
  assert.equal(manifest.expectedHostCount, 1);
  sourceChecks.push(
    "Static repository/route/manifest bindings: 24h/600 history and five-minute view-driven upsert, platform read audit, private GET operate guard, no route AbortController, one BaoTa host/no load balancing. Actual service rejects audit failure. No SQL transaction, RBAC, live topology, deployment or server cancellation proof.",
  );
  return {
    data: {
      sourcePaths,
      sourceChecks,
      datasets,
      labels,
      clock: now.toISOString(),
      provenance: "Synthetic service output; original E2E separate; not production observations.",
    },
    logic,
  };
}
