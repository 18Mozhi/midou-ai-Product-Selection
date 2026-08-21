import assert from "node:assert/strict";
import test from "node:test";

const waitFor = async (condition, timeoutMs = 1000) => {
  const startedAt = Date.now();
  while (!condition()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("condition_timeout");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

test("统一调度器按优先级执行并在达到并发配额时报告背压", async () => {
  const { QueueScheduler } = await import("../../apps/worker/dist/queue-scheduler.js");
  const events = [];
  let releaseHigh;
  const highGate = new Promise((resolve) => {
    releaseHigh = resolve;
  });
  const scheduler = new QueueScheduler({ maxConcurrency: 1, tickMs: 5 });
  scheduler
    .register({
      name: "low",
      priority: 10,
      intervalMs: 10_000,
      run: async () => events.push("low"),
    })
    .register({
      name: "high",
      priority: 100,
      intervalMs: 10_000,
      run: async () => {
        events.push("high");
        await highGate;
      },
    });

  scheduler.start();
  await waitFor(() => events.length === 1);
  assert.deepEqual(events, ["high"]);
  assert.equal(scheduler.snapshot().backpressure, true);
  assert.equal(scheduler.snapshot().due_queue_count, 1);

  releaseHigh();
  await waitFor(() => events.length === 2);
  assert.deepEqual(events, ["high", "low"]);
  assert.ok(scheduler.snapshot().queues.find((queue) => queue.name === "low").deferred_total > 0);
  await scheduler.stop();
  assert.equal(scheduler.snapshot().status, "stopped");
});

test("统一调度器记录最近一分钟失败率且不泄露任务载荷", async () => {
  const { QueueScheduler } = await import("../../apps/worker/dist/queue-scheduler.js");
  const scheduler = new QueueScheduler({ maxConcurrency: 2, tickMs: 5 });
  scheduler.register({
    name: "failing",
    priority: 50,
    intervalMs: 10_000,
    run: async () => {
      throw new Error("dependency unavailable");
    },
  });
  scheduler.start();
  await waitFor(() => scheduler.snapshot().failed_total === 1);
  const snapshot = scheduler.snapshot();
  assert.equal(snapshot.failed_last_minute, 1);
  assert.equal(snapshot.failure_rate_percent, 100);
  assert.doesNotMatch(JSON.stringify(snapshot), /cookie|token|payload/i);
  await scheduler.stop();
});

test("队列级重试成功后不篡改最终任务结果", async () => {
  const { QueueScheduler } = await import("../../apps/worker/dist/queue-scheduler.js");
  let attempts = 0;
  const scheduler = new QueueScheduler({ maxConcurrency: 1, tickMs: 5 });
  scheduler.register({
    name: "retrying",
    priority: 50,
    intervalMs: 10_000,
    timeoutMs: 1000,
    maxRetries: 2,
    retryDelayMs: 1,
    run: async (_signal, context) => {
      attempts += 1;
      assert.equal(context.max_attempts, 3);
      if (attempts === 1) throw new Error("temporary dependency failure");
    },
  });
  scheduler.start();
  await waitFor(() => scheduler.snapshot().completed_total === 1);
  const snapshot = scheduler.snapshot();
  assert.equal(attempts, 2);
  assert.equal(snapshot.retry_total, 1);
  assert.equal(snapshot.failed_total, 0);
  assert.equal(snapshot.queues[0].consecutive_failures, 0);
  await scheduler.stop();
});

test("连续超时触发队列级熔断并暴露运行策略", async () => {
  const { QueueScheduler } = await import("../../apps/worker/dist/queue-scheduler.js");
  const scheduler = new QueueScheduler({ maxConcurrency: 1, tickMs: 5 });
  scheduler.register({
    name: "timed",
    priority: 50,
    intervalMs: 1,
    maxConcurrency: 1,
    timeoutMs: 15,
    maxRetries: 0,
    circuitFailureThreshold: 2,
    circuitCooldownMs: 10_000,
    stuckAfterMs: 10,
    run: (signal) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
      ),
  });
  scheduler.start();
  await waitFor(() => scheduler.snapshot().timed_out_total === 2);
  const queue = scheduler.snapshot().queues[0];
  assert.equal(queue.timeout_ms, 15);
  assert.equal(queue.max_concurrency, 1);
  assert.equal(queue.timed_out_total, 2);
  assert.equal(queue.circuit_state, "open");
  assert.equal(queue.consecutive_failures, 2);
  await scheduler.stop();
});

test("停机向活动任务传递取消信号", async () => {
  const { QueueScheduler } = await import("../../apps/worker/dist/queue-scheduler.js");
  let receivedAbort = false;
  const scheduler = new QueueScheduler({ maxConcurrency: 1, tickMs: 5 });
  scheduler.register({
    name: "cancellable",
    priority: 50,
    intervalMs: 10_000,
    timeoutMs: 10_000,
    run: (signal) =>
      new Promise((_, reject) =>
        signal.addEventListener(
          "abort",
          () => {
            receivedAbort = true;
            reject(signal.reason);
          },
          { once: true },
        ),
      ),
  });
  scheduler.start();
  await waitFor(() => scheduler.snapshot().active_runs === 1);
  await scheduler.stop();
  assert.equal(receivedAbort, true);
  assert.equal(scheduler.snapshot().cancelled_total, 1);
  assert.equal(scheduler.snapshot().failed_total, 0);
});

test("快照写入失败与任务完成计数隔离", async () => {
  const { QueueScheduler } = await import("../../apps/worker/dist/queue-scheduler.js");
  const scheduler = new QueueScheduler({
    maxConcurrency: 1,
    tickMs: 5,
    onSnapshot: async () => {
      throw new Error("state disk unavailable");
    },
  });
  scheduler.register({
    name: "snapshot-isolated",
    priority: 50,
    intervalMs: 10_000,
    run: async () => undefined,
  });
  scheduler.start();
  await waitFor(() => scheduler.snapshot().completed_total === 1);
  const snapshot = scheduler.snapshot();
  assert.equal(snapshot.failed_total, 0);
  assert.ok(snapshot.snapshot_publish_failed_total > 0);
  assert.equal(snapshot.last_snapshot_error, "snapshot_publish_failed");
  await scheduler.stop();
});

test("等待老化让低优先级队列最终获得执行机会", async () => {
  const { QueueScheduler } = await import("../../apps/worker/dist/queue-scheduler.js");
  let nowMs = Date.parse("2026-08-21T10:00:00.000Z");
  let releaseHigh;
  const highGate = new Promise((resolve) => {
    releaseHigh = resolve;
  });
  const events = [];
  const scheduler = new QueueScheduler({
    maxConcurrency: 1,
    tickMs: 5,
    now: () => new Date(nowMs),
  });
  scheduler
    .register({
      name: "low-aged",
      priority: 1,
      intervalMs: 1,
      agingIntervalMs: 1,
      maximumAgingBoost: 100,
      run: async () => events.push("low"),
    })
    .register({
      name: "high-fresh",
      priority: 50,
      intervalMs: 1,
      agingIntervalMs: 1000,
      run: async () => {
        events.push("high");
        await highGate;
      },
    });
  scheduler.start();
  await waitFor(() => events.length === 1);
  nowMs += 60;
  releaseHigh();
  await waitFor(() => events.length === 2);
  assert.deepEqual(events, ["high", "low"]);
  await scheduler.stop();
});

test("业务可用性区分调度告警与过期心跳", async () => {
  const { RuntimeTopologyService } =
    await import("../../apps/api/dist/runtime-topology-service.js");
  const now = new Date("2026-08-19T10:00:00.000Z");
  const repository = {
    snapshot: async () => ({
      nodes: [
        {
          nodeId: "api-primary",
          hostId: "huizhou-single-host",
          role: "api",
          status: "ready",
          lastHeartbeatAt: now,
        },
      ],
    }),
    recordView: async () => {},
    heartbeat: async () => {},
  };
  const schedulerSnapshot = {
    status: "running",
    max_concurrency: 4,
    active_runs: 4,
    due_queue_count: 2,
    backpressure: true,
    max_queue_delay_ms: 1200,
    completed_last_minute: 10,
    failed_last_minute: 1,
    failure_rate_percent: 10,
    queues: [],
    observed_at: now.toISOString(),
  };
  const service = new RuntimeTopologyService(
    repository,
    {
      expectedNodeId: "api-primary",
      expectedHostId: "huizhou-single-host",
      staleAfterMs: 90_000,
      workerSchedulerStaleAfterMs: 90_000,
      workerSchedulerSnapshot: async () => schedulerSnapshot,
    },
    () => now,
  );
  const operational = await service.read({
    actorId: "actor",
    requestId: "request",
    traceId: "trace",
  });
  assert.deepEqual(
    operational.alerts.map((alert) => alert.code),
    ["worker_scheduler_backpressure", "worker_scheduler_recent_failures"],
  );
  assert.equal((await service.businessHealth()).status, "degraded");

  schedulerSnapshot.observed_at = new Date(now.getTime() - 90_001).toISOString();
  assert.equal((await service.businessHealth()).status, "unavailable");
  assert.equal((await service.publicHealth()).state, "ready");
});

test("运行拓扑统一收敛卡死、队列熔断与快照异常", async () => {
  const { RuntimeTopologyService } =
    await import("../../apps/api/dist/runtime-topology-service.js");
  const now = new Date("2026-08-21T10:00:00.000Z");
  const service = new RuntimeTopologyService(
    {
      snapshot: async () => ({
        nodes: [
          {
            nodeId: "api-primary",
            hostId: "huizhou-single-host",
            role: "api",
            status: "ready",
            lastHeartbeatAt: now,
          },
        ],
      }),
      recordView: async () => {},
      heartbeat: async () => {},
    },
    {
      expectedNodeId: "api-primary",
      expectedHostId: "huizhou-single-host",
      staleAfterMs: 90_000,
      workerSchedulerStaleAfterMs: 90_000,
      workerSchedulerSnapshot: async () => ({
        status: "running",
        max_concurrency: 4,
        active_runs: 1,
        due_queue_count: 0,
        backpressure: false,
        max_queue_delay_ms: 0,
        suspected_stuck_runs: 1,
        snapshot_publish_failed_total: 2,
        last_snapshot_error: "state disk unavailable",
        completed_last_minute: 1,
        failed_last_minute: 0,
        failure_rate_percent: 0,
        queues: [
          {
            name: "collection_tasks",
            priority: 100,
            running: true,
            queue_delay_ms: 0,
            failed_total: 2,
            deferred_total: 0,
            suspected_stuck: true,
            circuit_state: "open",
          },
        ],
        observed_at: now.toISOString(),
      }),
    },
    () => now,
  );
  const result = await service.read({
    actorId: "actor",
    requestId: "request",
    traceId: "trace",
  });
  assert.deepEqual(
    result.alerts.map((item) => item.code),
    [
      "worker_scheduler_suspected_stuck",
      "worker_scheduler_queue_circuit_open",
      "worker_scheduler_snapshot_publish_failed",
    ],
  );
  assert.equal((await service.businessHealth()).status, "unavailable");
});

test("业务可用性端点独立于存活和依赖就绪端点", async () => {
  const { buildApp } = await import("../../apps/api/dist/app.js");
  const app = buildApp({
    runtimeTopology: {
      service: {
        businessHealth: async () => ({
          status: "unavailable",
          services: { api: "available", worker: "unavailable" },
          observed_at: "2026-08-19T10:00:00.000Z",
        }),
      },
      authorization: {},
      auth: {},
      secureCookie: false,
    },
  });
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/health/available",
    headers: { "x-request-id": "business-health" },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().data.status, "unavailable");
  assert.equal(response.json().data.services.api, "available");
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.headers["x-request-id"], "business-health");
  await app.close();
});
