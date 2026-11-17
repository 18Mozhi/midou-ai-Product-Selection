import assert from "node:assert/strict";
import test from "node:test";
import { QueueScheduler } from "../../apps/worker/dist/queue-scheduler.js";
import { workerQueue } from "../../apps/worker/dist/worker-queue-registry.js";

const cohort = ["competitor_monitor", "sourcing_projection", "report_exports", "automation_rules"];
const settle = () => new Promise(setImmediate);

test("scheduler rollback restores unstaggered first polls for the four queues", async () => {
  for (const tickMs of [250, 500]) {
    let now = 0;
    const starts = new Map();
    const scheduler = new QueueScheduler({ maxConcurrency: 6, tickMs, now: () => new Date(now) });
    for (const name of ["collection_tasks", "trend_projection", ...cohort]) {
      scheduler.register(workerQueue(name, 2000, async () => {
        if (!starts.has(name)) starts.set(name, now);
      }));
    }
    try {
      scheduler.start();
      clearInterval(scheduler.timer);
      await settle();
      for (; now < 2000;) {
        now += tickMs;
        await scheduler.tick();
        await settle();
      }
      assert.equal(starts.get("collection_tasks"), 0);
      assert.equal(starts.get("trend_projection"), 0);
      assert.deepEqual(cohort.map((name) => starts.get(name)), [0, 0, 0, 0]);
    } finally { await scheduler.stop(); }
  }
});

// De-identified per-queue observed 2s/5s/30s cadence and p50/p95 runtime
// from the d8bf8ce72 3-minute post-release sample. This is a synthetic replay,
// not a production traffic trace or a simulation of actual business jobs.
const fixture = {
  approval_escalation: [2000, 4, 18],
  auth_delivery: [5000, 4, 26],
  automatic_full_sources: [30000, 132, 369],
  automatic_rule_sources: [30000, 172, 341],
  automatic_selection_evaluation: [2000, 1427, 2592],
  automation_rules: [2000, 10, 133],
  business_task_projection: [2000, 13, 82],
  collection_tasks: [2000, 196, 504],
  competitor_monitor: [2000, 4, 21],
  core_collection_projection: [2000, 1261, 2363],
  notification_outbox: [2000, 4, 29],
  opportunity_profit: [2000, 3, 13],
  opportunity_refresh: [2000, 4, 19],
  opportunity_scoring: [2000, 4, 26],
  report_exports: [2000, 5, 30],
  sourcing_projection: [2000, 4, 19],
  trend_projection: [2000, 3222, 4893],
  webhook_deliveries: [2000, 4, 20],
};

async function replay(stagger, cadence, offset) {
  let now = 0;
  const pending = [];
  const starts = new Map();
  const scheduler = new QueueScheduler({ maxConcurrency: 4, tickMs: 250, now: () => new Date(now) });
  for (const [name, [interval, typical, high]] of Object.entries(fixture)) {
    const queue = workerQueue(name, interval, () => new Promise((resolve) => {
      const previous = starts.get(name) ?? [];
      const gap = previous.length ? now - previous.at(-1) : interval;
      assert.ok(gap >= interval, `${name} polled early: ${gap} < ${interval}`);
      previous.push(now);
      starts.set(name, previous);
      const ms = (previous.length + offset + name.length) % cadence === 0 ? high : typical;
      pending.push({ at: now + ms, resolve });
    }));
    if (!stagger) delete queue.pollStaggerSlot;
    scheduler.register(queue);
  }
  const stats = { pressure: 0, collisions: 0, maxActive: 0, gapP95Ms: 0, maxGapMs: 0, completed: {}, failed: 0 };
  try {
    scheduler.start();
    clearInterval(scheduler.timer);
    for (now = 25; now <= 180_000; now += 25) {
      for (let i = pending.length - 1; i >= 0; i--) {
        if (pending[i].at <= now) pending.splice(i, 1)[0].resolve();
      }
      await settle();
      if (now % 250 !== 0) continue;
      const snapshot = scheduler.snapshot();
      if (now >= 10_000) {
        const peersDue = snapshot.queues.filter((q) => q.due && cohort.includes(q.name)).length;
        stats.pressure += Number(snapshot.backpressure);
        stats.collisions += Number(peersDue >= 2);
        stats.maxActive = Math.max(stats.maxActive, snapshot.active_runs);
      }
      await scheduler.tick();
    }
    const snapshot = scheduler.snapshot();
    stats.completed = Object.fromEntries(snapshot.queues.map((q) => [q.name, q.completed_total]));
    stats.failed = snapshot.failed_total;
    const excess = cohort.flatMap((name) => {
      const times = starts.get(name);
      return times.slice(1).map((at, i) => at - times[i] - fixture[name][0]);
    }).sort((a, b) => a - b);
    stats.gapP95Ms = excess[Math.ceil(excess.length * 0.95) - 1];
    stats.maxGapMs = excess.at(-1);
    return stats;
  } finally {
    for (const item of pending) item.resolve();
    await scheduler.stop();
  }
}

test("local rollback restores both no-stagger replay baselines at four slots", async (t) => {
  for (const [cadence, offset, pressure, maxGapMs] of [[5, 0, 642, 8500], [3, 2, 625, 8250]]) {
    const actual = await replay(true, cadence, offset);
    t.diagnostic(JSON.stringify({ cadence, offset, actual }));
    assert.equal(actual.failed, 0);
    assert.equal(actual.maxActive, 4);
    assert.equal(actual.pressure, pressure);
    assert.equal(actual.maxGapMs, maxGapMs);
  }
});
