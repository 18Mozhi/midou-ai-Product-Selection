import test from "node:test";
import assert from "node:assert/strict";
import { recoverExpiredCollectionTasks } from "../../apps/worker/dist/collection-task-dead-letter.js";

const now = new Date("2026-10-18T03:00:00Z");
const task = {
  id: "expired",
  organization_id: "org",
  workspace_id: "ws",
  status: "running",
  attempt_count: 1,
  request_id: "request",
  trace_id: "trace",
};
function harness({ candidate, locked, overflow = false, denyRangeLock = false }) {
  const calls = [],
    events = [];
  const c = {
    beginTransaction: async () => calls.push({ sql: "begin" }),
    commit: async () => calls.push({ sql: "commit" }),
    rollback: async () => calls.push({ sql: "rollback" }),
    release: () => calls.push({ sql: "release" }),
    query: async (sql, values) => {
      calls.push({ sql, values });
      if (sql.startsWith("SELECT * FROM collection_tasks")) {
        if (sql.includes("WHERE id=?")) return [locked ? [locked] : []];
        if (denyRangeLock)
          assert.doesNotMatch(sql, /FOR UPDATE/, "candidate scans must not acquire next-key locks");
        return [
          candidate && sql.includes(overflow ? "status='queued'" : "status IN ('leased','running')")
            ? [candidate]
            : [],
        ];
      }
      if (sql.startsWith("SELECT id FROM collection_task_attempts")) return [[{ id: "attempt" }]];
      return [{ affectedRows: 1 }];
    },
  };
  return {
    calls,
    events,
    context: {
      pool: { getConnection: async () => c },
      random: () => 0.5,
      taskId: undefined,
      event: async (...args) => events.push(args),
      outbox: async () => {},
    },
  };
}
test("empty expiry and overflow scans do not lock the task status ranges", async () => {
  const h = harness({ denyRangeLock: true });
  assert.equal(await recoverExpiredCollectionTasks(h.context, now), 0);
  assert.equal(h.calls.filter((c) => c.sql.includes("FOR UPDATE")).length, 0);
  assert.deepEqual(
    h.calls.slice(-2).map((c) => c.sql),
    ["commit", "release"],
  );
});
test("heartbeat renewal between discovery and primary lock prevents false timeout recovery", async () => {
  const h = harness({ candidate: task, locked: null });
  assert.equal(await recoverExpiredCollectionTasks(h.context, now), 0);
  assert.equal(h.calls.filter((c) => c.sql.startsWith("UPDATE")).length, 0);
  assert.equal(h.events.length, 0);
  const lock = h.calls.find((c) => c.sql.startsWith("SELECT * FROM collection_tasks WHERE id=?"));
  assert.match(lock.sql, /organization_id=\? AND workspace_id=\?/);
  assert.match(lock.sql, /lease_expires_at<=\? FOR UPDATE$/);
  assert.deepEqual(lock.values, [task.id, task.organization_id, task.workspace_id, now]);
});
test("expired task still follows the existing timeout state machine using the locked current attempt", async () => {
  const h = harness({ candidate: task, locked: { ...task, attempt_count: 4 } });
  assert.equal(await recoverExpiredCollectionTasks(h.context, now), 1);
  const write = h.calls.find((c) => c.sql.startsWith("UPDATE collection_tasks"));
  assert.equal(write.values[0], "dead_letter");
  assert.equal(write.values[2], "timeout");
  assert.equal(h.events[0][3], "dead_letter");
  assert.ok(h.calls.some((c) => c.sql.startsWith("INSERT INTO collection_dead_letters")));
});
test("overflow candidates changed by another writer are rechecked before quarantine", async () => {
  const h = harness({
    candidate: { ...task, status: "queued", attempt_count: 4 },
    locked: null,
    overflow: true,
  });
  assert.equal(await recoverExpiredCollectionTasks(h.context, now), 0);
  assert.equal(h.events.length, 0);
  assert.equal(h.calls.filter((c) => c.sql.startsWith("UPDATE")).length, 0);
});
