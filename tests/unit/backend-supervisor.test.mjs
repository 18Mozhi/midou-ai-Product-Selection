import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BackendSupervisor } from "../../apps/backend/dist/supervisor.js";

const waitFor = async (condition, timeoutMs = 10000) => {
  const startedAt = Date.now();
  while (!(await condition())) {
    if (Date.now() - startedAt > timeoutMs) throw new Error("condition_timeout");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

class FakeChild extends EventEmitter {
  constructor(pid) {
    super();
    this.pid = pid;
    this.exitCode = null;
    this.signals = [];
  }

  kill(signal) {
    this.signals.push(signal);
    queueMicrotask(() => {
      this.exitCode = 0;
      this.emit("exit", 0, signal);
    });
    return true;
  }
}

test("unified backend restarts an unexpectedly exited child", async () => {
  const children = [];
  const supervisor = new BackendSupervisor(
    [{ name: "api", entrypoint: "apps/api/dist/server.js" }],
    {
      restartDelayMs: 1,
      spawnProcess: () => {
        const child = new FakeChild(100 + children.length);
        children.push(child);
        return child;
      },
      readinessProbe: async () => true,
    },
  );

  supervisor.start();
  assert.equal(children.length, 1);
  children[0].exitCode = 1;
  children[0].emit("exit", 1, null);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(children.length, 2);
  await supervisor.stop("SIGTERM");
});

test("unified backend forwards graceful stop and does not restart children", async () => {
  const children = [];
  const supervisor = new BackendSupervisor(undefined, {
    restartDelayMs: 1,
    shutdownGraceMs: 50,
    spawnProcess: () => {
      const child = new FakeChild(200 + children.length);
      children.push(child);
      return child;
    },
    readinessProbe: async () => true,
  });

  supervisor.start();
  await waitFor(() => children.length === 2);
  await supervisor.stop("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(
    children.map((child) => child.signals),
    [["SIGTERM"], ["SIGTERM"]],
  );
  assert.equal(children.length, 2);
});

test("unified backend publishes ready only after the child readiness probe passes", async () => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-supervisor-ready-"));
  const stateFile = join(root, "state.json");
  let releaseReadiness = () => {};
  const readinessGate = new Promise((resolve) => {
    releaseReadiness = resolve;
  });
  const child = new FakeChild(301);
  const supervisor = new BackendSupervisor(
    [{ name: "api", entrypoint: "apps/api/dist/server.js" }],
    {
      stateFile,
      readinessPollMs: 2,
      readinessTimeoutMs: 10000,
      spawnProcess: () => child,
      readinessProbe: async () => readinessGate,
    },
  );
  try {
    supervisor.start();
    const startingSnapshot = JSON.parse(await readFile(stateFile, "utf8"));
    assert.equal(startingSnapshot.processes.api.status, "starting");
    assert.equal(startingSnapshot.status, "degraded");
    releaseReadiness(true);
    await waitFor(async () => JSON.parse(await readFile(stateFile, "utf8")).status === "ready");
    const snapshot = JSON.parse(await readFile(stateFile, "utf8"));
    assert.equal(snapshot.processes.api.status, "running");
    assert.match(snapshot.processes.api.ready_at, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    await supervisor.stop("SIGTERM");
    await rm(root, { recursive: true, force: true });
  }
});

test("unified backend restarts and exposes a failure when spawn throws", async () => {
  const children = [];
  let attempts = 0;
  const supervisor = new BackendSupervisor(
    [{ name: "worker", entrypoint: "apps/worker/dist/index.js" }],
    {
      restartDelayMs: 1,
      readinessPollMs: 1,
      spawnProcess: () => {
        attempts += 1;
        if (attempts === 1) throw new Error("spawn unavailable");
        const child = new FakeChild(400 + attempts);
        children.push(child);
        return child;
      },
      readinessProbe: async () => true,
    },
  );
  supervisor.start();
  await waitFor(() => attempts === 2);
  assert.equal(children.length, 1);
  await supervisor.stop("SIGTERM");
});

test("unified backend keeps supervising when the state file cannot be written", async () => {
  const root = await mkdtemp(join(tmpdir(), "scoutops-supervisor-state-"));
  const blockedParent = join(root, "not-a-directory");
  await writeFile(blockedParent, "blocked");
  const child = new FakeChild(501);
  const supervisor = new BackendSupervisor(
    [{ name: "api", entrypoint: "apps/api/dist/server.js" }],
    {
      stateFile: join(blockedParent, "state.json"),
      readinessProbe: async () => true,
      spawnProcess: () => child,
    },
  );
  try {
    assert.doesNotThrow(() => supervisor.start());
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(child.exitCode, null);
  } finally {
    await supervisor.stop("SIGTERM");
    await rm(root, { recursive: true, force: true });
  }
});

test("worker waits for API readiness even when listed before API", async () => {
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  const spawned = [];
  const supervisor = new BackendSupervisor(
    [
      { name: "worker", entrypoint: "apps/worker/dist/index.js" },
      { name: "api", entrypoint: "apps/api/dist/server.js" },
    ],
    {
      readinessProbe: async (m) => (m.name === "api" ? gate : true),
      spawnProcess: (_command, args) => {
        spawned.push(args[0]);
        return new FakeChild(800 + spawned.length);
      },
    },
  );
  try {
    supervisor.start();
    assert.equal(spawned.length, 1);
    assert.match(spawned[0], /api/);
    release(true);
    await waitFor(() => spawned.length === 2);
    assert.match(spawned[1], /worker/);
  } finally {
    release(true);
    await supervisor.stop("SIGTERM");
  }
});
test("shutdown during API readiness never starts the waiting worker", async () => {
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  let spawned = 0;
  const supervisor = new BackendSupervisor(undefined, {
    readinessProbe: async () => gate,
    spawnProcess: () => new FakeChild(900 + spawned++),
  });
  supervisor.start();
  assert.equal(spawned, 1);
  await supervisor.stop("SIGTERM");
  release(true);
  await new Promise((r) => setImmediate(r));
  assert.equal(spawned, 1);
});
test("API readiness failure leaves worker unstarted while API recovery is scheduled", async () => {
  const children = [];
  const supervisor = new BackendSupervisor(undefined, {
    readinessProbe: async () => false,
    readinessTimeoutMs: 2,
    readinessPollMs: 1,
    restartDelayMs: 1000,
    spawnProcess: () => {
      const c = new FakeChild(1000 + children.length);
      children.push(c);
      return c;
    },
  });
  try {
    supervisor.start();
    await waitFor(() => children[0].signals.includes("SIGTERM"));
    assert.equal(children.length, 1);
    assert.equal(supervisor.children.has("worker"), false);
  } finally {
    await supervisor.stop("SIGTERM");
  }
});
