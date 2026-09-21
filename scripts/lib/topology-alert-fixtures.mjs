import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { topologyStateFixtures, topologyStateSources } from "./topology-state-fixtures.mjs";
import { topologyReviewFixtures } from "./topology-review-fixtures.mjs";

export const topologyAlertSources = [
  ...topologyStateSources,
  "apps/worker/src/worker-pollers.ts",
  "apps/worker/src/queue-scheduler.ts",
  "scripts/lib/topology-alert-fixtures.mjs",
];

export async function topologyAlertFixtures() {
  const { fixture, policies } = await topologyReviewFixtures();
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(await readFile("apps/worker/src/worker-pollers.ts", "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText,
    { exports },
    { timeout: 1000 },
  );
  const normalize = exports.normalizeQueueRunObservation;
  const clock = fixture.observed_at,
    at = (ms) => new Date(Date.parse(clock) + ms).toISOString();
  const id = fixture.worker_scheduler.queues[0].last_business_objects[0].id;
  const error = fixture.worker_scheduler.queues[0].last_result_error_code;
  const queue = (name = "collection_tasks", overrides = {}) => {
    const p = policies[name];
    assert.ok(p, "registered queue " + name);
    return {
      ...structuredClone(fixture.worker_scheduler.queues[0]),
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
      ...overrides,
    };
  };
  const outcome = (name, key, status = "failed_terminal", age = 0, object = true) => {
    const normalized = normalize(name, {
      status,
      error_code: error,
      ...(object ? { [key]: id } : {}),
    });
    return queue(name, {
      last_result_at: at(age),
      last_result_status: normalized.status,
      last_result_error_code: normalized.error_code,
      last_business_objects: normalized.business_objects,
    });
  };
  const assign = (input, rows) => {
    input.worker.queues = rows;
    input.worker.active_runs = rows.reduce((sum, q) => sum + q.active_runs, 0);
    input.worker.due_queue_count = rows.filter((q) => q.due).length;
    input.worker.max_queue_delay_ms = Math.max(
      0,
      ...rows.filter((q) => q.due).map((q) => q.queue_delay_ms),
    );
    input.worker.suspected_stuck_runs = rows.filter((q) => q.suspected_stuck).length;
  };
  const prefix = "worker_scheduler_",
    business = "worker_business_result_failed";
  const specs = [];
  const add = (id, title, mutate, codes = [], state = "ready") =>
    specs.push({ id, title, mutate, codes, state });
  add("all-idle", "十九空闲队列", (x) =>
    assign(
      x,
      Object.keys(policies).map((name) => queue(name)),
    ),
  );
  add(
    "backpressure",
    "背压仅关联等待队列",
    (x) => {
      assign(x, [
        queue("collection_tasks", { due: true, queue_delay_ms: 1 }),
        queue("notification_outbox", { running: true, active_runs: 1 }),
      ]);
      x.worker.backpressure = true;
      x.worker.max_concurrency = 1;
    },
    [prefix + "backpressure"],
  );
  add(
    "recent-failures",
    "失败时间窗口边界",
    (x) => {
      assign(x, [
        queue("collection_tasks", {
          last_failed_at: at(-60000),
          consecutive_failures: 1,
          failed_total: 1,
        }),
        queue("notification_outbox", { last_failed_at: at(-60001) }),
        queue("auth_delivery", { last_failed_at: at(1) }),
      ]);
      x.worker.failed_last_minute = 1;
      x.worker.completed_last_minute = 1;
      x.worker.failure_rate_percent = 100;
    },
    [prefix + "recent_failures"],
  );
  add(
    "suspected-stuck",
    "疑似卡死",
    (x) =>
      assign(x, [
        queue("collection_tasks", {
          running: true,
          active_runs: 1,
          suspected_stuck: true,
          longest_running_ms: 600001,
        }),
      ]),
    [prefix + "suspected_stuck"],
  );
  add(
    "circuit-open",
    "队列熔断",
    (x) =>
      assign(x, [
        queue("notification_outbox", {
          circuit_state: "open",
          circuit_open_until: at(60000),
          consecutive_failures: 5,
        }),
      ]),
    [prefix + "queue_circuit_open"],
  );
  add(
    "publication-failed",
    "状态写入失败",
    (x) => {
      x.worker.snapshot_publish_failed_total = 1;
      x.worker.last_snapshot_error = "local_snapshot_write_failed";
    },
    [prefix + "snapshot_publish_failed"],
  );
  add(
    "publication-no-detail",
    "状态写入失败无详细错误",
    (x) => {
      x.worker.snapshot_publish_failed_total = 1;
    },
    [prefix + "snapshot_publish_failed"],
  );
  for (const [suffix, name, key] of [
    ["collection", "collection_tasks", "task_id"],
    ["business", "business_task_projection", "taskId"],
    ["opportunity", "automatic_selection_evaluation", "opportunity_id"],
    ["trend", "trend_projection", "topic_id"],
    ["report", "report_exports", "export_id"],
    ["automation", "automation_rules", "execution_id"],
  ])
    add("object-" + suffix, "业务对象关联：" + suffix, (x) => assign(x, [outcome(name, key)]), [
      business,
    ]);
  add(
    "result-window-edge",
    "业务结果恰好一分钟",
    (x) => assign(x, [outcome("collection_tasks", "task_id", "failed_terminal", -60000)]),
    [business],
  );
  add("result-outside-window", "业务结果超过一分钟", (x) =>
    assign(x, [outcome("collection_tasks", "task_id", "failed_terminal", -60001)]),
  );
  add("result-future", "业务结果未来时间", (x) =>
    assign(x, [outcome("collection_tasks", "task_id", "failed_terminal", 1)]),
  );
  for (const status of ["waiting_evidence", "waiting_profit"])
    add(status, "正常等待业务输入：" + status, (x) =>
      assign(x, [outcome("collection_tasks", "task_id", status)]),
    );
  add("result-no-code", "无错误代码", (x) => {
    const q = outcome("collection_tasks", "task_id");
    q.last_result_error_code = null;
    assign(x, [q]);
  });
  add(
    "result-no-object",
    "业务失败但无精确对象",
    (x) => assign(x, [outcome("collection_tasks", "task_id", "failed_terminal", 0, false)]),
    [business],
  );
  add(
    "result-rejected-objects",
    "服务过滤无效关联",
    (x) => {
      const q = outcome("collection_tasks", "task_id"),
        valid = q.last_business_objects[0];
      q.last_business_objects = [
        { ...valid, href: "https://example.invalid/not-allowed" },
        { ...valid, type: "unrecognized_local_type" },
        { ...valid, id: "" },
        valid,
        { ...valid, id: "ignored-fifth-local" },
      ];
      assign(x, [q]);
    },
    [business],
  );
  add("restart-below", "重启次数低于门限", (x) => {
    x.supervisor.processes.worker.restart_count = 4;
  });
  add(
    "restart-at",
    "重启次数到达门限",
    (x) => {
      x.supervisor.processes.worker.restart_count = 5;
    },
    ["backend_restart_loop"],
  );
  add("queue-waiting", "等待尚未提升优先级", (x) =>
    assign(x, [queue("collection_tasks", { due: true, queue_delay_ms: 1 })]),
  );
  add("queue-aged", "等待优先级已提升", (x) =>
    assign(x, [
      queue("collection_tasks", { due: true, queue_delay_ms: 30000, effective_priority: 101 }),
    ]),
  );
  add("queue-starvation", "老化增益耗尽仍等待", (x) =>
    assign(x, [
      queue("collection_tasks", { due: true, queue_delay_ms: 3000001, effective_priority: 200 }),
    ]),
  );
  add("queue-zero-delay", "无延迟不判定饥饿", (x) =>
    assign(x, [
      queue("collection_tasks", { due: true, queue_delay_ms: 0, effective_priority: 200 }),
    ]),
  );
  add("queue-running", "运行中不判定饥饿", (x) =>
    assign(x, [
      queue("collection_tasks", {
        running: true,
        active_runs: 1,
        longest_running_ms: 10,
        effective_priority: 200,
      }),
    ]),
  );
  add(
    "combined-alerts",
    "八类告警共存",
    (x) => {
      const q = outcome("collection_tasks", "task_id");
      Object.assign(q, {
        due: true,
        queue_delay_ms: 1,
        last_failed_at: clock,
        consecutive_failures: 5,
      });
      assign(x, [
        q,
        queue("auth_delivery", {
          running: true,
          active_runs: 1,
          suspected_stuck: true,
          longest_running_ms: 120001,
        }),
        queue("notification_outbox", {
          circuit_state: "open",
          circuit_open_until: at(60000),
          consecutive_failures: 5,
        }),
      ]);
      x.worker.backpressure = true;
      x.worker.max_concurrency = 1;
      x.worker.failed_last_minute = 1;
      x.worker.completed_last_minute = 1;
      x.worker.failure_rate_percent = 100;
      x.worker.snapshot_publish_failed_total = 1;
      x.worker.last_snapshot_error = "local_snapshot_write_failed";
      x.worker.observed_at = at(-90001);
      x.supervisor.processes.worker.restart_count = 5;
    },
    [
      prefix + "heartbeat_stale",
      prefix + "backpressure",
      prefix + "recent_failures",
      prefix + "suspected_stuck",
      prefix + "queue_circuit_open",
      prefix + "snapshot_publish_failed",
      business,
      "backend_restart_loop",
    ],
    "stale",
  );
  const result = await topologyStateFixtures(
    specs.map((s) => [s.id, s.title, s.mutate, s.state, []]),
  );
  for (const [i, row] of result.cases.entries())
    assert.deepEqual(
      row.data.alerts.map((a) => a.code),
      specs[i].codes,
      row.id + " exact service alerts",
    );
  return { ...result, policies };
}
