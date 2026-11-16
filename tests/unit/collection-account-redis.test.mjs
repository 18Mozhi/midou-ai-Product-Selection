import test from "node:test";
import assert from "node:assert/strict";
import { ScopedRedisCollectionCoordinator } from "../../apps/worker/dist/collection-task-worker.js";
import { ScopedRedisStore, inspectRedisKeyspaceHotspots } from "../../packages/redis/dist/index.js";

test("sealed account Redis signal and token-checked lease never touch the former scope", async () => {
  const keys = new Map();
  const calls = [];
  const redis = {
    set: async (key, value, flags) => {
      calls.push([key, flags]);
      if (flags.NX && keys.has(key)) return null;
      keys.set(key, value);
      return "OK";
    },
    eval: async (script, { keys: [key], arguments: [token] }) => {
      assert.match(script, /GET.*ARGV.*DEL/);
      if (keys.get(key) !== token) return 0;
      return Number(keys.delete(key));
    },
  };
  const coordinator = new ScopedRedisCollectionCoordinator(new ScopedRedisStore(redis));
  const task = { id: "task:one", accountId: "owner:one", organizationId: "old-org",
    workspaceId: "old-space", requestId: "request", traceId: "trace", leaseToken: "token" };
  const lease = "scoutops:v1:queue:account:owner%3Aone:collection-task:task%3Aone";
  const signal = "scoutops:v1:queue:account:owner%3Aone:collection-ready:task%3Aone";
  await coordinator.signal(task);
  assert.equal(await coordinator.acquire(task, 120), true);
  assert.equal(await coordinator.acquire({...task, leaseToken: "wrong"}, 120), false);
  await coordinator.release({...task, leaseToken: "wrong"});
  assert.equal(keys.get(lease), "token");
  assert.equal(await coordinator.acquire({...task, accountId: "different-owner"}, 120), true);
  await coordinator.release({...task, organizationId: "changed", workspaceId: "changed"});
  assert.equal(keys.has(lease), false);
  assert.equal(keys.size, 2);
  assert.deepEqual(calls.slice(0, 2), [[signal, { EX: 86400 }], [lease, { EX: 120, NX: true }]]);
  assert.deepEqual(JSON.parse(keys.get(signal)), {task_id: "task:one", request_id: "request", trace_id: "trace"});
  assert.ok(calls.every(([key]) => !key.includes("old-org") && !key.includes("old-space")));
  await assert.rejects(coordinator.signal({...task, accountId: ""}), {code:"invalid_key_segment"});
});

test("sampling covers both account queue buckets without returning key identities", async () => {
  const sample = await inspectRedisKeyspaceHotspots({
    scan: async () => ({ cursor: "0", keys: [
      "scoutops:v1:queue:account:private-account:collection-task:private-task",
      "scoutops:v1:queue:account:private-account:collection-ready:private-task",
      "scoutops:v1:queue:account:private-account:unrecognized:private-task",
    ] }),
    memoryUsage: async () => 80,
  });
  assert.equal(sample.measured_keys, 2);
  assert.equal(sample.ignored_keys, 1);
  assert.deepEqual(sample.hotspots.map((bucket) => bucket.resource).sort(), ["collection_ready", "collection_task"]);
  assert.doesNotMatch(JSON.stringify(sample), /private-account|private-task/);
});
