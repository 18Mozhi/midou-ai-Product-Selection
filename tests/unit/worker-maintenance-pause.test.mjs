import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as module from "../../apps/worker/dist/queue-scheduler.js";
const { QueueScheduler, createWorkerMaintenancePause } = module;
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("maintenance pauses dispatch but lets real active runs settle and heartbeat advance", async () => {
  let paused = false,
    now = 1000,
    calls = 0,
    release;
  const activeSignals = [],
    snapshots = [];
  const gate = new Promise((resolve) => (release = resolve));
  const scheduler = new QueueScheduler({
    maxConcurrency: 2,
    tickMs: 60000,
    now: () => new Date(now),
    dispatchPaused: () => paused,
    onSnapshot: (snapshot) => {
      snapshots.push(snapshot);
    },
  });
  for (const name of ["collection_tasks", "trend_projection"])
    scheduler.register({
      name,
      intervalMs: 100,
      priority: 10,
      maxConcurrency: 1,
      timeoutMs: 5000,
      maxRetries: 0,
      circuitFailureThreshold: 5,
      circuitCooldownMs: 1000,
      stuckAfterMs: 4000,
      run: async (signal) => {
        calls++;
        activeSignals.push(signal);
        if (calls <= 2) await gate;
      },
    });
  try {
    scheduler.start();
    await settle();
    assert.equal(calls, 2);
    assert.equal(scheduler.snapshot().active_runs, 2);
    paused = true;
    now += 200;
    await scheduler.tick();
    assert.equal(scheduler.snapshot().active_runs, 2);
    assert.ok(activeSignals.every((s) => !s.aborted));
    release();
    await settle();
    for (let i = 0; i < 4; i++) {
      now += 2000;
      await scheduler.tick();
      assert.equal(scheduler.snapshot().active_runs, 0);
      assert.equal(calls, 2);
    }
    assert.ok(new Set(snapshots.map((s) => s.observed_at)).size >= 4);
    assert.equal(scheduler.snapshot().status, "running");
    paused = false;
    now += 100;
    await scheduler.tick();
    await settle();
    assert.equal(calls, 4);
    assert.equal(scheduler.snapshot().max_concurrency, 2);
  } finally {
    release();
    await scheduler.stop();
  }
});

test("maintenance file presence and unreadable state fail closed; only absence resumes", async () => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-worker-pause-"));
  try {
    const path = join(root, "pause");
    const paused = createWorkerMaintenancePause(path);
    assert.equal(paused(), false);
    await writeFile(path, "not even valid JSON");
    assert.equal(paused(), true);
    await rm(path);
    assert.equal(paused(), false);
    assert.equal(
      createWorkerMaintenancePause(path, () => {
        throw Object.assign(new Error(), { code: "EACCES" });
      })(),
      true,
    );
    assert.equal(
      createWorkerMaintenancePause(path, () => {
        throw new Error("unknown");
      })(),
      true,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
