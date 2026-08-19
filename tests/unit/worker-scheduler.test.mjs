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
  const { QueueScheduler } = await import(
    "../../apps/worker/dist/queue-scheduler.js"
  );
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
  const { QueueScheduler } = await import(
    "../../apps/worker/dist/queue-scheduler.js"
  );
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

test("业务可用性区分调度告警与过期心跳", async () => {
  const { RuntimeTopologyService } = await import(
    "../../apps/api/dist/runtime-topology-service.js"
  );
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
